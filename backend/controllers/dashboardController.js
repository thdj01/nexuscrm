const Inquiry = require('../models/Inquiry');
const Project = require('../models/Project');
const Customer = require('../models/Customer');
const Ticket = require('../models/Ticket');
const { getLiveCustomerSnapshot } = require('../utils/customerUniversal');

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const INQUIRY_STATUS_OPTIONS = [
  'New',
  'Technical Evaluation',
  'Technical BoM Submitted',
  'BoM Approval Pending',
  'Revision',
  'Commercial BOM Submission',
  'Order Won',
  'Order Lost',
  'Inquiry Hold',
];

const INQUIRY_STATUS_ALIASES = {
  New: ['New'],
  'Technical Evaluation': ['Technical Evaluation', 'In Progress'],
  'Technical BoM Submitted': [
    'Technical BoM Submitted',
    'Technical BOM Submitted',
    'Technical BOM Submission',
    'Technical BoM Submission',
    'Technical Submit',
    'BOM Submitted',
    'Bom Submitted',
    'BOM SUBMITTED',
    'BoM Submitted',
  ],
  'BoM Approval Pending': [
    'BoM Approval Pending',
    'Technical BOM Approval',
    'Technical BoM Approval',
  ],
  Revision: ['Revision'],
  'Commercial BOM Submission': ['Commercial BOM Submission', 'Commercial Submit', 'Commercial Discussion', 'Quotation Submit'],
  'Order Won': ['Order Won', 'Order Received', 'Order Recieved', 'Project Won'],
  'Order Lost': ['Order Lost', 'Inquiry Lost', 'Inq. Lost'],
  'Inquiry Hold': ['Inquiry Hold'],
};

const LEGACY_INQUIRY_STATUS_LOOKUP = Object.entries(INQUIRY_STATUS_ALIASES).reduce((lookup, [normalizedStatus, aliases]) => {
  aliases.forEach((alias) => {
    lookup[alias] = normalizedStatus;
  });
  return lookup;
}, {});

const normalizeInquiryStatus = (status) => LEGACY_INQUIRY_STATUS_LOOKUP[status] || status || 'N/A';

const HIDDEN_TASK_STATUSES = new Set([
  'completed',
  'closed',
  'cancelled',
  'canceled',
  'removed',
  'void',
  'done',
]);

const CLOSED_PROJECT_STATUSES = ['Completed', 'Closed', 'Cancelled', 'Canceled', 'Removed'];

const statusIn = (status) => ({ $in: INQUIRY_STATUS_ALIASES[status] || [status] });

const padYearSuffix = (year) => String(year % 100).padStart(2, '0');

const getCurrentFinancialYearStart = (date = new Date()) => (
  date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
);

const ALL_YEARS_VALUE = 'all';
const ALL_YEARS_LABEL = 'All Years';

const parseFinancialYear = (value) => {
  if (typeof value !== 'string') return getCurrentFinancialYearStart();

  const match = value.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return getCurrentFinancialYearStart();

  const startYear = Number(match[1]);
  const endSuffix = Number(match[2]);

  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) {
    return getCurrentFinancialYearStart();
  }

  if (endSuffix !== Number(padYearSuffix(startYear + 1))) {
    return getCurrentFinancialYearStart();
  }

  return startYear;
};

const isAllYears = (financialYear) => String(financialYear || '').trim().toLowerCase() === ALL_YEARS_VALUE;

const getFinancialYearRange = (financialYear) => {
  if (isAllYears(financialYear)) {
    return {
      label: ALL_YEARS_LABEL,
      value: ALL_YEARS_VALUE,
      isAllYears: true,
      startYear: null,
      start: null,
      end: null,
    };
  }

  const startYear = parseFinancialYear(financialYear);
  const endYear = startYear + 1;

  return {
    label: `${startYear}-${padYearSuffix(endYear)}`,
    value: `${startYear}-${padYearSuffix(endYear)}`,
    isAllYears: false,
    startYear,
    start: new Date(startYear, 3, 1, 0, 0, 0, 0),
    end: new Date(endYear, 3, 1, 0, 0, 0, 0),
  };
};

const getFinancialYearFieldFilter = (field, fyRange) => {
  if (!fyRange || fyRange.isAllYears) return {};

  return {
    [field]: {
      $gte: fyRange.start,
      $lt: fyRange.end,
    },
  };
};

const getCreatedAtFilter = (fyRange) => getFinancialYearFieldFilter('createdAt', fyRange);

const getFinancialYearMonths = (fyRange) => {
  if (!fyRange || fyRange.isAllYears) {
    return monthNames.map((label, index) => ({
      year: null,
      month: index + 1,
      label,
      key: String(index + 1),
    }));
  }

  const months = [];

  for (let i = 0; i < 12; i += 1) {
    const date = new Date(fyRange.startYear, 3 + i, 1);
    months.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      label: monthNames[date.getMonth()],
      key: `${date.getFullYear()}-${date.getMonth() + 1}`,
    });
  }

  return months;
};

const mapMonthlyData = (rawData, outputKey, fyRange, rawValueKey = 'count') => {
  const months = getFinancialYearMonths(fyRange);
  const byMonth = new Map(
    rawData.map((item) => {
      const key = fyRange?.isAllYears ? String(item._id.month) : `${item._id.year}-${item._id.month}`;
      return [key, Number(item[rawValueKey] || 0)];
    })
  );

  return months.map((month) => ({
    month: month.label,
    [outputKey]: byMonth.get(month.key) || 0,
  }));
};

const getMonthGroupId = (dateField, fyRange) => (
  fyRange?.isAllYears
    ? { month: { $month: `$${dateField}` } }
    : { year: { $year: `$${dateField}` }, month: { $month: `$${dateField}` } }
);

const mapDistribution = (rawData) =>
  rawData.map((item) => ({
    name: item._id || 'N/A',
    value: item.count,
  }));

const mapInquiryStatusDistribution = (rawData = []) => {
  const countsByStatus = INQUIRY_STATUS_OPTIONS.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  rawData.forEach((item) => {
    const normalizedStatus = normalizeInquiryStatus(item._id);
    if (!countsByStatus[normalizedStatus] && countsByStatus[normalizedStatus] !== 0) {
      countsByStatus[normalizedStatus] = 0;
    }
    countsByStatus[normalizedStatus] += Number(item.count || 0);
  });

  return Object.entries(countsByStatus).map(([name, value]) => ({ name, value }));
};

const startOfDay = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value = new Date()) => {
  const date = startOfDay(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const addDays = (value, days) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return date;
};

const diffCalendarDays = (fromDate, toDate) => {
  const from = startOfDay(fromDate);
  const to = startOfDay(toDate);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
};

const toId = (value) => {
  if (!value) return '';
  if (value._id) return String(value._id);
  return String(value);
};

const normalizeTaskStatus = (status) => {
  const text = String(status || '').trim();
  return text || 'Pending';
};

const isHiddenTaskStatus = (status) => HIDDEN_TASK_STATUSES.has(String(status || '').trim().toLowerCase());

const isPendingStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'pending' || normalized === 'not started' || normalized === '';
};

const isInProgressStatus = (status) => String(status || '').trim().toLowerCase() === 'in progress';

const DELAYED_TASK_STATUS_VALUES = ['Delay', 'Delayed'];

const delayedTaskProjectQuery = () => ({
  $or: [
    { 'planningTasks.status': { $in: DELAYED_TASK_STATUS_VALUES } },
    { 'planningTasks.delayDays': { $gt: 0 } },
    { 'planningGrids.planningTasks.status': { $in: DELAYED_TASK_STATUS_VALUES } },
    { 'planningGrids.planningTasks.delayDays': { $gt: 0 } },
  ],
});

const overdueProjectQuery = (todayStart) => ({
  $or: [
    { projectEndDate: { $lt: todayStart } },
    { isDelayed: true },
    { delayedDays: { $gt: 0 } },
  ],
});

const getTaskDueDate = (task = {}, project = {}) => (
  task.plannedEndDate ||
  task.endDate ||
  task.dueDate ||
  task.plannedStartDate ||
  task.startDate ||
  project.projectEndDate ||
  null
);

const getProjectPlanningTasks = (project = {}) => {
  const gridTasks = Array.isArray(project.planningGrids)
    ? project.planningGrids.flatMap((grid) => (
        (grid.planningTasks || []).map((task, index) => ({
          ...task,
          gridId: task.gridId || grid.gridId || 'A',
          gridName: task.gridName || grid.gridName || grid.name || 'Project Planning Grid',
          _taskIndex: index,
        }))
      ))
    : [];

  if (gridTasks.length > 0) return gridTasks;

  return (project.planningTasks || []).map((task, index) => ({
    ...task,
    gridId: task.gridId || 'A',
    gridName: task.gridName || 'Project Planning Grid',
    _taskIndex: index,
  }));
};

const getBucket = (dueDate, todayStart, todayEnd, twoDaysEnd) => {
  if (!dueDate) return 'upcoming';

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 'upcoming';

  if (due < todayStart) return 'overdue';
  if (due >= todayStart && due <= todayEnd) return 'due_today';
  if (due > todayEnd && due <= twoDaysEnd) return 'due_in_2_days';
  return 'upcoming';
};

const getReminderMessage = (bucket, dueDate, todayStart) => {
  if (!dueDate) return 'No due date assigned';

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 'No due date assigned';

  const dayDiff = diffCalendarDays(todayStart, due);

  if (bucket === 'overdue') {
    const overdueDays = Math.abs(dayDiff) || 1;
    return `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue.`;
  }

  if (bucket === 'due_today') return 'Due today.';

  if (bucket === 'due_in_2_days') {
    return `You have ${dayDiff} day${dayDiff === 1 ? '' : 's'} left to complete this task.`;
  }

  if (dayDiff > 0) return `Due in ${dayDiff} day${dayDiff === 1 ? '' : 's'}.`;
  return 'Upcoming task.';
};

const getTaskReminderCounts = (items = []) => ({
  all: items.length,
  dueToday: items.filter((task) => task.bucket === 'due_today').length,
  dueIn2Days: items.filter((task) => task.bucket === 'due_in_2_days').length,
  overdue: items.filter((task) => task.bucket === 'overdue' || task.isOverdue).length,
  inProgress: items.filter((task) => isInProgressStatus(task.currentStatus)).length,
  pending: items.filter((task) => isPendingStatus(task.currentStatus)).length,
});

const getTaskSortWeight = (task = {}) => {
  if (task.bucket === 'overdue') return 0;
  if (task.bucket === 'due_today') return 1;
  if (task.bucket === 'due_in_2_days') return 2;
  if (isInProgressStatus(task.currentStatus)) return 3;
  if (isPendingStatus(task.currentStatus)) return 4;
  return 5;
};

const getTaskRemindersForUser = async (userId, fyRange) => {
  if (!userId) return { items: [], counts: getTaskReminderCounts([]) };

  const projectFinancialYearFilter = fyRange ? getFinancialYearFieldFilter('orderDate', fyRange) : {};

  const userObjectId = userId;
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const twoDaysEnd = endOfDay(addDays(todayStart, 2));

  const projects = await Project.find({
    ...projectFinancialYearFilter,
    projectStatus: { $nin: CLOSED_PROJECT_STATUSES },
    $or: [
      { 'planningTasks.assignedTo': userObjectId },
      { 'planningGrids.planningTasks.assignedTo': userObjectId },
    ],
  })
    .sort({ projectEndDate: 1, createdAt: -1 })
    .select('projectId projectName customerName projectStatus projectEndDate planningTasks planningGrids createdAt')
    .populate('planningTasks.assignedTo', 'name email role')
    .populate('planningGrids.planningTasks.assignedTo', 'name email role')
    .lean();

  const items = [];

  projects.forEach((project) => {
    getProjectPlanningTasks(project).forEach((task, index) => {
      const assigneeId = toId(task.assignedTo);
      const currentStatus = normalizeTaskStatus(task.status);

      if (assigneeId !== String(userId) || isHiddenTaskStatus(currentStatus)) return;

      const dueDate = getTaskDueDate(task, project);
      const bucket = getBucket(dueDate, todayStart, todayEnd, twoDaysEnd);
      const isOverdue = bucket === 'overdue';
      const taskIdentity = task.taskId || task._id || `${task.gridId || 'A'}-${task.taskName || index}-${index}`;

      items.push({
        id: `${project._id}-${task.gridId || 'A'}-${taskIdentity}`,
        taskId: task.taskId || '',
        taskTitle: task.taskName || task.title || 'Untitled task',
        projectMongoId: project._id,
        projectId: project.projectId || '',
        projectName: project.projectName || project.customerName || 'Untitled project',
        projectStatus: project.projectStatus || '',
        gridId: task.gridId || 'A',
        gridName: task.gridName || 'Project Planning Grid',
        department: task.department || task.taskType || '',
        currentStatus,
        assignedUser: task.assignedTo || null,
        dueDate,
        bucket,
        isOverdue,
        priority: isOverdue ? 'urgent' : (task.priority || ''),
        remainingLabel: getReminderMessage(bucket, dueDate, todayStart),
        reminderMessage: getReminderMessage(bucket, dueDate, todayStart),
      });
    });
  });

  items.sort((a, b) => {
    const weightDiff = getTaskSortWeight(a) - getTaskSortWeight(b);
    if (weightDiff !== 0) return weightDiff;

    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return aDate - bDate;
  });

  const limitedItems = items.slice(0, 50);

  return {
    items: limitedItems,
    counts: getTaskReminderCounts(limitedItems),
  };
};

// @desc Get dashboard stats
// @route GET /api/dashboard/stats
// @access Private
const getDashboardStats = async (req, res, next) => {
  try {
    const fyRange = getFinancialYearRange(req.query.financialYear);
    const inquiryFYFilter = getFinancialYearFieldFilter('inquiryDate', fyRange);
    const projectFYFilter = getFinancialYearFieldFilter('orderDate', fyRange);
    const createdAtFYFilter = getCreatedAtFilter(fyRange);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const weekEnd = new Date(todayEnd);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const activeTicketFilter = { isActive: true, ...createdAtFYFilter };
    const openTicketFilter = {
      ...activeTicketFilter,
      status: { $nin: ['Closed', 'Void'] },
    };
    const activeProjectFilter = {
      ...projectFYFilter,
      projectStatus: { $nin: CLOSED_PROJECT_STATUSES },
    };
    const delayedTaskProjectFilter = {
      ...activeProjectFilter,
      ...delayedTaskProjectQuery(),
    };
    const overdueProjectFilter = {
      ...activeProjectFilter,
      ...overdueProjectQuery(todayStart),
    };

    // =========================
    // STAT COUNTS
    // =========================

    const [
      totalInquiries,
      newInquiries,
      quotationSubmit,
      wonProjects,
      lostProjects,
      completedProjects,
      totalProjects,
      totalCustomers,
      ongoingInquiries,
      delayedProjects,
      projectsDueToday,
      projectsDueThisWeek,
      overdueProjects,
      totalTickets,
      newTickets,
      assignedTickets,
      workingTickets,
      customerPendingTickets,
      closedTickets,
      voidTickets,
      criticalTickets,
    ] = await Promise.all([
      Inquiry.countDocuments(inquiryFYFilter),
      Inquiry.countDocuments({ ...inquiryFYFilter, status: 'New' }),
      Inquiry.countDocuments({ ...inquiryFYFilter, status: statusIn('Commercial BOM Submission') }),
      Inquiry.countDocuments({ ...inquiryFYFilter, status: statusIn('Order Won') }),
      Inquiry.countDocuments({ ...inquiryFYFilter, status: statusIn('Order Lost') }),
      Project.countDocuments({ ...projectFYFilter, projectStatus: 'Completed' }),
      Project.countDocuments(projectFYFilter),
      Customer.countDocuments(),
      Inquiry.countDocuments({ ...inquiryFYFilter, status: statusIn('Technical Evaluation') }),
      Project.countDocuments(overdueProjectFilter),
      Project.countDocuments({
        ...activeProjectFilter,
        projectEndDate: { $gte: todayStart, $lte: todayEnd },
      }),
      Project.countDocuments({
        ...activeProjectFilter,
        projectEndDate: { $gte: todayStart, $lte: weekEnd },
      }),
      Project.countDocuments(overdueProjectFilter),
      Ticket.countDocuments(activeTicketFilter),
      Ticket.countDocuments({ ...activeTicketFilter, status: 'New' }),
      Ticket.countDocuments({ ...activeTicketFilter, status: 'Assigned' }),
      Ticket.countDocuments({ ...activeTicketFilter, status: 'Working' }),
      Ticket.countDocuments({ ...activeTicketFilter, status: 'Customer Side Pending' }),
      Ticket.countDocuments({ ...activeTicketFilter, status: 'Closed' }),
      Ticket.countDocuments({ ...activeTicketFilter, status: 'Void' }),
      Ticket.countDocuments({ ...openTicketFilter, priority: 'Critical' }),
    ]);

    const openTickets = totalTickets - closedTickets - voidTickets;

    // =========================
    // REVENUE / DELAY SUMMARY
    // =========================

    const [monthlyRevResult, totalRevResult, totalDelayedDaysResult, delayedTasksResult] = await Promise.all([
      Project.aggregate([
        {
          $match: {
            ...projectFYFilter,
            projectStatus: 'Completed',
            updatedAt: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: '$orderValue' } } },
      ]),
      Project.aggregate([
        { $match: { ...projectFYFilter, projectStatus: 'Completed' } },
        { $group: { _id: null, total: { $sum: '$orderValue' } } },
      ]),
      Project.aggregate([
        { $match: { ...projectFYFilter, delayedDays: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$delayedDays' } } },
      ]),
      Project.countDocuments(delayedTaskProjectFilter),
    ]);

    const monthlyRevenue = monthlyRevResult[0]?.total || 0;
    const totalRevenue = totalRevResult[0]?.total || 0;
    const totalDelayedDays = totalDelayedDaysResult[0]?.total || 0;
    const delayedTasks = delayedTasksResult || 0;

    // =========================
    // MONTHLY TRENDS - SELECTED FINANCIAL YEAR
    // =========================

    const [inquiryTrend, projectTrend, ticketTrend] = await Promise.all([
      Inquiry.aggregate([
        { $match: inquiryFYFilter },
        {
          $group: {
            _id: getMonthGroupId('inquiryDate', fyRange),
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Project.aggregate([
        { $match: projectFYFilter },
        {
          $group: {
            _id: getMonthGroupId('orderDate', fyRange),
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Ticket.aggregate([
        { $match: activeTicketFilter },
        {
          $group: {
            _id: getMonthGroupId('createdAt', fyRange),
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    // =========================
    // DISTRIBUTIONS
    // =========================

    const [
      statusDist,
      projectStatusDist,
      ticketStatusDist,
      ticketPriorityDist,
      ticketTypeDist,
    ] = await Promise.all([
      Inquiry.aggregate([
        { $match: inquiryFYFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Project.aggregate([
        { $match: projectFYFilter },
        { $group: { _id: '$projectStatus', count: { $sum: 1 } } },
      ]),
      Ticket.aggregate([
        { $match: activeTicketFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Ticket.aggregate([
        { $match: activeTicketFilter },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Ticket.aggregate([
        { $match: activeTicketFilter },
        { $group: { _id: '$ticketType', count: { $sum: 1 } } },
      ]),
    ]);

    // =========================
    // SALES FUNNEL / FOLLOWUPS
    // =========================

    const technicalBomSubmissionCount = await Inquiry.countDocuments({
      ...inquiryFYFilter,
      status: statusIn('Technical BoM Submitted'),
    });

    const funnelData = [
      { stage: 'New', count: newInquiries },
      { stage: 'Technical Evaluation', count: ongoingInquiries },
      { stage: 'Technical BOM Submission', count: technicalBomSubmissionCount },
      { stage: 'Commercial BOM Submission', count: quotationSubmit },
      { stage: 'Order Won', count: wonProjects },
    ];

    const followUpEnd = endOfDay(new Date());

    const [pendingFollowUps, taskReminders] = await Promise.all([
      Inquiry.countDocuments({
        ...inquiryFYFilter,
        nextFollowUpDate: { $lte: followUpEnd },
        status: { $nin: [...statusIn('Order Won').$in, ...statusIn('Order Lost').$in] },
      }),
      getTaskRemindersForUser(req.user?._id || req.user?.id, fyRange),
    ]);

    // =========================
    // RESPONSE
    // =========================

    res.json({
      success: true,
      data: {
        financialYear: {
          selected: fyRange.label,
          startDate: fyRange.start,
          endDate: fyRange.end ? new Date(fyRange.end.getTime() - 1) : null,
        },
        stats: {
          totalInquiries,
          newInquiries,
          ongoingInquiries,
          quotationSubmit,
          quotationSent: quotationSubmit,
          wonProjects,
          lostProjects,
          completedProjects,
          totalProjects,
          totalCustomers,
          monthlyRevenue,
          totalRevenue,
          pendingFollowUps,
          delayedProjects,
          totalDelayedDays,
          delayedTasks,
          projectsDueToday,
          projectsDueThisWeek,
          overdueProjects,
          totalTickets,
          newTickets,
          openTickets,
          assignedTickets,
          workingTickets,
          customerPendingTickets,
          closedTickets,
          voidTickets,
          criticalTickets,
        },
        charts: {
          inquiryTrend: mapMonthlyData(inquiryTrend, 'inquiries', fyRange),
          statusDistribution: mapInquiryStatusDistribution(statusDist),
          salesFunnel: funnelData,
          projectTrend: mapMonthlyData(projectTrend, 'projects', fyRange),
          projectStatusDistribution: mapDistribution(projectStatusDist),
          ticketTrend: mapMonthlyData(ticketTrend, 'tickets', fyRange),
          ticketStatusDistribution: mapDistribution(ticketStatusDist),
          ticketPriorityDistribution: mapDistribution(ticketPriorityDist),
          ticketTypeDistribution: mapDistribution(ticketTypeDist),
        },
        taskReminders,
      },
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

// @desc Get recent activity
// @route GET /api/dashboard/recent
// @access Private
const getRecentActivity = async (req, res, next) => {
  try {
    const fyRange = getFinancialYearRange(req.query.financialYear);
    const inquiryFYFilter = getFinancialYearFieldFilter('inquiryDate', fyRange);
    const projectFYFilter = getFinancialYearFieldFilter('orderDate', fyRange);
    const createdAtFYFilter = getCreatedAtFilter(fyRange);

    const [recentInquiries, recentProjects, recentTickets] = await Promise.all([
      Inquiry.find(inquiryFYFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select('inquiryId customerRef customerName status createdAt panelTypes panelType customPanelType')
        .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes'),

      Project.find(projectFYFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select('projectId customerRef customerName projectName projectStatus createdAt inquiryNumber inquiryReference sourceInquirySnapshot')
        .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes')
        .populate('inquiryReference', 'inquiryId'),

      Ticket.find({ isActive: true, ...createdAtFYFilter })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('ticketId title status priority ticketType customer assignedTo createdAt')
        .populate('customer', 'customerName')
        .populate('assignedTo', 'name email role'),
    ]);

    res.json({
      success: true,
      data: {
        financialYear: {
          selected: fyRange.label,
          startDate: fyRange.start,
          endDate: fyRange.end ? new Date(fyRange.end.getTime() - 1) : null,
        },
        recentInquiries: recentInquiries.map((item) => getLiveCustomerSnapshot(item.toObject ? item.toObject() : item)),
        recentProjects: recentProjects.map((item) => getLiveCustomerSnapshot(item.toObject ? item.toObject() : item)),
        recentTickets,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getRecentActivity,
};
