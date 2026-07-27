const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../config/db');

const User = require('../models/User');
const TimesheetTask = require('../models/TimesheetTask');

const TASKS = [
  {
    title: 'Requirement Analysis',
    taskType: 'Documentation',
    status: 'Backlog',
    startTime: '09:00',
    endTime: '11:00',
  },
  {
    title: 'Customer Discussion',
    taskType: 'Meeting',
    status: 'Planned',
    startTime: '11:00',
    endTime: '12:30',
  },
  {
    title: 'Design Review',
    taskType: 'Review',
    status: 'In Progress',
    startTime: '13:00',
    endTime: '15:00',
  },
  {
    title: 'Implementation',
    taskType: 'Development',
    status: 'Review',
    startTime: '15:00',
    endTime: '17:00',
  },
  {
    title: 'Testing & Closure',
    taskType: 'Testing',
    status: 'Completed',
    startTime: '17:00',
    endTime: '18:00',
  },
];

async function seedTasks() {
  try {
    await connectDB();

    await TimesheetTask.deleteMany({});
    console.log('🗑️ Existing tasks removed');

    const employees = await User.find({
      role: 'employee',
    });

    const teamLeads = await User.find({
      role: 'team_lead',
    });

    const leadMap = {};

    for (const lead of teamLeads) {
      leadMap[lead.teamId?.toString()] = lead;
    }
console.log(`👥 Employees found: ${employees.length}`);

employees.forEach(e => {
  console.log(`${e.name} (${e.role})`);
});
    const tasks = [];

    for (const employee of employees) {
      const today = new Date();

      TASKS.forEach((task, index) => {
        const taskDate = new Date(today);

        taskDate.setDate(today.getDate() - 2 + index);

        tasks.push({
          employee: employee._id,

          title: `${task.title} - ${employee.name}`,

          description:
            `${task.title} assigned to ${employee.name}`,

          taskType: task.taskType,

          date: taskDate,

          startTime: task.startTime,

          endTime: task.endTime,

          status: task.status,

          kanbanOrder: index,

          createdBy:
            employee.reportsTo || employee._id,
        });
      });
    }

    await TimesheetTask.insertMany(tasks);

    console.log(
      `✅ Created ${tasks.length} Timesheet Tasks`
    );

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedTasks();