'use strict';

const path = require('path');
const { getActiveEmailConfig, createTransporter } = require('./emailSettingsService');
const { buildInquiryEmailHtml } = require('./notificationTemplates');

function buildInquiryHtml(inquiry = {}, options = {}) {
  return buildInquiryEmailHtml(inquiry, options);
}
function buildInquiryAttachments(inquiry = {}) {
  return (inquiry?.attachments || [])
    .filter((file) => file?.storagePath)
    .map((file) => ({
      filename: file.name || file.storedName,
      path: path.join(__dirname, '..', 'uploads', file.storagePath),
    }));
}

async function sendOutlookNotification({
  to,
  cc,
  bcc,
  subject,
  html,
  text,
  inquiry,
  attachments,
  eventType,
  previousStatus,
}) {
  try {
    const emailConfig = await getActiveEmailConfig();
    const transporter = createTransporter(emailConfig);

    if (!emailConfig || !transporter) {
      console.warn('[outlookService] Email integration is not configured — skipping email');
      return { success: false, skipped: true, error: 'Email integration credentials not configured' };
    }

    if (!to) {
      console.warn('[outlookService] No recipient provided — skipping email');
      return { success: false, skipped: true, error: 'No recipient provided' };
    }

    const mailHtml = html || buildInquiryHtml(inquiry, { eventType, previousStatus });
    const inquiryAttachments = inquiry ? buildInquiryAttachments(inquiry) : [];
    const extraAttachments = Array.isArray(attachments) ? attachments : [];
    const mailAttachments = [...inquiryAttachments, ...extraAttachments];

    await transporter.sendMail({
      from: emailConfig.fromEmail || emailConfig.username,
      to,
      cc,
      bcc,
      subject: subject || 'Nexus Notification',
      text,
      html: mailHtml,
      attachments: mailAttachments,
    });

    console.log(`[outlookService] Outlook email sent successfully to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('[outlookService] Failed to send email:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = sendOutlookNotification;
