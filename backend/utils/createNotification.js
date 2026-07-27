const Notification = require('../models/Notification');

const createNotification = async ({
  title,
  message,
  type = 'info',
  priority = 'Medium',
  recipient,
  relatedInquiry = null,
  relatedProject = null,
}) => {
  try {
    await Notification.create({
      title,
      message,
      type,
      priority,
      recipient,
      relatedInquiry,
      relatedProject,
    });
  } catch (error) {
    console.log(
      'Notification Error:',
      error.message
    );
  }
};

module.exports = createNotification;