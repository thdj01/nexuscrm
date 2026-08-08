// backend/routes/ticketRoutes.js
'use strict';

const express = require('express');
const router = express.Router();

const {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  assignTicket,
  startWork,
  customerPending,
  closeTicket,
  reopenTicket,
  voidTicket,
  addComment,
  getComments,
  updateComment,
  uploadTicketAttachments,
  downloadTicketAttachment,
  ticketAttachmentUpload, // multer multi-file middleware
  getTicketActivity,
} = require('../controllers/ticketController');

const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// ── Comments (commentId scoped routes — registered before /:id to avoid clashes) ──
router.put('/comments/:commentId', updateComment);

// ── Collection ──────────────────────────────────────────────────────────────
router.route('/')
  .get(getTickets)
  .post(createTicket);

// ── Single ticket ────────────────────────────────────────────────────────────
router.route('/:id')
  .get(getTicketById)
  .put(updateTicket);

// ── Assignment ──────────────────────────────────────────────────────────────
router.patch('/:id/assign', assignTicket);

// ── Workflow transitions ─────────────────────────────────────────────────────
router.patch('/:id/start-work', startWork);
router.patch('/:id/customer-pending', customerPending);
router.patch('/:id/close', closeTicket);
router.patch('/:id/reopen', reopenTicket);
router.patch('/:id/void', voidTicket);

// ── Comments (ticket-scoped) ─────────────────────────────────────────────────
router.route('/:id/comments')
  .get(getComments)
  .post(addComment);

// ── Attachments ──────────────────────────────────────────────────────────────
router.post('/:id/attachments', ticketAttachmentUpload, uploadTicketAttachments);
router.get('/:id/attachments/:fileKey', downloadTicketAttachment);

// ── Activity timeline ────────────────────────────────────────────────────────
router.get('/:id/activity', getTicketActivity);

module.exports = router;
