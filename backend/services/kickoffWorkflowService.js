'use strict';

const mongoose = require('mongoose');
const Inquiry = require('../models/Inquiry');
const Project = require('../models/Project');
const Customer = require('../models/Customer');
const User = require('../models/User');
const ProjectActivityLog = require('../models/ProjectActivityLog');
const KickoffWorkflow = require('../models/KickoffWorkflow');
const sendOutlookNotification = require('./outlookService');
const {
  sendWhatsAppNotification,
  sendWhatsAppGroupNotification,
} = require('./whatsappService');
const { getActiveWhatsAppConfig } = require('./whatsappSettingsService');
const { dispatchNotificationsToUsers } = require('./userNotificationDispatchService');
const {
  combineUsers,
  getAdminUsers,
  getSalesLeadershipUsers,
  getProjectDepartmentUsers,
  idString,
} = require('./notificationRecipientService');

const {
  buildKickoffSummaryWhatsAppMessage: buildKickoffSummaryWhatsAppTemplate,
  buildKickoffAssignedWhatsAppMessage: buildKickoffAssignedWhatsAppTemplate,
  buildKickoffEmailHtml: buildKickoffEmailTemplate,
  buildProjectCreatedAfterKickoffWhatsAppMessage,
  buildProjectCreatedAfterKickoffEmailHtml,
  dashboardMessages,
} = require('./notificationTemplates');

const IST_OFFSET = '+05:30';
const DEFAULT_AGENDA = 'Kick-off Meeting to review customer requirements, scope, responsibilities, timeline, and next actions.';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateTime(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getAttendeeNames(workflow = {}, fallbackAttendees = []) {
  const source = Array.isArray(workflow.attendees) && workflow.attendees.length
    ? workflow.attendees
    : fallbackAttendees;

  const names = source
    .map(item => item?.name || item?.email || '')
    .filter(Boolean);

  return names.length ? names.join(', ') : '-';
}

function getAttendeeListText(workflow = {}, fallbackAttendees = []) {
  const source = Array.isArray(workflow.attendees) && workflow.attendees.length
    ? workflow.attendees
    : fallbackAttendees;

  const lines = source
    .map((item, index) => {
      const name = item?.name || item?.email || '';
      if (!name) return '';
      const role = item?.role ? ` - ${item.role}` : '';
      return `${index + 1}. ${name}${role}`;
    })
    .filter(Boolean);

  return lines.length ? lines.join('\n') : '-';
}

async function getInquiryMadeByName(inquiry = {}) {
  if (inquiry.createdBy && typeof inquiry.createdBy === 'object' && inquiry.createdBy.name) {
    return inquiry.createdBy.name;
  }

  const createdById = inquiry.createdBy?._id || inquiry.createdBy;
  if (!createdById || !mongoose.Types.ObjectId.isValid(String(createdById))) {
    return 'System';
  }

  const creator = await User.findById(createdById).select('name email').lean();
  return creator?.name || creator?.email || 'System';
}

function buildScheduledAt(date, time) {
  const dateText = String(date || '').trim();
  const timeText = String(time || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error('Valid kickoff meeting date is required');
  }

  if (!/^\d{2}:\d{2}$/.test(timeText)) {
    throw new Error('Valid kickoff meeting time is required');
  }

  const scheduledAt = new Date(`${dateText}T${timeText}:00${IST_OFFSET}`);

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error('Invalid kickoff meeting date/time');
  }

  return scheduledAt;
}

function getUserWhatsAppNumber(user = {}) {
  return user.whatsappNumber || user.mobileNumber || user.phone || '';
}

function getInquiryCustomerEmail(inquiry = {}) {
  return inquiry.email || inquiry.contacts?.find(contact => contact.email)?.email || '';
}

function getInquiryCustomerPhone(inquiry = {}) {
  return inquiry.mobileNumber || inquiry.contacts?.find(contact => contact.phone)?.phone || '';
}

function buildCustomerWhatsAppMessage(inquiry, workflow, attendees = [], inquiryMadeByName = 'System') {
  const lines = [
    `Hello ${inquiry.contactPerson || inquiry.customerName || 'Customer'},`,
    '',
    'Your Kick-off Meeting has been scheduled.',
    '',
    `Inquiry ID: ${inquiry.inquiryId || '-'}`,
    `Inquiry Made By: ${inquiryMadeByName || 'System'}`,
    `Project / Requirement: ${inquiry.projectName || inquiry.productType || '-'}`,
    `Date & Time: ${formatDateTime(workflow.scheduledAt)}`,
    '',
    'Assigned Persons:',
    getAttendeeListText(workflow, attendees),
  ];

  if (workflow.meetingLink) {
    lines.push('', `Meeting Link: ${workflow.meetingLink}`);
  }

  if (workflow.agenda) {
    lines.push('', `Agenda: ${workflow.agenda}`);
  }

  lines.push('', 'The project will be created after Kickoff Meeting Done.');
  return lines.join('\n');
}

function buildAssignedWhatsAppMessage(inquiry, workflow, user, attendees = [], inquiryMadeByName = 'System') {
  return buildKickoffAssignedWhatsAppTemplate(inquiry, workflow, user, attendees, inquiryMadeByName);
}
function buildKickoffSummaryWhatsAppMessage(inquiry, workflow, attendees = [], inquiryMadeByName = 'System') {
  return buildKickoffSummaryWhatsAppTemplate(inquiry, workflow, attendees, inquiryMadeByName);
}
function buildKickoffEmailHtml(inquiry, workflow, recipientName = '', attendees = [], inquiryMadeByName = '') {
  return buildKickoffEmailTemplate(inquiry, workflow, recipientName, attendees, inquiryMadeByName);
}
function buildProjectCreatedMessage(project, inquiry, workflow) {
  return buildProjectCreatedAfterKickoffWhatsAppMessage(project, inquiry, workflow);
}
function snapshotInquiry(inquiry) {
  const obj = inquiry.toObject ? inquiry.toObject() : inquiry;
  const clone = { ...obj };
  delete clone.__v;
  delete clone.priority;
  delete clone.estimatedValue;
  delete clone.enclosureMaterial;
  delete clone.enclosureStandard;
  return clone;
}

function buildProjectNotes(inquiry, workflow) {
  return [
    inquiry.additionalNotes ? `Additional Notes: ${inquiry.additionalNotes}` : '',
    inquiry.internalRemarks ? `Internal Remarks: ${inquiry.internalRemarks}` : '',
    inquiry.applicationDescription ? `Application: ${inquiry.applicationDescription}` : '',
    workflow.agenda ? `Kick-off Agenda: ${workflow.agenda}` : '',
    workflow.meetingLink ? `Kick-off Meeting Link: ${workflow.meetingLink}` : '',
  ].filter(Boolean).join('\n');
}

async function validateAttendees(attendeeIds = []) {
  const ids = [...new Set((attendeeIds || []).map(String).filter(Boolean))];

  if (!ids.length) {
    throw new Error('Select at least one assigned person for the Kick-off Meeting');
  }

  const invalid = ids.find(id => !mongoose.Types.ObjectId.isValid(id));
  if (invalid) {
    throw new Error('Invalid assigned person selected');
  }

  const users = await User.find({ _id: { $in: ids }, isActive: true })
    .select('name email role teamId mobileNumber whatsappNumber phone')
    .lean();

  if (users.length !== ids.length) {
    throw new Error('One or more selected persons are invalid or inactive');
  }

  return users;
}

async function appendWorkflowLog(workflow, log) {
  workflow.notificationLogs.push({
    ...log,
    loggedAt: new Date(),
  });
  await workflow.save();
}

function normaliseNotificationResult(result) {
  if (result?.success || result?.ok) return 'Sent';
  if (result?.queued || result?.status === 'Queued') return 'Queued';
  if (result?.skipped || result?.status === 'Skipped') return 'Skipped';
  return 'Failed';
}

async function sendKickoffNotifications({ inquiry, workflow, attendees }) {
  let whatsappSent = false;
  let whatsappQueued = false;
  let whatsappSkipped = false;
  let whatsappFailed = false;
  let emailSent = false;
  let emailQueued = false;
  let emailSkipped = false;
  let emailFailed = false;

  const customerPhone = getInquiryCustomerPhone(inquiry);
  const customerEmail = getInquiryCustomerEmail(inquiry);
  const inquiryMadeByName = await getInquiryMadeByName(inquiry);
  const summaryWhatsAppMessage = buildKickoffSummaryWhatsAppMessage(inquiry, workflow, attendees, inquiryMadeByName);
  const whatsappConfig = getActiveWhatsAppConfig();
  const [adminUsers, salesLeadershipUsers] = await Promise.all([
    getAdminUsers(),
    getSalesLeadershipUsers(),
  ]);
  const internalRecipients = combineUsers(attendees, adminUsers, salesLeadershipUsers);
  const attendeeIdSet = new Set(attendees.map((user) => idString(user)).filter(Boolean));

  await dispatchNotificationsToUsers({
    users: internalRecipients,
    title: `Kick-off Meeting Scheduled - ${inquiry.inquiryId || 'Inquiry'}`,
    message: `Kick-off Meeting for inquiry ${inquiry.inquiryId || '-'} was scheduled by ${inquiryMadeByName}.`,
    type: 'kickoff_scheduled',
    relatedInquiry: inquiry._id,
    sendEmail: false,
    sendWhatsApp: false,
  });

  // Send one clear kickoff summary message to the configured WhatsApp group, if configured.
  // This message contains assigned persons, date/time, meeting link, and agenda.
  if (whatsappConfig.isEnabled && whatsappConfig.groupId) {
    const groupResult = await sendWhatsAppGroupNotification(summaryWhatsAppMessage);
    const groupStatus = normaliseNotificationResult(groupResult);

    whatsappSent = whatsappSent || groupStatus === 'Sent';
    whatsappQueued = whatsappQueued || groupStatus === 'Queued';
    whatsappSkipped = whatsappSkipped || groupStatus === 'Skipped';
    whatsappFailed = whatsappFailed || groupStatus === 'Failed';

    await appendWorkflowLog(workflow, {
      channel: 'WhatsApp',
      recipientType: 'Internal Team',
      recipientName: 'Kick-off Notification Group',
      recipientContact: whatsappConfig.groupId,
      status: groupStatus,
      message: groupStatus === 'Queued'
        ? 'Kickoff summary queued for WhatsApp group until client becomes ready'
        : 'Kickoff summary processed for WhatsApp group',
      error: groupResult?.error || '',
    });
  }

  // Also send the same summary to the direct number saved in Integration Settings.
  if (whatsappConfig.isEnabled && whatsappConfig.notifyNumber) {
    const notifyResult = await sendWhatsAppNotification(summaryWhatsAppMessage);
    const notifyStatus = normaliseNotificationResult(notifyResult);

    whatsappSent = whatsappSent || notifyStatus === 'Sent';
    whatsappQueued = whatsappQueued || notifyStatus === 'Queued';
    whatsappSkipped = whatsappSkipped || notifyStatus === 'Skipped';
    whatsappFailed = whatsappFailed || notifyStatus === 'Failed';

    await appendWorkflowLog(workflow, {
      channel: 'WhatsApp',
      recipientType: 'Internal Team',
      recipientName: 'Configured WhatsApp Notification Number',
      recipientContact: whatsappConfig.notifyNumber,
      status: notifyStatus,
      message: notifyStatus === 'Queued'
        ? 'Kickoff summary queued for configured WhatsApp number until client becomes ready'
        : 'Kickoff summary processed for configured WhatsApp number',
      error: notifyResult?.error || '',
    });
  }

  if (customerPhone) {
    const result = await sendWhatsAppNotification(
      buildCustomerWhatsAppMessage(inquiry, workflow, attendees, inquiryMadeByName),
      customerPhone
    );
    const status = normaliseNotificationResult(result);

    whatsappSent = whatsappSent || status === 'Sent';
    whatsappQueued = whatsappQueued || status === 'Queued';
    whatsappSkipped = whatsappSkipped || status === 'Skipped';
    whatsappFailed = whatsappFailed || status === 'Failed';

    await appendWorkflowLog(workflow, {
      channel: 'WhatsApp',
      recipientType: 'Customer',
      recipientName: inquiry.contactPerson || inquiry.customerName || '',
      recipientContact: customerPhone,
      status,
      message: status === 'Queued'
        ? 'Customer kickoff confirmation queued until WhatsApp client becomes ready'
        : 'Customer kickoff confirmation processed through WhatsApp service',
      error: result?.error || '',
    });
  } else {
    whatsappSkipped = true;
    await appendWorkflowLog(workflow, {
      channel: 'WhatsApp',
      recipientType: 'Customer',
      recipientName: inquiry.contactPerson || inquiry.customerName || '',
      status: 'Skipped',
      error: 'Customer mobile number is missing',
    });
  }

  for (const user of internalRecipients) {
    const phone = getUserWhatsAppNumber(user);

    if (!phone) {
      whatsappSkipped = true;
      await appendWorkflowLog(workflow, {
        channel: 'WhatsApp',
        recipientType: attendeeIdSet.has(idString(user)) ? 'Assigned User' : 'Internal Stakeholder',
        recipientName: user.name || '',
        recipientContact: user.email || '',
        status: 'Skipped',
        error: 'User Management record has no WhatsApp/mobile number',
      });
      continue;
    }

    const isAssignedAttendee = attendeeIdSet.has(idString(user));
    const result = await sendWhatsAppNotification(
      isAssignedAttendee
        ? buildAssignedWhatsAppMessage(inquiry, workflow, user, attendees, inquiryMadeByName)
        : summaryWhatsAppMessage,
      phone
    );
    const status = normaliseNotificationResult(result);

    whatsappSent = whatsappSent || status === 'Sent';
    whatsappQueued = whatsappQueued || status === 'Queued';
    whatsappSkipped = whatsappSkipped || status === 'Skipped';
    whatsappFailed = whatsappFailed || status === 'Failed';

    await appendWorkflowLog(workflow, {
      channel: 'WhatsApp',
      recipientType: attendeeIdSet.has(idString(user)) ? 'Assigned User' : 'Internal Stakeholder',
      recipientName: user.name || '',
      recipientContact: phone,
      status,
      message: status === 'Queued'
        ? 'Assigned person kickoff confirmation queued until WhatsApp client becomes ready'
        : 'Assigned person kickoff confirmation processed through WhatsApp service',
      error: result?.error || '',
    });
  }

  const emailRecipients = [customerEmail, ...internalRecipients.map(user => user.email)].filter(Boolean);
  const uniqueEmailRecipients = [...new Set(emailRecipients)];

  if (!uniqueEmailRecipients.length) {
    emailSkipped = true;
    await appendWorkflowLog(workflow, {
      channel: 'Outlook',
      recipientType: 'System',
      status: 'Skipped',
      error: 'No customer or assigned-user email address available',
    });
  } else {
    for (const to of uniqueEmailRecipients) {
      const recipientUser = internalRecipients.find(user => user.email === to);
      const result = await sendOutlookNotification({
        to,
        subject: `Kick-off Meeting Scheduled - ${inquiry.projectName || inquiry.inquiryId || 'Inquiry'}`,
        html: buildKickoffEmailHtml(inquiry, workflow, recipientUser?.name || inquiry.contactPerson || inquiry.customerName, attendees, inquiryMadeByName),
      });
      const status = normaliseNotificationResult(result);

      emailSent = emailSent || status === 'Sent';
      emailQueued = emailQueued || status === 'Queued';
      emailSkipped = emailSkipped || status === 'Skipped';
      emailFailed = emailFailed || status === 'Failed';

      await appendWorkflowLog(workflow, {
        channel: 'Outlook',
        recipientType: recipientUser
          ? (attendeeIdSet.has(idString(recipientUser)) ? 'Assigned User' : 'Internal Stakeholder')
          : 'Customer',
        recipientName: recipientUser?.name || inquiry.contactPerson || inquiry.customerName || '',
        recipientContact: to,
        status,
        message: status === 'Sent' ? 'Kickoff confirmation email sent' : '',
        error: result?.error || '',
      });
    }
  }

  workflow.notificationStatus.whatsapp = whatsappSent
    ? 'Sent'
    : (whatsappQueued ? 'Queued' : (whatsappSkipped && !whatsappFailed ? 'Skipped' : 'Failed'));

  workflow.notificationStatus.outlook = emailSent
    ? 'Sent'
    : (emailQueued ? 'Queued' : (emailSkipped && !emailFailed ? 'Skipped' : 'Failed'));

  await workflow.save();
}

async function scheduleKickoffForInquiry({ inquiryId, payload, user }) {
  const inquiry = await Inquiry.findById(inquiryId);
  if (!inquiry) {
    const err = new Error('Inquiry not found');
    err.statusCode = 404;
    throw err;
  }

  if (inquiry.convertedToProject || inquiry.projectReference) {
    const err = new Error('This inquiry is already converted into a project');
    err.statusCode = 400;
    throw err;
  }

  const scheduledAt = buildScheduledAt(payload.date, payload.time);
  if (scheduledAt <= new Date()) {
    const err = new Error('Kick-off Meeting date/time must be in the future');
    err.statusCode = 400;
    throw err;
  }

  const attendees = await validateAttendees(payload.attendees || payload.assignedUsers || []);
  const attendeeIds = attendees.map(person => person._id);

  const workflowPayload = {
    inquiry: inquiry._id,
    scheduledAt,
    date: payload.date,
    time: payload.time,
    agenda: String(payload.agenda || DEFAULT_AGENDA).trim(),
    meetingLink: String(payload.meetingLink || '').trim(),
    attendees: attendeeIds,
    status: 'Scheduled',
    projectReference: null,
    convertedAt: null,
    lastError: '',
    updatedBy: user?._id,
  };

  let workflow = await KickoffWorkflow.findOne({ inquiry: inquiry._id });

  if (workflow?.status === 'Project Created') {
    const err = new Error('Project has already been created for this kickoff workflow');
    err.statusCode = 400;
    throw err;
  }

  if (workflow) {
    Object.assign(workflow, workflowPayload);
    workflow.notificationLogs.push({
      channel: 'System',
      recipientType: 'System',
      status: 'Sent',
      message: `Kick-off Meeting rescheduled by ${user?.name || 'User'}`,
    });
  } else {
    workflow = await KickoffWorkflow.create({
      ...workflowPayload,
      createdBy: user?._id,
    });
  }

  await workflow.save();

  inquiry.status = 'Order Won';
  inquiry.convertedToProject = false;
  inquiry.projectReference = undefined;
  inquiry.kickoffMeeting = {
    workflowReference: workflow._id,
    scheduledAt,
    date: payload.date,
    time: payload.time,
    agenda: workflow.agenda,
    meetingLink: workflow.meetingLink,
    attendees: attendeeIds,
    status: 'Scheduled',
    scheduledBy: user?._id,
    scheduledOn: new Date(),
  };
  await inquiry.save();

  workflow = await KickoffWorkflow.findById(workflow._id)
    .populate('attendees', 'name email role teamId mobileNumber whatsappNumber phone')
    .populate({ path: 'inquiry', populate: { path: 'createdBy', select: 'name email' } });

  await sendKickoffNotifications({ inquiry, workflow, attendees });

  return KickoffWorkflow.findById(workflow._id)
    .populate('attendees', 'name email role teamId mobileNumber whatsappNumber phone')
    .populate('inquiry')
    .populate('projectReference', 'projectId projectName');
}

async function createProjectFromWorkflow(workflow) {
  const inquiry = await Inquiry.findById(workflow.inquiry);
  if (!inquiry) {
    throw new Error('Inquiry not found for scheduled kickoff workflow');
  }

  if (inquiry.convertedToProject && inquiry.projectReference) {
    workflow.status = 'Project Created';
    workflow.projectReference = inquiry.projectReference;
    workflow.convertedAt = workflow.convertedAt || new Date();
    workflow.lastError = '';
    await workflow.save();
    return Project.findById(inquiry.projectReference);
  }

  const existingProject = await Project.findOne({ inquiryReference: inquiry._id });
  if (existingProject) {
    inquiry.convertedToProject = true;
    inquiry.projectReference = existingProject._id;
    if (inquiry.kickoffMeeting) {
      inquiry.kickoffMeeting.status = 'Project Created';
      inquiry.kickoffMeeting.projectReference = existingProject._id;
      inquiry.kickoffMeeting.convertedAt = new Date();
    }
    await inquiry.save();

    workflow.status = 'Project Created';
    workflow.projectReference = existingProject._id;
    workflow.convertedAt = new Date();
    workflow.lastError = '';
    await workflow.save();

    return existingProject;
  }

  const attendees = (workflow.attendees || []).map(item => String(item?._id || item));

  // An inquiry can contain panel-related information, but it must not decide
  // the project's planning structure. The project is created with an empty
  // planning setup so an authorized user explicitly selects the panel types
  // and departments from the Project Planning screen.
  const selectedDepartments = [];
  const panelSelections = [];
  const planningGrids = [];

  const projectData = {
    inquiryReference: inquiry._id,
    inquiryNumber: inquiry.inquiryId || '',
    customerRef: inquiry.customerRef || undefined,
    customerName: inquiry.customerName,
    projectName: inquiry.projectName || `${inquiry.customerName} - ${inquiry.productType}`,
    quantity: 1,
    selectedDepartments,
    panelSelections,
    planningGrids,
    planningTasks: planningGrids.flatMap((grid) => grid.planningTasks),
    orderDate: new Date(),
    expectedDeliveryDate: inquiry.deliveryDate,
    projectEndDate: inquiry.deliveryDate,
    assignedTeamMembers: attendees,
    createdBy: workflow.createdBy,
    sourceInquirySnapshot: snapshotInquiry(inquiry),
    kickoffMeeting: {
      workflowReference: workflow._id,
      scheduledAt: workflow.scheduledAt,
      date: workflow.date,
      time: workflow.time,
      agenda: workflow.agenda,
      meetingLink: workflow.meetingLink,
      attendees,
      status: 'Project Created',
      createdBy: workflow.createdBy,
      scheduledBy: workflow.createdBy,
      scheduledOn: workflow.createdAt || new Date(),
    },
  };

  const project = await Project.create(projectData);

  inquiry.convertedToProject = true;
  inquiry.projectReference = project._id;
  inquiry.status = 'Order Won';
  if (inquiry.kickoffMeeting) {
    inquiry.kickoffMeeting.status = 'Project Created';
    inquiry.kickoffMeeting.projectReference = project._id;
    inquiry.kickoffMeeting.convertedAt = new Date();
    inquiry.kickoffMeeting.lastError = '';
  }
  await inquiry.save();

  if (inquiry.customerRef || inquiry.mobileNumber) {
    await Customer.findOneAndUpdate(
      inquiry.customerRef ? { _id: inquiry.customerRef } : { mobileNumber: inquiry.mobileNumber },
      { $inc: { totalProjects: 1 } },
      { new: true }
    );
  }

  workflow.status = 'Project Created';
  workflow.projectReference = project._id;
  workflow.convertedAt = new Date();
  workflow.lastError = '';
  workflow.notificationStatus.internal = 'Pending';
  await workflow.save();

  await ProjectActivityLog.create({
    projectId: project._id,
    userId: workflow.createdBy || null,
    userName: 'System',
    actionType: 'created',
    fieldChanged: 'Kick-off Workflow',
    newValue: project.projectId,
    description: `Project ${project.projectId} created automatically after Kick-off Meeting`,
    activityDate: new Date(),
  });

  return project;
}

async function notifyProjectCreated({ project, inquiry, workflow }) {
  const message = buildProjectCreatedMessage(project, inquiry, workflow);

  await sendWhatsAppGroupNotification(message);

  const attendeeIds = (workflow.attendees || []).map((item) => item?._id || item);
  const [attendeeDocs, adminUsers, salesLeadershipUsers, departmentUsers] = await Promise.all([
    User.find({ _id: { $in: attendeeIds }, isActive: { $ne: false } })
      .select('_id name email phone mobileNumber whatsappNumber mobile role department hodDepartments teamId')
      .lean(),
    getAdminUsers(),
    getSalesLeadershipUsers(),
    getProjectDepartmentUsers(project),
  ]);
  const recipients = combineUsers(attendeeDocs, adminUsers, salesLeadershipUsers, departmentUsers);

  await dispatchNotificationsToUsers({
    users: recipients,
    title: 'Project Created After Kick-off Meeting',
    message: dashboardMessages.projectCreatedAfterKickoff(project),
    type: 'project_created',
    relatedInquiry: inquiry._id,
    relatedProject: project._id,
    emailSubject: `Project Created - ${project.projectId}`,
    emailHtml: (user) => buildProjectCreatedAfterKickoffEmailHtml(
      project,
      inquiry,
      workflow,
      user?.name || 'Team Member'
    ),
    whatsappMessage: message,
  });

  workflow.notificationStatus.internal = 'Sent';
  workflow.notificationLogs.push({
    channel: 'System',
    recipientType: 'Internal Team',
    status: 'Sent',
    message: `Admin, Sales leadership, assigned attendees and selected planning departments, if any, notified (${recipients.length} users)`,
  });
  await workflow.save();
}


async function completeKickoffMeetingAndCreateProject({ inquiryId, user }) {
  const workflow = await KickoffWorkflow.findOne({ inquiry: inquiryId })
    .populate('attendees', 'name email role teamId mobileNumber whatsappNumber phone')
    .populate({ path: 'inquiry', populate: { path: 'createdBy', select: 'name email' } });

  if (!workflow) {
    const err = new Error('Scheduled Kick-off Meeting not found for this inquiry');
    err.statusCode = 404;
    throw err;
  }

  if (workflow.status === 'Project Created' && workflow.projectReference) {
    const err = new Error('Project has already been created for this kickoff workflow');
    err.statusCode = 400;
    throw err;
  }

  if (workflow.status === 'Cancelled') {
    const err = new Error('Cancelled Kick-off Meeting cannot be completed');
    err.statusCode = 400;
    throw err;
  }

  if (workflow.scheduledAt > new Date()) {
    const err = new Error('Kick-off Meeting cannot be marked done before the scheduled date/time');
    err.statusCode = 400;
    throw err;
  }

  workflow.status = 'Completed';
  workflow.lastProcessedAt = new Date();
  workflow.updatedBy = user?._id;
  workflow.notificationLogs.push({
    channel: 'System',
    recipientType: 'System',
    status: 'Sent',
    message: `Kick-off Meeting marked done by ${user?.name || 'User'}`,
  });
  await workflow.save();

  await Inquiry.findByIdAndUpdate(inquiryId, {
    'kickoffMeeting.status': 'Completed',
    'kickoffMeeting.lastError': '',
  });

  const inquiry = await Inquiry.findById(workflow.inquiry);
  const project = await createProjectFromWorkflow(workflow);
  await notifyProjectCreated({ project, inquiry, workflow });

  return {
    workflow: await KickoffWorkflow.findById(workflow._id)
      .populate('attendees', 'name email role teamId mobileNumber whatsappNumber phone')
      .populate('inquiry')
      .populate('projectReference', 'projectId projectName'),
    project,
  };
}

async function processDueKickoffWorkflows({ limit = 25 } = {}) {
  const now = new Date();
  const workflows = await KickoffWorkflow.find({
    status: 'Scheduled',
    scheduledAt: { $lte: now },
  })
    .sort({ scheduledAt: 1 })
    .limit(limit);

  const results = [];

  for (const workflow of workflows) {
    workflow.status = 'Ready For Completion';
    workflow.lastProcessedAt = new Date();
    workflow.notificationLogs.push({
      channel: 'System',
      recipientType: 'System',
      status: 'Sent',
      message: 'Kick-off Meeting time completed. Waiting for user to mark meeting done.',
    });
    await workflow.save();

    await Inquiry.findByIdAndUpdate(workflow.inquiry, {
      'kickoffMeeting.status': 'Ready For Completion',
      'kickoffMeeting.lastError': '',
    });

    results.push({ workflowId: workflow._id, success: true, status: workflow.status });
  }

  return {
    processed: results.length,
    results,
  };
}

async function getWorkflowForInquiry(inquiryId) {
  return KickoffWorkflow.findOne({ inquiry: inquiryId })
    .populate('attendees', 'name email role teamId mobileNumber whatsappNumber phone')
    .populate('inquiry')
    .populate('projectReference', 'projectId projectName');
}

module.exports = {
  scheduleKickoffForInquiry,
  processDueKickoffWorkflows,
  completeKickoffMeetingAndCreateProject,
  getWorkflowForInquiry,
  buildScheduledAt,
};
