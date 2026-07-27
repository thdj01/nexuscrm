# Nexus Dashboard — Project Understanding Report

## 0. Analysis Scope

Uploaded codebase inspected from:

`/mnt/data/nexus-dashboard.zip`

Actual source code was extracted and reviewed across:

* `backend/server.js`
* backend routes, controllers, models, services, middleware, utilities
* frontend `src/App.jsx`, pages, components, API services, context, route guards
* seed, migration, old backup, and unused/duplicate files

No code was modified.

Backend JavaScript syntax check passed for live backend files excluding `node_modules` and WhatsApp session cache.

Frontend build could not complete because the uploaded `node_modules` is missing Rollup optional native package:

`@rollup/rollup-linux-x64-gnu`

This is a dependency/package installation issue in the uploaded artifact, not confirmed as an application source-code syntax error.

---

# 1. Project Structure Analysis

## Backend structure

Main backend root:

`backend/`

Important runtime files:

| Area             | Files / Folder                                                       |
| ---------------- | -------------------------------------------------------------------- |
| Entry point      | `backend/server.js`                                                  |
| Database config  | `backend/config/db.js`                                               |
| Routes           | `backend/routes/*.js`                                                |
| Controllers      | `backend/controllers/*.js`                                           |
| Models           | `backend/models/*.js`                                                |
| Middleware       | `backend/middleware/*.js`                                            |
| Services         | `backend/services/*.js`                                              |
| Utilities        | `backend/utils/*.js`                                                 |
| Seed / scripts   | `backend/seed`, `backend/scripts/migrations`                         |
| Uploads          | `backend/uploads/inquiry`, `backend/uploads/avatars`, ticket uploads |
| WhatsApp session | `backend/.wwebjs_auth`                                               |

Runtime boot sequence from `backend/server.js`:

1. Loads environment variables using `dotenv`.
2. Connects MongoDB using `connectDB()`.
3. Seeds Department Master using `seedDefaultDepartments()`.
4. Initializes Express.
5. Applies CORS, JSON parser, URL encoding, and `morgan`.
6. Serves `/uploads` statically from `backend/uploads`.
7. Mounts all API routes.
8. Starts WhatsApp client using `initWhatsApp()`.
9. Starts kickoff workflow scheduler using `initKickoffWorkflowScheduler()`.
10. Starts HTTP server.

Mounted API prefixes:

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

## Frontend structure

Main frontend root:

`frontend/src/`

Important runtime files:

| Area                  | Files / Folder                           |
| --------------------- | ---------------------------------------- |
| App routing           | `frontend/src/App.jsx`                   |
| Auth context          | `frontend/src/context/AuthContext.jsx`   |
| Toast context         | `frontend/src/context/ToastContext.jsx`  |
| Protected route       | `frontend/src/routes/ProtectedRoute.jsx` |
| Layout                | `frontend/src/layouts/MainLayout.jsx`    |
| Common UI             | `frontend/src/components/common`         |
| Pages                 | `frontend/src/pages`                     |
| API services          | `frontend/src/api`                       |
| Timesheet views       | `frontend/src/components/timesheet`      |
| Project components    | `frontend/src/components/project`        |
| Inquiry components    | `frontend/src/components/inquiry`        |
| Ticket components     | `frontend/src/components/ticket`         |
| Department components | `frontend/src/components/department`     |

Vite proxy configuration exists for:

```text
/api     -> http://localhost:5000
/uploads -> http://localhost:5000
```

---

# 2. Module Inventory

## Active backend modules

| Module           | Backend files                                                                                                                                | Purpose                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Authentication   | `authRoutes.js`, `authController.js`, `authMiddleware.js`, `User.js`                                                                         | Login, profile, avatar, password change, JWT auth                  |
| Users            | `userRoutes.js`, `userController.js`, `User.js`                                                                                              | Admin user management, assignable users                            |
| Teams            | `teamRoutes.js`, `teamController.js`, `Team.js`                                                                                              | HOD/team lead/team member hierarchy                                |
| Departments      | `departmentRoutes.js`, `departmentController.js`, `Department.js`, `departmentSeedService.js`                                                | Department Master                                                  |
| Customers        | `customerRoutes.js`, `customerController.js`, `Customer.js`                                                                                  | Customer master                                                    |
| Inquiries        | `inquiryRoutes.js`, `inquiryController.js`, `Inquiry.js`                                                                                     | Inquiry creation, editing, attachments, follow-ups                 |
| Projects         | `projectRoutes.js`, `projectController.js`, `Project.js`, `ProjectActivityLog.js`                                                            | Project management, planning grids, project logs                   |
| Kickoff Workflow | `kickoffWorkflowRoutes.js`, `kickoffWorkflowController.js`, `KickoffWorkflow.js`, `kickoffWorkflowService.js`, `kickoffWorkflowScheduler.js` | Order Received → kickoff → project creation                        |
| Notifications    | `notificationRoutes.js`, `notificationController.js`, `Notification.js`, `notificationService.js`                                            | Dashboard/internal notifications and email side effects            |
| WhatsApp         | `whatsappService.js`, `testWhatsappRoute.js`                                                                                                 | WhatsApp outbound and inbound project task commands                |
| Timesheet        | `timesheetRoutes.js`, `timesheetController.js`, `TimesheetTask.js`, `projectTimesheetSyncService.js`                                         | User tasks, project-linked tasks, Kanban/list/calendar/admin views |
| Tickets          | `ticketRoutes.js`, `ticketController.js`, `Ticket.js`, `TicketActivity.js`, `TicketComment.js`                                               | Support/repair ticket workflow                                     |
| Dashboard        | `dashboardRoutes.js`, `dashboardController.js`                                                                                               | Stats, charts, recent activity                                     |

## Active frontend modules

| Module            | Frontend files                                                                         |
| ----------------- | -------------------------------------------------------------------------------------- |
| Login             | `LoginPage.jsx`                                                                        |
| Dashboard         | `DashboardPage.jsx`                                                                    |
| Inquiries         | `InquiriesPage.jsx`, `ElectricalPanelInquiryPage.jsx`, inquiry components              |
| Projects          | `ProjectsPage.jsx`, `ProjectDetailPage.jsx`, project components                        |
| Customers         | `CustomersPage.jsx`, `CustomerDetailPage.jsx`, `CustomerForm.jsx`                      |
| Tickets           | `TicketsPage.jsx`, `TicketFormPage.jsx`, `TicketForm.jsx`                              |
| Notifications     | `NotificationsPage.jsx`                                                                |
| Users             | `UsersPage.jsx`                                                                        |
| Department Master | `DepartmentPage.jsx`, `DepartmentForm.jsx`, `departmentService.js`                     |
| Timesheet         | `TimesheetPage.jsx`, `TimesheetAdminPage.jsx`, timesheet components                    |
| Layout/Auth       | `MainLayout.jsx`, `Sidebar.jsx`, `Topbar.jsx`, `ProtectedRoute.jsx`, `AuthContext.jsx` |

---

# 3. Database Model Analysis

## `User`

File:

`backend/models/User.js`

Roles defined in model:

```text
admin
hod
team_lead
employee
manager
```

Important fields:

* `name`
* `email`
* `password`
* `phone`
* `avatar`
* `role`
* `department`
* `hodDepartments`
* `teamId`
* `reportsTo`
* `isActive`

Notes:

* `department` and `hodDepartments` are `Mixed`, allowing both old string values and new Department ObjectIds.
* Password hashing uses bcrypt before save.
* `ROLE_ORDER` is:

```text
admin > hod > manager > team_lead > employee
```

## `Department`

File:

`backend/models/Department.js`

Purpose:

Central Department Master.

Important fields:

* `name`
* `code`
* `hod`
* `isActive`
* `createdBy`

Seed service inserts these default departments:

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

The API supports adding departments from UI.

## `Team`

File:

`backend/models/Team.js`

Purpose:

Hierarchy and scope control.

Important fields:

* `name`
* `description`
* `hod`
* `teamLead`
* `members`
* `isActive`
* `createdBy`
* `updatedBy`

Used heavily by timesheet and assignable-user scoping.

## `Customer`

File:

`backend/models/Customer.js`

Important fields:

* `customerId`
* `customerName`
* `companyName`
* `contactPerson`
* `email`
* `mobileNumber`
* `city`
* `address`
* `gstNumber`
* `totalProjects`
* `isActive`
* `createdBy`

Customer IDs are generated using the shared `Counter` model.

## `Inquiry`

File:

`backend/models/Inquiry.js`

Purpose:

Large inquiry model for electrical panel / automation inquiry capture.

Important sections:

* Customer/company/contact details
* Site/location details
* Project/application details
* Inquiry type
* Panel/product details
* PLC details
* VFD details
* MCC details
* Component requirement rows
* Load rows
* Attachments
* Follow-up fields
* Kickoff meeting embedded state
* Project conversion linkage

Live inquiry status enum:

```text
New
In Progress
Commercial Discussion
Commercial Submit
Technical Submit
Order Received
Inquiry Hold
Inquiry Lost
```

Important fields:

* `inquiryId`
* `inquiryDate`
* `customerName`
* `companyName`
* `contacts`
* `projectName`
* `inquiryType`
* `productType`
* `status`
* `priority`
* `nextFollowUpDate`
* `attachments`
* `convertedToProject`
* `projectReference`
* `kickoffMeeting`

Observed ID-generation behavior:

* Uses `Counter` with id `inquiryId`.
* Counter default starts at `1349`.
* Pre-save increments counter and assigns:

```text
INQ-${counter.seq + 1349}
```

This means the numeric sequence has an additional offset.

## `Project`

File:

`backend/models/Project.js`

Purpose:

Project master with planning grids and planning tasks.

Important fields:

* `projectId`
* `inquiryReference`
* `customerName`
* `companyName`
* `projectName`
* `projectType`
* `panelType`
* `quantity`
* `orderValue`
* `orderDate`
* `expectedDeliveryDate`
* `projectEndDate`
* `projectStatus`
* `completionPercentage`
* `assignedTeamMembers`
* `assignedTo`
* `planningTasks`
* `planningGrids`
* `kickoffMeeting`
* `sourceInquirySnapshot`
* `customerRef`

Project ID generation:

* Internal `NaplCounter`
* Generates IDs like:

```text
NAPL-0200
NAPL-0201
```

Planning exists in two forms:

1. Legacy flat `planningTasks`
2. New grouped `planningGrids`

The timesheet sync service prefers `planningGrids` first, then falls back to flat `planningTasks`.

## `TimesheetTask`

File:

`backend/models/TimesheetTask.js`

Purpose:

User-created and project-synced timesheet tasks.

Statuses:

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

Important fields:

* `employee`
* `title`
* `description`
* `employeeRemarks`
* `project`
* `taskType`
* `taskSource`
* `sourceProject`
* `sourceProjectId`
* `sourceGridId`
* `sourceGridName`
* `sourceTaskId`
* `sourceTaskKey`
* `sourceTaskName`
* `sourceDepartment`
* `sourcePlannedStartDate`
* `sourcePlannedEndDate`
* `syncStatus`
* `isArchived`
* `archiveReason`
* `date`
* `startTime`
* `endTime`
* `hours`
* `status`
* `kanbanOrder`

Important index:

Unique partial index for project-linked tasks:

```text
taskSource + sourceProject + sourceTaskKey
```

This prevents duplicate synced tasks for the same project planning task.

## `Ticket`

File:

`backend/models/Ticket.js`

Purpose:

Support / repair / replacement ticket workflow.

Statuses:

```text
New
Assigned
Working
Customer Side Pending
Closed
Void
```

Ticket types:

```text
N/A
Support
Repairing & Replacement
```

Departments hardcoded in ticket model:

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

* `ticketId`
* `title`
* `description`
* `ticketType`
* `status`
* `priority`
* `source`
* `supportType`
* `department`
* `customer`
* `project`
* `inquiry`
* `assignedTo`
* `assignedBy`
* `assignedAt`
* `product`
* `repairReplacement`
* `resolution`
* `attachments`
* `createdBy`
* `updatedBy`

Ticket ID uses `Counter` with id `ticketId`.

## `Notification`

File:

`backend/models/Notification.js`

Purpose:

Internal dashboard notifications.

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

Important fields:

* `title`
* `message`
* `type`
* `priority`
* `isRead`
* `recipient`
* `relatedInquiry`
* `relatedProject`

## `KickoffWorkflow`

File:

`backend/models/KickoffWorkflow.js`

Purpose:

Controls scheduled kickoff meeting before project creation.

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

* `inquiry`
* `projectReference`
* `scheduledAt`
* `date`
* `time`
* `agenda`
* `meetingLink`
* `attendees`
* `status`
* `notificationStatus`
* `notificationLogs`
* `attempts`
* `completedAt`
* `projectCreatedAt`
* `lastError`

## `ProjectActivityLog`

File:

`backend/models/ProjectActivityLog.js`

Purpose:

Project timeline/history.

Tracks project actions such as:

* created
* updated
* deleted
* status changed
* assignee changed
* task added
* task updated
* task assigned
* task completed
* WhatsApp sent/failed

## Ticket activity/comment models

Files:

```text
backend/models/TicketActivity.js
backend/models/TicketComment.js
```

Purpose:

Ticket timeline and ticket discussion/comments.

---

# 4. API Route Analysis

## Auth routes

Prefix:

`/api/auth`

| Method | Path               | Protection    | Purpose            |
| ------ | ------------------ | ------------- | ------------------ |
| POST   | `/login`           | Public        | Login              |
| GET    | `/me`              | Auth          | Current user       |
| PUT    | `/profile`         | Auth          | Update own profile |
| POST   | `/profile/avatar`  | Auth + upload | Upload own avatar  |
| PUT    | `/change-password` | Auth          | Change password    |

## User routes

Prefix:

`/api/users`

| Method | Path          | Protection             | Purpose                                            |
| ------ | ------------- | ---------------------- | -------------------------------------------------- |
| GET    | `/assignable` | Auth + hierarchy scope | Returns users assignable within current user scope |
| GET    | `/`           | Admin                  | List users                                         |
| POST   | `/`           | Admin                  | Create user                                        |
| GET    | `/:id`        | Admin                  | Get user                                           |
| PUT    | `/:id`        | Admin                  | Update user                                        |
| DELETE | `/:id`        | Admin                  | Delete/deactivate user                             |
| POST   | `/:id/avatar` | Admin + upload         | Upload user avatar                                 |

Important routing detail:

`/assignable` is intentionally declared before `router.use(authorize('admin'))`.

## Department routes

Prefix:

`/api/departments`

| Method | Path                     | Protection        | Purpose                                     |
| ------ | ------------------------ | ----------------- | ------------------------------------------- |
| GET    | `/`                      | Auth              | List active departments                     |
| GET    | `/?includeInactive=true` | Admin only effect | Include inactive departments only for admin |
| POST   | `/`                      | Admin             | Create department                           |
| GET    | `/:id`                   | Auth              | Get department                              |
| PUT    | `/:id`                   | Admin             | Update department                           |
| DELETE | `/:id`                   | Admin             | Soft-delete department                      |

The uploaded backend does include `/api/departments`.

## Customer routes

Prefix:

`/api/customers`

| Method | Path   | Protection | Purpose         |
| ------ | ------ | ---------- | --------------- |
| GET    | `/`    | Auth       | List customers  |
| POST   | `/`    | Auth       | Create customer |
| GET    | `/:id` | Auth       | Get customer    |
| PUT    | `/:id` | Auth       | Update customer |
| DELETE | `/:id` | Admin      | Delete customer |

## Inquiry routes

Prefix:

`/api/inquiries`

| Method | Path          | Protection              | Purpose             |
| ------ | ------------- | ----------------------- | ------------------- |
| GET    | `/follow-ups` | Auth                    | Follow-up inquiries |
| GET    | `/`           | Auth                    | Inquiry list        |
| POST   | `/`           | Auth + multipart upload | Create inquiry      |
| GET    | `/:id`        | Auth                    | Get inquiry         |
| PUT    | `/:id`        | Auth + multipart upload | Update inquiry      |
| DELETE | `/:id`        | Admin                   | Delete inquiry      |

## Project routes

Prefix:

`/api/projects`

| Method | Path                           | Protection | Purpose                        |
| ------ | ------------------------------ | ---------- | ------------------------------ |
| POST   | `/convert/:inquiryId`          | Auth       | Schedule kickoff from inquiry  |
| POST   | `/recalc-delays`               | Auth       | Recalculate all project delays |
| GET    | `/planning-templates`          | Auth       | Return planning templates      |
| GET    | `/`                            | Auth       | List projects                  |
| POST   | `/`                            | Auth       | Create project                 |
| POST   | `/:id/copy`                    | Auth       | Copy project                   |
| GET    | `/:id`                         | Auth       | Get project                    |
| PUT    | `/:id`                         | Auth       | Update project                 |
| DELETE | `/:id`                         | Admin      | Delete project                 |
| GET    | `/:id/activity`                | Auth       | Project activity timeline      |
| GET    | `/:id/task-completion-history` | Auth       | Task completion history        |

## Kickoff workflow routes

Prefix:

`/api/kickoff-workflows`

| Method | Path                   | Protection | Purpose                                |
| ------ | ---------------------- | ---------- | -------------------------------------- |
| POST   | `/:inquiryId/schedule` | Auth       | Schedule kickoff                       |
| POST   | `/:inquiryId/complete` | Auth       | Complete kickoff and create project    |
| GET    | `/:inquiryId`          | Auth       | Get workflow for inquiry               |
| POST   | `/process/due`         | Admin      | Manually process due kickoff workflows |

## Notification routes

Prefix:

`/api/notifications`

| Method | Path        | Protection | Purpose                         |
| ------ | ----------- | ---------- | ------------------------------- |
| GET    | `/`         | Auth       | List current user notifications |
| PUT    | `/read-all` | Auth       | Mark all read                   |
| PUT    | `/:id/read` | Auth       | Mark one read                   |
| DELETE | `/:id`      | Auth       | Delete notification             |

## Dashboard routes

Prefix:

`/api/dashboard`

| Method | Path      | Protection | Purpose                             |
| ------ | --------- | ---------- | ----------------------------------- |
| GET    | `/stats`  | Auth       | Counts, charts, dashboard summaries |
| GET    | `/recent` | Auth       | Recent inquiries/projects/tickets   |

## Timesheet routes

Prefix:

`/api/timesheet`

All routes use:

```text
protect
attachTeamContext
scopeToHierarchy where applicable
```

| Method | Path                     | Purpose                          |
| ------ | ------------------------ | -------------------------------- |
| GET    | `/list`                  | Paginated list view              |
| GET    | `/kanban`                | Kanban view                      |
| GET    | `/calendar`              | Calendar view                    |
| GET    | `/tasks`                 | Scoped tasks                     |
| POST   | `/tasks`                 | Create task                      |
| GET    | `/tasks/:id`             | Get task                         |
| PUT    | `/tasks/:id`             | Update task                      |
| DELETE | `/tasks/:id`             | Delete task                      |
| PATCH  | `/tasks/:id/status`      | Update status                    |
| PATCH  | `/tasks/:id/kanban`      | Update Kanban position           |
| PATCH  | `/tasks/:id/archive`     | Archive task                     |
| PATCH  | `/tasks/:id/restore`     | Restore archived task            |
| DELETE | `/tasks/:id/archived`    | Permanently delete archived task |
| GET    | `/admin/all`             | Elevated scoped admin list       |
| GET    | `/admin/summary`         | Elevated scoped summary          |
| GET    | `/admin/workload`        | Elevated scoped workload         |
| GET    | `/admin/daily-breakdown` | Elevated scoped daily breakdown  |

Elevated timesheet admin APIs allow:

```text
admin
hod
team_lead
```

with scope restrictions.

## Team routes

Prefix:

`/api/teams`

| Method | Path                   | Protection          | Purpose                  |
| ------ | ---------------------- | ------------------- | ------------------------ |
| GET    | `/`                    | Auth                | List teams based on role |
| POST   | `/`                    | Admin               | Create team              |
| GET    | `/:id`                 | Auth                | Get team                 |
| PUT    | `/:id`                 | Admin               | Update team              |
| DELETE | `/:id`                 | Admin               | Soft-delete team         |
| PATCH  | `/:id/hod`             | Admin               | Assign HOD               |
| PATCH  | `/:id/team-lead`       | Admin/HOD           | Assign team lead         |
| GET    | `/:id/members`         | Auth                | Get team members         |
| POST   | `/:id/members`         | Admin/HOD/team lead | Add member               |
| DELETE | `/:id/members/:userId` | Admin/HOD/team lead | Remove member            |

## Ticket routes

Prefix:

`/api/tickets`

| Method | Path                             | Purpose                       |
| ------ | -------------------------------- | ----------------------------- |
| GET    | `/`                              | List tickets                  |
| POST   | `/`                              | Create ticket                 |
| GET    | `/:id`                           | Get ticket                    |
| PUT    | `/:id`                           | Update ticket                 |
| PATCH  | `/:id/assign`                    | Assign ticket                 |
| PATCH  | `/:id/start-work`                | Move to Working               |
| PATCH  | `/:id/customer-pending`          | Move to Customer Side Pending |
| PATCH  | `/:id/close`                     | Close ticket                  |
| PATCH  | `/:id/reopen`                    | Reopen ticket                 |
| PATCH  | `/:id/void`                      | Void ticket                   |
| GET    | `/:id/comments`                  | Get comments                  |
| POST   | `/:id/comments`                  | Add comment                   |
| PUT    | `/comments/:commentId`           | Update comment                |
| DELETE | `/comments/:commentId`           | Delete comment                |
| POST   | `/:id/attachments`               | Upload attachments            |
| DELETE | `/:id/attachments/:attachmentId` | Delete attachment             |
| GET    | `/:id/activity`                  | Ticket activity timeline      |

## WhatsApp diagnostic route

Prefix:

`/api/test-whatsapp`

| Method | Path | Protection | Purpose                     |
| ------ | ---- | ---------- | --------------------------- |
| GET    | `/`  | No auth    | Sends WhatsApp test message |

The code comment marks this as temporary diagnostic.

---

# 5. Frontend Page Analysis

## Active routes in `frontend/src/App.jsx`

| Frontend route         | Component                                   |
| ---------------------- | ------------------------------------------- |
| `/auth/login`          | `LoginPage`                                 |
| `/`                    | `DashboardPage`                             |
| `/inquiries`           | `InquiriesPage`                             |
| `/inquiries/new`       | `ElectricalPanelInquiryPage`                |
| `/inquiries/:id`       | `ElectricalPanelInquiryPage`                |
| `/inquiries/:id/edit`  | `ElectricalPanelInquiryPage`                |
| `/projects`            | `ProjectsPage`                              |
| `/projects/:id`        | `ProjectDetailPage`                         |
| `/projects/:id/edit`   | `ProjectDetailPage`                         |
| `/customers`           | `CustomersPage`                             |
| `/customers/:id`       | `CustomerDetailPage`                        |
| `/tickets`             | `TicketsPage`                               |
| `/tickets/new`         | `TicketFormPage`                            |
| `/tickets/:id`         | `TicketFormPage`                            |
| `/tickets/:id/edit`    | `TicketFormPage`                            |
| `/notifications`       | `NotificationsPage`                         |
| `/timesheet`           | `TimesheetPage`                             |
| `/timesheet/list`      | `TimesheetListView`                         |
| `/timesheet/kanban`    | `TimesheetKanbanView`                       |
| `/timesheet/calendar`  | `TimesheetCalendarView`                     |
| `/timesheet/admin`     | `TimesheetAdminPage`                        |
| `/users`               | `UsersPage`, admin-only frontend guard      |
| `/masters/departments` | `DepartmentPage`, admin-only frontend guard |
| `/404`                 | `NotFoundPage`                              |

## Sidebar navigation

Main navigation visible to authenticated users:

```text
Dashboard
Inquiries
Projects
Customers
Tickets
Timesheet
```

Admin-only sidebar items:

```text
Department Master
User Management
Timesheet Admin
```

## Frontend API layer

API base:

`frontend/src/api/axios.js`

Behavior:

* Base URL: `/api`
* Adds Bearer token from `localStorage`
* Removes manual `Content-Type` for `FormData`
* Redirects to `/auth/login` on `401`

Dedicated API service files:

```text
departmentService.js
projectService.js
ticketService.js
timesheetService.js
```

Several pages also call `API` directly instead of using a dedicated service.

---

# 6. Authentication & Permissions Analysis

## JWT authentication

Backend middleware:

`backend/middleware/authMiddleware.js`

`protect` behavior:

1. Reads token from `Authorization: Bearer <token>`.
2. Also checks `req.cookies?.token`.
3. Verifies JWT using `JWT_SECRET`.
4. Fetches active user from database.
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

## Backend role checks

### `authorize(...roles)`

Used for simple role allowlist.

Important behavior:

* `manager` user is treated as `hod`.
* Requested role `manager` expands to `hod` and `team_lead`.

Observed issue:

When access is denied, `createError()` is called without a status code, so error middleware returns status `500` instead of intended `403`.

### `authorizeHierarchy(minimumRole)`

Used in timesheet admin routes.

Allows users at or above the minimum role according to:

```text
admin > hod > manager > team_lead > employee
```

Observed issue:

Access denial also calls `createError()` without status code, which can return `500` instead of `403`.

## Permission middleware

File:

`backend/middleware/permissionMiddleware.js`

Main responsibilities:

* `requireRoles`
* `attachTeamContext`
* `scopeToHierarchy`
* `canEditTask`
* `canReadTask`
* archive/restore/delete archived task permissions
* project-linked timesheet task structure permission

### Team scope behavior

| Role      | Scope behavior                         |
| --------- | -------------------------------------- |
| Admin     | All users                              |
| HOD       | Users in teams where user is HOD       |
| Team Lead | Own team                               |
| Employee  | Own team if found, otherwise self only |

## Frontend auth behavior

File:

`frontend/src/context/AuthContext.jsx`

Stores in localStorage:

```text
token
user
```

Frontend role helpers include:

```text
isAdmin
isHod
isTeamLead
isEmployee
isTechnicalCommunication
isEngineer
isManager
```

Observed mismatch:

Frontend and ticket module reference roles:

```text
engineer
technical_communication
```

But backend `User` model enum does not include these roles.

---

# 7. Notification & WhatsApp Flow Analysis

## Internal notification flow

Service:

`backend/services/notificationService.js`

Purpose:

Creates `Notification` records and may also send Outlook email.

Used by:

* inquiry creation/update
* project events
* kickoff workflow
* status events

Notification creation is wrapped so failures do not block the primary business operation.

## Outlook/email flow

Service:

`backend/services/outlookService.js`

Purpose:

Sends email through SMTP using Outlook credentials.

Environment-dependent fields include:

```text
OUTLOOK_EMAIL
OUTLOOK_PASSWORD
OUTLOOK_FROM
OUTLOOK_TO
```

For inquiry creation, attachments can be included from inquiry upload paths.

## WhatsApp outbound flow

Service:

`backend/services/whatsappService.js`

Startup:

* `server.js` calls `initWhatsApp()`.
* Uses `whatsapp-web.js`.
* Uses LocalAuth session id:

```text
nexus-session
```

Main outbound helpers:

| Function                           | Purpose                                |
| ---------------------------------- | -------------------------------------- |
| `sendWhatsAppNotification`         | Sends to one number                    |
| `sendWhatsAppGroupNotification`    | Sends to configured group              |
| `sendWhatsAppGroupWithAttachments` | Sends message and attachments to group |
| `sendTestMessage`                  | Diagnostic message                     |

WhatsApp returns result objects shaped like:

```text
{ ok, status, recipient, error }
```

## WhatsApp inquiry flow

On inquiry creation:

1. Inquiry is saved.
2. Internal notification is created.
3. Outlook email may be sent.
4. Customer is auto-created or updated.
5. WhatsApp message is sent to configured notify number.
6. WhatsApp group message is sent.
7. Inquiry attachments may be sent to group.

On inquiry update:

* Internal notification is created.
* Status notification may be created.
* WhatsApp group sending is not part of the normal update flow.

## Kickoff notification flow

When kickoff is scheduled:

1. Workflow is created/updated.
2. Inquiry status is set to `Order Received`.
3. Inquiry kickoff meeting state is set to `Scheduled`.
4. WhatsApp group notification is attempted.
5. WhatsApp notify number notification is attempted.
6. Customer WhatsApp notification is attempted if contact is available.
7. Attendee WhatsApp notifications are attempted.
8. Outlook emails are attempted for customer and attendees.
9. Internal notification is created.

Observed result-shape mismatch:

`kickoffWorkflowService.normaliseNotificationResult()` checks fields like:

```text
success
queued
skipped
```

But `whatsappService` returns:

```text
ok
status
```

So kickoff notification logs can mark WhatsApp attempts as failed even when WhatsApp service returns a successful `{ ok: true }` result.

## WhatsApp inbound project task command flow

The WhatsApp service can parse project task update commands.

Accepted command formats include:

```text
NEXUS | NAPL-0209 | GA Approval | Completed | Sent to client
PROJECT | NAPL-0209 | GA Approval | Completed | Sent to client
```

Also supports multiline format:

```text
PROJECT: NAPL-0209
TASK: GA Approval
STATUS: Completed
REMARK: Sent to client
```

Inbound logic:

1. Ignores non-command messages.
2. De-duplicates message IDs.
3. Validates allowed group if configured.
4. Resolves sender phone to active User.
5. Parses project/task/status/remark.
6. Updates matching project planning task.
7. Logs activity.
8. Sends WhatsApp reply.

---

# 8. Project → Timesheet Sync Flow Analysis

Service:

`backend/services/projectTimesheetSyncService.js`

Controller integration:

`backend/controllers/projectController.js`

Integration points found:

| Project action | Sync action                              |
| -------------- | ---------------------------------------- |
| Create project | Runs project-timesheet sync              |
| Copy project   | Runs project-timesheet sync              |
| Update project | Runs project-timesheet sync              |
| Delete project | Archives related project timesheet tasks |

Wrapper functions:

```text
runProjectTimesheetSyncSafe()
archiveProjectTimesheetTasksSafe()
```

These catch errors so project creation/update/delete does not fail because of sync failure.

## Source task extraction

The sync service extracts tasks from:

1. `planningGrids`
2. fallback to flat `planningTasks`

For each project planning task, the service builds source metadata including:

* project id
* grid id
* grid name
* task id
* task name
* department
* planned start date
* planned end date
* assigned user
* task status

## Assignment conversion

The service accepts different assigned-user shapes and converts them into ObjectId where possible.

It checks assigned user values from task fields such as:

* `assignedTo`
* nested object `_id`
* nested object `id`

If no valid assignment exists, the task is skipped or an existing linked timesheet task is archived.

## Source key generation

Each project task receives a deterministic `sourceTaskKey`.

Pattern conceptually:

```text
PROJECT:<project>:GRID:<grid>:TASK:<task>
```

This key is used with the unique partial index in `TimesheetTask` to prevent duplicate synced records.

## Create/update behavior

When a planning task is assigned:

* A `TimesheetTask` is created if no matching source key exists.
* Existing matching `TimesheetTask` is updated if task data changes.
* The task is linked back to project/source metadata.

Mapped task source:

```text
taskSource = PROJECT
```

Mapped sync status:

```text
SYNCED
PENDING
FAILED
```

## Archive behavior

Timesheet tasks are archived when:

| Trigger                                  | Archive reason            |
| ---------------------------------------- | ------------------------- |
| Project planning task removed            | `PROJECT_TASK_REMOVED`    |
| Project planning task becomes unassigned | `PROJECT_TASK_UNASSIGNED` |
| Project deleted                          | `PROJECT_DELETED`         |

## Project task status mapping

Project planning statuses map into timesheet statuses approximately as:

| Project task status | Timesheet status |
| ------------------- | ---------------- |
| Not Started         | Planned          |
| In Progress         | In Progress      |
| Completed           | Completed        |
| Delayed             | In Progress      |

## Project-linked task protection

Timesheet controller/middleware differentiates between:

* user-created tasks
* project-linked tasks

For project-linked tasks:

* employee can update work/status-oriented fields
* structural task fields are restricted
* archive/restore/delete archived are limited to admin/HOD scope

---

# 9. Inquiry Workflow Analysis

## Inquiry creation flow

Frontend:

`ElectricalPanelInquiryPage.jsx`

Backend:

`inquiryController.createInquiry`

Flow:

1. User fills electrical panel inquiry form.
2. Form submits multipart request with JSON body and attachments.
3. Backend parses JSON from multipart payload.
4. Backend validates allowed fields.
5. Inquiry is created.
6. Inquiry number is generated.
7. Attachments are saved under backend uploads.
8. Internal notification is created.
9. Outlook email may be sent.
10. Customer is auto-created/updated.
11. WhatsApp notification is sent.
12. WhatsApp group message with attachments may be sent.
13. Response returns created inquiry.

## Inquiry update flow

1. Frontend loads inquiry by id.
2. Form submits updated JSON and optional new attachments.
3. Backend keeps selected old attachments and adds new ones.
4. Inquiry fields are updated using allowlisted payload.
5. Internal notification is created.
6. Response returns updated inquiry.

## Follow-up flow

Endpoint:

`GET /api/inquiries/follow-ups`

Backend filters by:

* `nextFollowUpDate <= today`
* status not in excluded statuses

Observed issue:

The exclusion list uses old/misspelled status values:

```text
Order Recieved
Inq. Lost
```

But live model enum uses:

```text
Order Received
Inquiry Lost
```

Therefore follow-up exclusion can behave incorrectly.

## Order Received → Kickoff flow

Frontend:

`InquiriesPage.jsx`

Backend:

`kickoffWorkflowService.scheduleKickoffForInquiry`

Flow:

1. Inquiry status is changed to `Order Received`.
2. Frontend opens kickoff scheduling modal.
3. Frontend calls kickoff workflow schedule API.
4. Backend validates inquiry.
5. Backend validates scheduled date/time and attendees.
6. Backend creates/updates `KickoffWorkflow`.
7. Inquiry status remains/updates to `Order Received`.
8. Inquiry kickoff meeting state becomes `Scheduled`.
9. Notifications are sent/logged.

## Due kickoff flow

Scheduler:

`kickoffWorkflowScheduler.js`

Service:

`processDueKickoffWorkflows`

Flow:

1. Scheduler finds scheduled kickoff workflows where scheduled time has passed.
2. Workflow status changes to `Ready For Completion`.
3. Inquiry kickoff state changes to ready/completion state.
4. Project is not automatically created at due time.

## Complete kickoff → Project creation flow

Endpoint:

`POST /api/kickoff-workflows/:inquiryId/complete`

Flow:

1. User marks kickoff meeting done.
2. Backend validates scheduled time has passed.
3. Workflow status becomes `Completed`.
4. Inquiry kickoff meeting status becomes `Completed`.
5. Backend creates Project from Inquiry/Workflow.
6. Project gets inquiry snapshot.
7. Project receives assigned team members from attendees.
8. Inquiry is marked converted.
9. Customer total project count is incremented.
10. Project activity log is created.
11. Project-created notifications are sent.

Important:

Project creation from kickoff does not directly run `projectTimesheetSyncService`. The created project normally has no planning grids/tasks at that moment, so no project-linked timesheet tasks are produced until planning tasks exist and project update sync runs.

---

# 10. Identified Undocumented / Unused / Duplicate Modules

## Backend

| File / Area                                            | Observation                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `backend/server_old.js`                                | Old server backup exists in repo                                         |
| `backend/controllers/userController_old.js`            | Old user controller backup                                               |
| `backend/models/User_old.js`                           | Old user model backup                                                    |
| `backend/services/documentExtractionService.js`        | Empty or placeholder service                                             |
| `backend/services/projectTimesheetBackfillService.js`  | Backfill service exists but no active API route/server integration found |
| `backend/routes/testWhatsappRoute.js`                  | Temporary unauthenticated diagnostic route mounted in runtime            |
| `backend/utils/createNotification.js`                  | Utility exists separate from service-based notification flow             |
| `backend/utils/departmentUtils_old.js`                 | Old department utility backup                                            |
| `backend/scripts/migrations/001_add_team_hierarchy.js` | Migration script present outside runtime                                 |
| `backend/seed/seedData.js`, `seedTask.js`              | Seed scripts present outside normal server runtime                       |
| `backend/.wwebjs_auth`                                 | WhatsApp session artifacts included in codebase upload                   |

## Frontend

| File / Area                                                   | Observation                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `frontend/src/App_old.jsx`                                    | Old app backup                                                                 |
| `frontend/src/components/common/Sidebar_old.jsx`              | Old sidebar backup                                                             |
| `frontend/src/pages/ProjectDetailPage_old.jsx`                | Old project detail page                                                        |
| `frontend/src/pages/UsersPage_old.jsx`                        | Old users page                                                                 |
| `frontend/src/components/project/ProjectPlanningGrid_old.jsx` | Old planning grid                                                              |
| `frontend/src/components/timesheet/TimesheetForm_old.jsx`     | Old timesheet form                                                             |
| `frontend/src/utils/departmentUtils_old.js`                   | Old department utility                                                         |
| `frontend/src/components/common/MainLayout.jsx`               | Duplicate layout component; runtime uses `frontend/src/layouts/MainLayout.jsx` |
| `frontend/src/pages/TicketViewPage.jsx`                       | Exists but `/tickets/:id` route uses `TicketFormPage` instead                  |
| `frontend/src/pages/TimesheetCalendarPage.jsx`                | Exists but app uses `TimesheetCalendarView` inside `TimesheetPage`             |

---

# 11. Identified Broken Flows

## 11.1 Department route exists in uploaded code, but earlier 404 would indicate runtime mismatch

The uploaded `backend/server.js` mounts:

```text
/api/departments
```

and `backend/routes/departmentRoutes.js` exists.

Therefore, a runtime `GET /api/departments?includeInactive=true 404` is not consistent with this uploaded backend running correctly. Possible observed causes from code state only:

* old server instance running
* backend not restarted
* wrong deployment folder
* proxy pointing to different backend
* `server_old.js` or older build being executed instead of current `server.js`

## 11.2 Inquiry status spelling mismatch

Live model enum:

```text
Order Received
Inquiry Lost
```

But several backend/frontend references still use:

```text
Order Recieved
Inq. Lost
```

Observed locations include:

* `dashboardController.js`
* `inquiryController.js`
* `ElectricalPanelInquiryPage.jsx`
* `StatusBadge.jsx`

Impact:

* dashboard won/lost counts may be wrong
* pending follow-up exclusion may be wrong
* inquiry filter for order-received inquiries may return wrong data
* frontend compatibility code is carrying both spellings

## 11.3 Dashboard uses non-model status value

`dashboardController.js` counts:

```text
Quotation Submit
```

But live Inquiry model enum uses:

```text
Commercial Submit
Technical Submit
```

Impact:

* quotation/commercial dashboard counts can be zero or inaccurate.

## 11.4 Ticket roles reference non-existent backend roles

Ticket backend and frontend reference:

```text
engineer
technical_communication
```

But `User` model enum allows only:

```text
admin
hod
team_lead
employee
manager
```

Impact:

* users cannot actually be saved with `engineer` or `technical_communication` role through the current model enum
* ticket permission logic partially depends on roles that do not exist in active user schema
* employees are treated as engineer-like, but technical communication role cannot exist unless old data bypasses enum or schema changed earlier

## 11.5 Ticket view route points to form page

Frontend route:

```text
/tickets/:id -> TicketFormPage
```

But a separate `TicketViewPage.jsx` exists.

Impact:

* “view ticket” navigation opens the form-style page, not the dedicated view page.

## 11.6 Timesheet Admin frontend visibility does not match backend permission model

Backend elevated timesheet APIs allow:

```text
admin
hod
team_lead
```

Frontend sidebar shows `Timesheet Admin` only to:

```text
admin
```

Impact:

* HOD/team lead users can be authorized by backend but do not see the navigation item.
* Direct URL access may still open the page, but employees may hit backend access denial.

## 11.7 `authorize()` / `authorizeHierarchy()` denial can return 500 instead of 403

In `authMiddleware.js`, denial calls `createError()` without passing status code.

Impact:

* unauthorized role access can appear as server error.
* affected routes include admin routes using `authorize()` and elevated routes using `authorizeHierarchy()`.

## 11.8 Kickoff WhatsApp notification logging mismatch

`kickoffWorkflowService.normaliseNotificationResult()` expects result fields like:

```text
success
queued
skipped
```

But `whatsappService` returns:

```text
ok
status
```

Impact:

* WhatsApp messages may actually send but kickoff workflow notification logs/status can record them as failed.

## 11.9 Project-timesheet backfill service is not wired to runtime

`projectTimesheetBackfillService.js` exists but is not mounted as a route or called from server startup.

Impact:

* existing projects/tasks are not automatically backfilled unless manually invoked elsewhere.

## 11.10 Frontend build validation blocked by missing Rollup optional dependency

Frontend build failed before source compilation due to missing package:

```text
@rollup/rollup-linux-x64-gnu
```

Impact:

* uploaded dependency state is incomplete.
* source compile status could not be fully validated from the uploaded `node_modules`.

## 11.11 Hardcoded departments still exist outside Department Master

Although Department Master exists, hardcoded department values remain in places including:

* `Ticket.js`
* `User.js` legacy `USER_DEPARTMENTS`
* department utility aliases
* frontend ticket and inquiry logic
* project planning/task department handling

Impact:

* Department Master is active, but not yet the single source of truth across the entire system.

## 11.12 `/api/test-whatsapp` is unauthenticated

The route is mounted in runtime and has no `protect` middleware.

Impact:

* any caller reaching the backend can trigger the WhatsApp test pipeline.

---

# 12. Architectural Risks Observed

## 12.1 Mixed legacy and new architecture

The codebase contains active new modules plus old backup files and commented legacy blocks inside live files.

Examples:

* `Inquiry.js` contains large commented old schema before live schema.
* `inquiryController.js` contains old commented controller sections.
* old frontend/backend backup files exist beside live files.

Risk:

* future changes can target old or unused files by mistake.

## 12.2 Department Master is partially integrated

Department Master API, model, seed, and UI exist.

But departments remain hardcoded in:

* Ticket model
* User legacy constants
* utility aliases
* frontend filters and permission helpers
* some project/task logic

Risk:

* adding a department through UI may not automatically make it available in every module.

## 12.3 Role model is inconsistent across modules

Core user model supports:

```text
admin
hod
team_lead
employee
manager
```

Ticket module and frontend helpers additionally reference:

```text
engineer
technical_communication
```

Risk:

* permission behavior differs by module.
* UI can expect roles that backend cannot persist.

## 12.4 Status strings are not centralized

Inquiry statuses are manually repeated in:

* model enum
* controllers
* dashboard
* frontend forms
* status badge
* filter queries

Risk:

* spelling mismatches directly affect business counts and workflow conditions.

## 12.5 Project planning exists in two formats

Project model supports:

* legacy flat `planningTasks`
* new grouped `planningGrids`

Sync service supports both.

Risk:

* different pages/controllers may update one structure while reports/sync/dashboard read another.
* dashboard delayed task aggregation currently unwinds `planningTasks`, not `planningGrids`.

## 12.6 Side effects are embedded in controllers/services

Business operations trigger many side effects:

* notification creation
* Outlook email
* WhatsApp messages
* customer auto-create
* project activity logs
* timesheet sync

Risk:

* partial success is possible.
* some side effects are safely caught, while others influence workflow state/logs.

## 12.7 WhatsApp session data is present inside uploaded codebase

The ZIP includes WhatsApp LocalAuth session artifacts under:

```text
backend/.wwebjs_auth
```

Risk:

* runtime/session state is mixed into source package.
* deployment portability and credential/session exposure risk exist.

## 12.8 Frontend route and backend authorization are not always aligned

Examples:

* Timesheet admin frontend hidden for HOD/team lead, but backend allows them.
* `/tickets/:id` route uses form page despite view page existing.
* frontend has role helpers for roles backend model does not allow.

Risk:

* users may see missing menus or wrong pages despite backend capability.

---

# 13. Current System Understanding Summary

This Nexus Dashboard codebase is now a multi-module MERN-style business system with these major flows:

1. **Inquiry Management**

   * Create/edit electrical panel inquiries.
   * Upload inquiry attachments.
   * Notify internally, by Outlook, and by WhatsApp.
   * Track follow-ups and inquiry statuses.

2. **Kickoff Workflow**

   * Order Received inquiries move into scheduled kickoff workflow.
   * Scheduler marks due kickoff meetings as ready.
   * User completion of kickoff creates a project.

3. **Project Management**

   * Projects can be created manually, copied, updated, or created from kickoff.
   * Projects include planning tasks and planning grids.
   * Project activity is logged.
   * WhatsApp can update project task statuses through inbound commands.

4. **Project → Timesheet Sync**

   * Assigned project planning tasks create/update project-linked timesheet tasks.
   * Removed/unassigned/deleted project tasks archive linked timesheet tasks.
   * Sync is integrated into project create/copy/update/delete controller paths.

5. **Timesheet**

   * Supports list, Kanban, calendar, and admin views.
   * Access is scoped by admin/HOD/team lead/employee hierarchy.
   * Project-linked tasks are protected differently from user-created tasks.

6. **Department Master**

   * Backend model, seed, routes, controller, frontend page, and API service exist.
   * Initial departments are seeded.
   * Admin can add/update/deactivate departments.
   * Full system-wide replacement of hardcoded departments is not complete.

7. **Ticket Module**

   * Supports ticket creation, assignment, work status, customer pending, close, reopen, void, comments, attachments, and activity timeline.
   * Ticket workflow has its own role assumptions that do not fully match the User model.

8. **Notifications**

   * Internal dashboard notifications exist.
   * Email/Outlook and WhatsApp are integrated as side effects.
   * WhatsApp outbound and inbound command handling are both present.

9. **Authentication and Permissions**

   * JWT-based auth is active.
   * Admin/HOD/team lead/employee hierarchy is partially implemented.
   * Team-based scoping is active mainly for timesheet and assignable users.

10. **Main broken areas**

* status spelling mismatches
* role mismatches
* partial Department Master integration
* kickoff WhatsApp result normalization mismatch
* frontend/backend permission visibility mismatch
* unauthenticated WhatsApp diagnostic route
* old/unused files mixed with active files
