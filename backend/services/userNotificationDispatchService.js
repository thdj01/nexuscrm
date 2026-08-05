'use strict';

const createNotification = require('./notificationService');
const sendOutlookNotification = require('./outlookService');
const { sendWhatsAppNotification } = require('./whatsappService');
const {
  combineUsers,
  getUserNotificationPhone,
  idString,
} = require('./notificationRecipientService');

function resolveValue(value, user) {
  return typeof value === 'function' ? value(user) : value;
}

async function dispatchNotificationsToUsers({
  users = [],
  title,
  message,
  type = 'info',
  priority = 'Medium',
  relatedInquiry = null,
  relatedProject = null,
  relatedTicket = null,
  sendInApp = true,
  sendEmail = true,
  sendWhatsApp = true,
  emailSubject = title,
  emailHtml = '',
  emailText = '',
  emailAttachments = [],
  whatsappMessage = message,
}) {
  const recipients = combineUsers(users);
  const tasks = [];

  for (const user of recipients) {
    const recipientId = idString(user);
    const resolvedTitle = resolveValue(title, user);
    const resolvedMessage = resolveValue(message, user);

    if (sendInApp && recipientId) {
      tasks.push(createNotification({
        title: resolvedTitle,
        message: resolvedMessage,
        type,
        priority,
        recipient: recipientId,
        relatedInquiry,
        relatedProject,
        relatedTicket,
      }));
    }

    const email = String(user?.email || '').trim();
    if (sendEmail && email) {
      tasks.push(sendOutlookNotification({
        to: email,
        subject: resolveValue(emailSubject, user) || resolvedTitle,
        html: resolveValue(emailHtml, user) || undefined,
        text: resolveValue(emailText, user) || undefined,
        attachments: resolveValue(emailAttachments, user) || [],
      }));
    }

    const phone = getUserNotificationPhone(user);
    const resolvedWhatsAppMessage = resolveValue(whatsappMessage, user);
    if (sendWhatsApp && phone && resolvedWhatsAppMessage) {
      tasks.push(sendWhatsAppNotification(resolvedWhatsAppMessage, phone));
    }
  }

  const results = await Promise.allSettled(tasks);
  const rejected = results.filter((result) => result.status === 'rejected');
  if (rejected.length) {
    console.error(`[userNotificationDispatch] ${rejected.length} notification operation(s) failed`);
  }

  return {
    recipients: recipients.map((user) => idString(user)),
    operations: results.length,
    failed: rejected.length,
  };
}

module.exports = {
  dispatchNotificationsToUsers,
};
