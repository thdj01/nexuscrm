'use strict';

const DEFAULT_AGENDA = 'Kick-off Meeting to review customer requirements, scope, responsibilities, timeline, and next actions.';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeText(value = '') {
  return String(value || '').trim();
}

function resolveCustomerName(inquiry = {}) {
  return inquiry.customerName || inquiry.companyName || inquiry.customerRef?.customerName || '-';
}

function resolveSiteLocation(inquiry = {}) {
  return inquiry.siteLocation || inquiry.city || inquiry.location || inquiry.customerRef?.city || '-';
}

function resolveInquiryProjectName(inquiry = {}) {
  return inquiry.projectName || inquiry.productType || inquiry.inquiryName || '-';
}

function resolvePanelType(inquiry = {}) {
  const inquiryTypeLabels = {
    PLC_AUTOMATION: 'PLC',
    VFD_PANEL: 'VFD',
    MCC_PANEL: 'MCC',
    MCC_CUM_PLC: 'MCC cum PLC',
  };

  if (inquiryTypeLabels[inquiry.inquiryType]) return inquiryTypeLabels[inquiry.inquiryType];

  if (Array.isArray(inquiry.panelTypes) && inquiry.panelTypes.length) {
    return inquiry.panelTypes.filter(Boolean).join(', ');
  }

  if (inquiry.productType === 'PLC_MCC') return 'MCC cum PLC';
  return inquiry.productType || '-';
}

function resolveCreatedByName(inquiry = {}, fallback = 'System') {
  return inquiry.createdBy?.name || inquiry.createdByName || fallback;
}

function getAttachmentNames(inquiry = {}) {
  return (inquiry.attachments || [])
    .map((file) => file?.name || file?.storedName || '')
    .filter(Boolean);
}

function tableRows(rows = []) {
  return rows.map(([label, value]) => (
    `<tr><td style="font-weight:700; background:#f9fafb; width:210px;">${escapeHtml(label)}</td><td>${value}</td></tr>`
  )).join('');
}

function buildBaseEmail({ heading, intro = '', rows = [], footer = 'Regards,<br/>Nexus Team' }) {
  return `
    <div style="font-family: Arial, sans-serif; color:#111827; line-height:1.5;">
      <h2 style="margin:0 0 12px;">${escapeHtml(heading)}</h2>
      ${intro ? `<p>${intro}</p>` : ''}
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width:100%; max-width:760px;">
        ${tableRows(rows)}
      </table>
      ${footer ? `<p style="margin-top:16px;">${footer}</p>` : ''}
    </div>
  `;
}

function buildInquiryEmailHtml(inquiry = {}, options = {}) {
  const eventType = options.eventType || 'inquiry_created';
  const previousStatus = options.previousStatus || inquiry.previousStatus || '';

  const copy = {
    inquiry_created: {
      heading: 'New Inquiry Received',
      intro: 'A new inquiry has been created in Nexus Dashboard.',
      createdLabel: 'Created On',
    },
    inquiry_updated: {
      heading: 'Inquiry Updated',
      intro: 'An inquiry has been updated in Nexus Dashboard.',
      createdLabel: 'Updated On',
    },
    inquiry_status_changed: {
      heading: 'Inquiry Status Changed',
      intro: 'An inquiry status has been changed in Nexus Dashboard.',
      createdLabel: 'Updated On',
    },
    inquiry_deleted: {
      heading: 'Inquiry Deleted',
      intro: 'An inquiry has been deleted from Nexus Dashboard.',
      createdLabel: 'Deleted On',
    },
  }[eventType] || {
    heading: 'Inquiry Notification',
    intro: 'An inquiry notification has been generated from Nexus Dashboard.',
    createdLabel: 'Updated On',
  };

  const statusValue = eventType === 'inquiry_status_changed' && previousStatus
    ? `${escapeHtml(previousStatus)} → ${escapeHtml(inquiry.status || '-')}`
    : escapeHtml(inquiry.status || '-');

  const attachmentNames = getAttachmentNames(inquiry);
  const attachmentsHtml = attachmentNames.length
    ? `<ul style="margin:0; padding-left:18px;">${attachmentNames.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`
    : 'No attachments';

  return buildBaseEmail({
    heading: copy.heading,
    intro: copy.intro,
    rows: [
      ['Inquiry ID', escapeHtml(inquiry.inquiryId || '-')],
      ['Created By', escapeHtml(resolveCreatedByName(inquiry))],
      ['Customer Name', escapeHtml(resolveCustomerName(inquiry))],
      ['Project Name', escapeHtml(resolveInquiryProjectName(inquiry))],
      ['Site Location', escapeHtml(resolveSiteLocation(inquiry))],
      ['Panel Type', escapeHtml(resolvePanelType(inquiry))],
      ['Status', statusValue],
      ...(options.actorName ? [['Changed By', escapeHtml(options.actorName)]] : []),
      [copy.createdLabel, escapeHtml(formatDateTime(inquiry.updatedAt || inquiry.createdAt || new Date()))],
      ['Uploaded Documents', attachmentsHtml],
    ],
  });
}

function buildNewInquiryWhatsAppMessage(inquiry = {}, createdByName = '') {
  return [
    '🔔 *New Inquiry Received*',
    '',
    `*Inquiry No:* ${inquiry.inquiryId || '-'}`,
    `*Customer:* ${resolveCustomerName(inquiry)}`,
    `*Project:* ${resolveInquiryProjectName(inquiry)}`,
    `*Panel Type:* ${resolvePanelType(inquiry)}`,
    `*Created By:* ${createdByName || resolveCreatedByName(inquiry)}`,
  ].join('\n');
}

function buildProjectCreatedWhatsAppMessage(project = {}) {
  const departments = Array.isArray(project.selectedDepartments) && project.selectedDepartments.length
    ? project.selectedDepartments.join(', ')
    : '-';
  const panels = Array.isArray(project.panelSelections) && project.panelSelections.length
    ? project.panelSelections.map((item) => `${item.department}: ${item.panelType} × ${item.quantity}`).join('; ')
    : '-';
  return [
    '🆕 *New Project Created*',
    `Project: *${project.projectName || '-'}* (${project.projectId || '-'})`,
    `Customer: ${project.customerName || '-'}`,
    `Project Quantity: ${project.projectQuantity || project.quantity || 1}`,
    `Departments: ${departments}`,
    `Panels: ${panels}`,
    `Status: ${project.projectStatus || 'Planning'}`,
  ].join('\n');
}

function buildTaskLine(task = {}, index = 0) {
  const suffix = [];
  if (task.department) suffix.push(task.department);
  if (task.gridName) suffix.push(task.gridName);

  return [
    `${index + 1}. ${task.taskName || 'Task'}${suffix.length ? ` (${suffix.join(' / ')})` : ''}`,
    `   Task Start Date: ${formatDate(task.startDate || task.plannedStartDate)}`,
    `   Task End Date: ${formatDate(task.endDate || task.plannedEndDate)}`,
  ].join('\n');
}

function buildTaskAssignmentGroupWhatsAppMessage({ projectName, projectId, assignedToName, tasks = [] }) {
  return [
    '🔧 *Task Assignment*',
    `Project: *${projectName || '-'}* (${projectId || '-'})`,
    `Assigned to: *${assignedToName || 'Team member'}*`,
    '',
    'Tasks:',
    tasks.map(buildTaskLine).join('\n'),
  ].filter(Boolean).join('\n');
}

function buildTaskAssignmentPersonalWhatsAppMessage({ userName, projectName, projectId, tasks = [] }) {
  return [
    `Hi *${userName || 'Team Member'}* 👋`,
    '',
    'You have been assigned a task.',
    `Project: *${projectName || '-'}* (${projectId || '-'})`,
    '',
    'Tasks:',
    tasks.map(buildTaskLine).join('\n'),
    '',
    'Please check the Nexus dashboard for details.',
  ].filter(Boolean).join('\n');
}

function buildProjectFieldChangedWhatsAppMessage({ projectName, projectId, fieldChanged, oldValue, newValue }) {
  const isStatus = String(fieldChanged || '').toLowerCase() === 'status';
  return [
    isStatus ? '🔄 *Project Status Changed*' : '🔄 *Project Field Changed*',
    `Project: *${projectName || '-'}* (${projectId || '-'})`,
    `${fieldChanged || 'Field'}: *${oldValue || '-'}* → *${newValue || '-'}*`,
  ].join('\n');
}

function buildProjectDelayedWhatsAppMessage(project = {}) {
  return [
    '⚠️ *Project Delayed*',
    `Project: *${project.projectName || '-'}* (${project.projectId || '-'})`,
    `End Date: ${formatDate(project.projectEndDate)}`,
    `Delayed by: *${Number(project.delayedDays || 0)} day(s)*`,
  ].join('\n');
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

function getAttendeeNames(workflow = {}, fallbackAttendees = []) {
  const source = Array.isArray(workflow.attendees) && workflow.attendees.length
    ? workflow.attendees
    : fallbackAttendees;

  const names = source.map((item) => item?.name || item?.email || '').filter(Boolean);
  return names.length ? names.join(', ') : '-';
}

function buildKickoffSummaryWhatsAppMessage(inquiry = {}, workflow = {}, attendees = [], inquiryMadeByName = 'System') {
  const lines = [
    '🚀 Kick-off Meeting Scheduled',
    '',
    `Inquiry ID: ${inquiry.inquiryId || '-'}`,
    `Inquiry Made By: ${inquiryMadeByName || 'System'}`,
    `Project / Requirement: ${resolveInquiryProjectName(inquiry)}`,
    `Date & Time: ${formatDateTime(workflow.scheduledAt)}`,
    '',
    'Assigned Persons:',
    getAttendeeListText(workflow, attendees),
  ];

  if (workflow.meetingLink) lines.push('', `Meeting Link: ${workflow.meetingLink}`);
  lines.push('', `Agenda: ${workflow.agenda || DEFAULT_AGENDA}`);
  lines.push('', 'Note: Project will be created only after Kickoff Meeting Done.');
  return lines.join('\n');
}

function buildKickoffAssignedWhatsAppMessage(inquiry = {}, workflow = {}, user = {}, attendees = [], inquiryMadeByName = 'System') {
  const lines = [
    `Hello ${user.name || 'Team Member'},`,
    '',
    'A Kick-off Meeting has been scheduled and assigned to you.',
    '',
    `Inquiry ID: ${inquiry.inquiryId || '-'}`,
    `Sales Person: ${inquiryMadeByName || 'System'}`,
    `Project / Requirement: ${resolveInquiryProjectName(inquiry)}`,
    `Date & Time: ${formatDateTime(workflow.scheduledAt)}`,
    '',
    'Assigned Persons:',
    getAttendeeListText(workflow, attendees),
  ];

  if (workflow.meetingLink) lines.push('', `Meeting Link: ${workflow.meetingLink}`);
  lines.push('', `Agenda: ${workflow.agenda || DEFAULT_AGENDA}`);
  lines.push('', 'Note: Project will be created only after Kickoff Meeting Done.');
  return lines.join('\n');
}

function buildKickoffEmailHtml(inquiry = {}, workflow = {}, recipientName = '', attendees = [], inquiryMadeByName = '') {
  return buildBaseEmail({
    heading: 'Kick-off Meeting Scheduled',
    intro: `Hello ${escapeHtml(recipientName || inquiry.contactPerson || resolveCustomerName(inquiry) || 'Team')},<br/>The Kick-off Meeting has been scheduled with the below details.`,
    rows: [
      ['Inquiry ID', escapeHtml(inquiry.inquiryId || '-')],
      ['Inquiry Made By', escapeHtml(inquiryMadeByName || resolveCreatedByName(inquiry))],
      ['Customer / Company', escapeHtml(resolveCustomerName(inquiry))],
      ['Project / Requirement', escapeHtml(resolveInquiryProjectName(inquiry))],
      ['Meeting Date & Time', escapeHtml(formatDateTime(workflow.scheduledAt))],
      ['Agenda', escapeHtml(workflow.agenda || DEFAULT_AGENDA)],
      ['Meeting Link', workflow.meetingLink ? `<a href="${escapeHtml(workflow.meetingLink)}">${escapeHtml(workflow.meetingLink)}</a>` : '-'],
      ['Assigned Persons', escapeHtml(getAttendeeNames(workflow, attendees))],
      ['Notes / Requirements', escapeHtml(inquiry.additionalNotes || inquiry.applicationDescription || '-')],
    ],
    footer: 'After the Kick-off Meeting is completed, please open the Kick-off popup and click Kickoff Meeting Done to create the project.<br/><br/>Regards,<br/>Nexus Team',
  });
}

function buildProjectCreatedAfterKickoffWhatsAppMessage(project = {}, inquiry = {}, workflow = {}) {
  return [
    '✅ Project created automatically after Kick-off Meeting.',
    '',
    `Project: ${project.projectName || '-'} (${project.projectId || '-'})`,
    `Inquiry: ${inquiry.inquiryId || '-'}`,
    `Customer: ${project.customerName || resolveCustomerName(inquiry)}`,
    `Kick-off: ${formatDateTime(workflow.scheduledAt)}`,
  ].join('\n');
}

function buildProjectCreatedAfterKickoffEmailHtml(project = {}, inquiry = {}, workflow = {}, userName = '') {
  return buildBaseEmail({
    heading: 'Project Created',
    intro: `Hello ${escapeHtml(userName || 'Team Member')},<br/>The project was created automatically after the scheduled Kick-off Meeting.`,
    rows: [
      ['Project ID', escapeHtml(`${project.projectId || '-'}${project.projectNumber ? ` (${project.projectNumber})` : ''}`)],
      ['Project Name', escapeHtml(project.projectName || '-')],
      ['Customer', escapeHtml(project.customerName || resolveCustomerName(inquiry))],
      ['Kick-off Date & Time', escapeHtml(formatDateTime(workflow.scheduledAt))],
    ],
  });
}


function buildInquiryChangedWhatsAppMessage(inquiry = {}, { eventType = 'inquiry_updated', previousStatus = '', actorName = '' } = {}) {
  const isStatusChange = eventType === 'inquiry_status_changed';
  const lines = [
    isStatusChange ? '🔄 *Inquiry Status Changed*' : '📝 *Inquiry Updated*',
    '',
    `*Inquiry No:* ${inquiry.inquiryId || '-'}`,
    `*Customer:* ${resolveCustomerName(inquiry)}`,
    `*Project:* ${resolveInquiryProjectName(inquiry)}`,
  ];

  if (isStatusChange) {
    lines.push(`*Status:* ${previousStatus || '-'} → ${inquiry.status || '-'}`);
  } else {
    lines.push(`*Status:* ${inquiry.status || '-'}`);
  }

  if (actorName) lines.push(`*Changed By:* ${actorName}`);
  return lines.join('\n');
}

function buildProjectCreatedEmailHtml(project = {}, userName = '') {
  const departments = Array.isArray(project.selectedDepartments) && project.selectedDepartments.length
    ? project.selectedDepartments.join(', ')
    : '-';
  const panels = Array.isArray(project.panelSelections) && project.panelSelections.length
    ? project.panelSelections.map((item) => `${item.department}: ${item.panelType} × ${item.quantity}`).join('; ')
    : '-';

  return buildBaseEmail({
    heading: 'New Project Created',
    intro: `Hello ${escapeHtml(userName || 'Team Member')},<br/>A project has been created in Nexus Dashboard.`,
    rows: [
      ['Project ID', escapeHtml(project.projectId || '-')],
      ['Project Name', escapeHtml(project.projectName || '-')],
      ['Customer', escapeHtml(project.customerName || '-')],
      ['Departments', escapeHtml(departments)],
      ['Panels', escapeHtml(panels)],
      ['Status', escapeHtml(project.projectStatus || 'Planning')],
      ['Created On', escapeHtml(formatDateTime(project.createdAt || new Date()))],
    ],
  });
}

function buildTaskAssignmentEmailHtml({ userName = '', assignedToName = '', isAssignee = true, projectName = '', projectId = '', tasks = [] } = {}) {
  const taskRows = tasks.length
    ? `<ol style="margin:0; padding-left:20px;">${tasks.map((task) => (
        `<li style="margin-bottom:8px;"><strong>${escapeHtml(task.taskName || 'Task')}</strong>` +
        `${task.department || task.gridName ? ` (${escapeHtml([task.department, task.gridName].filter(Boolean).join(' / '))})` : ''}<br/>` +
        `Start: ${escapeHtml(formatDate(task.startDate || task.plannedStartDate))}<br/>` +
        `End: ${escapeHtml(formatDate(task.endDate || task.plannedEndDate))}</li>`
      )).join('')}</ol>`
    : '-';

  return buildBaseEmail({
    heading: 'New Task Assignment',
    intro: `Hello ${escapeHtml(userName || 'Team Member')},<br/>${isAssignee ? 'You have been assigned project-planning task(s).' : `${escapeHtml(assignedToName || 'A team member')} has been assigned project-planning task(s).`}`,
    rows: [
      ['Project ID', escapeHtml(projectId || '-')],
      ['Project Name', escapeHtml(projectName || '-')],
      ['Assigned Tasks', taskRows],
    ],
  });
}

function resolveTicketCustomerName(ticket = {}) {
  return ticket.customer?.customerName || ticket.customerName || '-';
}

function resolveTicketAssigneeName(ticket = {}) {
  return ticket.assignedTo?.name || ticket.assignedToName || '-';
}

function buildTicketCreatedWhatsAppMessage(ticket = {}) {
  return [
    '🎫 *New Ticket Created*',
    '',
    `*Ticket ID:* ${ticket.ticketId || '-'}`,
    `*Title:* ${ticket.title || '-'}`,
    `*Customer:* ${resolveTicketCustomerName(ticket)}`,
    `*Department:* ${ticket.department || '-'}`,
    `*Priority:* ${ticket.priority || 'Medium'}`,
    `*Assigned To:* ${resolveTicketAssigneeName(ticket)}`,
    `*Status:* ${ticket.status || 'New'}`,
  ].join('\n');
}

function buildTicketAssignedWhatsAppMessage(ticket = {}, userName = '') {
  return [
    `Hello *${userName || resolveTicketAssigneeName(ticket) || 'Team Member'}*`,
    '',
    'A ticket has been assigned to you.',
    `*Ticket ID:* ${ticket.ticketId || '-'}`,
    `*Title:* ${ticket.title || '-'}`,
    `*Customer:* ${resolveTicketCustomerName(ticket)}`,
    `*Priority:* ${ticket.priority || 'Medium'}`,
    `*Status:* ${ticket.status || 'Assigned'}`,
    '',
    'Please check the Nexus dashboard for details.',
  ].join('\n');
}

function buildTicketEmailHtml(ticket = {}, { userName = '', eventType = 'ticket_created', isAssignee = true, assignedToName = '' } = {}) {
  const isAssignment = eventType === 'ticket_assigned';
  return buildBaseEmail({
    heading: isAssignment ? 'Ticket Assigned' : 'New Ticket Created',
    intro: `Hello ${escapeHtml(userName || 'Team Member')},<br/>${isAssignment ? (isAssignee ? 'A ticket has been assigned to you.' : `A ticket has been assigned to ${escapeHtml(assignedToName || resolveTicketAssigneeName(ticket))}.`) : 'A ticket has been created in Nexus Dashboard.'}`,
    rows: [
      ['Ticket ID', escapeHtml(ticket.ticketId || '-')],
      ['Title', escapeHtml(ticket.title || '-')],
      ['Customer', escapeHtml(resolveTicketCustomerName(ticket))],
      ['Department', escapeHtml(ticket.department || '-')],
      ['Priority', escapeHtml(ticket.priority || 'Medium')],
      ['Assigned To', escapeHtml(resolveTicketAssigneeName(ticket))],
      ['Status', escapeHtml(ticket.status || 'New')],
      ['Created By', escapeHtml(ticket.createdBy?.name || '-')],
    ],
  });
}

const dashboardMessages = {
  inquiryCreated: (inquiry = {}) => `Inquiry ${inquiry.inquiryId || '-'} created by ${resolveCreatedByName(inquiry)} for ${resolveCustomerName(inquiry)}`,
  inquiryUpdated: (inquiry = {}) => `Inquiry ${inquiry.inquiryId || '-'} updated successfully`,
  inquiryStatusChanged: (inquiry = {}) => `Inquiry ${inquiry.inquiryId || '-'} moved to ${inquiry.status || '-'}`,
  inquiryDeleted: (inquiry = {}) => `Inquiry ${inquiry.inquiryId || '-'} deleted successfully`,
  projectCreatedAfterKickoff: (project = {}) => `Project ${project.projectId || '-'} - ${project.projectName || '-'} has been created automatically.`,
};

module.exports = {
  DEFAULT_AGENDA,
  escapeHtml,
  formatDate,
  formatDateTime,
  resolvePanelType,
  buildInquiryEmailHtml,
  buildNewInquiryWhatsAppMessage,
  buildInquiryChangedWhatsAppMessage,
  buildProjectCreatedWhatsAppMessage,
  buildProjectCreatedEmailHtml,
  buildTaskAssignmentGroupWhatsAppMessage,
  buildTaskAssignmentPersonalWhatsAppMessage,
  buildTaskAssignmentEmailHtml,
  buildProjectFieldChangedWhatsAppMessage,
  buildProjectDelayedWhatsAppMessage,
  buildKickoffSummaryWhatsAppMessage,
  buildKickoffAssignedWhatsAppMessage,
  buildKickoffEmailHtml,
  buildProjectCreatedAfterKickoffWhatsAppMessage,
  buildProjectCreatedAfterKickoffEmailHtml,
  buildTicketCreatedWhatsAppMessage,
  buildTicketAssignedWhatsAppMessage,
  buildTicketEmailHtml,
  dashboardMessages,
};
