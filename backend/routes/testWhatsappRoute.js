// ─────────────────────────────────────────────────────────────────────────────
// backend/routes/testWhatsappRoute.js
//
// Temporary diagnostic route.
// Remove this file and its app.use() line from server.js once WhatsApp is
// confirmed working in production.
//
// Usage:
//   GET http://localhost:5000/api/test-whatsapp
//   — No auth required (diagnostic only, localhost access)
//   — Returns JSON describing every step of the pipeline
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const express        = require('express');
const router         = express.Router();
const { sendTestMessage } = require('../services/whatsappService');

// GET /api/test-whatsapp
router.get('/', async (_req, res) => {
  const result = await sendTestMessage();

  if (result.ok) {
    return res.json({
      success:   true,
      message:   'WhatsApp test message sent successfully',
      recipient: result.recipient,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'WhatsApp test failed — check server logs for details',
    error:   result.error,
  });
});

module.exports = router;
