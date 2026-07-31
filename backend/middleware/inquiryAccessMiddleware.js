'use strict';

const Inquiry = require('../models/Inquiry');
const { assertUserCanEditInquiry } = require('../services/inquiryAccessService');

const requireInquiryEditAccess = (paramName = 'id') => async (req, _res, next) => {
  try {
    const inquiryId = req.params?.[paramName];
    const inquiry = await Inquiry.findById(inquiryId).select('createdBy').lean();

    if (!inquiry) {
      const error = new Error('Inquiry not found');
      error.statusCode = 404;
      error.isOperational = true;
      return next(error);
    }

    await assertUserCanEditInquiry(req.user, inquiry);
    req.inquiryAccessDocument = inquiry;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { requireInquiryEditAccess };
