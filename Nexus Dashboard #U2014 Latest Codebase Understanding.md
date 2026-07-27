# Nexus Dashboard — Latest Codebase Understanding Report

## 0. Source Inspected

Latest uploaded ZIP inspected from:

```text
/mnt/data/nexus-dashboard.zip
```

Extracted project root:

```text
/mnt/data/audit_latest/nexus-dashboard
```

Inspection was based on actual code files, not README assumptions.

Validation performed:

| Check                       | Result                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Backend JS syntax check     | Passed, 0 syntax errors                                                                      |
| Frontend JSX/JS parse check | Passed, 0 parse errors                                                                       |
| Frontend production build   | Blocked by existing Rollup optional dependency issue: `@rollup/rollup-linux-x64-gnu` missing |

No code was modified.

---

# 1. Project Structure Analysis

## Root structure

```text
nexus-dashboard/
├── backend/
├── frontend/
└── .vscode/
```

## Backend structure

Important backend areas:

| Area                | Path                                                   |
| ------------------- | ------------------------------------------------------ |
| Entry point         | `backend/server.js`                                    |
| Database connection | `backend/config/db.js`                                 |
| Planning templates  | `backend/config/projectPlanningTemplates.js`           |
| Routes              | `backend/routes/*.js`                                  |
| Controllers         | `backend/controllers/*.js`                             |
| Models              | `backend/models/*.js`                                  |
| Middleware          | `backend/middleware/*.js`                              |
| Services            | `backend/services/*.js`                                |
| Utilities           | `backend/utils/*.js`                                   |
| Seed data           | `backend/seed/*.js`                                    |
| Migration script    | `backend/scripts/migrations/001_add_team_hierarchy.js` |
| Uploads             | `backend/uploads`                                      |
| WhatsApp session    | `backend/.wwebjs_auth`                                 |

Backend includes:

```text
backend/node_modules
backend/uploads
backend/.env
backend/.wwebjs_auth
```

These are runtime/deployment artifacts included inside the uploaded ZIP.

## Frontend structure

Important frontend areas:

| Area                 | Path                                      |
| -------------------- | ----------------------------------------- |
| App routes           | `frontend/src/App.jsx`                    |
| API services         | `frontend/src/api`                        |
| Layout               | `frontend/src/layouts/MainLayout.jsx`     |
| Common components    | `frontend/src/components/common`          |
| Inquiry components   | `frontend/src/components/inquiry`         |
| Project components   | `frontend/src/components/project`         |
| Ticket components    | `frontend/src/components/ticket`          |
| Timesheet components | `frontend/src/components/timesheet`       |
| Pages                | `frontend/src/pages`                      |
| Auth context         | `frontend/src/context/AuthContext.jsx`    |
| Master data          | `frontend/src/data`                       |
| Validation           | `frontend/src/utils/inquiryValidation.js` |

Frontend includes:

```text
frontend/node_modules
frontend/dist
```

---

# 2. Runtime Boot Flow

Backend runtime starts from:

```text
backend/server.js
```

Actual startup sequence:

1. Loads environment variables using `dotenv`.
2. Connects MongoDB using `connectDB()`.
3. Seeds Department Master using `seedDefaultDepartments()`.
4. Initializes WhatsApp using `initWhatsApp()`.
5. Initializes kickoff workflow scheduler using `initKickoffWorkflowScheduler()`.
6. Starts Express app.
7. Serves `/uploads` statically from `backend/uploads`.
8. Mounts all API route modules.
9. Starts server on `PORT` or `5000`.

Mounted backend API prefixes:

```text
/api/auth
/api/inquiries
/api/projects
/api/kickoff-workflows
/api/customers
/api/notifications
/api/dashboard
/api/departments
/api/users
/api/test-whatsapp
/api/timesheet
/api/teams
/api/tickets
/api/health
```

---

# 3. Module Inventory

## Active backend modules

| Module           | Backend files                                                                                                                                | Purpose                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Authentication   | `authRoutes.js`, `authController.js`, `authMiddleware.js`, `User.js`                                                                         | Login, profile, avatar, password change, JWT protection             |
| Users            | `userRoutes.js`, `userController.js`, `User.js`                                                                                              | Admin user management and assignable-user lookup                    |
| Departments      | `departmentRoutes.js`, `departmentController.js`, `Department.js`, `departmentSeedService.js`                                                | Department Master                                                   |
| Teams            | `teamRoutes.js`, `teamController.js`, `Team.js`                                                                                              | HOD/team lead/employee hierarchy                                    |
| Customers        | `customerRoutes.js`, `customerController.js`, `Customer.js`                                                                                  | Customer master                                                     |
| Inquiries        | `inquiryRoutes.js`, `inquiryController.js`, `Inquiry.js`                                                                                     | Inquiry workflow, attachments, status handling                      |
| Projects         | `projectRoutes.js`, `projectController.js`, `Project.js`, `ProjectActivityLog.js`                                                            | Project management, planning grids, documents, activity logs        |
| Kickoff Workflow | `kickoffWorkflowRoutes.js`, `kickoffWorkflowController.js`, `KickoffWorkflow.js`, `kickoffWorkflowService.js`, `kickoffWorkflowScheduler.js` | Order Won kickoff scheduling and project creation                   |
| Notifications    | `notificationRoutes.js`, `notificationController.js`, `Notification.js`, `notificationService.js`, `outlookService.js`                       | Internal notifications and email side effects                       |
| WhatsApp         | `whatsappService.js`, `testWhatsappRoute.js`                                                                                                 | WhatsApp outgoing messages and inbound project task update commands |
| Timesheet        | `timesheetRoutes.js`, `timesheetController.js`, `TimesheetTask.js`, `projectTimesheetSyncService.js`                                         | Timesheet CRUD, Kanban, calendar, admin, project sync               |
| Tickets          | `ticketRoutes.js`, `ticketController.js`, `Ticket.js`, `TicketActivity.js`, `TicketComment.js`                                               | Ticket workflow, comments, attachments, activity                    |
| Dashboard        | `dashboardRoutes.js`, `dashboardController.js`                                                                                               | Dashboard stats, charts, recent activity                            |

## Active frontend modules

| Module        | Frontend files                                                                         |
| ------------- | -------------------------------------------------------------------------------------- |
| Login         | `LoginPage.jsx`                                                                        |
| Dashboard     | `DashboardPage.jsx`                                                                    |
| Inquiries     | `InquiriesPage.jsx`, `ElectricalPanelInquiryPage.jsx`, inquiry form components         |
| Projects      | `ProjectsPage.jsx`, `ProjectDetailPage.jsx`, project components                        |
| Customers     | `CustomersPage.jsx`, `CustomerDetailPage.jsx`, `CustomerForm.jsx`                      |
| Tickets       | `TicketsPage.jsx`, `TicketFormPage.jsx`, ticket components                             |
| Notifications | `NotificationsPage.jsx`                                                                |
| Users         | `UsersPage.jsx`                                                                        |
| Departments   | `DepartmentPage.jsx`, `DepartmentForm.jsx`                                             |
| Timesheet     | `TimesheetPage.jsx`, `TimesheetAdminPage.jsx`, list/Kanban/calendar components         |
| Layout/Auth   | `MainLayout.jsx`, `Sidebar.jsx`, `Topbar.jsx`, `ProtectedRoute.jsx`, `AuthContext.jsx` |

---

# 4. Database Model Analysis

## 4.1 `User`

File:

```text
backend/models/User.js
```

Supported roles:

```text
admin
hod
team_lead
employee
manager
```

Important fields:

| Field            | Purpose                                    |
| ---------------- | ------------------------------------------ |
| `name`           | User name                                  |
| `email`          | Unique login email                         |
| `password`       | Hashed using bcrypt                        |
| `phone`          | Used also by WhatsApp sender matching      |
| `avatar`         | Profile image URL                          |
| `role`           | Role enum                                  |
| `department`     | Mixed legacy string or Department ObjectId |
| `hodDepartments` | Mixed array for HOD department ownership   |
| `teamId`         | Team relation                              |
| `reportsTo`      | Reporting manager/user                     |
| `isActive`       | Active/deactivated status                  |

Important note:

`department` and `hodDepartments` are `Mixed`, so the system supports both old string department values and newer Department Master references.

---

## 4.2 `Department`

File:

```text
backend/models/Department.js
```

Fields:

| Field       | Purpose                   |
| ----------- | ------------------------- |
| `name`      | Uppercase department name |
| `code`      | Uppercase department code |
| `hod`       | Optional HOD user         |
| `isActive`  | Soft-active flag          |
| `createdBy` | Creator user              |

Default seeded departments:

```text
ADMIN
SALES
ESTIMATION
DESIGN
AUTOMATION
PRODUCTION
PURCHASE
STORE
QC
```

Seed file:

```text
backend/services/departmentSeedService.js
```

---

## 4.3 `Team`

File:

```text
backend/models/Team.js
```

Fields:

| Field                    | Purpose          |
| ------------------------ | ---------------- |
| `name`                   | Team name        |
| `description`            | Team description |
| `hod`                    | HOD user         |
| `teamLead`               | Team lead user   |
| `members`                | Employee users   |
| `isActive`               | Soft-active flag |
| `createdBy`, `updatedBy` | Audit references |

Team hierarchy intended:

```text
Admin → HOD → Team Lead → Employee
```

---

## 4.4 `Customer`

File:

```text
backend/models/Customer.js
```

Fields:

| Field             | Purpose                             |
| ----------------- | ----------------------------------- |
| `customerId`      | Auto-generated `CUST-0001` style id |
| `customerName`    | Required customer name              |
| `companyName`     | Company                             |
| `contactPerson`   | Primary contact                     |
| `email`           | Email                               |
| `mobileNumber`    | Mobile                              |
| `alternateNumber` | Alternate number                    |
| `city`            | City                                |
| `address`         | Address                             |
| `gstNumber`       | GST number                          |
| `totalProjects`   | Project count                       |
| `notes`           | Notes                               |
| `isActive`        | Active flag                         |

Uses `Counter` model for customer ID generation.

---

## 4.5 `Inquiry`

File:

```text
backend/models/Inquiry.js
```

Current inquiry module is a large hybrid model with:

1. legacy inquiry fields,
2. new source-of-truth inquiry type fields,
3. PLC/VFD/MCC specific sections,
4. kickoff workflow state,
5. status detail subdocuments,
6. attachments.

### Main inquiry types

```text
PLC_AUTOMATION
VFD_PANEL
MCC_PANEL
MCC_CUM_PLC
LEGACY
```

### Current inquiry statuses

New statuses:

```text
New
Technical Evaluation
Technical BOM Submission
Technical BOM Approval
Commercial BOM Submission
Order Won
Order Lost
Inquiry Hold
Revision
```

Legacy statuses still accepted:

```text
In Progress
Commercial Discussion
Commercial Submit
Technical Submit
Order Received
Order Recieved
Inquiry Lost
Inq. Lost
Quotation Submit
```

The controller normalizes legacy statuses into the new status model.

### Important inquiry fields

| Area          | Fields                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client        | `customerName`, `companyName`, `companyType`, `contacts`, legacy contact fields                                                                                                   |
| Location      | `siteAddress`, `city`, `location`                                                                                                                                                 |
| Project       | `projectName`, `industryType`, `offerType`, `previousOrderRef`                                                                                                                    |
| Type          | `inquiryType`, `panelTypes`, `customPanelType`, `productType`                                                                                                                     |
| Technical     | `supplyVoltage`, `frequency`, `ipRating`, `installationType`, `shortCircuitCapacity`, `busbarMaterial`, `enclosureMaterial`, `panelColourRal`, `cableEntry`, `cableGlandMaterial` |
| Loads         | `loadDetails`                                                                                                                                                                     |
| Compliance    | `certificationRequired`, `drawingsSldAttached`, `equipmentListAttached`, `referenceBomAttached`                                                                                   |
| Type-specific | `plcDetails`, `vfdDetails`, `mccDetails`                                                                                                                                          |
| Status        | `status`, `statusDetails`, `nextFollowUpDate`                                                                                                                                     |
| Conversion    | `convertedToProject`, `projectReference`, `kickoffMeeting`                                                                                                                        |
| Attachments   | `attachments`, legacy `attachment`                                                                                                                                                |

### PLC details currently stored in backend

Backend `plcDetailsSchema` currently stores:

```text
automationRequirements
ioDetails.digitalInputs
ioDetails.digitalOutputs
ioDetails.analogInputs
ioDetails.analogOutputs
ioDetails.thermocoupleRtdInputs
ioDetails.highSpeedCounterInputs
ioDetails.communicationProtocol
ioDetails.networkTopology
ioDetails.plcCpuRedundancyRequired
ioDetails.powerSupplyRedundancy
ioDetails.ioSpareCapacityPercent
```

Important: frontend currently uses additional PLC fields that are not present in backend schema. This is listed under broken flows.

### VFD details currently stored in backend

```text
panelType
switchgearMake
customSwitchgearMake
loadDetails
additionalComponents
referenceBomAttached
onsiteSupportRequired
onsiteSupportDays
commissioningSupportRequired
commissioningSupportDays
```

### MCC details currently stored in backend

MCC backend has:

```text
incomerDetails
outgoingFeederDetails
loadDetails
layoutPreferences
notesAndSupport
```

`layoutPreferences` still includes:

```text
ventilation
```

`notesAndSupport` currently does not include support day fields in backend, while frontend uses them.

---

## 4.6 `Project`

File:

```text
backend/models/Project.js
```

Project ID format:

```text
NAPL-0200
NAPL-0201
...
```

Uses internal `NaplCounter`.

Important fields:

| Area              | Fields                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Identity          | `projectId`, `inquiryReference`, `inquiryNumber`                                                                     |
| Customer/project  | `customerName`, `companyName`, `projectName`, `projectType`, `projectScopes`, `panelType`, `quantity`                |
| Dates/value       | `orderValue`, `orderDate`, `expectedDeliveryDate`, `actualDeliveryDate`, `projectEndDate`, `completedAt`             |
| Delay             | `delayedDays`, `delayedEndDate`, `isDelayed`                                                                         |
| Status            | `productionStatus`, `dispatchStatus`, `installationStatus`, `paymentStatus`, `projectStatus`, `completionPercentage` |
| Kickoff           | `kickoffMeeting`                                                                                                     |
| Documents         | `documents`                                                                                                          |
| Team              | `assignedTeamMembers`, legacy `assignedTo`                                                                           |
| Inquiry snapshot  | `sourceInquirySnapshot`                                                                                              |
| Customer relation | `customerRef`                                                                                                        |
| Planning          | `planningTasks`, `planningGrids`                                                                                     |

Planning exists in both:

```text
planningTasks
planningGrids
```

`planningGrids` is the newer structure. `planningTasks` is retained as flattened legacy compatibility data.

---

## 4.7 `TimesheetTask`

File:

```text
backend/models/TimesheetTask.js
```

Task statuses:

```text
Backlog
Planned
In Progress
Review
Completed
```

Task types:

```text
Development
Design
Meeting
Review
Testing
Documentation
Support
Other
```

Task sources:

```text
USER
PROJECT
```

Sync statuses:

```text
SYNCED
PENDING
FAILED
```

Archive reasons:

```text
PROJECT_TASK_REMOVED
PROJECT_TASK_UNASSIGNED
PROJECT_DELETED
MANUAL_ARCHIVE
```

Important fields:

| Area            | Fields                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner           | `employee`                                                                                                                                                           |
| Work            | `title`, `description`, `employeeRemarks`, `taskType`                                                                                                                |
| Time            | `date`, `startTime`, `endTime`, `hours`                                                                                                                              |
| Workflow        | `status`, `kanbanOrder`                                                                                                                                              |
| Project linkage | `taskSource`, `project`, `sourceProject`, `sourceProjectId`, `sourceGridId`, `sourceGridName`, `sourceTaskId`, `sourceTaskKey`, `sourceTaskName`, `sourceDepartment` |
| Sync            | `syncStatus`, `lastSyncedAt`, `syncError`, `syncRetryCount`                                                                                                          |
| Archive         | `isArchived`, `archivedAt`, `archivedBy`, `archiveReason`, `restoredAt`, `restoredBy`                                                                                |

Unique partial index prevents duplicate synced project tasks:

```text
taskSource + sourceProject + sourceTaskKey
```

---

## 4.8 `Ticket`

File:

```text
backend/models/Ticket.js
```

Ticket types:

```text
N/A
Support
Repairing & Replacement
```

Statuses:

```text
New
Assigned
Working
Customer Side Pending
Closed
Void
```

Priorities:

```text
Low
Medium
High
Critical
```

Departments are still hardcoded:

```text
Sales
Estimation
Design
Production
Automation
QC
Purchase
Store & Dispatch
```

Important fields:

| Area               | Fields                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| Identity           | `ticketId`, `title`, `description`, `additionalDescription`                  |
| Workflow           | `ticketType`, `status`, `priority`, `source`, `supportType`, `department`    |
| Relations          | `customer`, `project`, `inquiry`, `assignedTo`, `assignedBy`, `assignedAt`   |
| Contact            | `contactPerson`, `contactNumber`                                             |
| Product            | `product.productType`, `brand`, `panelFamily`, `partNumber`, `serialNumber`  |
| Repair/replacement | `repairReplacement`                                                          |
| Closure            | `resolution`, `closedBy`, `closedAt`, `reopenedBy`, `voidedBy`, `voidReason` |
| Attachments        | `attachments`                                                                |
| Lifecycle          | `isActive`, `createdBy`, `updatedBy`                                         |

Ticket ID uses `Counter` and generates:

```text
TKT-000001
```

---

## 4.9 `Notification`

File:

```text
backend/models/Notification.js
```

Notification types:

```text
follow_up
overdue
project_delay
order_confirmed
kickoff_scheduled
project_created
workflow_error
info
status
warning
```

Important fields:

```text
title
message
type
priority
isRead
recipient
relatedInquiry
relatedProject
```

---

## 4.10 `KickoffWorkflow`

File:

```text
backend/models/KickoffWorkflow.js
```

Statuses:

```text
Scheduled
Ready For Completion
Completed
Project Created
Failed
Cancelled
```

Important fields:

```text
inquiry
projectReference
scheduledAt
date
time
agenda
meetingLink
attendees
status
notificationStatus
notificationLogs
conversionAttempts
lastProcessedAt
convertedAt
lastError
createdBy
updatedBy
```

---

# 5. API Route Analysis

## 5.1 Auth routes

Prefix:

```text
/api/auth
```

| Method | Path               | Protection    | Purpose            |
| ------ | ------------------ | ------------- | ------------------ |
| POST   | `/login`           | Public        | Login              |
| GET    | `/me`              | Auth          | Current user       |
| PUT    | `/profile`         | Auth          | Update own profile |
| POST   | `/profile/avatar`  | Auth + upload | Upload own avatar  |
| PUT    | `/change-password` | Auth          | Change password    |

---

## 5.2 User routes

Prefix:

```text
/api/users
```

| Method | Path          | Protection             | Purpose                 |
| ------ | ------------- | ---------------------- | ----------------------- |
| GET    | `/assignable` | Auth + hierarchy scope | Scoped assignable users |
| GET    | `/`           | Admin                  | List users              |
| POST   | `/`           | Admin                  | Create user             |
| GET    | `/:id`        | Admin                  | Get user                |
| PUT    | `/:id`        | Admin                  | Update user             |
| DELETE | `/:id`        | Admin                  | Delete user             |
| POST   | `/:id/avatar` | Admin + upload         | Update user avatar      |

Important route detail:

`/assignable` is declared before `router.use(authorize('admin'))`, so non-admin scoped users can access it.

---

## 5.3 Department routes

Prefix:

```text
/api/departments
```

| Method | Path                     | Protection              | Purpose                                |
| ------ | ------------------------ | ----------------------- | -------------------------------------- |
| GET    | `/`                      | Auth                    | List active departments                |
| GET    | `/?includeInactive=true` | Auth, admin effect only | Admin can include inactive departments |
| POST   | `/`                      | Admin                   | Create department                      |
| GET    | `/:id`                   | Auth                    | Get department                         |
| PUT    | `/:id`                   | Admin                   | Update department                      |
| DELETE | `/:id`                   | Admin                   | Soft deactivate department             |

---

## 5.4 Customer routes

Prefix:

```text
/api/customers
```

| Method | Path   | Protection | Purpose         |
| ------ | ------ | ---------- | --------------- |
| GET    | `/`    | Auth       | List customers  |
| POST   | `/`    | Auth       | Create customer |
| GET    | `/:id` | Auth       | Get customer    |
| PUT    | `/:id` | Auth       | Update customer |
| DELETE | `/:id` | Admin      | Delete customer |

---

## 5.5 Inquiry routes

Prefix:

```text
/api/inquiries
```

| Method | Path          | Protection              | Purpose                |
| ------ | ------------- | ----------------------- | ---------------------- |
| GET    | `/follow-ups` | Auth                    | Pending follow-ups     |
| GET    | `/`           | Auth                    | Paginated inquiry list |
| POST   | `/`           | Auth + multipart upload | Create inquiry         |
| GET    | `/:id`        | Auth                    | Get inquiry            |
| PUT    | `/:id`        | Auth + multipart upload | Update inquiry         |
| DELETE | `/:id`        | Admin                   | Delete inquiry         |

Upload field:

```text
attachments
```

Max files:

```text
10
```

Max size:

```text
15 MB per file
```

---

## 5.6 Project routes

Prefix:

```text
/api/projects
```

| Method | Path                           | Protection    | Purpose                                    |
| ------ | ------------------------------ | ------------- | ------------------------------------------ |
| POST   | `/convert/:inquiryId`          | Auth          | Schedule kickoff workflow from inquiry     |
| POST   | `/recalc-delays`               | Auth          | Recalculate project delays                 |
| GET    | `/planning-templates`          | Auth          | Planning templates                         |
| GET    | `/`                            | Auth          | List projects                              |
| POST   | `/`                            | Auth          | Create project                             |
| POST   | `/:id/copy`                    | Auth          | Copy project                               |
| POST   | `/:id/documents`               | Auth + upload | Upload project documents                   |
| DELETE | `/:id/documents/:documentId`   | Auth          | Delete project document                    |
| GET    | `/:id`                         | Auth          | Get project                                |
| PUT    | `/:id`                         | Auth          | Update project                             |
| DELETE | `/:id`                         | Admin         | Delete project                             |
| GET    | `/:id/activity`                | Auth          | Project activity log                       |
| GET    | `/:id/task-completion-history` | Auth          | Expected vs actual task completion history |

---

## 5.7 Kickoff workflow routes

Prefix:

```text
/api/kickoff-workflows
```

| Method | Path                   | Protection | Purpose                             |
| ------ | ---------------------- | ---------- | ----------------------------------- |
| POST   | `/:inquiryId/schedule` | Auth       | Schedule kickoff                    |
| POST   | `/:inquiryId/complete` | Auth       | Complete kickoff and create project |
| GET    | `/:inquiryId`          | Auth       | Get workflow                        |
| POST   | `/process/due`         | Admin      | Process due workflows manually      |

---

## 5.8 Notification routes

Prefix:

```text
/api/notifications
```

| Method | Path        | Protection | Purpose                         |
| ------ | ----------- | ---------- | ------------------------------- |
| GET    | `/`         | Auth       | List current user notifications |
| PUT    | `/read-all` | Auth       | Mark all read                   |
| PUT    | `/:id/read` | Auth       | Mark one read                   |
| DELETE | `/:id`      | Auth       | Delete notification             |

---

## 5.9 Dashboard routes

Prefix:

```text
/api/dashboard
```

| Method | Path      | Protection | Purpose                           |
| ------ | --------- | ---------- | --------------------------------- |
| GET    | `/stats`  | Auth       | Dashboard stats/charts            |
| GET    | `/recent` | Auth       | Recent inquiries/projects/tickets |

---

## 5.10 Timesheet routes

Prefix:

```text
/api/timesheet
```

All timesheet routes use:

```text
protect
attachTeamContext
```

View routes:

| Method | Path        | Purpose        |
| ------ | ----------- | -------------- |
| GET    | `/list`     | Paginated list |
| GET    | `/kanban`   | Kanban tasks   |
| GET    | `/calendar` | Calendar tasks |

Task routes:

| Method | Path                  | Purpose                          |
| ------ | --------------------- | -------------------------------- |
| GET    | `/tasks`              | Scoped tasks                     |
| POST   | `/tasks`              | Create task                      |
| GET    | `/tasks/:id`          | Get task                         |
| PUT    | `/tasks/:id`          | Update task                      |
| DELETE | `/tasks/:id`          | Delete task                      |
| PATCH  | `/tasks/:id/status`   | Update status                    |
| PATCH  | `/tasks/:id/kanban`   | Update Kanban position           |
| PATCH  | `/tasks/:id/archive`  | Archive task                     |
| PATCH  | `/tasks/:id/restore`  | Restore archived task            |
| DELETE | `/tasks/:id/archived` | Permanently delete archived task |

Admin/elevated routes:

| Method | Path                     | Access intended                    |
| ------ | ------------------------ | ---------------------------------- |
| GET    | `/admin/all`             | Admin/HOD/team lead backend access |
| GET    | `/admin/summary`         | Admin/HOD/team lead backend access |
| GET    | `/admin/workload`        | Admin/HOD/team lead backend access |
| GET    | `/admin/daily-breakdown` | Admin/HOD/team lead backend access |

---

## 5.11 Team routes

Prefix:

```text
/api/teams
```

| Method | Path                   | Protection          | Purpose           |
| ------ | ---------------------- | ------------------- | ----------------- |
| GET    | `/`                    | Auth                | List scoped teams |
| POST   | `/`                    | Admin               | Create team       |
| GET    | `/:id`                 | Auth                | Get team          |
| PUT    | `/:id`                 | Admin               | Update team       |
| DELETE | `/:id`                 | Admin               | Deactivate team   |
| PATCH  | `/:id/hod`             | Admin               | Assign HOD        |
| PATCH  | `/:id/team-lead`       | Admin/HOD           | Assign team lead  |
| GET    | `/:id/members`         | Auth                | Get members       |
| POST   | `/:id/members`         | Admin/HOD/team lead | Add member        |
| DELETE | `/:id/members/:userId` | Admin/HOD/team lead | Remove member     |

---

## 5.12 Ticket routes

Prefix:

```text
/api/tickets
```

| Method | Path | Purpose |
|---|---|
| GET | `/` | List tickets |
| POST | `/` | Create ticket |
| GET | `/:id` | Get ticket |
| PUT | `/:id` | Update ticket |
| PATCH | `/:id/assign` | Assign ticket |
| PATCH | `/:id/start-work` | Move to Working |
| PATCH | `/:id/customer-pending` | Move to Customer Side Pending |
| PATCH | `/:id/close` | Close ticket |
| PATCH | `/:id/reopen` | Reopen ticket |
| PATCH | `/:id/void` | Void ticket |
| GET | `/:id/comments` | Get comments |
| POST | `/:id/comments` | Add comment |
| PUT | `/comments/:commentId` | Update comment |
| DELETE | `/comments/:commentId` | Delete comment |
| POST | `/:id/attachments` | Upload attachments |
| DELETE | `/:id/attachments/:attachmentId` | Delete attachment |
| GET | `/:id/activity` | Activity timeline |

---

## 5.13 WhatsApp test route

Prefix:

```text
/api/test-whatsapp
```

| Method | Path | Protection | Purpose                     |
| ------ | ---- | ---------- | --------------------------- |
| GET    | `/`  | No auth    | Sends WhatsApp test message |

This route is mounted in runtime and is unauthenticated.

---

# 6. Frontend Page Analysis

## Active frontend routes

File:

```text
frontend/src/App.jsx
```

| Route                  | Component                          |
| ---------------------- | ---------------------------------- |
| `/auth/login`          | `LoginPage`                        |
| `/`                    | `DashboardPage`                    |
| `/inquiries`           | `InquiriesPage`                    |
| `/inquiries/new`       | `ElectricalPanelInquiryPage`       |
| `/inquiries/:id`       | `ElectricalPanelInquiryPage`       |
| `/inquiries/:id/edit`  | `ElectricalPanelInquiryPage`       |
| `/projects`            | `ProjectsPage`                     |
| `/projects/new`        | `ProjectDetailPage`                |
| `/projects/:id`        | `ProjectDetailPage`                |
| `/projects/:id/edit`   | `ProjectDetailPage`                |
| `/customers`           | `CustomersPage`                    |
| `/customers/:id`       | `CustomerDetailPage`               |
| `/tickets`             | `TicketsPage`                      |
| `/tickets/new`         | `TicketFormPage`                   |
| `/tickets/:id`         | `TicketFormPage`                   |
| `/tickets/:id/edit`    | `TicketFormPage`                   |
| `/notifications`       | `NotificationsPage`                |
| `/timesheet`           | `TimesheetPage`                    |
| `/timesheet/list`      | `TimesheetListView`                |
| `/timesheet/kanban`    | `TimesheetKanbanView`              |
| `/timesheet/calendar`  | `TimesheetCalendarView`            |
| `/timesheet/admin`     | `TimesheetAdminPage`               |
| `/users`               | `UsersPage`, admin-only route      |
| `/masters/departments` | `DepartmentPage`, admin-only route |
| `/404`                 | `NotFoundPage`                     |

## Sidebar navigation

Main navigation:

```text
Dashboard
Inquiries
Projects
Customers
Tickets
Timesheet
```

Admin-only sidebar sections:

```text
Master:
- Department Master

Admin:
- User Management
- Timesheet Admin
```

Important current behavior:

`/timesheet/admin` is inside the authenticated `/timesheet` route tree, but sidebar only shows it to admin users. The page itself allows admin and HOD, but backend elevated routes also allow team lead.

---

# 7. Authentication & Permissions Analysis

## Backend auth

File:

```text
backend/middleware/authMiddleware.js
```

### `protect`

Behavior:

1. Reads JWT from `Authorization: Bearer <token>`.
2. Also checks `req.cookies?.token`.
3. Verifies token using `JWT_SECRET`.
4. Loads active user from database.
5. Attaches user to `req.user`.

Selected user fields:

```text
name
email
phone
role
department
hodDepartments
teamId
reportsTo
isActive
avatar
```

## Role helpers

### `authorize(...roles)`

Used for basic route role checks.

Current behavior:

* maps user role `manager` to `hod`
* if route allows `manager`, it also allows `hod` and `team_lead`

Broken behavior:

When access is denied, it calls `createError()` without a status code. That means forbidden access can become HTTP `500` instead of `403`.

### `authorizeHierarchy(minimumRole)`

Used in timesheet elevated routes.

Current role order from `User.js`:

```text
admin
hod
manager
team_lead
employee
```

Allows roles at or above a minimum role.

Broken behavior:

Denied access also calls `createError()` without a status code, so it can return HTTP `500`.

## Permission middleware

File:

```text
backend/middleware/permissionMiddleware.js
```

Major responsibilities:

| Function                              | Purpose                         |
| ------------------------------------- | ------------------------------- |
| `requireRoles`                        | Role allowlist with default 403 |
| `attachTeamContext`                   | Builds team scope               |
| `scopeToHierarchy`                    | Injects `allowedEmployeeIds`    |
| `canEditTask`                         | Timesheet task edit permission  |
| `canReadTask`                         | Timesheet task read permission  |
| `canArchiveTimesheetTask`             | Archive permission              |
| `canRestoreTimesheetTask`             | Restore permission              |
| `canDeleteArchivedTimesheetTask`      | Delete archived permission      |
| `canModifyProjectLinkedTaskStructure` | Protects synced project tasks   |

Timesheet hierarchy behavior:

| Role      | Scope                                 |
| --------- | ------------------------------------- |
| Admin     | All users                             |
| HOD       | HOD managed teams                     |
| Team Lead | Own team                              |
| Employee  | Own team visible, edit own tasks only |

## Frontend auth

File:

```text
frontend/src/context/AuthContext.jsx
```

Stores:

```text
localStorage.token
localStorage.user
```

Role helpers exposed:

```text
isAdmin
isHod
isTeamLead
isEmployee
isManager
isTechnicalCommunication
isEngineer
```

Frontend still references roles not supported by backend `User` enum:

```text
technical_communication
engineer
```

---

# 8. Notification & WhatsApp Flow Analysis

## Internal notification flow

Service:

```text
backend/services/notificationService.js
```

Creates a `Notification` record and may send email through `outlookService`.

Used by:

* inquiry creation
* inquiry update
* inquiry delete
* status change
* kickoff workflow
* project events

`notificationService` is wrapped in try/catch, so notification failures generally do not block main business save operations.

## Outlook/email flow

Service:

```text
backend/services/outlookService.js
```

Uses Nodemailer SMTP.

Relevant environment variables:

```text
OUTLOOK_EMAIL
OUTLOOK_PASSWORD
OUTLOOK_FROM
OUTLOOK_TO
```

Can send inquiry details and attachments.

## WhatsApp service

File:

```text
backend/services/whatsappService.js
```

Uses:

```text
whatsapp-web.js
LocalAuth
qrcode-terminal
```

Session id:

```text
nexus-session
```

Main outbound functions:

| Function                           | Purpose                                 |
| ---------------------------------- | --------------------------------------- |
| `initWhatsApp`                     | Starts WhatsApp client                  |
| `sendWhatsAppNotification`         | Sends to configured/default number      |
| `sendWhatsAppGroupNotification`    | Sends to configured group               |
| `sendWhatsAppGroupWithAttachments` | Sends group message plus uploaded files |
| `sendTestMessage`                  | Sends diagnostic test message           |

## Inquiry notification flow

On inquiry create:

1. Multipart `_json` is parsed.
2. Contacts are normalized.
3. Attachments are saved.
4. Inquiry payload is allowlisted.
5. Inquiry is created.
6. Internal notification is created.
7. Customer may be auto-created/updated.
8. WhatsApp individual notification is attempted.
9. WhatsApp group notification is attempted.
10. Uploaded attachments may be sent to WhatsApp group.

On inquiry update:

1. Inquiry is loaded.
2. Request body is parsed.
3. Contacts are normalized if present.
4. Attachments are merged using kept attachments plus new uploads.
5. Status details are merged.
6. Inquiry is updated.
7. Internal notification is created.
8. Status-change notification is created if status changed.

## Kickoff notification flow

Service:

```text
backend/services/kickoffWorkflowService.js
```

When kickoff is scheduled:

1. Inquiry is loaded.
2. Scheduled date/time is validated.
3. Attendees are validated.
4. `KickoffWorkflow` is created or updated.
5. Inquiry status is set to `Order Won`.
6. Inquiry `kickoffMeeting` state is set.
7. WhatsApp group notification is attempted.
8. WhatsApp configured notify number notification is attempted.
9. Customer WhatsApp notification is attempted.
10. Attendee WhatsApp notifications are attempted.
11. Outlook emails are attempted.
12. Notification logs are added to workflow.

When kickoff is completed:

1. Workflow is loaded.
2. Meeting time must have passed.
3. Workflow becomes `Completed`.
4. Project is created from workflow.
5. Inquiry becomes converted.
6. Project activity log is written.
7. Project created notification is sent.

## WhatsApp inbound project task flow

Incoming WhatsApp messages can update project planning task status.

Supported command styles:

```text
NEXUS | NAPL-0209 | GA Approval | Completed | Sent to client
PROJECT | NAPL-0209 | GA Approval | Completed | Sent to client
```

Also supports label format:

```text
PROJECT: NAPL-0209
TASK: GA Approval
STATUS: Completed
REMARK: Sent to client
```

Inbound flow:

1. Message received.
2. Duplicate message ID skipped.
3. Text parsed as project update command.
4. Optional group restriction checked using `WHATSAPP_INCOMING_GROUP_ID`.
5. Sender phone matched against active users.
6. Project found by project code.
7. Planning task found by task name or task id.
8. Task status and remark updated.
9. Project planning calculations refreshed.
10. Activity log written.
11. WhatsApp reply sent.

---

# 9. Project → Timesheet Sync Flow Analysis

Service:

```text
backend/services/projectTimesheetSyncService.js
```

Controller integration:

```text
backend/controllers/projectController.js
```

Integrated points:

| Project action | Timesheet sync action                   |
| -------------- | --------------------------------------- |
| Create project | Sync project tasks to timesheet         |
| Copy project   | Sync copied project tasks to timesheet  |
| Update project | Sync changed project tasks to timesheet |
| Delete project | Archive project-linked timesheet tasks  |

Wrapper functions in controller:

```text
runProjectTimesheetSyncSafe
archiveProjectTimesheetTasksSafe
```

These catch sync errors so the project save/update/delete operation does not fail because of timesheet sync.

## Task extraction

The sync service extracts planning tasks from:

1. `planningGrids`
2. fallback `planningTasks`

Each extracted source task includes:

```text
project
planningTask
gridId
gridName
taskIndex
sourceTaskKey
assignedTo
rawAssignedTo
```

## Source task key

Key format:

```text
PROJECT:<projectId>:GRID:<gridId>#<gridIndex>:TASK:<taskId>#<taskIndex>
```

This includes grid and task positions to avoid duplicate source keys.

## Assignment conversion

The service accepts several assigned-user shapes:

```text
assignedTo
assignedUser
assignee
employee
userId
```

It converts valid values to Mongo ObjectId.

If assignment is invalid or missing:

* invalid assigned value → task skipped with error log
* unassigned after previously assigned → linked task archived
* never assigned → skipped

## Timesheet payload mapping

Project task maps to `TimesheetTask`:

| Project task    | Timesheet task                                           |
| --------------- | -------------------------------------------------------- |
| assigned user   | `employee`                                               |
| task name       | `title`                                                  |
| planning remark | `description`                                            |
| project         | `project`, `sourceProject`                               |
| department      | `sourceDepartment`                                       |
| grid            | `sourceGridId`, `sourceGridName`                         |
| planned dates   | `sourcePlannedStartDate`, `sourcePlannedEndDate`, `date` |
| source key      | `sourceTaskKey`                                          |
| task source     | `PROJECT`                                                |

Project status to timesheet status:

| Project status | Timesheet status |
| -------------- | ---------------- |
| Pending        | Planned          |
| Not Started    | Planned          |
| In Progress    | In Progress      |
| Completed      | Completed        |
| Hold           | Planned          |
| Delayed        | In Progress      |

## Archive behavior

Timesheet project-linked tasks are archived when:

| Trigger                                  | Archive reason            |
| ---------------------------------------- | ------------------------- |
| Project planning task removed            | `PROJECT_TASK_REMOVED`    |
| Project planning task becomes unassigned | `PROJECT_TASK_UNASSIGNED` |
| Project deleted                          | `PROJECT_DELETED`         |

## Backfill service

File exists:

```text
backend/services/projectTimesheetBackfillService.js
```

It can backfill project-linked tasks from existing projects, but no active API route or startup call is mounted for it.

---

# 10. Inquiry Workflow Analysis

## Current inquiry type workflow

Frontend source-of-truth form:

```text
frontend/src/pages/ElectricalPanelInquiryPage.jsx
```

Shared sections:

```text
frontend/src/components/inquiry/forms/CommonInquirySections.jsx
```

Type-specific sections:

```text
PlcInquirySections.jsx
VfdInquirySections.jsx
MccInquirySections.jsx
```

Inquiry types:

```text
PLC_AUTOMATION
VFD_PANEL
MCC_PANEL
MCC_CUM_PLC
```

## Inquiry creation flow

1. User selects inquiry type.
2. Common sections are rendered.
3. Type-specific technical/engineering sections are rendered.
4. Form payload is prepared.
5. Files and JSON are submitted as multipart FormData.
6. Backend parses `_json`.
7. Backend normalizes contacts.
8. Backend validates contact array.
9. Backend builds allowlisted payload.
10. Backend derives `inquiryType`, `productType`, and `panelTypes`.
11. Backend saves inquiry.
12. Notifications, email, customer sync, and WhatsApp side effects run.

## Inquiry update flow

1. Existing inquiry loaded.
2. Old records are back-filled into current form shape.
3. Form update submitted.
4. Backend parses `_json`.
5. Backend creates update payload only from allowed fields.
6. Existing attachments are preserved using `keptAttachments`.
7. New attachments are added.
8. Status details are merged for:

   * `Order Lost`
   * `Inquiry Hold`
   * `Revision`
9. Inquiry is updated.
10. Notifications run.

## Status flow

Frontend and backend now use new statuses:

```text
New
Technical Evaluation
Technical BOM Submission
Technical BOM Approval
Commercial BOM Submission
Order Won
Order Lost
Inquiry Hold
Revision
```

Legacy statuses are mapped to new statuses.

Important mapping:

```text
In Progress -> Technical Evaluation
Technical Submit -> Technical BOM Submission
Commercial Submit -> Commercial BOM Submission
Commercial Discussion -> Commercial BOM Submission
Quotation Submit -> Commercial BOM Submission
Order Received -> Order Won
Order Recieved -> Order Won
Inquiry Lost -> Order Lost
Inq. Lost -> Order Lost
```

## Order Won → Kickoff workflow

Current behavior:

1. Inquiry status becomes `Order Won`.
2. Kickoff meeting is scheduled.
3. Project is not created immediately.
4. Project is created only after kickoff meeting time passes and user completes kickoff.

Backend project route `/api/projects/convert/:inquiryId` is kept for compatibility, but it now schedules kickoff instead of direct project creation.

## Follow-up flow

Endpoint:

```text
GET /api/inquiries/follow-ups
```

Backend excludes aliases for:

```text
Order Won
Order Lost
```

So legacy won/lost statuses are also excluded.

---

# 11. Frontend Inquiry Current State

## Common Section 1

Current behavior:

* Company Type includes `Other`.
* If `Other` is selected, `Other Company Type` textbox appears.
* Location/Site Address is directly visible.
* Location/Site Address uses 2-column width.
* City of Location uses 1-column width.

## Common Section 4 — Technical Details

Current behavior includes:

* Supply Voltage options include:

  ```text
  440V AC, 3 Phase
  415 V AC 3 Phase
  415 V AC 3 Phase + Neutral
  ```
* Removed 1-sec short-circuit options from UI list.
* Protection Class options:

  ```text
  IP20
  IP27
  IP40
  IP42
  IP54
  IP65
  IP66
  IP67
  ```
* Enclosure Material options:

  ```text
  CRCA / MS
  SS304
  FLP
  ```
* Cable Entry options:

  ```text
  Top
  Bottom
  ```
* Cable Gland Material is text input.
* Switchgear Make is shown in common technical section for:

  ```text
  VFD_PANEL
  PLC_AUTOMATION
  MCC_CUM_PLC
  ```

## PLC engineering section

Current behavior:

* PLC Component Requirements show all rows at once.
* Add button is disabled/removed through:

  ```text
  showAllRows
  allowAddRow={false}
  ```
* Preferred Brand dropdown for PLC component requirements exists with:

  ```text
  Siemens
  Schneider
  ROCKWELL
  ABB
  Other
  ```
* PLC Support Requirements are rendered.

## VFD engineering section

Current behavior:

* VFD Component Requirements show all rows at once.
* Add button is disabled/removed.
* VFD Support Requirements are rendered.
* Reference BOM documentation card is not visible inside VFD engineering section.

## MCC engineering section

Current behavior:

* MCC Support Requirements are rendered.
* MCC Layout Preferences frontend no longer shows Ventilation.
* But backend still has `mccDetails.layoutPreferences.ventilation`.

---

# 12. Identified Undocumented / Unused / Duplicate Modules

## Backend

| File / Area                                            | Observation                                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `backend/server_old.js`                                | Old server backup still present                                                         |
| `backend/utils/departmentUtils_old.js`                 | Old department utility backup                                                           |
| `backend/services/documentExtractionService.js`        | Empty file, no implementation                                                           |
| `backend/services/projectTimesheetBackfillService.js`  | Backfill logic exists but is not mounted in routes/startup                              |
| `backend/routes/testWhatsappRoute.js`                  | Runtime-mounted unauthenticated diagnostic route                                        |
| `backend/controllers/TicketActivity.js`                | Exports activity constants/class but active ticket flow uses `models/TicketActivity.js` |
| `backend/seed/seedData.js`                             | Seed script outside normal runtime                                                      |
| `backend/seed/seedTask.js`                             | Seed script outside normal runtime                                                      |
| `backend/scripts/migrations/001_add_team_hierarchy.js` | Migration script outside normal runtime                                                 |
| `backend/.wwebjs_auth`                                 | WhatsApp session artifacts included                                                     |
| `backend/uploads`                                      | Uploaded files included                                                                 |
| `backend/.env`                                         | Environment file included                                                               |

## Frontend

| File / Area                                      | Observation                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `frontend/src/components/common/Sidebar_old.jsx` | Old sidebar backup                                                    |
| `frontend/src/components/common/MainLayout.jsx`  | Duplicate name; runtime imports `frontend/src/layouts/MainLayout.jsx` |
| `frontend/src/pages/TicketViewPage.jsx`          | Exists but active `/tickets/:id` route uses `TicketFormPage`          |
| `frontend/src/pages/TimesheetCalendarPage.jsx`   | Exists but active timesheet route uses `TimesheetCalendarView`        |
| `frontend/dist`                                  | Build output included in upload                                       |

---

# 13. Identified Broken Flows

## 13.1 PLC Switchgear Make frontend is not persisted by backend

Frontend writes and validates:

```text
plcDetails.switchgearMake
plcDetails.customSwitchgearMake
```

But backend `plcDetailsSchema` does not define these fields.

Impact:

* PLC Switchgear Make appears in frontend.
* Validation requires it.
* Payload sends it.
* Mongoose strict nested schema will not persist it under `plcDetails`.

## 13.2 PLC Support Requirements frontend is not persisted by backend

Frontend uses:

```text
plcDetails.supportRequirements.onsiteSupportRequired
plcDetails.supportRequirements.onsiteSupportDays
plcDetails.supportRequirements.commissioningSupportRequired
plcDetails.supportRequirements.commissioningSupportDays
```

Backend `plcDetailsSchema` does not include `supportRequirements`.

Impact:

* PLC Support Requirements can appear and validate in UI.
* Saved values can be dropped by backend schema.

## 13.3 MCC Support days frontend is not persisted by backend

Frontend uses:

```text
mccDetails.notesAndSupport.onsiteSupportDays
mccDetails.notesAndSupport.commissioningSupportDays
```

Backend `mccDetails.notesAndSupport` currently has:

```text
onsiteSupportRequired
commissioningSupportRequired
trainingRequired
warrantyPeriodMonths
amcRequiredAfterWarranty
additionalComments
```

It does not include support day fields.

Impact:

* MCC Support day values can be lost on save.

## 13.4 MCC Ventilation removed from frontend but still exists in backend

Frontend no longer renders Ventilation in MCC Layout Preferences.

Backend still has:

```text
mccDetails.layoutPreferences.ventilation
```

Impact:

* Backend still stores/accepts legacy ventilation field.
* Frontend/backend model is not fully aligned.

## 13.5 Timesheet Admin page access is inconsistent

Backend elevated timesheet routes allow:

```text
admin
hod
team_lead
```

Frontend page guard allows only:

```text
admin
hod
```

Sidebar shows Timesheet Admin only to admin.

Also, `TimesheetAdminPage.jsx` loads reference employees using:

```text
GET /api/users
```

But `/api/users` is admin-only.

Impact:

* HOD is allowed by page guard but employee dropdown load can fail.
* Team lead is allowed by backend elevated timesheet APIs but blocked by frontend page guard/sidebar visibility.
* Denial from `/api/users` may return 500 due `authorize()` missing status code.

## 13.6 Auth role denial can return HTTP 500 instead of 403

In `authMiddleware.js`, `authorize()` and `authorizeHierarchy()` call `createError()` without status code for access denied.

Impact:

* Forbidden admin/HOD/team-lead access can appear as server error.
* Affects admin routes such as users, departments, delete routes, and hierarchy routes.

## 13.7 Ticket role model mismatch

Backend `User` model allows:

```text
admin
hod
team_lead
employee
manager
```

Ticket backend/frontend also reference:

```text
technical_communication
engineer
```

Impact:

* `technical_communication` and `engineer` cannot be created through current `User` schema.
* Ticket permission logic expects roles that active user model does not allow.
* Ticket module treats `employee` as engineer-like, but TC role cannot exist unless old data bypassed current schema.

## 13.8 Ticket creation permission blocks normal employee users

Backend ticket create permission:

```text
canCreateTicket = canManageTickets
```

`canManageTickets` allows:

```text
admin
hod
technical_communication
```

Frontend ticket permission also restricts create ticket to admin/HOD/TC.

Impact:

* General employees cannot create tickets in current logic.
* This may or may not match business intent, but it is a current behavior.

## 13.9 Ticket view page exists but is not routed

File exists:

```text
frontend/src/pages/TicketViewPage.jsx
```

But route:

```text
/tickets/:id
```

uses:

```text
TicketFormPage
```

Impact:

* Dedicated ticket view page is unused.

## 13.10 Project planning has dual data structures

Project model stores both:

```text
planningTasks
planningGrids
```

Controller normalizes `planningGrids` into flattened `planningTasks`.

Project-timesheet sync prefers `planningGrids`.

Dashboard delayed task aggregation still unwinds:

```text
planningTasks
```

Impact:

* Runtime depends on correct synchronization between flattened and grid planning data.
* Reports and sync read from different representations.

## 13.11 Project backfill service is not exposed

File exists:

```text
backend/services/projectTimesheetBackfillService.js
```

No route or startup call is wired.

Impact:

* Existing project planning tasks will not be automatically backfilled into timesheet unless this service is manually invoked elsewhere.

## 13.12 WhatsApp diagnostic route is unauthenticated

Runtime-mounted route:

```text
GET /api/test-whatsapp
```

has no `protect` middleware.

Impact:

* Any caller who can reach backend can trigger test WhatsApp sending.

## 13.13 WhatsApp session data is inside codebase ZIP

The upload contains:

```text
backend/.wwebjs_auth
```

with many session files.

Impact:

* Runtime session state is mixed with source code package.
* This can affect portability and exposure risk.

## 13.14 Frontend build is blocked by dependency artifact state

Frontend source parses successfully, but production build fails before app compilation because Rollup optional native package is missing:

```text
@rollup/rollup-linux-x64-gnu
```

Impact:

* Current uploaded `node_modules` is incomplete for this environment.
* This is not confirmed as source-code failure.

---

# 14. Architectural Risks Observed

## 14.1 Department Master is active but not system-wide source of truth

Department Master exists and is seeded.

But hardcoded departments still exist in:

```text
User.js
Ticket.js
departmentUtils.js
frontend master data / filters
ticket module
project/task department handling
```

Risk:

* Adding a new department from UI may not automatically affect every module.

## 14.2 Role definitions are not centralized across modules

Core user roles differ from ticket/frontend role assumptions.

Risk:

* UI visibility, backend permission checks, and saved user roles can drift.

## 14.3 Inquiry schema and frontend are evolving faster than backend schema

Current examples:

```text
PLC switchgear fields
PLC support requirements
MCC support day fields
MCC ventilation removal mismatch
```

Risk:

* Form values can appear saved in UI but be dropped by Mongoose nested schemas.

## 14.4 Status strings are partially normalized but still repeated

Inquiry statuses are repeated in:

```text
Inquiry model
inquiryController
dashboardController
StatusBadge
InquiryForm
InquiriesPage
ElectricalPanelInquiryPage
```

Risk:

* New status changes require updates in several places.

## 14.5 Controllers contain many side effects

Examples:

* Inquiry create sends notifications/email/WhatsApp and updates customers.
* Project create/update sends WhatsApp, logs activity, syncs timesheet.
* Kickoff scheduling sends WhatsApp/email and updates inquiry.
* Ticket workflow logs activity and mutates status.

Risk:

* Partial success is possible.
* Some side effects are non-fatal; others can affect workflow state.

## 14.6 Old/runtime artifacts are mixed with source

Included in ZIP:

```text
backend/.env
backend/.wwebjs_auth
backend/uploads
backend/node_modules
frontend/node_modules
frontend/dist
old backup files
```

Risk:

* Environment-specific state and source code are bundled together.
* Review and deployment can accidentally use stale artifacts.

## 14.7 Timesheet scope and UI access are not fully aligned

Backend has hierarchy-based scope for:

```text
admin
hod
team_lead
employee
```

Frontend navigation and admin page guard do not fully match backend capabilities.

Risk:

* Users may be authorized by backend but blocked or unsupported by frontend.
* Other users may access page but fail dependent reference API calls.

---

# 15. Current System Understanding Summary

The latest Nexus Dashboard codebase is a MERN-style business application with these main flows:

1. **Inquiry Management**

   * Multi-type inquiry form for PLC Automation, VFD Panel, MCC Panel, and MCC cum PLC.
   * Multipart attachment upload.
   * New status workflow with legacy status compatibility.
   * Internal notifications, Outlook email, WhatsApp notifications, and customer sync side effects.

2. **Kickoff Workflow**

   * `Order Won` inquiries schedule kickoff meetings.
   * Project creation is delayed until kickoff completion.
   * Scheduler marks due kickoff workflows as ready for completion.
   * Kickoff stores notification logs and project conversion state.

3. **Project Management**

   * Projects use NAPL IDs.
   * Supports planning grids, flattened planning tasks, document attachments, activity logs, delay tracking, and WhatsApp alerts.
   * Project copy/create/update/delete are integrated with project-timesheet sync.

4. **Project → Timesheet Sync**

   * Assigned project planning tasks become `PROJECT` timesheet tasks.
   * Unassigned/removed/deleted project tasks archive linked timesheet tasks.
   * Sync uses deterministic source keys and unique partial index protection.

5. **Timesheet**

   * Includes list, Kanban, calendar, and admin views.
   * Supports hierarchy-based visibility.
   * Calendar now shows person name in event rendering.
   * Kanban card style is currently reverted to white card design.

6. **Department Master**

   * Backend model, seed service, API routes, frontend page, and service exist.
   * Still not the single source of truth across all modules.

7. **Ticket Module**

   * Supports ticket lifecycle, assignment, work status, pending, close, reopen, void, comments, attachments, and activity.
   * Permission logic uses role assumptions that do not fully match current `User` model.

8. **Notifications and WhatsApp**

   * Internal notification model is active.
   * Outlook email integration exists.
   * WhatsApp outbound and inbound project task command handling exists.
   * Test WhatsApp route is currently public.

9. **Main confirmed broken areas in latest ZIP**

   * PLC Switchgear Make frontend/backend persistence mismatch.
   * PLC Support Requirements frontend/backend persistence mismatch.
   * MCC Support Days frontend/backend persistence mismatch.
   * MCC Ventilation removed from frontend but still present in backend.
   * Timesheet Admin frontend/backend access mismatch.
   * Role mismatch in Ticket module.
   * Forbidden auth failures can return 500.
   * Project-timesheet backfill service not wired.
   * WhatsApp test route unauthenticated.
   * Frontend build blocked by missing Rollup optional dependency.
