const mongoose = require('mongoose');
const Customer = require('../models/Customer');

const toText = (value) => String(value || '').trim();
const escapeRegex = (value) => toText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isValidObjectId = (value) => value && mongoose.Types.ObjectId.isValid(String(value));

const firstNonEmpty = (...values) => values.map(toText).find(Boolean) || '';

const normalizeContacts = (source = {}) => {
  const rawContacts = Array.isArray(source.contacts) ? source.contacts : [];
  const contacts = rawContacts
    .map((contact = {}) => ({
      name: firstNonEmpty(contact.name, contact.contactPerson),
      phone: firstNonEmpty(contact.phone, contact.mobileNumber, contact.contactNumber),
      email: firstNonEmpty(contact.email).toLowerCase(),
      designation: firstNonEmpty(contact.designation),
    }))
    .filter((contact) => contact.name || contact.phone || contact.email || contact.designation);

  if (contacts.length) return contacts;

  const fallback = {
    name: firstNonEmpty(source.contactPerson),
    phone: firstNonEmpty(source.mobileNumber, source.contactNumber),
    email: firstNonEmpty(source.email).toLowerCase(),
    designation: firstNonEmpty(source.designation),
  };

  return fallback.name || fallback.phone || fallback.email || fallback.designation ? [fallback] : [];
};

const getPrimaryContact = (source = {}) => {
  const contacts = normalizeContacts(source);
  const primary = contacts[0] || {};

  return {
    name: firstNonEmpty(primary.name, source.contactPerson),
    phone: firstNonEmpty(primary.phone, source.mobileNumber, source.contactNumber),
    email: firstNonEmpty(primary.email, source.email).toLowerCase(),
    designation: firstNonEmpty(primary.designation, source.designation),
  };
};

const buildCustomerPayload = (source = {}, userId) => {
  const contacts = normalizeContacts(source);
  const primary = getPrimaryContact({ ...source, contacts });
  const customerName = firstNonEmpty(
    source.customerName,
    source.customer?.customerName,
    source.customerRef?.customerName,
    // Legacy fallback only. New UI/backend writes customerName only.
    source.companyName,
    source.customer?.companyName,
    source.customerRef?.companyName
  );

  return {
    customerName,
    companyType: firstNonEmpty(source.companyType, source.customer?.companyType, source.customerRef?.companyType),
    contacts,
    contactPerson: primary.name,
    mobileNumber: primary.phone,
    email: primary.email,
    city: firstNonEmpty(source.city, source.location, source.customer?.city, source.customerRef?.city),
    address: firstNonEmpty(source.address, source.siteAddress, source.location, source.customer?.address, source.customerRef?.address),
    gstNumber: firstNonEmpty(source.gstNumber, source.gst, source.customer?.gstNumber, source.customerRef?.gstNumber),
    notes: firstNonEmpty(source.notes, source.customer?.notes, source.customerRef?.notes),
    createdBy: userId,
  };
};

const compactUpdate = (payload = {}) => {
  const update = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) update[key] = value;
      return;
    }

    const text = typeof value === 'string' ? value.trim() : value;
    if (text !== undefined && text !== null && text !== '') {
      update[key] = text;
    }
  });
  delete update.createdBy;
  return update;
};

const buildCustomerLookup = ({ customerId, payload }) => {
  if (isValidObjectId(customerId)) return { _id: customerId };

  const or = [];
  if (payload.email) or.push({ email: payload.email.toLowerCase() });
  if (payload.mobileNumber) or.push({ mobileNumber: payload.mobileNumber });
  if (payload.customerName) {
    or.push({ customerName: new RegExp(`^${escapeRegex(payload.customerName)}$`, 'i') });
    // Legacy fallback so old Customer records created with companyName can still be linked.
    or.push({ companyName: new RegExp(`^${escapeRegex(payload.customerName)}$`, 'i') });
  }

  return or.length ? { $or: or } : null;
};

const extractCustomerId = (source = {}) => {
  const candidate = source.customerRef || source.customer || source.customerId;
  if (!candidate) return undefined;
  if (typeof candidate === 'object') return candidate._id || candidate.id;
  return candidate;
};

async function resolveUniversalCustomer(source = {}, userId, options = {}) {
  const {
    createIfMissing = true,
    updateExisting = true,
  } = options;

  const payload = buildCustomerPayload(source, userId);
  const explicitCustomerId = extractCustomerId(source);
  const lookup = buildCustomerLookup({ customerId: explicitCustomerId, payload });

  let customer = lookup ? await Customer.findOne(lookup) : null;

  if (customer && updateExisting) {
    const update = compactUpdate(payload);
    // New customer master has one universal name field only.
    // Clear legacy companyName if it exists in older records.
    update.companyName = '';
    if (Object.keys(update).length > 0) {
      customer = await Customer.findByIdAndUpdate(customer._id, { $set: update }, { new: true });
    }
  }

  if (!customer && createIfMissing && payload.customerName) {
    customer = await Customer.create({
      ...compactUpdate(payload),
      companyName: '',
      createdBy: payload.createdBy,
    });
  }

  return customer;
}

function applyCustomerToPayload(target = {}, customer) {
  if (!customer) return target;
  const c = typeof customer.toObject === 'function' ? customer.toObject() : customer;

  target.customerRef = c._id;
  target.customerName = c.customerName || target.customerName;
  delete target.companyName;

  if ('companyType' in target || c.companyType) target.companyType = c.companyType || target.companyType;
  if (Array.isArray(c.contacts) && c.contacts.length) target.contacts = c.contacts;
  if ('contactPerson' in target || c.contactPerson) target.contactPerson = c.contactPerson || target.contactPerson;
  if ('mobileNumber' in target || c.mobileNumber) target.mobileNumber = c.mobileNumber || target.mobileNumber;
  if ('email' in target || c.email) target.email = c.email || target.email;
  if ('city' in target || c.city) target.city = c.city || target.city;
  if ('siteAddress' in target || c.address) target.siteAddress = c.address || target.siteAddress;

  return target;
}

function getLiveCustomerSnapshot(record = {}) {
  const customer = record.customerRef || record.customer;
  if (!customer || typeof customer !== 'object') {
    const fallbackName = record.customerName || record.companyName || '';
    return {
      ...record,
      customerName: fallbackName,
      companyName: undefined,
    };
  }

  return {
    ...record,
    liveCustomer: customer,
    customerName: customer.customerName || record.customerName || record.companyName,
    companyName: undefined,
    companyType: customer.companyType || record.companyType,
    contacts: Array.isArray(customer.contacts) && customer.contacts.length ? customer.contacts : record.contacts,
    contactPerson: customer.contactPerson || record.contactPerson,
    mobileNumber: customer.mobileNumber || record.mobileNumber,
    email: customer.email || record.email,
    city: customer.city || record.city,
    siteAddress: customer.address || record.siteAddress,
  };
}

async function findCustomerIdsForSearch(search) {
  const keyword = toText(search);
  if (!keyword) return [];

  const regex = new RegExp(escapeRegex(keyword), 'i');
  const customers = await Customer.find({
    $or: [
      { customerId: regex },
      { customerName: regex },
      // Legacy fallback only.
      { companyName: regex },
      { companyType: regex },
      { contactPerson: regex },
      { mobileNumber: regex },
      { email: regex },
      { 'contacts.name': regex },
      { 'contacts.phone': regex },
      { 'contacts.email': regex },
      { city: regex },
    ],
  }).select('_id').lean();

  return customers.map((customer) => customer._id);
}

module.exports = {
  applyCustomerToPayload,
  buildCustomerPayload,
  findCustomerIdsForSearch,
  getLiveCustomerSnapshot,
  getPrimaryContact,
  normalizeContacts,
  resolveUniversalCustomer,
};
