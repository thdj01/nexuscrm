// ─────────────────────────────────────────────────────────────────────────────
// backend/services/notificationService.js  — FIXED (full replacement)
//
// Bug fixes applied:
//   [M2/C3b] Wrapped entire function body in try/catch.
//             Previously, any error from Notification.create() (e.g. invalid
//             type enum) or sendOutlookNotification() propagated as an unhandled
//             rejection to the calling controller (createInquiry, updateInquiry,
//             deleteInquiry), causing those operations to return HTTP 500 to the
//             frontend even though the inquiry document had already been saved.
//             Notifications are side-effects — a notification failure must never
//             roll back or mask a successful inquiry save.
//   [M2]     sendOutlookNotification failure is now also safely contained.
// ─────────────────────────────────────────────────────────────────────────────

const Notification             = require('../models/Notification');
const sendOutlookNotification  = require('./outlookService');

// const createNotification = async ({
//   title,
//   message,
//   type           = 'info',
//   recipient      = null,
//   relatedInquiry = null,
//   relatedProject = null,
//   sendEmail      = false,
//   emailTo        = null,
// }) => {

  const createNotification = async ({
  title,
  message,
  type = 'info',
  recipient = null,
  relatedInquiry = null,
  relatedProject = null,
  sendEmail = false,
  emailTo = null,
  inquiry = null,
  eventType = null,
  previousStatus = null,
  emailSubject = null,
  emailHtml = null,
  emailText = null,
}) => {

  // [FIX M2] Notifications are non-critical side-effects.
  // Any failure here must be logged but must NOT propagate to the controller.
  try {
    const notification = await Notification.create({
      title,
      message,
      type,
      recipient,
      relatedInquiry,
      relatedProject,
    });

    if (sendEmail && emailTo) {
      // sendOutlookNotification already has its own internal try/catch,
      // but we keep it inside this outer try so any future refactoring
      // of outlookService stays safe too.
      await sendOutlookNotification({
        to: emailTo,
        subject: emailSubject || title,
        text: emailText,
        html: emailHtml,
        inquiry,
        eventType,
        previousStatus,
      });
    }

    return notification;
  } catch (error) {
    // Log the failure but do not rethrow — callers must not fail because
    // of a notification error.
    console.error('[notificationService] Failed to create notification:', error.message);
    return null;
  }
};

module.exports = createNotification;
