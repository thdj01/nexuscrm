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
  emailAttachments = [],
}) => {

  // Notifications and emails are independent non-critical side effects.
  // A database notification failure must not prevent the email (and its PDF)
  // from being delivered, and an email failure must not affect inquiry creation.
  let notification = null;

  try {
    notification = await Notification.create({
      title,
      message,
      type,
      recipient,
      relatedInquiry,
      relatedProject,
    });
  } catch (error) {
    console.error('[notificationService] Failed to create notification:', error.message);
  }

  if (sendEmail && emailTo) {
    try {
      await sendOutlookNotification({
        to: emailTo,
        subject: emailSubject || title,
        text: emailText,
        html: emailHtml,
        inquiry,
        eventType,
        previousStatus,
        attachments: emailAttachments,
      });
    } catch (error) {
      console.error('[notificationService] Failed to send notification email:', error.message);
    }
  }

  return notification;
};

module.exports = createNotification;
