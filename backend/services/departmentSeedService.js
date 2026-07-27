'use strict';

const Department = require('../models/Department');

const DEFAULT_DEPARTMENTS = Object.freeze([
  { name: 'ADMIN', code: 'ADM' },
  { name: 'SALES', code: 'SAL' },
  { name: 'ESTIMATION', code: 'EST' },
  { name: 'DESIGN', code: 'DES' },
  { name: 'AUTOMATION', code: 'AUT' },
  { name: 'PRODUCTION', code: 'PRO' },
  { name: 'PURCHASE', code: 'PUR' },
  { name: 'STORE', code: 'STO' },
  { name: 'QC', code: 'QC' },
]);

const seedDefaultDepartments = async () => {
  try {
    for (const item of DEFAULT_DEPARTMENTS) {
      await Department.findOneAndUpdate(
        { $or: [{ code: item.code }, { name: item.name }] },
        {
          $setOnInsert: {
            name: item.name,
            code: item.code,
            isActive: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    console.log('✅ Department master seed verified');
  } catch (err) {
    console.error('❌ Department master seed failed:', err.message);
  }
};

module.exports = {
  DEFAULT_DEPARTMENTS,
  seedDefaultDepartments,
};
