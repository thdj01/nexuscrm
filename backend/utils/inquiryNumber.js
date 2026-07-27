'use strict';

const Counter = require('../models/Counter');

const INQUIRY_NUMBER_OFFSET = 1349;

function formatInquiryNumber(sequence) {
  return `INQ-${Number(sequence || 0) + INQUIRY_NUMBER_OFFSET}`;
}

async function getNextInquiryNumber() {
  const counter = await Counter.findOneAndUpdate(
    { id: 'inquiryId' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return formatInquiryNumber(counter.seq);
}

module.exports = {
  INQUIRY_NUMBER_OFFSET,
  formatInquiryNumber,
  getNextInquiryNumber,
};
