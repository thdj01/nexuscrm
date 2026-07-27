const Team = require('../models/Team');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

const User = require('../models/User');
const Inquiry = require('../models/Inquiry');
const Project = require('../models/Project');
const Customer = require('../models/Customer');
const Notification = require('../models/Notification');
const Counter = require('../models/Counter');

const MONGO_URI = process.env.MONGODB_URI;

const seedData = async () => {
  try {
    await mongoose.connect(MONGO_URI);

    console.log('✅ Connected to MongoDB');

    // Drop Database
    await mongoose.connection.db.dropDatabase();

    console.log('🗑️ Database Dropped');

    // Reconnect
    await mongoose.disconnect();
    await mongoose.connect(MONGO_URI);

    console.log('🔄 Reconnected');

    // Initialize Counter
    await Counter.insertMany([
    {
      id: 'inquiryId',
      seq: 1349,
    },
    {
      id: 'customerId',
      seq: 0,
    },
  ]);

    console.log('🔢 Counter Initialized');

    // USERS
// USERS
const users = await User.create([
  {
    name: 'Neel Patel',
    email: 'neel.patel@nexus.com',
    password: 'admin12345',
    role: 'admin',
  },
  
  {
    name: 'Kevin Patel',
    email: 'kevin.patel@nexus.com',
    password: 'admin12345',
    role: 'admin',
  },
  
  // HODs
  {
    name: 'Manan Shah',
    email: 'manan.shah@nexus.com',
    password: 'hod12345',
    role: 'hod',
  },

  {
    name: 'Nirav Patel',
    email: 'nirav.patel@nexus.com',
    password: 'hod12345',
    role: 'hod',
  },

  {
    name: 'Pratik Mistry',
    email: 'pratik.mistry@nexus.com',
    password: 'hod12345',
    role: 'hod',
  },
  
  // Team Leads
  {
    name: 'Amit Patel',
    email: 'amit.patel@nexus.com',
    password: 'lead12345',
    role: 'team_lead',
  },

  {
    name: 'Karan Shah',
    email: 'karan.shah@nexus.com',
    password: 'lead12345',
    role: 'team_lead',
  },

  {
    name: 'Dhruv Mehta',
    email: 'dhruv.mehta@nexus.com',
    password: 'lead12345',
    role: 'team_lead',
  },

  {
    name: 'Pooja Jain',
    email: 'pooja.jain@nexus.com',
    password: 'lead12345',
    role: 'team_lead',
  },
  {
    name: 'Ravi Darji',
    email: 'ravi.darji@nexus.com',
    password: 'lead12345',
    role: 'team_lead',
  },
  
  {
    name: 'Astha Verma',
    email: 'astha.verma@nexus.com',
    password: 'astha123',
    role: 'employee',
  },
  
  {
    name: 'Juhee Gade',
    email: 'juhee.gade@nexus.com',
    password: 'Juhee123',
    role: 'employee',
  },
  
  
  
  // Sales Employees
  {
    name: 'Vishal Patel',
    email: 'vishal.patel@nexus.com',
    password: 'lead12345',
    role: 'team_lead',
  },
    
  {
    name: 'Rahul Patel',
    email: 'rahul.patel@nexus.com',
    password: 'employee123',
    role: 'employee',
  },

  {
    name: 'Priya Shah',
    email: 'priya.shah@nexus.com',
    password: 'employee123',
    role: 'employee',
  },

  // Estimation Employees
  {
    name: 'Yash Mehta',
    email: 'yash.mehta@nexus.com',
    password: 'employee123',
    role: 'employee',
  },

  {
    name: 'Nidhi Patel',
    email: 'nidhi.patel@nexus.com',
    password: 'employee123',
    role: 'employee',
  },

  // Design Employees
  {
    name: 'Parth Shah',
    email: 'parth.shah@nexus.com',
    password: 'employee123',
    role: 'employee',
  },

  {
    name: 'Riya Desai',
    email: 'riya.desai@nexus.com',
    password: 'employee123',
    role: 'employee',
  },

  // Programming Employees
  {
    name: 'Supriya Yadav',
    email: 'supriya.yadav@nexus.com',
    password: 'employee123',
    role: 'employee',
  },

  {
    name: 'Yash Bhavsar',
    email: 'yash.bhavsar@nexus.com',
    password: 'employee123',
    role: 'employee',
  },

  // Manufacturing Employees
  {
    name: 'Harsh Patel',
    email: 'harsh.patel@nexus.com',
    password: 'employee123',
    role: 'employee',
  },

  {
    name: 'Krupa Shah',
    email: 'krupa.shah@nexus.com',
    password: 'employee123',
    role: 'employee',
  },
]);

    console.log(
      `👥 Created ${users.length} users`
    );
// Admins
const adminUser = users.find(
  u => u.email === 'neel.patel@nexus.com'
);

const adminUser2 = users.find(
  u => u.email === 'kevin.patel@nexus.com'
);

// HODs
const salesHod = users.find(
  u => u.email === 'manan.shah@nexus.com'
);

const manufacturingHod = users.find(
  u => u.email === 'nirav.patel@nexus.com'
);

const engineeringHod = users.find(
  u => u.email === 'pratik.mistry@nexus.com'
);

// Team Leads
const salesLead = users.find(
  u => u.email === 'amit.patel@nexus.com'
);

const estimationLead = users.find(
  u => u.email === 'karan.shah@nexus.com'
);

const designLead = users.find(
  u => u.email === 'dhruv.mehta@nexus.com'
);

const programmingLead = users.find(
  u => u.email === 'pooja.jain@nexus.com'
);

const aiLead = users.find(
  u => u.email === 'ravi.darji@nexus.com'
);

const manufacturingLead = users.find(
  u => u.email === 'vishal.patel@nexus.com'
);

// AI Team Employees
const juheeGade = users.find(
  u => u.email === 'juhee.gade@nexus.com'
);

const asthaVerma = users.find(
  u => u.email === 'astha.verma@nexus.com'
);

// Sales Team Employees
const rahulPatel = users.find(
  u => u.email === 'rahul.patel@nexus.com'
);

const priyaShah = users.find(
  u => u.email === 'priya.shah@nexus.com'
);

// Estimation Team Employees
const yashMehta = users.find(
  u => u.email === 'yash.mehta@nexus.com'
);

const nidhiPatel = users.find(
  u => u.email === 'nidhi.patel@nexus.com'
);

// Design Team Employees
const parthShah = users.find(
  u => u.email === 'parth.shah@nexus.com'
);

const riyaDesai = users.find(
  u => u.email === 'riya.desai@nexus.com'
);

// Programming Team Employees
const supriyaYadav = users.find(
  u => u.email === 'supriya.yadav@nexus.com'
);

const yashBhavsar = users.find(
  u => u.email === 'yash.bhavsar@nexus.com'
);

// Manufacturing Team Employees
const harshPatel = users.find(
  u => u.email === 'harsh.patel@nexus.com'
);

const krupaShah = users.find(
  u => u.email === 'krupa.shah@nexus.com'
);


// CREATE TEAMS

const salesTeam = await Team.create({
  name: 'Sales Team',
  description: 'Sales Department',
  hod: salesHod._id,
  teamLead: salesLead._id,
  members: [rahulPatel._id, priyaShah._id],
  createdBy: adminUser._id,
  updatedBy: adminUser._id,
});

const estimationTeam = await Team.create({
  name: 'Estimation Team',
  description: 'Estimation Department',
  hod: engineeringHod._id,
  teamLead: estimationLead._id,
  members: [yashMehta._id, nidhiPatel._id],
  createdBy: adminUser._id,
  updatedBy: adminUser._id,
});

const designTeam = await Team.create({
  name: 'Design Team',
  description: 'Design Department',
  hod: engineeringHod._id,
  teamLead: designLead._id,
  members: [parthShah._id, riyaDesai._id],
  createdBy: adminUser._id,
  updatedBy: adminUser._id,
});

const programmingTeam = await Team.create({
  name: 'Programming Team',
  description: 'Programming Department',
  hod: engineeringHod._id,
  teamLead: programmingLead._id,
  members: [supriyaYadav._id, yashBhavsar._id],
  createdBy: adminUser._id,
  updatedBy: adminUser._id,
});

const aiTeam = await Team.create({
  name: 'AI Team',
  description: 'Artificial Intelligence Department',
  hod: engineeringHod._id,
  teamLead: aiLead._id,
  members: [juheeGade._id, asthaVerma._id],
  createdBy: adminUser._id,
  updatedBy: adminUser._id,
});

const manufacturingTeam = await Team.create({
  name: 'Manufacturing Team',
  description: 'Manufacturing Department',
  hod: manufacturingHod._id,
  teamLead: manufacturingLead._id,
  members: [harshPatel._id, krupaShah._id],
  createdBy: adminUser._id,
  updatedBy: adminUser._id,
});

console.log('🏢 Created 6 Teams');

// TEAM LEADS

await User.findByIdAndUpdate(salesLead._id, {
  teamId: salesTeam._id,
  reportsTo: salesHod._id,
});

await User.findByIdAndUpdate(estimationLead._id, {
  teamId: estimationTeam._id,
  reportsTo: engineeringHod._id,
});

await User.findByIdAndUpdate(designLead._id, {
  teamId: designTeam._id,
  reportsTo: engineeringHod._id,
});

await User.findByIdAndUpdate(programmingLead._id, {
  teamId: programmingTeam._id,
  reportsTo: engineeringHod._id,
});

await User.findByIdAndUpdate(aiLead._id, {
  teamId: aiTeam._id,
  reportsTo: engineeringHod._id,
});

await User.findByIdAndUpdate(manufacturingLead._id, {
  teamId: manufacturingTeam._id,
  reportsTo: manufacturingHod._id,
});

// EMPLOYEES

const employeeMappings = [
  [rahulPatel, salesTeam, salesLead],
  [priyaShah, salesTeam, salesLead],

  [yashMehta, estimationTeam, estimationLead],
  [nidhiPatel, estimationTeam, estimationLead],

  [parthShah, designTeam, designLead],
  [riyaDesai, designTeam, designLead],

  [supriyaYadav, programmingTeam, programmingLead],
  [yashBhavsar, programmingTeam, programmingLead],

  [juheeGade, aiTeam, aiLead],
  [asthaVerma, aiTeam, aiLead],

  [harshPatel, manufacturingTeam, manufacturingLead],
  [krupaShah, manufacturingTeam, manufacturingLead],
];

for (const [employee, team, lead] of employeeMappings) {
  await User.findByIdAndUpdate(employee._id, {
    teamId: team._id,
    reportsTo: lead._id,
  });
}

console.log('👥 Team hierarchy assigned');

    // CUSTOMERS
    await Customer.create({
      customerName: 'Rajesh Patel',
      companyName: 'Patel Industries Pvt Ltd',
      contactPerson: 'Rajesh Patel',
      email: 'rajesh@patelindustries.com',
      mobileNumber: '9812345678',
      city: 'Ahmedabad',
      gstNumber: '24ABCDE1234F1Z5',
      totalProjects: 3,
      totalBusinessValue: 2500000,
      createdBy: adminUser._id,
    });

    await Customer.create({
      customerName: 'Suresh Kumar',
      companyName: 'Kumar Textiles Ltd',
      contactPerson: 'Suresh Kumar',
      email: 'suresh@kumartextiles.com',
      mobileNumber: '9823456789',
      city: 'Surat',
      totalProjects: 1,
      totalBusinessValue: 850000,
      createdBy: adminUser._id,
    });

    await Customer.create({
      customerName: 'Meena Shah',
      companyName: 'Shah Engineering Works',
      contactPerson: 'Meena Shah',
      email: 'meena@shahengg.com',
      mobileNumber: '9834567890',
      city: 'Vadodara',
      totalProjects: 2,
      totalBusinessValue: 1750000,
      createdBy: adminUser._id,
    });

    await Customer.create({
      customerName: 'Vivek Joshi',
      companyName: 'Joshi Chemical Industries',
      contactPerson: 'Vivek Joshi',
      email: 'vivek@joshichem.com',
      mobileNumber: '9845678901',
      city: 'Rajkot',
      totalProjects: 0,
      totalBusinessValue: 0,
      createdBy: adminUser._id,
    });
    console.log(
      '🏢 Created Customers'
    );

    // DATES
    const today = new Date();

    const nextWeek = new Date(
      today.getTime() +
        7 *
          24 *
          60 *
          60 *
          1000
    );

    const yesterday = new Date(
      today.getTime() -
        24 *
          60 *
          60 *
          1000
    );

    // INQUIRIES
    const inquiries =
      await Inquiry.create([
        {
          inquiryDate:
            new Date(
              '2024-01-10'
            ),

          customerName:
            'Rajesh Patel',

          companyName:
            'Patel Industries Pvt Ltd',

          contactPerson:
            'Rajesh Patel',

          mobileNumber:
            '9812345678',

          email:
            'rajesh@patelindustries.com',

          location:
            'Ahmedabad',

          productType: 'MCC',

          projectName:
            'New Factory MCC Panel',

          estimatedValue:
            850000,

          priority: 'High',

          status:
            'Order Received',

          convertedToProject: true,

          nextFollowUpDate:
            nextWeek,

          remarks:
            'Very interested customer',

          createdBy:
            adminUser._id,
        },

        {
          inquiryDate:
            new Date(
              '2024-01-15'
            ),

          customerName:
            'Suresh Kumar',

          companyName:
            'Kumar Textiles Ltd',

          contactPerson:
            'Suresh Kumar',

          mobileNumber:
            '9823456789',

          email:
            'suresh@kumartextiles.com',

          location: 'Surat',

          productType:
            'MCC',

          projectName:
            'MCC Panel',

          estimatedValue:
            450000,

          priority:
            'Medium',

          status:
            'Commercial Submit',

          nextFollowUpDate:
            nextWeek,

          remarks:
            'Commercial submitted',

          createdBy:
            adminUser._id,
        },

        {
          inquiryDate:
            new Date(
              '2024-02-01'
            ),

          customerName:
            'Meena Shah',

          companyName:
            'Shah Engineering Works',

          contactPerson:
            'Meena Shah',

          mobileNumber:
            '9834567890',

          email:
            'meena@shahengg.com',

          location:
            'Vadodara',

          productType: 'MCC',

          projectName:
            'Main MCC Panel',

          estimatedValue:
            1200000,

          priority: 'High',

          status:
            'Commercial Discussion',

          nextFollowUpDate:
            yesterday,

          remarks:
            'Price negotiation ongoing',

          createdBy:
            adminUser._id,
        },

        {
          inquiryDate:
            new Date(
              '2024-02-10'
            ),

          customerName:
            'Vivek Joshi',

          companyName:
            'Joshi Chemical Industries',

          contactPerson:
            'Vivek Joshi',

          mobileNumber:
            '9845678901',

          email:
            'vivek@joshichem.com',

          location:
            'Rajkot',

          productType: 'VFD',

          projectName:
            'VFD Panel for Pumps',

          estimatedValue:
            320000,

          priority: 'Low',

          status: 'New',

          nextFollowUpDate:
            nextWeek,

          remarks:
            'Initial discussion pending',

          createdBy:
            adminUser._id,
        },

        {
          inquiryDate:
            new Date(
              '2024-01-20'
            ),

          customerName:
            'Harish Modi',

          companyName:
            'Modi Pharmaceuticals',

          contactPerson:
            'Harish Modi',

          mobileNumber:
            '9856789012',

          email:
            'harish@modipharma.com',

          location:
            'Gandhinagar',

          productType: 'PLC',

          projectName:
            'Automation PLC Panel',

          estimatedValue:
            950000,

          priority: 'High',

          status:
            'Inquiry Lost',

          remarks:
            'Lost due to pricing',

          createdBy:
            adminUser._id,
        },
      ]);

    console.log(
      `📋 Created ${inquiries.length} inquiries`
    );

    // PROJECTS
    const projects = await Project.create([
      {
        customerName: 'Rajesh Patel',
        companyName: 'Patel Industries Pvt Ltd',
        projectName: 'New Factory MCC Panel',
        quantity: 1,
        selectedDepartments: ['Design'],
        panelSelections: [{ department: 'Design', panelType: 'MCC', quantity: 1, planningMode: 'common' }],
        planningGrids: [{
          gridId: 'DESIGN-MCC-COMMON',
          gridName: 'Design · MCC – Quantity 1',
          department: 'Design',
          panelType: 'MCC',
          panelQuantity: 1,
          planningMode: 'common',
          isCommon: true,
          planningTasks: [],
        }],
        orderValue: 850000,
        createdBy: adminUser._id,
        assignedTo: aiLead._id,
        projectStatus: 'Planning',
      },
    ]);


    console.log(
      `🏗️ Created ${projects.length} projects`
    );

    await Inquiry.findByIdAndUpdate(
      inquiries[0]._id,
      {
        projectReference:
          projects[0]._id,
      }
    );

    // NOTIFICATIONS
    await Notification.create([
      {
        title: 'Follow-up Overdue',
        message: 'Follow up',
        type: 'overdue',
        priority: 'High',
        isRead: false,
        recipient: aiLead._id,
        relatedInquiry: inquiries[2]._id,
      },

      {
        title: 'Order Received 🎉',
        message: `Inquiry ${inquiries[0].inquiryId} confirmed successfully`,
        type: 'order_confirmed',
        priority: 'High',
        isRead: true,
        recipient: adminUser._id,
        relatedInquiry: inquiries[0]._id,
      },
    ]);


    console.log(
      '🔔 Notifications Created'
    );

    console.log(
      '\n✅ Seed Data Created Successfully!\n'
    );

    process.exit(0);
  } catch (error) {
    console.error(
      '❌ Seed Error:',
      error.message
    );

    process.exit(1);
  }
};

seedData();