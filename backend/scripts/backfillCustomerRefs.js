/*
 * One-time maintenance script for Universal Customer Master.
 *
 * It links old Inquiry and Project records to Customer._id using existing
 * customer text/contact fields. It does not delete or rewrite business records.
 *
 * Run from backend folder:
 *   node scripts/backfillCustomerRefs.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Inquiry = require('../models/Inquiry');
const Project = require('../models/Project');
const { applyCustomerToPayload, resolveUniversalCustomer } = require('../utils/customerUniversal');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const connect = async () => {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI or MONGODB_URI is required');
  }
  await mongoose.connect(MONGO_URI);
};

const backfillCollection = async ({ Model, label, buildSource }) => {
  let scanned = 0;
  let linked = 0;
  let skipped = 0;
  let failed = 0;

  const cursor = Model.find({
    $or: [
      { customerRef: { $exists: false } },
      { customerRef: null },
    ],
  }).cursor();

  for await (const doc of cursor) {
    scanned += 1;
    try {
      const source = buildSource(doc);
      const customer = await resolveUniversalCustomer(source, doc.createdBy, {
        createIfMissing: true,
        updateExisting: false,
      });

      if (!customer) {
        skipped += 1;
        continue;
      }

      const update = {};
      applyCustomerToPayload(update, customer);

      await Model.findByIdAndUpdate(doc._id, { $set: update }, { runValidators: false });
      linked += 1;
    } catch (error) {
      failed += 1;
      console.error(`[${label}] Failed for ${doc._id}:`, error.message);
    }
  }

  console.log(`[${label}] scanned=${scanned}, linked=${linked}, skipped=${skipped}, failed=${failed}`);
};

const main = async () => {
  await connect();

  await backfillCollection({
    Model: Inquiry,
    label: 'Inquiry',
    buildSource: (doc) => ({
      customerName: doc.customerName,
      companyName: doc.companyName,
      companyType: doc.companyType,
      contactPerson: doc.contactPerson,
      mobileNumber: doc.mobileNumber,
      email: doc.email,
      city: doc.city,
      siteAddress: doc.siteAddress,
      contacts: doc.contacts,
      createdBy: doc.createdBy,
    }),
  });

  await backfillCollection({
    Model: Project,
    label: 'Project',
    buildSource: (doc) => ({
      customerName: doc.customerName,
      companyName: doc.companyName,
      createdBy: doc.createdBy,
    }),
  });

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('[backfillCustomerRefs] Failed:', error.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
