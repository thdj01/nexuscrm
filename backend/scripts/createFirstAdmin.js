'use strict';

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

const User = require('../models/User');

const createFirstAdmin = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing from backend/.env');
  }

  const name = String(process.env.FIRST_ADMIN_NAME || '').trim();
  const email = String(process.env.FIRST_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const password = String(process.env.FIRST_ADMIN_PASSWORD || '');

  if (!name) {
    throw new Error('FIRST_ADMIN_NAME is required');
  }

  if (!email) {
    throw new Error('FIRST_ADMIN_EMAIL is required');
  }

  if (password.length < 8) {
    throw new Error(
      'FIRST_ADMIN_PASSWORD must contain at least 8 characters'
    );
  }

  await mongoose.connect(mongoUri);

  const existingAdmin = await User.findOne({ email }).select('+password');

  if (existingAdmin) {
    existingAdmin.name = name;
    existingAdmin.role = 'admin';
    existingAdmin.isActive = true;
    existingAdmin.password = password;

    await existingAdmin.save();

    console.log(`Admin account updated: ${email}`);
    return;
  }

  await User.create({
    name,
    email,
    password,
    role: 'admin',
    department: '',
    hodDepartments: [],
    employeeAccess: [],
    isActive: true,
  });

  console.log(`First Admin created successfully: ${email}`);
};

createFirstAdmin()
  .catch((error) => {
    console.error('Admin creation failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  }); 