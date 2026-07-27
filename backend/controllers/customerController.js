const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Inquiry = require('../models/Inquiry');
const Project = require('../models/Project');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { normalizeContacts } = require('../utils/customerUniversal');
const { userHasPermission } = require('../utils/accessControl');
const { CUSTOMER_PERMISSIONS } = require('../constants/permissions');


const customerPopulate = { path: 'createdBy', select: 'name role' };

const populateCustomer = (query) => query.populate(customerPopulate);

const resolveCreatedBy = async (createdBy, fallbackUserId) => {
  const selectedUserId = createdBy || fallbackUserId;

  if (!selectedUserId) return null;

  if (!mongoose.Types.ObjectId.isValid(selectedUserId)) {
    const error = new Error('Created by employee is invalid');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ _id: selectedUserId, isActive: { $ne: false } }).select('_id');
  if (!user) {
    const error = new Error('Created by employee not found');
    error.statusCode = 400;
    throw error;
  }

  return user._id;
};

const sanitizeCustomerPayload = (body = {}) => {
  const payload = { ...body };

  if (!payload.customerName && payload.companyName) {
    payload.customerName = payload.companyName;
  }

  const contacts = normalizeContacts(payload);
  if (contacts.length > 0) {
    payload.contacts = contacts;
    payload.contactPerson = contacts[0].name || payload.contactPerson || '';
    payload.mobileNumber = contacts[0].phone || payload.mobileNumber || '';
    payload.email = contacts[0].email || payload.email || '';
  } else if (Array.isArray(payload.contacts)) {
    payload.contacts = [];
  }

  if (payload.address === undefined && payload.siteAddress !== undefined) {
    payload.address = payload.siteAddress;
  }

  delete payload.companyName;
  delete payload.siteAddress;
  delete payload.customCompanyType;
  return payload;
};

const validateRequiredCustomerContact = (source = {}) => {
  const contacts = normalizeContacts(source);
  const primary = contacts[0] || {};

  if (!String(primary.name || '').trim()) {
    const error = new Error('Primary contact name is required');
    error.statusCode = 400;
    throw error;
  }

  if (!String(primary.phone || '').trim()) {
    const error = new Error('Primary contact mobile number is required');
    error.statusCode = 400;
    throw error;
  }
};

const propagateCustomerMaster = async (customer) => {
  if (!customer?._id) return;

  const sharedUpdate = {
    customerName: customer.customerName,
    companyType: customer.companyType || '',
    contacts: Array.isArray(customer.contacts) ? customer.contacts : [],
    contactPerson: customer.contactPerson || '',
    mobileNumber: customer.mobileNumber || '',
    email: customer.email || '',
    city: customer.city || '',
    siteAddress: customer.address || '',
  };

  const ticketUpdate = {};
  if (customer.contactPerson !== undefined) ticketUpdate.contactPerson = customer.contactPerson || '';
  if (customer.mobileNumber !== undefined) ticketUpdate.contactNumber = customer.mobileNumber || '';

  await Promise.all([
    Inquiry.updateMany({ customerRef: customer._id }, { $set: sharedUpdate, $unset: { companyName: '' } }),
    Project.updateMany({ customerRef: customer._id }, { $set: { customerName: customer.customerName }, $unset: { companyName: '' } }),
    Object.keys(ticketUpdate).length
      ? Ticket.updateMany({ customer: customer._id }, { $set: ticketUpdate })
      : Promise.resolve(),
  ]);
};

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res, next) => {
  try {
    const { search } = req.query;
    const parsedPage = Math.max(Number(req.query.page) || 1, 1);
    const parsedLimit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 1000);

    const query = {};
    const keyword = String(search || '').trim();

    if (keyword) {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedKeyword, 'i');

      query.$or = [
        { customerId: searchRegex },
        { customerName: searchRegex },
        { companyType: searchRegex },
        { companyName: searchRegex },
        { contactPerson: searchRegex },
        { mobileNumber: searchRegex },
        { email: searchRegex },
        { 'contacts.name': searchRegex },
        { 'contacts.phone': searchRegex },
        { 'contacts.email': searchRegex },
        { city: searchRegex },
        { gstNumber: searchRegex },
      ];
    }

    const skip = (parsedPage - 1) * parsedLimit;

    const [customers, total] = await Promise.all([
      populateCustomer(Customer.find(query))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
      Customer.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: customers,
      pagination: {
        total,
        page: parsedPage,
        pages: Math.ceil(total / parsedLimit) || 1,
        limit: parsedLimit,
      },
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Get saved customer cities
// @route   GET /api/customers/cities
// @access  Private
const getCustomerCities = async (req, res, next) => {
  try {
    const rawCities = await Customer.distinct('city', {
      city: { $exists: true, $nin: [null, ''] },
    });

    const cityMap = new Map();
    rawCities.forEach((value) => {
      const city = String(value || '').trim();
      if (!city) return;

      const key = city.toLowerCase();
      if (!cityMap.has(key)) cityMap.set(key, city);
    });

    const cities = Array.from(cityMap.values()).sort((a, b) => a.localeCompare(b));
    res.json({ success: true, data: cities });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single customer with history
// @route   GET /api/customers/:id
// @access  Private
const getCustomer = async (req, res, next) => {
  try {
    const customer = await populateCustomer(Customer.findById(req.params.id));

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const legacyNameQuery = customer.customerName
      ? { customerName: customer.customerName, customerRef: { $exists: false } }
      : null;

    const [inquiries, projects, tickets] = await Promise.all([
      Inquiry.find({
        $or: [
          { customerRef: customer._id },
          ...(legacyNameQuery ? [legacyNameQuery] : []),
        ],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('inquiryId customerRef customerName status productType estimatedValue createdAt'),
      Project.find({
        $or: [
          { customerRef: customer._id },
          ...(legacyNameQuery ? [legacyNameQuery] : []),
        ],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('projectId customerRef customerName projectName projectStatus orderValue createdAt'),
      Ticket.find({ customer: customer._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('ticketId title status priority createdAt'),
    ]);

    res.json({
      success: true,
      data: { customer, inquiries, projects, tickets },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res, next) => {
  try {
    const payload = sanitizeCustomerPayload(req.body);
    validateRequiredCustomerContact(payload);
    payload.createdBy = await resolveCreatedBy(payload.createdBy, req.user._id);

    const customer = await Customer.create(payload);
    const populatedCustomer = await populateCustomer(Customer.findById(customer._id));

    res.status(201).json({ success: true, data: populatedCustomer });
  } catch (error) {
    next(error);
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res, next) => {
  try {
    const existingCustomer = await Customer.findById(req.params.id);

    if (!existingCustomer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const hasGeneralEditAccess = userHasPermission(req.user, CUSTOMER_PERMISSIONS.EDIT);
    const isCustomerCreator = Boolean(
      existingCustomer.createdBy &&
      req.user?._id &&
      existingCustomer.createdBy.toString() === req.user._id.toString()
    );

    if (!hasGeneralEditAccess && !isCustomerCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only users with Customer Edit access or the customer creator can edit this customer',
      });
    }

    const payload = sanitizeCustomerPayload(req.body);

    // A creator who does not have general Customer Edit access may update the
    // customer details, but cannot transfer ownership to another employee.
    if (!hasGeneralEditAccess) {
      delete payload.createdBy;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'createdBy')) {
      payload.createdBy = await resolveCreatedBy(payload.createdBy, req.user._id);
    }

    validateRequiredCustomerContact({
      ...existingCustomer.toObject(),
      ...payload,
    });

    const customer = await populateCustomer(Customer.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    }));

    await propagateCustomerMaster(customer);

    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCustomers, getCustomerCities, getCustomer, createCustomer, updateCustomer };