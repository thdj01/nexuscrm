const mongoose = require('mongoose');
const Counter = require('./Counter');

const customerContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    designation: { type: String, trim: true },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      unique: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    companyType: {
      type: String,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    contacts: {
      type: [customerContactSchema],
      default: [],
    },
    city: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    gstNumber: {
      type: String,
      trim: true,
    },
    totalProjects: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);


customerSchema.pre('validate', function (next) {
  const contacts = Array.isArray(this.contacts) ? this.contacts : [];
  const cleanedContacts = contacts
    .map((contact) => ({
      name: String(contact?.name || '').trim(),
      phone: String(contact?.phone || '').trim(),
      email: String(contact?.email || '').trim().toLowerCase(),
      designation: String(contact?.designation || '').trim(),
    }))
    .filter((contact) => contact.name || contact.phone || contact.email || contact.designation);

  if (cleanedContacts.length > 0) {
    const primary = cleanedContacts[0];
    this.contacts = cleanedContacts;
    this.contactPerson = primary.name || this.contactPerson || '';
    this.mobileNumber = primary.phone || this.mobileNumber || '';
    this.email = primary.email || this.email || '';
  } else if (this.contactPerson || this.mobileNumber || this.email) {
    this.contacts = [{
      name: this.contactPerson || '',
      phone: this.mobileNumber || '',
      email: this.email || '',
      designation: '',
    }];
  }

  if (!this.customerName && this.companyName) {
    this.customerName = this.companyName;
  }

  next();
});

// Auto-generate customer ID using Counter collection
customerSchema.pre('save', async function (next) {
  if (this.customerId) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { id: 'customerId' },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
      }
    );

    this.customerId = `CUST-${String(counter.seq).padStart(4, '0')}`;

    next();
  } catch (err) {
    next(err);
  }
});

customerSchema.index({ companyType: 1 });
customerSchema.index({ createdBy: 1 });
customerSchema.index({ 'contacts.phone': 1 });
customerSchema.index({ 'contacts.email': 1 });

module.exports = mongoose.model('Customer', customerSchema);