/*
 * One-time maintenance script to remove the old Alternate Number field
 * from existing Customer documents after the field is removed from code/schema.
 *
 * Run from backend folder:
 *   node scripts/removeAlternateNumberFromCustomers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../models/Customer');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const main = async () => {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI or MONGODB_URI is required');
  }

  await mongoose.connect(MONGO_URI);

  const result = await Customer.updateMany(
    { alternateNumber: { $exists: true } },
    { $unset: { alternateNumber: '' } }
  );

  console.log(`[removeAlternateNumberFromCustomers] matched=${result.matchedCount || 0}, modified=${result.modifiedCount || 0}`);

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('[removeAlternateNumberFromCustomers] Failed:', error.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
