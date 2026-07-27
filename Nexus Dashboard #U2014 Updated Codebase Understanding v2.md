# Nexus Dashboard — Updated Codebase Understanding Report v2

## 0. Source Inspected

Latest uploaded ZIP inspected from:

```text
/mnt/data/nexus-dashboard.zip
```

Extracted project source inspected from:

```text
/mnt/data/nexus_inspect/nexus-dashboard
```

Existing Markdown understanding files used as context:

```text
/mnt/data/Nexus Dashboard — Latest Codebase Understanding.md
/mnt/data/Nexus Dashboard — Project Understandin.md
```

Important: this report is based on the actual extracted source files in the uploaded ZIP. It corrects stale findings from older Markdown files where the code has changed.

No code was modified.

---

## 0.1 Validation Performed

| Check | Result |
|---|---|
| Backend JavaScript syntax check | Passed |
| Backend files checked | 73 `.js` files excluding dependency/runtime folders |
| Backend syntax failures | 0 |
| Frontend production build | Not run because extracted inspection source does not include usable installed dependency tree |
| ZIP dependency/runtime artifacts | Present inside uploaded ZIP |

Runtime/deployment artifacts are present in the ZIP:

```text
backend/.env
backend/.wwebjs_auth
backend/uploads
backend/node_modules in ZIP listing
frontend/dist in ZIP listing
```

These should not be treated as clean source-only project files.

---

# 1. Project Structure

## 1.1 Root

```text
nexus-dashboard/
├── backend/
├── frontend/
├── .vscode/
├── README.md
├── Nexus Dashboard Code Review — Issues.md
├── Nexus Dashboard — Latest Codebase Understanding.md
└── Nexus Dashboard — Project Understandin.md
```

## 1.2 Backend structure

```text
backend/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── scripts/
├── seed/
├── services/
├── utils/
├── package.json
└── server.js
```

Important backend folders:

| Area | Path |
|---|---|
| Entry point | `backend/server.js` |
| Database config | `backend/config/db.js` |
| Planning templates | `backend/config/projectPlanningTemplates.js` |
| Routes | `backend/routes/*.js` |
| Controllers | `backend/controllers/*.js` |
| Models | `backend/models/*.js` |
| Middleware | `backend/middleware/*.js` |
| Services | `backend/services/*.js` |
| Utilities | `backend/utils/*.js` |
| Seed data | `backend/seed/*.js` |
| Migration script | `backend/scripts/migrations/001_add_team_hierarchy.js` |
| Uploads | `backend/uploads` |
| WhatsApp session | `backend/.wwebjs_auth` |

## 1.3 Frontend structure

```text
frontend/
├── src/
│   ├── api/
│   ├── assets/
│   ├── components/
│   ├── context/
│   ├── data/
│   ├── layouts/
│   ├── pages/
│   ├── routes/
│   └── utils/
├── package.json
├── vite.config.js
├── tailwind.config.js
└── index.html
```

Important frontend folders:

| Area | Path |
|---|---|
| App routes | `frontend/src/App.jsx` |
| API client | `frontend/src/api/axios.js` |
| API services | `frontend/src/api/*.js` |
| Layout | `frontend/src/layouts/MainLayout.jsx` |
| Sidebar | `frontend/src/components/common/Sidebar.jsx` |
| Common components | `frontend/src/components/common` |
| Inquiry components | `frontend/src/components/inquiry` |
| Project components | `frontend/src/components/project` |
| Ticket components | `frontend/src/components/ticket` |
| Timesheet components | `frontend/src/components/timesheet` |
| Department components | `frontend/src/components/department` |
| Auth context | `frontend/src/context/AuthContext.jsx` |

---

# 2. Backend Runtime Boot Flow

Runtime entry point:

```text
backend/server.js
```

Startup sequence in the inspected source:

1. Load environment variables with `dotenv.config()`.
2. Connect MongoDB using `connectDB()`.
3. Seed Department Master using `seedDefaultDepartments()` after DB connection.
4. Initialize WhatsApp using `initWhatsApp()`.
5. Initialize kickoff workflow scheduler using `initKickoffWorkflowScheduler()`.
6. Create Express app.
7. Apply CORS, JSON parsing, URL-encoded parsing, and development Morgan logging.
8. Serve uploaded files using `app.use('/uploads', express.static(...))`.
9. Mount API route modules.
10. Mount error middleware.
11. Start server on `PORT` or `5000`.

Mounted backend API prefixes in current ZIP:

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
/api/integrations
/api/test-whatsapp
/api/timesheet
/api/teams
/api/tickets
/api/health
```

Important finding:

```text
/api/departments exists
/api/integrations exists
```

So a `404` for either route usually means the running backend is not this extracted source, the backend was not restarted, the frontend proxy points to another backend, or the deployment folder is stale.

---

# 3. Backend Module Inventory

| Module | Main backend files | Purpose |
|---|---|---|
| Authentication | `authRoutes.js`, `authController.js`, `authMiddleware.js`, `User.js` | Login, current user, profile, avatar, password change, JWT auth |
| Users | `userRoutes.js`, `userController.js`, `User.js` | Admin user management and assignable users |
| Departments | `departmentRoutes.js`, `departmentController.js`, `Department.js`, `departmentSeedService.js` | Department Master with multi-HOD support |
| Teams | `teamRoutes.js`, `teamController.js`, `Team.js` | HOD / team lead / employee hierarchy |
| Customers | `customerRoutes.js`, `customerController.js`, `Customer.js`, `customerUniversal.js` | Customer master and universal customer sync |
| Inquiries | `inquiryRoutes.js`, `inquiryController.js`, `Inquiry.js` | Inquiry creation, editing, status workflow, attachments |
| Projects | `projectRoutes.js`, `projectController.js`, `Project.js`, `ProjectActivityLog.js` | Project master, planning grids, documents, activity, delay tracking |
| Kickoff Workflow | `kickoffWorkflowRoutes.js`, `kickoffWorkflowController.js`, `KickoffWorkflow.js`, `kickoffWorkflowService.js`, `kickoffWorkflowScheduler.js` | Order won/received kickoff scheduling and project creation |
| Notifications | `notificationRoutes.js`, `notificationController.js`, `Notification.js`, `notificationService.js` | Internal notifications and email side effects |
| Email Integration | `integrationRoutes.js`, `integrationController.js`, `IntegrationSettings.js`, `emailSettingsService.js` | Admin integration settings for SMTP/email and WhatsApp status controls |
| WhatsApp | `whatsappService.js`, `testWhatsappRoute.js` | WhatsApp outbound, inbound project task commands, test message route |
| Timesheet | `timesheetRoutes.js`, `timesheetController.js`, `TimesheetTask.js`, `projectTimesheetSyncService.js` | User/project tasks, list, Kanban, calendar, admin views, project sync |
| Tickets | `ticketRoutes.js`, `ticketController.js`, `Ticket.js`, `TicketActivity.js`, `TicketComment.js` | Support / repair ticket lifecycle, comments, attachments, activity |
| Dashboard | `dashboardRoutes.js`, `dashboardController.js` | Dashboard stats, charts, recent activity |

---

# 4. Frontend Module Inventory

| Module | Main frontend files | Purpose |
|---|---|---|
| Login | `LoginPage.jsx` | User login |
| Dashboard | `DashboardPage.jsx` | System summary widgets/charts |
| Inquiries | `InquiriesPage.jsx`, `ElectricalPanelInquiryPage.jsx`, `components/inquiry/*` | Inquiry list and multi-type inquiry form |
| Projects | `ProjectsPage.jsx`, `ProjectDetailPage.jsx`, `ProjectActivityPage.jsx`, `ProjectDocumentPreviewPage.jsx`, `components/project/*` | Project list/detail/planning/activity/documents |
| Customers | `CustomersPage.jsx`, `CustomerDetailPage.jsx`, `CustomerForm.jsx` | Customer master/list/detail |
| Tickets | `TicketsPage.jsx`, `TicketFormPage.jsx`, `TicketForm.jsx`, `ticketPermissions.js` | Ticket list and ticket workflow form |
| Notifications | `NotificationsPage.jsx` | User notifications |
| Timesheet | `TimesheetPage.jsx`, `TimesheetAdminPage.jsx`, `TimesheetListView`, `TimesheetKanbanView`, `TimesheetCalendarView` | Timesheet list/Kanban/calendar/admin views |
| Users | `UsersPage.jsx` | Admin user management |
| Department Master | `DepartmentPage.jsx`, `DepartmentForm.jsx`, `departmentService.js` | Department CRUD, HODs, team lead |
| Integration Settings | `IntegrationSettingsPage.jsx`, `integrationService.js` | Admin email and WhatsApp integration settings |
| Layout/Auth | `MainLayout.jsx`, `Sidebar.jsx`, `Topbar.jsx`, `ProtectedRoute.jsx`, `AuthContext.jsx` | Authenticated shell, navigation, guards |

---

# 5. Frontend Routes

Routes from `frontend/src/App.jsx`:

| Route | Component / Access |
|---|---|
| `/auth/login` | `LoginPage` |
| `/` | `DashboardPage`, protected |
| `/inquiries` | `InquiriesPage`, protected |
| `/inquiries/new` | `ElectricalPanelInquiryPage`, protected |
| `/inquiries/:id` | `ElectricalPanelInquiryPage`, protected |
| `/inquiries/:id/edit` | `ElectricalPanelInquiryPage`, protected |
| `/projects` | `ProjectsPage`, protected |
| `/projects/new` | `ProjectDetailPage`, protected |
| `/projects/:id` | `ProjectDetailPage`, protected |
| `/projects/:id/edit` | `ProjectDetailPage`, protected |
| `/projects/:id/activity` | `ProjectActivityPage`, protected |
| `/projects/:id/documents/preview` | `ProjectDocumentPreviewPage`, protected |
| `/customers` | `CustomersPage`, protected |
| `/customers/:id` | `CustomerDetailPage`, protected |
| `/tickets` | `TicketsPage`, protected |
| `/tickets/new` | `TicketFormPage`, protected |
| `/tickets/:id` | `TicketFormPage`, protected |
| `/tickets/:id/edit` | `TicketFormPage`, protected |
| `/notifications` | `NotificationsPage`, protected |
| `/timesheet` | `TimesheetPage`, protected |
| `/timesheet/admin` | `TimesheetAdminPage`, protected inside timesheet route tree |
| `/timesheet/list` | `TimesheetListView`, lazy-loaded |
| `/timesheet/kanban` | `TimesheetKanbanView`, lazy-loaded |
| `/timesheet/calendar` | `TimesheetCalendarView`, lazy-loaded |
| `/users` | `UsersPage`, admin-only frontend guard |
| `/masters/departments` | `DepartmentPage`, admin-only frontend guard |
| `/masters/integrations` | `IntegrationSettingsPage`, admin-only frontend guard |
| `/404` | `NotFoundPage` |

Important routing note:

```text
frontend/src/pages/TicketViewPage.jsx exists,
but /tickets/:id currently routes to TicketFormPage.
```

So the dedicated ticket view page is still unused.

---

# 6. Sidebar Navigation

Main navigation visible to authenticated users:

```text
Dashboard
Inquiries
Projects
Customers
Tickets
Timesheet
```

Master section in current Sidebar:

```text
Timesheet             visible to admin, hod, team_lead, manager
User Management       visible to admin
Department            visible to admin
Integration Settings  visible to admin
```

Compared with older Markdown, the sidebar is no longer admin-only for Timesheet Admin. It now considers:

```text
admin
hod
team_lead
manager
```

---

# 7. API Route Inventory

## 7.1 Auth routes — `/api/auth`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| POST | `/login` | Public | Login |
| GET | `/me` | Auth | Current user |
| PUT | `/profile` | Auth | Update own profile |
| POST | `/profile/avatar` | Auth + upload | Upload own avatar |
| PUT | `/change-password` | Auth | Change password |

## 7.2 User routes — `/api/users`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/assignable` | Auth + team context + hierarchy scope | Scoped assignable users |
| GET | `/` | Admin | List users |
| POST | `/` | Admin | Create user |
| POST | `/:id/avatar` | Admin + upload | Update user avatar |
| GET | `/:id` | Admin | Get user |
| PUT | `/:id` | Admin | Update user |
| DELETE | `/:id` | Admin | Delete/deactivate user |

## 7.3 Department routes — `/api/departments`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/` | Auth | List departments; admin can include inactive with query |
| POST | `/` | Admin | Create department |
| GET | `/:id` | Auth | Get department |
| PUT | `/:id` | Admin | Update department |
| DELETE | `/:id` | Admin | Soft deactivate department |

## 7.4 Customer routes — `/api/customers`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/` | Auth | List customers |
| POST | `/` | Auth | Create customer |
| GET | `/:id` | Auth | Get customer |
| PUT | `/:id` | Auth | Update customer |
| DELETE | `/:id` | Admin | Delete customer |

## 7.5 Inquiry routes — `/api/inquiries`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/follow-ups` | Auth | Pending follow-ups |
| GET | `/` | Auth | Inquiry list |
| POST | `/` | Auth + upload | Create inquiry |
| PATCH | `/:id/status` | Auth + upload | Update inquiry status |
| GET | `/:id` | Auth | Get inquiry |
| PUT | `/:id` | Auth + upload | Update inquiry |
| DELETE | `/:id` | Admin | Delete inquiry |

Upload field:

```text
attachments
```

## 7.6 Project routes — `/api/projects`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| POST | `/convert/:inquiryId` | Auth | Schedule/create kickoff conversion flow |
| POST | `/recalc-delays` | Auth | Recalculate project delays |
| GET | `/planning-templates` | Auth | Get planning templates |
| GET | `/` | Auth | List projects |
| POST | `/` | Auth | Create project |
| POST | `/:id/copy` | Auth | Copy project |
| POST | `/:id/documents` | Auth + upload | Upload project documents |
| DELETE | `/:id/documents/:documentId` | Auth | Delete project document |
| GET | `/:id` | Auth | Get project |
| PUT | `/:id` | Auth | Update project |
| DELETE | `/:id` | Admin | Delete project |
| GET | `/:id/activity` | Auth | Project activity log |
| GET | `/:id/task-completion-history` | Auth | Expected vs actual task completion history |

## 7.7 Kickoff workflow routes — `/api/kickoff-workflows`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| POST | `/:inquiryId/schedule` | Auth | Schedule kickoff |
| POST | `/:inquiryId/complete` | Auth | Complete kickoff and create project |
| GET | `/:inquiryId` | Auth | Get workflow for inquiry |
| POST | `/process/due` | Admin | Process due workflows manually |

## 7.8 Notification routes — `/api/notifications`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/` | Auth | List current user notifications |
| PUT | `/read-all` | Auth | Mark all read |
| PUT | `/:id/read` | Auth | Mark one read |
| DELETE | `/:id` | Auth | Delete notification |

## 7.9 Dashboard routes — `/api/dashboard`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/stats` | Auth | Dashboard stats |
| GET | `/recent` | Auth | Recent inquiries/projects/tickets |

## 7.10 Integration routes — `/api/integrations`

All integration routes use:

```text
protect + requireAdmin
```

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/status` | Admin | Get email + WhatsApp integration status |
| GET | `/email` | Admin | Get email settings |
| PUT | `/email` | Admin | Save email settings |
| POST | `/email/verify` | Admin | Verify SMTP/login settings |
| GET | `/whatsapp/status` | Admin | Get WhatsApp status |
| POST | `/whatsapp/restart` | Admin | Restart WhatsApp client |
| POST | `/whatsapp/logout` | Admin | Clear WhatsApp session/logout |

## 7.11 Timesheet routes — `/api/timesheet`

All timesheet routes use:

```text
protect
attachTeamContext
```

| Method | Path | Purpose |
|---|---|---|
| GET | `/list` | Paginated list |
| GET | `/kanban` | Kanban view |
| GET | `/calendar` | Calendar view |
| GET | `/tasks` | Scoped task list |
| POST | `/tasks` | Create task |
| GET | `/tasks/:id` | Get task |
| PUT | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task |
| PATCH | `/tasks/:id/status` | Update task status |
| PATCH | `/tasks/:id/kanban` | Update Kanban position |
| PATCH | `/tasks/:id/archive` | Archive task |
| PATCH | `/tasks/:id/restore` | Restore archived task |
| DELETE | `/tasks/:id/archived` | Permanently delete archived task |
| GET | `/admin/all` | Elevated scoped task list |
| GET | `/admin/summary` | Elevated scoped summary |
| GET | `/admin/workload` | Elevated scoped workload |
| GET | `/admin/daily-breakdown` | Elevated scoped daily breakdown |

Elevated routes use:

```text
authorizeHierarchy('team_lead')
```

So backend allows:

```text
admin
hod
manager as hod-compatible
team_lead
```

## 7.12 Team routes — `/api/teams`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/` | Auth | List scoped teams |
| POST | `/` | Admin | Create team |
| GET | `/:id` | Auth | Get team |
| PUT | `/:id` | Admin | Update team |
| DELETE | `/:id` | Admin | Deactivate team |
| PATCH | `/:id/hod` | Admin | Assign HOD |
| PATCH | `/:id/team-lead` | Admin/HOD | Assign team lead |
| GET | `/:id/members` | Auth | Get members |
| POST | `/:id/members` | Admin/HOD/team lead | Add member |
| DELETE | `/:id/members/:userId` | Admin/HOD/team lead | Remove member |

## 7.13 Ticket routes — `/api/tickets`

| Method | Path | Purpose |
|---|---|---|
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

## 7.14 WhatsApp test route — `/api/test-whatsapp`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/` | None | Sends WhatsApp test message |

This route is still public in the current ZIP.

---

# 8. Database Model Summary

## 8.1 `User`

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

Role order:

```text
admin > hod > manager > team_lead > employee
```

Important fields:

| Field | Purpose |
|---|---|
| `name` | User name |
| `email` | Login email |
| `password` | Hashed password |
| `phone` | Contact / WhatsApp matching |
| `avatar` | Profile avatar URL |
| `role` | User role enum |
| `department` | Mixed value for Department ObjectId or legacy string |
| `hodDepartments` | Mixed array for HOD department ownership |
| `teamId` | Team relation |
| `reportsTo` | Reporting manager/user relation |
| `isActive` | Active/deactivated user flag |

## 8.2 `Department`

File:

```text
backend/models/Department.js
```

Current model supports:

| Field | Purpose |
|---|---|
| `name` | Uppercase department name |
| `code` | Uppercase department code |
| `hod` | Backward-compatible primary HOD |
| `hods` | Multiple HOD users |
| `teamLead` | Department team lead |
| `isActive` | Active/deactivated department |
| `createdBy` | Creator user |

Important update versus older Markdown:

```text
Department now supports hods[] for multiple HOD users.
```

## 8.3 `Customer`

File:

```text
backend/models/Customer.js
```

Important fields:

| Field | Purpose |
|---|---|
| `customerId` | Auto-generated customer number |
| `customerName` | Current primary customer field |
| `companyName` | Legacy-compatible field |
| `companyType` | Company/customer type |
| `contacts` | Contact array |
| `contactPerson` | Legacy primary contact |
| `email` | Email |
| `mobileNumber` | Mobile |
| `city` | City |
| `address` | Address |
| `gstNumber` | GST number |
| `totalProjects` | Project count |
| `notes` | Notes |
| `isActive` | Active flag |

The current `customerUniversal.js` is designed around `customerName` as the primary field and clears legacy `companyName` during sync/update where applicable.

## 8.4 `Inquiry`

File:

```text
backend/models/Inquiry.js
```

Main inquiry types:

```text
PLC_AUTOMATION
VFD_PANEL
MCC_PANEL
MCC_CUM_PLC
LEGACY
```

Current status enum includes active and legacy values:

```text
New
Technical Evaluation
Technical BoM Submitted
BoM Approval Pending
Revision
Commercial BOM Submission
Order Won
Order Lost
Inquiry Hold
In Progress
Commercial Discussion
Commercial Submit
Technical Submit
Technical BOM Submission
Technical BoM Submission
BoM Submitted
Technical BOM Submitted
Technical BoM Submitted
BOM Submitted
Bom Submitted
BOM SUBMITTED
Technical BOM Approval
Technical BoM Approval
Order Received
Order Recieved
Inquiry Lost
Inq. Lost
Quotation Submit
Project Won
```

Important note:

```text
The system still carries multiple legacy spellings and aliases.
Controllers and frontend normalize many of them, but status strings remain duplicated across files.
```

### PLC details now persisted

Older Markdown said PLC switchgear/support fields were missing from backend. In this current ZIP, `plcDetailsSchema` now includes:

```text
plcDetails.switchgearMake
plcDetails.customSwitchgearMake
plcDetails.programmingDevelopmentScope
plcDetails.automationRequirements
plcDetails.supportRequirements.onsiteSupportRequired
plcDetails.supportRequirements.onsiteSupportDays
plcDetails.supportRequirements.commissioningSupportRequired
plcDetails.supportRequirements.commissioningSupportDays
plcDetails.ioDetails.*
```

So the older PLC persistence mismatch is no longer valid for this ZIP.

### VFD details

Current backend VFD schema includes:

```text
switchgearMake
customSwitchgearMake
panelType
loadDetails
additionalComponents
referenceBomAttached
onsiteSupportRequired
onsiteSupportDays
commissioningSupportRequired
commissioningSupportDays
```

### MCC details now include support days

Current backend MCC schema includes:

```text
mccDetails.incomerDetails
mccDetails.outgoingFeederDetails
mccDetails.loadDetails
mccDetails.layoutPreferences.panelType
mccDetails.layoutPreferences.panelStructure
mccDetails.layoutPreferences.cableEntryMvLv
mccDetails.layoutPreferences.busbarArrangement
mccDetails.notesAndSupport.onsiteSupportRequired
mccDetails.notesAndSupport.onsiteSupportDays
mccDetails.notesAndSupport.commissioningSupportRequired
mccDetails.notesAndSupport.commissioningSupportDays
mccDetails.notesAndSupport.trainingRequired
mccDetails.notesAndSupport.warrantyPeriodMonths
mccDetails.notesAndSupport.amcRequiredAfterWarranty
mccDetails.notesAndSupport.additionalComments
```

So the older MCC support-days persistence mismatch is no longer valid for this ZIP.

Also, older Markdown said MCC backend still had `layoutPreferences.ventilation`. In this current ZIP, `ventilation` is not present in `mccDetails.layoutPreferences`.

## 8.5 `Project`

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

Important fields:

| Area | Fields |
|---|---|
| Identity | `projectId`, `inquiryReference`, `inquiryNumber` |
| Customer/project | `customerName`, `projectName`, `projectType`, `projectScopes`, `projectDepartment`, `panelType`, `quantity` |
| Dates/value | `orderValue`, `orderDate`, `expectedDeliveryDate`, `actualDeliveryDate`, `projectEndDate`, `completedAt` |
| Delay | `delayedDays`, `delayedEndDate`, `isDelayed` |
| Status | `productionStatus`, `dispatchStatus`, `installationStatus`, `paymentStatus`, `projectStatus`, `completionPercentage` |
| Kickoff | `kickoffMeeting` |
| Documents | `documents` |
| Team | `assignedTeamMembers`, legacy `assignedTo` |
| Customer | `customerRef` |
| Planning | `planningTasks`, `planningGrids` |

Planning still exists in two forms:

```text
planningGrids   newer grouped grid structure
planningTasks   flattened legacy/reporting compatibility structure
```

This dual structure remains an architectural risk.

## 8.6 `TimesheetTask`

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

Important index:

```text
taskSource + sourceProject + sourceTaskKey
```

This prevents duplicate project-linked timesheet tasks.

## 8.7 `Ticket`

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

Support types:

```text
Free
Paid
Warranty
Comprehensive AMC
Non Comprehensive AMC
Other
```

Product types:

```text
N/A
HMI
PLC
Servo
VFD
SCADA
Industrial PC
Other
```

Important update versus older Markdown:

```text
Ticket department is now a String field, not a hardcoded department enum.
Frontend TicketForm fetches departments from Department Master.
```

Ticket manager roles in backend controller:

```text
admin
hod
manager
team_lead
```

Assignable ticket users:

```text
employee
```

The older `technical_communication` / `engineer` ticket-role mismatch is not present in the current inspected ticket controller or frontend ticket permission helper.

## 8.8 `IntegrationSettings`

File:

```text
backend/models/IntegrationSettings.js
```

Purpose:

```text
Stores admin-configurable email integration settings.
```

Important fields:

```text
singletonKey
email.isEnabled
email.provider
email.host
email.port
email.secure
email.username
email.fromEmail
email.passwordEncrypted
email.lastVerifiedAt
email.lastVerificationStatus
email.lastVerificationError
updatedBy
```

Password is stored encrypted with AES-256-GCM in `emailSettingsService.js`.

## 8.9 `Notification`

File:

```text
backend/models/Notification.js
```

Notification types include:

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

## 8.10 `KickoffWorkflow`

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

Notification log statuses:

```text
Queued
Sent
Skipped
Failed
```

---

# 9. Authentication and Permission Findings

## 9.1 Backend auth

File:

```text
backend/middleware/authMiddleware.js
```

`protect` behavior:

1. Reads Bearer token from `Authorization` header.
2. Also checks `req.cookies?.token`.
3. Verifies JWT using `JWT_SECRET`.
4. Fetches active user from database.
5. Selects required user fields.
6. Attaches user to `req.user`.

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

## 9.2 Still-active issue: forbidden access can become 500

`authorize()` and `authorizeHierarchy()` call `createError(...)` without passing a status code for access denial.

Current helper:

```text
createError(message, statusCode)
```

But forbidden branch passes only message.

Impact:

```text
Access denied may become HTTP 500 instead of HTTP 403.
```

Affected areas include admin-only routes and hierarchy checks that use these helpers.

`permissionMiddleware.requireRoles()` has its own default 403 behavior, so not all route guards are affected.

## 9.3 Frontend auth context

File:

```text
frontend/src/context/AuthContext.jsx
```

Current frontend role helpers:

```text
isAdmin
isHod
isManagerRole
isTeamLead
isEmployee
isManager
isTicketAssignee
```

Important update versus older Markdown:

```text
AuthContext no longer exposes isTechnicalCommunication or isEngineer.
```

---

# 10. Department Master Current State

Department Master is active in:

```text
backend/models/Department.js
backend/controllers/departmentController.js
backend/routes/departmentRoutes.js
backend/services/departmentSeedService.js
frontend/src/pages/DepartmentPage.jsx
frontend/src/components/department/DepartmentForm.jsx
frontend/src/api/departmentService.js
```

Seeded default departments:

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

Current capabilities:

| Capability | Status |
|---|---|
| List active departments | Present |
| Include inactive departments for admin | Present |
| Create department | Present |
| Update department | Present |
| Soft deactivate department | Present |
| Multiple HODs per department | Present through `hods[]` |
| Primary HOD backward compatibility | Present through `hod` |
| Department team lead | Present |
| Sync department HOD ownership to users | Present |
| User Management department dropdown | Uses Department Master API |
| Ticket department dropdown | Uses Department Master API |

Remaining limitation:

```text
Project planning templates still contain hardcoded department names.
```

So Department Master is much more integrated than older reports suggested, but it is still not the full system-wide single source of truth.

---

# 11. Customer Name Current State

Current source-of-truth direction:

```text
customerName is the main field.
companyName is legacy compatibility.
```

Important files:

```text
backend/utils/customerUniversal.js
backend/models/Customer.js
backend/controllers/projectController.js
frontend/src/components/customer/CustomerForm.jsx
```

Confirmed current behavior:

* Customer sync builds payload around `customerName`.
* Legacy `companyName` can be used as fallback for old records.
* Universal customer sync clears `companyName` on update/create where applicable.
* Project controller deletes `companyName` from body in several flows.
* Customer form maps old `companyName` into `customerName` for compatibility and removes `companyName` from payload.

This is aligned with the intended “single customer name” direction, while still keeping legacy data readable.

---

# 12. Inquiry Workflow Current State

## 12.1 Inquiry creation

High-level flow:

1. Frontend form collects common + type-specific inquiry data.
2. Request is submitted as multipart FormData with JSON + attachments.
3. Backend parses JSON from multipart payload.
4. Backend normalizes contacts/customer fields.
5. Backend allowlists fields.
6. Inquiry is saved.
7. Internal notification is created.
8. Customer may be auto-created/updated.
9. WhatsApp individual/group notification may be attempted.
10. Attachments may be sent to WhatsApp group.

## 12.2 Inquiry update

High-level flow:

1. Existing inquiry is loaded.
2. Request body is parsed.
3. Attachments are merged from kept old attachments + new uploads.
4. Status details are merged where applicable.
5. Inquiry is updated.
6. Internal notification/status notification is created.

## 12.3 Status normalization

Status strings are still heavily duplicated across:

```text
backend/models/Inquiry.js
backend/controllers/inquiryController.js
backend/controllers/dashboardController.js
frontend/src/components/common/StatusBadge.jsx
frontend/src/components/inquiry/forms/CommonInquirySections.jsx
frontend/src/components/inquiry/InquiryForm.jsx
frontend/src/pages/InquiriesPage.jsx
frontend/src/pages/ElectricalPanelInquiryPage.jsx
```

Risk:

```text
Future status changes must be updated in many places.
```

---

# 13. Kickoff Workflow Current State

Main files:

```text
backend/routes/kickoffWorkflowRoutes.js
backend/controllers/kickoffWorkflowController.js
backend/models/KickoffWorkflow.js
backend/services/kickoffWorkflowService.js
backend/services/kickoffWorkflowScheduler.js
```

Schedule kickoff flow:

1. Inquiry is loaded.
2. Scheduled date/time is validated.
3. Attendees are validated.
4. Workflow is created or updated.
5. Inquiry status/kickoff state is updated.
6. WhatsApp group notification is attempted.
7. WhatsApp configured notify number notification is attempted.
8. Customer WhatsApp notification is attempted if phone exists.
9. Attendee WhatsApp notifications are attempted.
10. Email notifications are attempted.
11. Notification logs are written to workflow.

Complete kickoff flow:

1. Workflow is loaded.
2. Meeting time must have passed.
3. Workflow becomes completed.
4. Project is created from inquiry/workflow.
5. Inquiry is marked converted.
6. Customer/project data is synced.
7. Activity and notifications are created.

Important update versus older Markdown:

```text
kickoffWorkflowService.normaliseNotificationResult() now handles result.ok and result.status from whatsappService.
```

So the older “WhatsApp sent but logged failed because of result-shape mismatch” issue is no longer valid in this ZIP.

---

# 14. Project Management Current State

Main files:

```text
backend/controllers/projectController.js
backend/models/Project.js
backend/models/ProjectActivityLog.js
backend/config/projectPlanningTemplates.js
frontend/src/pages/ProjectsPage.jsx
frontend/src/pages/ProjectDetailPage.jsx
frontend/src/components/project/*
```

Project supports:

* manual project create/update/delete
* project copy
* NAPL project ID generation
* customer reference sync
* planning grids
* flattened planning tasks
* document upload/delete
* project activity log
* delay tracking
* task completion history
* WhatsApp notification side effects
* project-to-timesheet sync on create/copy/update/delete

Remaining architecture risk:

```text
planningGrids and planningTasks both exist.
Different features may depend on different representations.
```

---

# 15. Project to Timesheet Sync Current State

Main service:

```text
backend/services/projectTimesheetSyncService.js
```

Integrated from:

```text
backend/controllers/projectController.js
```

Integration points:

| Project action | Timesheet sync action |
|---|---|
| Create project | Sync assigned project planning tasks |
| Copy project | Sync copied project planning tasks |
| Update project | Sync changed assigned planning tasks |
| Delete project | Archive linked project timesheet tasks |

Task extraction order:

```text
1. planningGrids
2. fallback planningTasks
```

Project planning task becomes a timesheet task only when it has a valid assignee.

Archive behavior:

| Trigger | Archive reason |
|---|---|
| Project planning task removed | `PROJECT_TASK_REMOVED` |
| Project planning task becomes unassigned | `PROJECT_TASK_UNASSIGNED` |
| Project deleted | `PROJECT_DELETED` |

Remaining limitation:

```text
backend/services/projectTimesheetBackfillService.js exists, but no active route/startup call is wired.
```

So existing old project tasks are not automatically backfilled unless invoked manually elsewhere.

---

# 16. Timesheet Current State

Frontend views:

```text
/timesheet/list
/timesheet/kanban
/timesheet/calendar
/timesheet/admin
```

Backend routes:

```text
/api/timesheet/list
/api/timesheet/kanban
/api/timesheet/calendar
/api/timesheet/tasks
/api/timesheet/admin/all
/api/timesheet/admin/summary
/api/timesheet/admin/workload
/api/timesheet/admin/daily-breakdown
```

Permission/scoping behavior:

| Role | Scope |
|---|---|
| Admin | All users |
| HOD | Managed teams/departments |
| Manager | Treated as HOD-compatible in auth helpers |
| Team Lead | Own team |
| Employee | Own/team-scoped tasks with restricted edit rights |

Frontend sidebar now exposes Timesheet Admin to:

```text
admin
hod
team_lead
manager
```

This is more aligned with backend than older reports suggested.

---

# 17. Ticket Module Current State

Main backend files:

```text
backend/routes/ticketRoutes.js
backend/controllers/ticketController.js
backend/models/Ticket.js
backend/models/TicketActivity.js
backend/models/TicketComment.js
```

Main frontend files:

```text
frontend/src/pages/TicketsPage.jsx
frontend/src/pages/TicketFormPage.jsx
frontend/src/components/ticket/TicketForm.jsx
frontend/src/components/ticket/ticketPermissions.js
```

Ticket lifecycle:

```text
New
Assigned
Working
Customer Side Pending
Closed
Void
```

Backend ticket manager roles:

```text
admin
hod
manager
team_lead
```

Backend assignable ticket users:

```text
employee
```

Workflow permissions:

| Action | Current intended access |
|---|---|
| Create ticket | Management roles only |
| Assign ticket | Management roles only |
| Start work | Management roles or assigned employee |
| Customer pending | Management roles or assigned employee |
| Close ticket | Management roles or assigned employee |
| Reopen | Management roles only |
| Void | Management roles in backend; frontend helper shows admin/HOD only |
| Add comment | Any authenticated user |
| Upload attachment | Any authenticated user |
| Edit/delete comment | Author or management |
| Delete attachment | Uploader or management |

Important current mismatches:

1. `TicketViewPage.jsx` exists but is not routed.
2. Frontend `canVoidTicket()` restricts Void to Admin/HOD, but backend `canVoidTicket` allows all management roles (`admin`, `hod`, `manager`, `team_lead`).

---

# 18. Integration Settings Current State

Frontend:

```text
frontend/src/pages/IntegrationSettingsPage.jsx
frontend/src/api/integrationService.js
```

Backend:

```text
backend/routes/integrationRoutes.js
backend/controllers/integrationController.js
backend/models/IntegrationSettings.js
backend/services/emailSettingsService.js
backend/services/whatsappService.js
```

Admin-only capabilities:

| Area | Capability |
|---|---|
| Email | View settings |
| Email | Save SMTP settings |
| Email | Verify SMTP/login |
| Email | Store password encrypted |
| WhatsApp | View client status |
| WhatsApp | Restart client |
| WhatsApp | Logout/clear session |

Email active config order:

```text
1. Database IntegrationSettings when enabled and password exists
2. Environment fallback OUTLOOK_EMAIL / OUTLOOK_PASS
```

Important `.env` note:

```text
emailSettingsService.js uses OUTLOOK_PASS,
while older docs/reports sometimes mention OUTLOOK_PASSWORD.
```

If email fails after deployment, check the exact env variable names used by current code.

---

# 19. WhatsApp Current State

Main service:

```text
backend/services/whatsappService.js
```

Uses:

```text
whatsapp-web.js
LocalAuth
qrcode-terminal
qrcode
```

Session id:

```text
nexus-session
```

Main outbound helpers:

```text
initWhatsApp
getWhatsAppStatus
restartWhatsApp
logoutWhatsApp
sendWhatsAppNotification
sendWhatsAppGroupNotification
sendWhatsAppGroupWithAttachments
sendTestMessage
```

Outgoing result shape:

```text
{ ok, status, recipient, error }
```

Statuses include:

```text
Sent
Queued
Skipped
Failed
```

WhatsApp inbound project task command supports project planning task status updates from messages.

Supported command style examples:

```text
NEXUS | NAPL-0209 | GA Approval | Completed | Sent to client
PROJECT | NAPL-0209 | GA Approval | Completed | Sent to client
```

Multiline style:

```text
PROJECT: NAPL-0209
TASK: GA Approval
STATUS: Completed
REMARK: Sent to client
```

Still-active risk:

```text
GET /api/test-whatsapp is mounted without authentication.
```

---

# 20. Undocumented / Old / Duplicate Files

## Backend

| File / area | Observation |
|---|---|
| `backend/server_old.js` | Old server backup |
| `backend/controllers/userController_old.js` | Old user controller backup |
| `backend/models/User_old.js` | Old user model backup |
| `backend/controllers/inquiryController_old.js` | Old inquiry controller backup |
| `backend/services/documentExtractionService.js` | Placeholder/unused service |
| `backend/services/projectTimesheetBackfillService.js` | Exists but not wired into active route/startup |
| `backend/routes/testWhatsappRoute.js` | Public diagnostic route |
| `backend/utils/createNotification.js` | Separate utility alongside notification service flow |
| `backend/utils/departmentUtils_old.js` | Old department utility backup |
| `backend/scripts/migrations/001_add_team_hierarchy.js` | Migration script outside normal runtime |
| `backend/seed/*.js` | Seed scripts outside normal runtime except department seed service |
| `backend/.wwebjs_auth` | Runtime WhatsApp session artifact in ZIP |
| `backend/uploads` | Runtime uploaded files in ZIP |
| `backend/.env` | Environment/secrets file in ZIP |

## Frontend

| File / area | Observation |
|---|---|
| `frontend/src/pages/InquiriesPage_old.jsx` | Old page backup |
| `frontend/src/pages/ProjectsPage_ol.jsx` | Old/backup page |
| `frontend/src/components/common/Sidebar_old.jsx` | Old sidebar backup |
| `frontend/src/components/common/MainLayout.jsx` | Duplicate component name; runtime uses `frontend/src/layouts/MainLayout.jsx` |
| `frontend/src/pages/TicketViewPage.jsx` | Exists but not routed |
| `frontend/src/pages/TimesheetCalendarPage.jsx` | Exists but active route uses `TimesheetCalendarView` |
| `frontend/src/data/inquiryMasterData_old.js` | Old master data backup |
| `frontend/src/components/inquiry/forms/*_old.jsx` | Old inquiry component backups |

Risk:

```text
Future edits can accidentally target old files instead of live files.
```

---

# 21. Corrected Findings Compared With Older Markdown

The older Markdown reports are useful, but these items are stale for the currently extracted ZIP:

| Older finding | Current ZIP status |
|---|---|
| PLC switchgear make not persisted | Fixed; fields exist in backend `plcDetailsSchema` |
| PLC support requirements not persisted | Fixed; `plcDetails.supportRequirements` exists |
| MCC support days not persisted | Fixed; support day fields exist under `mccDetails.notesAndSupport` |
| MCC ventilation removed frontend but still backend | Fixed; backend layout preferences no longer show `ventilation` |
| Kickoff WhatsApp result-shape mismatch | Fixed; `normaliseNotificationResult()` handles `ok` and `status` |
| Frontend AuthContext references `technical_communication` / `engineer` | Not present in current AuthContext |
| Ticket department hardcoded enum | Not present in current Ticket model; department is string and frontend loads Department Master |
| UsersPage Add User `DEPARTMENTS is not defined` crash | Not present in current UsersPage; it uses dynamic Department Master options |
| Department model only supports one HOD | Updated; model has `hods[]` plus legacy `hod` |
| Timesheet Admin sidebar only admin | Updated; sidebar allows admin/HOD/team lead/manager |

---

# 22. Still-Active Issues / Risks

## 22.1 Auth denial can return HTTP 500 instead of 403

Files:

```text
backend/middleware/authMiddleware.js
```

Problem:

```text
authorize() and authorizeHierarchy() call createError(message) without statusCode on access denial.
```

Expected:

```text
createError(message, 403)
```

Impact:

```text
Forbidden access can look like server crash/error.
```

## 22.2 Public WhatsApp test route

Files:

```text
backend/server.js
backend/routes/testWhatsappRoute.js
```

Problem:

```text
GET /api/test-whatsapp has no protect middleware.
```

Impact:

```text
Anyone who can reach backend can trigger a WhatsApp test send.
```

## 22.3 Ticket view page unused

Files:

```text
frontend/src/App.jsx
frontend/src/pages/TicketViewPage.jsx
frontend/src/pages/TicketFormPage.jsx
```

Problem:

```text
/tickets/:id routes to TicketFormPage, not TicketViewPage.
```

Impact:

```text
Dedicated ticket view page is dead/unused unless intentionally abandoned.
```

## 22.4 Ticket Void permission mismatch

Files:

```text
backend/controllers/ticketController.js
frontend/src/components/ticket/ticketPermissions.js
```

Problem:

```text
Backend allows management roles to void.
Frontend helper shows Void only to Admin/HOD.
```

Impact:

```text
manager/team_lead may be allowed by backend but not shown action in frontend.
```

## 22.5 Project planning dual representation

Files:

```text
backend/models/Project.js
backend/controllers/projectController.js
backend/services/projectTimesheetSyncService.js
backend/controllers/dashboardController.js
```

Problem:

```text
planningGrids and planningTasks both exist and must stay synchronized.
```

Impact:

```text
Reports/sync/dashboard can diverge if only one representation is updated.
```

## 22.6 Project-timesheet backfill not wired

File:

```text
backend/services/projectTimesheetBackfillService.js
```

Problem:

```text
Service exists but no active route/startup integration was found.
```

Impact:

```text
Old existing project tasks will not automatically appear in timesheet unless manually backfilled.
```

## 22.7 Status strings still duplicated

Files:

```text
backend/models/Inquiry.js
backend/controllers/inquiryController.js
backend/controllers/dashboardController.js
frontend/src/components/common/StatusBadge.jsx
frontend/src/components/inquiry/forms/CommonInquirySections.jsx
frontend/src/components/inquiry/InquiryForm.jsx
frontend/src/pages/InquiriesPage.jsx
frontend/src/pages/ElectricalPanelInquiryPage.jsx
```

Problem:

```text
Many active/legacy status aliases are repeated in multiple files.
```

Impact:

```text
New status changes are easy to implement incompletely.
```

## 22.8 Runtime/private artifacts are bundled with source

Problem:

```text
.env, WhatsApp session data, uploads, node_modules, and build output are included in ZIP.
```

Impact:

```text
Credential/session leakage risk and stale runtime state risk.
```

---

# 23. Recommended Surgical Change Workflow Going Forward

For each next requested fix:

1. Identify exact affected files.
2. Confirm whether the file is live or old/unused.
3. Explain root cause from source code.
4. Make only minimal changes.
5. Avoid refactoring unrelated modules.
6. Preserve existing labels/placeholders and UI behavior unless explicitly requested.
7. Return:

```text
Modified files
Root cause
Change summary
Validation performed
Remaining risks
```

Do not blindly trust the older Markdown files where they conflict with the current extracted source.

---

# 24. Current System Summary

The current Nexus Dashboard ZIP contains a multi-module MERN-style business system:

1. Inquiry Management
   * Electrical panel inquiry form for PLC, VFD, MCC, and MCC cum PLC.
   * Attachments, status flow, notifications, customer sync, WhatsApp/email side effects.

2. Kickoff Workflow
   * Order-won/received inquiry can schedule kickoff.
   * Due kickoff can become ready.
   * Completion creates project.

3. Project Management
   * NAPL project IDs.
   * Planning grids + flattened tasks.
   * Activity logs, documents, delay tracking, project copy, timesheet sync.

4. Timesheet
   * List, Kanban, calendar, admin views.
   * Hierarchy-based scope for admin/HOD/manager/team lead/employee.
   * Project-linked tasks are synced and protected differently from user-created tasks.

5. Department Master
   * Active model/routes/UI.
   * Supports multiple HODs and team lead.
   * Used by User Management and Ticket form.
   * Still not fully replacing hardcoded department names in project planning templates.

6. Ticket Module
   * Ticket lifecycle, assignment, comments, attachments, activity timeline.
   * Department dropdown uses Department Master.
   * Main open issues are unused view route and void-permission mismatch.

7. Integration Settings
   * Admin-only page/API for email SMTP settings and WhatsApp status/restart/logout.
   * Email password stored encrypted.
   * Environment fallback still exists.

8. Notifications and WhatsApp
   * Internal dashboard notifications.
   * Email notification service.
   * WhatsApp outbound + inbound project task commands.
   * Public test route remains a security issue.

9. Main current risks
   * Auth forbidden can return 500 instead of 403.
   * Public WhatsApp diagnostic route.
   * Project planning dual structures.
   * Project backfill service not wired.
   * Status alias duplication.
   * Runtime/private artifacts included in ZIP.
