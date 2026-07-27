# Nexus Dashboard — Updated Codebase Understanding Report

## 0. Source Inspected

This report is based on direct inspection of the uploaded ZIP:

```text
nexus-dashboard.zip
```

extracted and read file-by-file (routes, controllers, models, services, middleware, App.jsx, pages, components). The three prior Markdown understanding files were used only as a starting reference; every claim carried forward from them was re-checked against the actual extracted source, and several were corrected or removed where the code no longer matches.

No source code was modified, generated, or patched as part of this report.

---

## 0.1 What Changed Since the Last Markdown (Highlights)

| Area | Change |
|---|---|
| Old/backup files | Several backup files referenced in older Markdown are **no longer present**: `backend/server_old.js`, `backend/controllers/userController_old.js`, `backend/models/User_old.js`, `backend/utils/departmentUtils_old.js`, `frontend/src/components/common/Sidebar_old.jsx`. These appear to have been cleaned up. |
| Old/backup files | A new backup file now exists that older Markdown did not mention: `backend/package_old.json`. |
| Timesheet ↔ Project sync | A **new reverse-sync service** exists: `backend/services/timesheetProjectReverseSyncService.js`, wired into `timesheetController.js`. This pushes Timesheet task status changes (`In Progress`, `Completed`) back onto the linked Project planning task. This is in addition to the existing one-way Project → Timesheet sync. |
| Kickoff Workflow | `kickoffWorkflowRoutes.js` now attaches a `kickoffFinalBomUpload` multer middleware to the schedule route, allowing a final technical BoM document to be uploaded at kickoff-scheduling time. Not present in older Markdown. |
| Notifications | Verified precisely: `createNotification` (the `services/notificationService.js` version) is **only called from `inquiryController.js`**. Ticket, Timesheet, Project, Department, User, Customer, and Kickoff modules perform **zero** calls to it. The `workflow_error` notification type in the `Notification` model enum is **unused anywhere in the codebase**. |
| Notifications | `backend/utils/createNotification.js` is a second, structurally similar but separate implementation of the same function. It is never imported anywhere — confirmed dead/duplicate code. |
| Frontend layout components | `PageHeader.jsx` and `StickyActionBar.jsx` (in `components/common/`) are adopted in **detail/form pages only** (Ticket, Project, Customer, Inquiry forms). The five list pages — Inquiries, Projects, Customers, Tickets, and all Timesheet views — **do not yet use them**, so those list pages still carry their own page-specific header/toolbar markup. |
| Integration Settings frontend | No `frontend/src/api/integrationService.js` file exists. `IntegrationSettingsPage.jsx` calls the API directly through `api/axios.js`, the same pattern used by Inquiries/Customers. (Older Markdown incorrectly listed a dedicated `integrationService.js`.) |
| Inquiry status enum | The literal string `'Project Won'` is **not** present in the current `Inquiry.js` status enum, contradicting one older Markdown file. The enum content is otherwise unchanged (see §8.4). |

---

# 1. Project Structure

## 1.1 Root

```text
nexus-dashboard/
├── .vscode/
├── README.md
├── Nexus Dashboard Code Review — Issues.md
├── Nexus Dashboard — Latest Codebase Understanding.md
├── Nexus Dashboard — Project Understandin.md
├── backend/
└── frontend/
```

The three legacy Markdown files and the issues doc ship inside the ZIP itself; they are documentation only and not part of the runtime.

## 1.2 Backend structure

```text
backend/
├── config/
│   ├── db.js
│   └── projectPlanningTemplates.js
├── controllers/          (16 files, incl. 2 unused "_old" backups)
├── middleware/
│   ├── authMiddleware.js
│   ├── errorMiddleware.js
│   └── permissionMiddleware.js
├── models/                (15 files)
├── routes/                (14 files)
├── scripts/
│   ├── backfillCustomerRefs.js
│   ├── migrations/001_add_team_hierarchy.js
│   └── removeAlternateNumberFromCustomers.js
├── seed/
│   ├── seedData.js
│   └── seedTask.js
├── services/               (12 files)
├── uploads/                 (runtime artifact — see §17)
├── .wwebjs_auth/             (runtime artifact — see §17)
├── .wwebjs_cache/            (runtime artifact — see §17)
├── .env                       (runtime/secrets artifact — see §17)
├── node_modules/                (dependency artifact)
├── package.json
├── package_old.json          (unused backup — see §17)
└── server.js
```

## 1.3 Frontend structure

```text
frontend/
├── src/
│   ├── api/                (axios.js + 4 service files)
│   ├── assets/
│   ├── components/
│   │   ├── activity/
│   │   ├── common/          (PageHeader, StickyActionBar, Sidebar, Topbar, Table, Modal, etc.)
│   │   ├── customer/
│   │   ├── department/
│   │   ├── inquiry/          (forms/, tables/)
│   │   ├── project/
│   │   ├── ticket/
│   │   └── timesheet/
│   ├── context/               (AuthContext, ToastContext)
│   ├── data/                   (masterData, inquiryMasterData, projectPlanningTemplates)
│   ├── layouts/                  (MainLayout.jsx — the one actually routed)
│   ├── pages/                     (22 files, incl. 3 unrouted/unused pages)
│   ├── routes/                     (ProtectedRoute.jsx)
│   ├── utils/
│   └── App.jsx
├── dist/                            (build output artifact — see §17)
├── node_modules/                      (dependency artifact)
├── package.json
├── vite.config.js
├── tailwind.config.js
└── index.html
```

Key frontend dependencies confirmed in `package.json`: `react` 18, `react-router-dom` 6, `axios`, `recharts`, `dayjs`, `lucide-react`, `@dnd-kit/core` + `sortable` + `utilities`, `react-big-calendar`, `@fullcalendar/*` (daygrid/interaction/react/timegrid — present but not confirmed wired into any active page; `TimesheetCalendarView.jsx` is the active calendar and its import list should be checked before assuming FullCalendar is live), Tailwind 3, Vite 5.

---

# 2. Backend Runtime Boot Flow

Entry point: `backend/server.js`.

Startup sequence, in order, as written in the file:

1. `dotenv.config()` loads environment variables.
2. `connectDB()` connects to MongoDB; `.then()` chains `seedDefaultDepartments()` once connected.
3. `initWhatsApp()` boots the `whatsapp-web.js` singleton (QR code on first run, session persisted under `.wwebjs_auth/`). Failures are logged only and never block server start.
4. `initKickoffWorkflowScheduler()` starts the kickoff due-date scheduler.
5. Express app is created.
6. `cors()`, `express.json()`, `express.urlencoded({ extended: true })` are applied.
7. `morgan('dev')` logging is applied only when `NODE_ENV === 'development'`.
8. `/uploads` is served via `express.static(path.join(__dirname, 'uploads'), { index: false, maxAge: ... })`, registered **before** the API routes.
9. API routers are mounted (see §7 for full list).
10. `/api/health` responds with a simple status JSON.
11. `errorMiddleware` is mounted last.
12. `app.listen(PORT || 5000, ...)`.

Mounted API prefixes, exactly as they appear in `server.js`:

```text
/uploads                  (static file serving, not JSON API)
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

Notable detail in `server.js`: `ticketRoutes` is imported once at the top (`const ticketRoutes = require('./routes/ticketRoutes')`) but that imported binding is never mounted — a commented-out line (`// app.use('/api/tickets', ticketRoutes);`) sits directly above the line that actually mounts tickets via a **second**, separate `require('./routes/ticketRoutes')` call. Functionally harmless (both requires resolve to the same singleton router), but it is leftover clutter that could confuse a future edit.

---

# 3. Backend Module Inventory

| Module | Main backend files | Purpose |
|---|---|---|
| Authentication | `authRoutes.js`, `authController.js`, `authMiddleware.js`, `User.js` | Login, current user, profile update, avatar upload, password change, JWT issuing/verification |
| Users | `userRoutes.js`, `userController.js`, `User.js` | Admin user CRUD, avatar update, hierarchy-scoped "assignable users" endpoint |
| Departments | `departmentRoutes.js`, `departmentController.js`, `Department.js`, `departmentSeedService.js` | Department Master CRUD with multi-HOD (`hods[]`) and team lead support |
| Teams | `teamRoutes.js`, `teamController.js`, `Team.js` | HOD / team lead / employee hierarchy and membership management |
| Customers | `customerRoutes.js`, `customerController.js`, `Customer.js`, `customerUniversal.js` | Customer master CRUD and cross-module customer field normalization |
| Inquiries | `inquiryRoutes.js`, `inquiryController.js`, `Inquiry.js` | Electrical panel inquiry lifecycle, status workflow, attachments, follow-ups, the **only** module wired to `createNotification` |
| Projects | `projectRoutes.js`, `projectController.js`, `Project.js`, `ProjectActivityLog.js` | Project master, planning grids/tasks, documents, activity log, delay tracking, copy, timesheet sync trigger |
| Kickoff Workflow | `kickoffWorkflowRoutes.js`, `kickoffWorkflowController.js`, `KickoffWorkflow.js`, `kickoffWorkflowService.js`, `kickoffWorkflowScheduler.js` | Order-won kickoff scheduling → completion → project creation, WhatsApp/email side effects |
| Notifications | `notificationRoutes.js`, `notificationController.js`, `Notification.js`, `notificationService.js` | Internal dashboard notifications + optional email side effect; currently only invoked by the Inquiry module |
| Email Integration | `integrationRoutes.js`, `integrationController.js`, `IntegrationSettings.js`, `emailSettingsService.js` | Admin SMTP settings, verification, WhatsApp status/restart/logout controls |
| WhatsApp | `whatsappService.js`, `testWhatsappRoute.js` | WhatsApp session lifecycle, outbound messaging, inbound project-task command parsing, public test route |
| Timesheet | `timesheetRoutes.js`, `timesheetController.js`, `TimesheetTask.js`, `projectTimesheetSyncService.js`, `timesheetProjectReverseSyncService.js` | User/project task list, Kanban, calendar, admin summary/workload views, hierarchy scoping, two-way project sync |
| Tickets | `ticketRoutes.js`, `ticketController.js`, `Ticket.js`, `TicketActivity.js`, `TicketComment.js` | Support / repair ticket lifecycle, assignment, comments, attachments, activity timeline — **no notifications wired** |
| Dashboard | `dashboardRoutes.js`, `dashboardController.js` | Aggregate stats and recent-activity feed |

---

# 4. Frontend Module Inventory

| Module | Main frontend files | Purpose |
|---|---|---|
| Login | `LoginPage.jsx` | Credential login |
| Dashboard | `DashboardPage.jsx` | Summary widgets/charts |
| Inquiries | `InquiriesPage.jsx`, `ElectricalPanelInquiryPage.jsx`, `components/inquiry/*` | Inquiry list and the multi-type (PLC/VFD/MCC/MCC+PLC) inquiry form |
| Projects | `ProjectsPage.jsx`, `ProjectDetailPage.jsx`, `ProjectActivityPage.jsx`, `ProjectDocumentPreviewPage.jsx`, `components/project/*` | Project list/detail/planning/activity/documents |
| Customers | `CustomersPage.jsx`, `CustomerDetailPage.jsx`, `components/customer/CustomerForm.jsx` | Customer master list/detail/form |
| Tickets | `TicketsPage.jsx`, `TicketFormPage.jsx`, `components/ticket/TicketForm.jsx`, `components/ticket/ticketPermissions.js` | Ticket list and workflow form; `TicketViewPage.jsx` also exists but is unrouted |
| Notifications | `NotificationsPage.jsx` | User-facing notification list (sparse content — see §3, notifications are effectively Inquiry-only) |
| Timesheet | `TimesheetPage.jsx` (shell), `TimesheetAdminPage.jsx`, `components/timesheet/TimesheetListView.jsx`, `TimesheetKanbanView.jsx`, `TimesheetCalendarView.jsx`, `KanbanBoard.jsx`, `KanbanColumn.jsx`, `SortableTaskCard.jsx`, `EmployeeWorkloadTable.jsx`, `TimesheetWidgets.jsx` | List/Kanban/calendar/admin views; `pages/TimesheetCalendarPage.jsx` also exists but is unrouted (superseded by the `components/timesheet/TimesheetCalendarView.jsx` route child) |
| Users | `UsersPage.jsx` | Admin user management |
| Department Master | `DepartmentPage.jsx`, `components/department/DepartmentForm.jsx`, `api/departmentService.js` | Department CRUD, multi-HOD, team lead assignment |
| Integration Settings | `IntegrationSettingsPage.jsx` | Admin email/WhatsApp integration settings — calls the API directly via `api/axios.js` (no dedicated service file) |
| Layout/Auth shell | `layouts/MainLayout.jsx`, `components/common/Sidebar.jsx`, `Topbar.jsx`, `routes/ProtectedRoute.jsx`, `context/AuthContext.jsx` | Authenticated shell, navigation, route guards |
| Shared layout primitives | `components/common/PageHeader.jsx`, `StickyActionBar.jsx` | Reusable page header / sticky action bar; adopted in detail and form pages only (see §0.1) |

---

# 5. Frontend Routes (from `App.jsx`)

| Route | Component | Access |
|---|---|---|
| `/auth/login` | `LoginPage` | Public |
| `/` | `DashboardPage` | Protected (any authenticated role) |
| `/inquiries` | `InquiriesPage` | Protected |
| `/inquiries/new` | `ElectricalPanelInquiryPage` | Protected |
| `/inquiries/:id` | `ElectricalPanelInquiryPage` | Protected |
| `/inquiries/:id/edit` | `ElectricalPanelInquiryPage` | Protected |
| `/projects` | `ProjectsPage` | Protected |
| `/projects/new` | `ProjectDetailPage` | Protected |
| `/projects/:id` | `ProjectDetailPage` | Protected |
| `/projects/:id/edit` | `ProjectDetailPage` | Protected |
| `/projects/:id/activity` | `ProjectActivityPage` | Protected |
| `/projects/:id/documents/preview` | `ProjectDocumentPreviewPage` | Protected |
| `/customers` | `CustomersPage` | Protected |
| `/customers/:id` | `CustomerDetailPage` | Protected |
| `/tickets` | `TicketsPage` | Protected |
| `/tickets/new` | `TicketFormPage` | Protected |
| `/tickets/:id` | `TicketFormPage` | Protected |
| `/tickets/:id/edit` | `TicketFormPage` | Protected |
| `/notifications` | `NotificationsPage` | Protected |
| `/timesheet` (index) | redirects to `kanban` | Protected |
| `/timesheet/admin` | `TimesheetAdminPage` | Protected (rendered as a child of `TimesheetPage`, not role-gated at the router level — gating happens via Sidebar visibility and backend authorization) |
| `/timesheet/list` | `TimesheetListView` (lazy) | Protected |
| `/timesheet/kanban` | `TimesheetKanbanView` (lazy) | Protected |
| `/timesheet/calendar` | `TimesheetCalendarView` (lazy) | Protected |
| `/users` | `UsersPage` | Protected + `roles={['admin']}` |
| `/masters/departments` | `DepartmentPage` | Protected + `roles={['admin']}` |
| `/masters/integrations` | `IntegrationSettingsPage` | Protected + `roles={['admin']}` |
| `/404` | `NotFoundPage` | Public |
| `*` | Redirects to `/404` | Public |

Unrouted frontend pages (exist on disk, imported by nothing in `App.jsx`):

```text
frontend/src/pages/TicketViewPage.jsx
frontend/src/pages/TimesheetCalendarPage.jsx
frontend/src/pages/InquiriesPage_old.jsx
frontend/src/pages/ProjectsPage_ol.jsx
```

---

# 6. Sidebar Navigation

Main nav items (all authenticated users):

```text
Dashboard
Inquiries
Projects
Customers
Tickets
Timesheet
```

Master section, built by `getMasterItems()` in `Sidebar.jsx`:

```text
Timesheet (admin view)   → visible when isAdmin || isHod || isTeamLead || role === 'manager'
User Management           → visible to admin only
Department                → visible to admin only
Integration Settings      → visible to admin only
```

This matches the backend's timesheet elevated-route access (`authorizeHierarchy('team_lead')`, i.e. admin/hod/manager/team_lead), so frontend and backend are aligned for Timesheet Admin visibility.

---

# 7. API Route Inventory

## 7.1 Auth — `/api/auth`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| POST | `/login` | Public | Login |
| GET | `/me` | Auth | Current user |
| PUT | `/profile` | Auth | Update own profile |
| POST | `/profile/avatar` | Auth + upload | Upload own avatar |
| PUT | `/change-password` | Auth | Change password |

## 7.2 Users — `/api/users`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/assignable` | Auth + team context + hierarchy scope | Scoped assignable-user list (declared before the admin-only gate so all roles can reach it) |
| GET | `/` | Admin | List users |
| POST | `/` | Admin | Create user |
| POST | `/:id/avatar` | Admin + upload | Update a user's avatar |
| GET | `/:id` | Admin | Get user |
| PUT | `/:id` | Admin | Update user |
| DELETE | `/:id` | Admin | Delete/deactivate user |

## 7.3 Departments — `/api/departments`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/` | Auth | List departments (admin can include inactive) |
| POST | `/` | Admin | Create department |
| GET | `/:id` | Auth | Get department |
| PUT | `/:id` | Admin | Update department |
| DELETE | `/:id` | Admin | Soft-deactivate department |

## 7.4 Customers — `/api/customers`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/` | Auth | List customers |
| POST | `/` | Auth | Create customer |
| GET | `/:id` | Auth | Get customer |
| PUT | `/:id` | Auth | Update customer |
| DELETE | `/:id` | Admin | Delete customer |

## 7.5 Inquiries — `/api/inquiries`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/follow-ups` | Auth | Pending follow-ups |
| GET | `/` | Auth | Inquiry list |
| POST | `/` | Auth + upload (`attachments`) | Create inquiry |
| PATCH | `/:id/status` | Auth + upload | Update inquiry status |
| GET | `/:id` | Auth | Get inquiry |
| PUT | `/:id` | Auth + upload | Update inquiry |
| DELETE | `/:id` | Admin | Delete inquiry |

## 7.6 Projects — `/api/projects`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| POST | `/convert/:inquiryId` | Auth | Kickoff conversion entry point |
| POST | `/recalc-delays` | Auth | Recalculate delays across projects |
| GET | `/planning-templates` | Auth | Fetch planning templates |
| GET | `/` | Auth | List projects |
| POST | `/` | Auth | Create project |
| POST | `/:id/copy` | Auth | Copy project |
| POST | `/:id/documents` | Auth + upload (max 10) | Upload project documents |
| DELETE | `/:id/documents/:documentId` | Auth | Delete project document |
| GET | `/:id` | Auth | Get project |
| PUT | `/:id` | Auth | Update project |
| DELETE | `/:id` | Admin | Delete project |
| GET | `/:id/activity` | Auth | Project activity log |
| GET | `/:id/task-completion-history` | Auth | Expected vs actual task completion history |

## 7.7 Kickoff Workflow — `/api/kickoff-workflows`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| POST | `/:inquiryId/schedule` | Auth + `kickoffFinalBomUpload` upload | Schedule kickoff meeting (final BoM document attachable at schedule time) |
| POST | `/:inquiryId/complete` | Auth | Complete kickoff → create project |
| GET | `/:inquiryId` | Auth | Get workflow state for an inquiry |
| POST | `/process/due` | Admin | Manually process all due workflows |

## 7.8 Notifications — `/api/notifications`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/` | Auth | List current user's notifications |
| PUT | `/read-all` | Auth | Mark all read |
| PUT | `/:id/read` | Auth | Mark one read |
| DELETE | `/:id` | Auth | Delete a notification |

## 7.9 Dashboard — `/api/dashboard`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/stats` | Auth | Dashboard stats |
| GET | `/recent` | Auth | Recent inquiries/projects/tickets |

## 7.10 Integrations — `/api/integrations`

All routes require `protect` + a local `requireAdmin` inline middleware.

| Method | Path | Purpose |
|---|---|---|
| GET | `/status` | Get email + WhatsApp integration status |
| GET | `/email` | Get email settings |
| PUT | `/email` | Save email settings |
| POST | `/email/verify` | Verify SMTP/login |
| GET | `/whatsapp/status` | Get WhatsApp client status |
| POST | `/whatsapp/restart` | Restart WhatsApp client |
| POST | `/whatsapp/logout` | Clear WhatsApp session/logout |

## 7.11 Timesheet — `/api/timesheet`

All routes run `protect` then `attachTeamContext`.

| Method | Path | Middleware | Purpose |
|---|---|---|---|
| GET | `/list` | `scopeToHierarchy()` | Paginated list |
| GET | `/kanban` | `scopeToHierarchy()` | Kanban view |
| GET | `/calendar` | `scopeToHierarchy()` | Calendar view (needs `from`/`to`) |
| GET | `/tasks` | `scopeToHierarchy()` | Scoped task list |
| POST | `/tasks` | `scopeToHierarchy()` | Create task |
| GET | `/tasks/:id` | — | Get task |
| PUT | `/tasks/:id` | `scopeToHierarchy()` | Update task |
| DELETE | `/tasks/:id` | `scopeToHierarchy()` | Delete task |
| PATCH | `/tasks/:id/status` | `scopeToHierarchy()` | Update task status |
| PATCH | `/tasks/:id/kanban` | `scopeToHierarchy()` | Update Kanban position |
| PATCH | `/tasks/:id/archive` | `scopeToHierarchy()` | Archive (admin/HOD only, enforced in controller) |
| PATCH | `/tasks/:id/restore` | `scopeToHierarchy()` | Restore archived task |
| DELETE | `/tasks/:id/archived` | `scopeToHierarchy()` | Permanently delete archived task |
| GET | `/admin/all` | `authorizeHierarchy('team_lead')` + `scopeToHierarchy()` | Elevated scoped task list |
| GET | `/admin/summary` | same | Elevated scoped summary |
| GET | `/admin/workload` | same | Elevated scoped workload |
| GET | `/admin/daily-breakdown` | same | Elevated scoped daily breakdown |

`authorizeHierarchy('team_lead')` allows admin, hod, manager (treated as hod-equivalent), and team_lead.

## 7.12 Teams — `/api/teams`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/` | Auth | List scoped teams |
| POST | `/` | `requireRoles('admin')` | Create team |
| GET | `/:id` | Auth | Get team |
| PUT | `/:id` | `requireRoles('admin')` | Update team |
| DELETE | `/:id` | `requireRoles('admin')` | Deactivate team |
| PATCH | `/:id/hod` | `requireRoles('admin')` | Assign HOD |
| PATCH | `/:id/team-lead` | `requireRoles('admin','hod')` | Assign team lead |
| GET | `/:id/members` | Auth | Get members |
| POST | `/:id/members` | `requireRoles('admin','hod','team_lead')` | Add member |
| DELETE | `/:id/members/:userId` | `requireRoles('admin','hod','team_lead')` | Remove member |

## 7.13 Tickets — `/api/tickets`

| Method | Path | Purpose |
|---|---|---|
| PUT | `/comments/:commentId` | Update comment (registered before `/:id` to avoid route clash) |
| DELETE | `/comments/:commentId` | Delete comment |
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
| POST | `/:id/attachments` | Upload attachments |
| DELETE | `/:id/attachments/:attachmentId` | Delete attachment |
| GET | `/:id/activity` | Activity timeline |

All ticket routes only require `protect`; fine-grained role checks (`canManageTickets`, `canVoidTicket`, etc.) are enforced inside `ticketController.js`, not at the router level.

## 7.14 WhatsApp test route — `/api/test-whatsapp`

| Method | Path | Protection | Purpose |
|---|---|---|---|
| GET | `/` | **None** | Sends a WhatsApp test message and reports pipeline result |

Confirmed still public — no `protect` middleware anywhere on this router or its mount line.

---

# 8. Database Model Summary

## 8.1 `User`

```text
backend/models/User.js
```

Roles: `admin`, `hod`, `team_lead`, `employee`, `manager` (`ROLES` constant).
Role order (high → low): `admin > hod > manager > team_lead > employee` (`ROLE_ORDER`).

| Field | Notes |
|---|---|
| `name`, `email`, `password` | Standard identity fields; password bcrypt-hashed on save (`select: false`) |
| `phone` | Also used for WhatsApp inbound matching |
| `avatar` | Profile avatar URL |
| `role` | Enum, default `employee` |
| `department` | `Mixed` — Department ObjectId (new data) or legacy string |
| `hodDepartments` | `Mixed[]` — supports multiple HOD-owned departments |
| `teamId` | Ref `Team` |
| `reportsTo` | Ref `User` |
| `isActive` | Soft-deactivation flag |
| `passwordResetToken` / `passwordResetExpires` | Password reset flow |

Instance methods: `comparePassword`, `hasRole(...roles)`, `outranks(targetRole)`. Static: `findByTeam(teamId)`.

## 8.2 `Department`

```text
backend/models/Department.js
```

| Field | Notes |
|---|---|
| `name`, `code` | Uppercased, unique |
| `hod` | Backward-compatible single HOD reference |
| `hods[]` | Current multi-HOD array |
| `teamLead` | Single team lead reference |
| `isActive` | Soft-deactivation |
| `createdBy` | Creator reference |

## 8.3 `Customer`

```text
backend/models/Customer.js
```

Key fields: `customerId` (auto-generated), `customerName` (current primary field), `companyName` (legacy-compatible), `companyType`, `contacts[]`, `contactPerson` (legacy), `email`, `mobileNumber`, `city`, `address`, `gstNumber`, `totalProjects`, `notes`, `isActive`.

`backend/utils/customerUniversal.js` centers on `customerName` as canonical and clears legacy `companyName` during sync where applicable.

## 8.4 `Inquiry`

```text
backend/models/Inquiry.js  (729 lines)
```

Inquiry types: `PLC_AUTOMATION`, `VFD_PANEL`, `MCC_PANEL`, `MCC_CUM_PLC`, `LEGACY`.

Main `status` enum (verified directly from the schema, current file):

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
```

Note: `'Project Won'` is **not** in this enum in the current source (one older Markdown file claimed it was — that claim is stale/incorrect for this ZIP).

Legacy spelling variants (`Order Recieved`, `Inq. Lost`, multiple casings of "BOM Submitted") remain in the enum, confirming status-string duplication is still an active characteristic of this module.

PLC-specific fields confirmed present:

```text
plcDetails.switchgearMake
plcDetails.customSwitchgearMake
plcDetails.programmingDevelopmentScope
plcDetails.automationRequirements
plcDetails.supportRequirements.onsiteSupportRequired / onsiteSupportDays
plcDetails.supportRequirements.commissioningSupportRequired / commissioningSupportDays
plcDetails.ioDetails.*
```

The `kickoffMeeting` sub-schema embedded in `Inquiry.js` has its own status enum, separate from the main inquiry status:

```text
Not Scheduled, Scheduled, Ready For Completion, Completed, Project Created, Failed, Cancelled
```

## 8.5 `Project`

```text
backend/models/Project.js  (370 lines)
```

- `projectId` auto-generated as `NAPL-####` via a dedicated `NaplCounter` model (starting seq 199).
- Panel types: `PLC`, `MCC`, `VFD`, `PLC_MCC`.
- Dual planning representation: `planningGrids[]` (structured grid-of-tasks, current primary structure) **and** `planningTasks[]` (flattened legacy copy retained so existing reports/charts/reminders/integrations keep working). Both are populated and must be kept in sync — see §16 risk.
- Delay tracking fields: `delayedDays`, `delayedEndDate`, computed via a shared helper comparing `projectEndDate` against either `completedAt` or "now".
- `projectDocumentSchema` and `kickoffMeetingSchema` sub-schemas for attachments and kickoff linkage.

## 8.6 `TimesheetTask`

```text
backend/models/TimesheetTask.js  (404 lines)
```

```text
TASK_STATUSES   = Backlog, Planned, In Progress, Review, Completed
TASK_TYPES      = Development, Design, Meeting, Review, Testing, Documentation, Support, Other
TASK_SOURCES    = USER, PROJECT
SYNC_STATUSES   = SYNCED, PENDING, FAILED
ARCHIVE_REASONS = PROJECT_TASK_REMOVED, PROJECT_TASK_UNASSIGNED, PROJECT_DELETED, MANUAL_ARCHIVE
```

`taskSource` distinguishes user-created tasks from project-linked tasks; project-linked tasks have extra structural protections enforced via `canModifyProjectLinkedTaskStructure()` in `permissionMiddleware.js`.

## 8.7 `Ticket`

```text
backend/models/Ticket.js  (553 lines)
```

```text
TICKET_TYPES         = N/A, Support, Repairing & Replacement
TICKET_STATUSES       = New, Assigned, Working, Customer Side Pending, Closed, Void
TICKET_PRIORITIES      = Low, Medium, High, Critical
SUPPORT_TYPES            = Free, Paid, Warranty, Comprehensive AMC, Non Comprehensive AMC, Other
PRODUCT_TYPES              = N/A, HMI, PLC, Servo, VFD, SCADA, Industrial PC, Other
RR_SOLUTION_STATUSES         = N/A, Repair Done, Replacement Done, Vendor Return, Scrap, Awaiting Approval, Awaiting Material
REPAIR_STATUSES                = N/A, Pending, In Progress, Under Inspection, Repair Done, Replacement Done, Ready for Dispatch, Dispatched, Vendor Return, Scrap
```

`source` enum: `Call, Mail, WhatsApp, Internal, Other` (required, no default).

Product sub-schema confirms **`brand`** and **`panelFamily`** as two separate free-text fields (not a combined field), consistent with the Ticket Module Phase 2 decisions recorded in project history. `department` is a free-text string (max 80 chars), populated on the frontend from the Department Master, not a hardcoded enum.

Ticket-level `Notification` calls: **none**. No document in `ticketController.js` creates an internal `Notification` or triggers `notificationService`.

## 8.8 `IntegrationSettings`

```text
backend/models/IntegrationSettings.js
```

Singleton document (`singletonKey: 'default'`, unique + immutable). `email.*` sub-object: `isEnabled`, `provider` (default `outlook`), `host` (default `smtp.office365.com`), `port` (default 587), `secure`, `username`, `fromEmail`, `passwordEncrypted` (`select: false`), `lastVerifiedAt`, `lastVerificationStatus` (`Pending`/`Success`/`Failed`), `lastVerificationError`. `updatedBy` references `User`.

## 8.9 `Notification`

```text
backend/models/Notification.js
```

`type` enum: `follow_up, overdue, project_delay, order_confirmed, kickoff_scheduled, project_created, workflow_error, info, status, warning`.

Confirmed by direct code search: `workflow_error` is **not referenced anywhere** in `controllers/`, `services/`, or `routes/` — it exists in the schema but nothing in the current codebase ever creates a notification of that type.

## 8.10 `KickoffWorkflow`

```text
backend/models/KickoffWorkflow.js
```

Tracks scheduling state, attendees, notification logs, and the link from an Inquiry through to a created Project. Consumed by `kickoffWorkflowController.js` and `kickoffWorkflowService.js`.

---

# 9. Authentication and Permission Flow

## 9.1 Backend auth

`authMiddleware.js` exports:

- `protect` — verifies JWT, hydrates `req.user` (excluding password) with `name, email, phone, role, department, hodDepartments, teamId, reportsTo, isActive, avatar`. Rejects with 401 on missing/invalid token, inactive account, or deleted user.
- `authorize(...roles)` — exact-role allowlist, with a backward-compat rule that `'manager'` in the caller's role list also expands to accept `hod` and `team_lead`, and that a token bearing `role: 'manager'` is treated as `hod`.
- `authorizeHierarchy(minimumRole)` — allows any role at or above `minimumRole` in `ROLE_ORDER`.

`permissionMiddleware.js` exports a parallel, more granular set: `requireRoles`, `attachTeamContext` (computes `req.teamContext.memberIds` per role), `scopeToHierarchy()` (computes `req.allowedEmployeeIds`, supports an `employeeId` query override that is itself scope-checked), `canEditTask`, `canReadTask`, and the timesheet archive-permission helpers (`canArchiveTimesheetTask`, `canRestoreTimesheetTask`, `canDeleteArchivedTimesheetTask`, `canModifyProjectLinkedTaskStructure`).

## 9.2 Confirmed still-active issue: `authMiddleware.js` denial can surface as HTTP 500

`authMiddleware.js`'s local `createError(message, statusCode)` helper takes an **optional** `statusCode` with no default. Both `authorize()` and `authorizeHierarchy()` call it on the "access denied" path with only a message argument:

```js
return next(createError(`Access denied. Required roles: [...]. Your role: ...`));
```

`err.statusCode` is therefore `undefined`, and `errorMiddleware.js` falls back to `err.statusCode || 500`, so a forbidden-access response comes back as HTTP 500 rather than 403.

This is **not** true of `permissionMiddleware.js`: its own `createError(message, statusCode = 403)` defaults correctly, so any route using `requireRoles`/`scopeToHierarchy` denial paths returns proper 403s. The bug is isolated to the two `authMiddleware.js` functions, which back `authorize()` on Auth/Customer/Department/Inquiry/Project/User/Kickoff/Timesheet-elevated routes and `authorizeHierarchy()` on the Timesheet elevated routes.

## 9.3 Frontend auth context

`AuthContext.jsx` derives `isAdmin`, `isHod`, `isManagerRole` (`role === 'manager'`), `isTeamLead`, `isEmployee`, a combined `isManager` (any of admin/hod/manager/team_lead), and `isTicketAssignee` (alias for `isEmployee`). No references to `technical_communication` or `engineer` roles exist in the current file (an older Markdown's concern about those role names is not applicable to this ZIP).

---

# 10. Inquiry Module Flow

**Backend:** `inquiryRoutes.js` → `inquiryController.js` → `Inquiry.js`, with `multer`-based `uploadMiddleware` shared across create/update/status-change.
**Frontend:** `InquiriesPage.jsx` (list) → `ElectricalPanelInquiryPage.jsx` (create/view/edit) → `components/inquiry/InquiryForm.jsx`, `forms/CommonInquirySections.jsx` + type-specific sections (`PlcInquirySections.jsx`, `VfdInquirySections.jsx`, `MccInquirySections.jsx`) + `tables/ComponentRequirementTable.jsx` + `InquiryLoadTable.jsx`.

Flow:

1. Create — `POST /api/inquiries` with `attachments` multipart field; multer runs before `createInquiry`.
2. Update — `PUT /api/inquiries/:id`, same upload pattern.
3. Status change — `PATCH /api/inquiries/:id/status`, also upload-capable (e.g. attaching a document at status-change time).
4. Every create/update/status-change/delete path attempts a `createNotification()` call (email + in-app), wrapped in try/catch inside `notificationService.js` so a notification failure never rolls back the inquiry save.
5. Follow-up tracking via `GET /api/inquiries/follow-ups`.
6. Order-won status feeds into the Kickoff Workflow module (§13 in prior report structure, now §12 here).

Notification module coupling: Inquiry is the **only** module in the entire backend that calls `createNotification`. This is a structural gap, not a bug — Ticket and Timesheet users currently get no in-app or email notifications for their own workflow events.

---

# 11. Project Module Flow

**Backend:** `projectRoutes.js` → `projectController.js` → `Project.js` / `ProjectActivityLog.js`, using `config/projectPlanningTemplates.js` for default planning grids.
**Frontend:** `ProjectsPage.jsx` (list) → `ProjectDetailPage.jsx` (create/view/edit, uses `PageHeader` + `StickyActionBar`) → `components/project/ProjectForm.jsx`, `ProjectPlanningGrid.jsx`, `ProjectDocumentAttachments.jsx`; `ProjectActivityPage.jsx` + `components/activity/ProjectActivityLogHistory.jsx` + `ActivityGraph.jsx` for history; `ProjectDocumentPreviewPage.jsx` for document preview.

Capabilities: manual create/update/delete, project copy, NAPL project ID auto-generation, customer reference sync, dual planning representation (`planningGrids` + flattened `planningTasks`), document upload/delete, activity log, delay tracking + recalculation endpoint, task completion history, WhatsApp side effects (via `kickoffWorkflowService`/`whatsappService` on relevant transitions), and project-to-timesheet sync on create/copy/update/delete (§14).

---

# 12. Ticket Module Flow

**Backend:** `ticketRoutes.js` → `ticketController.js` → `Ticket.js` / `TicketActivity.js` / `TicketComment.js`.
**Frontend:** `TicketsPage.jsx` (list) → `TicketFormPage.jsx` (create/view/edit, uses `PageHeader` + `StickyActionBar`) → `components/ticket/TicketForm.jsx` + `ticketPermissions.js`. `TicketViewPage.jsx` exists but is not routed (dead file, see §17).

Lifecycle: `New → Assigned → Working → Customer Side Pending → Closed`, with `Void` reachable from most states, plus `Reopen` from `Closed`.

Backend "ticket manager" roles (`TICKET_MANAGER_ROLES`): `admin, hod, manager, team_lead`. Assignable role: `employee` only.

| Action | Backend rule | Frontend rule |
|---|---|---|
| Create | management roles | `canCreateTicket` = management |
| Assign | management roles | `canAssignTicket` = management |
| Start work | management or assigned employee | matches |
| Customer pending | management or assigned employee | matches |
| Close | management or assigned employee | matches |
| Reopen | management roles | matches |
| **Void** | `admin, hod, manager, team_lead` (`canVoidTicket = canManageTickets`) | **`admin, hod` only** (`isAdminOrHod`) |
| Add/upload | any authenticated user | matches |
| Edit/delete comment | author or management | matches |
| Delete attachment | uploader or management | matches |

**Confirmed still-active mismatch:** backend allows `manager` and `team_lead` to void a ticket; the frontend's `getVisibleActions()` will not show the Void button to those two roles, so they can only trigger it by calling the API directly.

No `createNotification` calls exist anywhere in `ticketController.js` — ticket assignment, status transitions, and closures do not generate in-app or email notifications in the current code.

---

# 13. Customer Module Flow

**Backend:** `customerRoutes.js` → `customerController.js` → `Customer.js`, with `backend/utils/customerUniversal.js` providing shared normalization logic used by Inquiry and Project creation/update flows whenever a customer reference needs to be resolved or synced.
**Frontend:** `CustomersPage.jsx` (list) → `CustomerDetailPage.jsx` (detail, uses `PageHeader`) → `components/customer/CustomerForm.jsx` (uses `StickyActionBar`).

Basic CRUD with `customerName` as the canonical display field and `companyName` retained for legacy compatibility. Customer deletion is admin-only; all other operations require only authentication.

---

# 14. Timesheet Module Flow

**Backend:** `timesheetRoutes.js` → `timesheetController.js` → `TimesheetTask.js`, scoped through `attachTeamContext` + `scopeToHierarchy()` on every route.
**Frontend:** `TimesheetPage.jsx` (shell + tab navigation) with lazy-loaded child routes `TimesheetListView.jsx`, `TimesheetKanbanView.jsx` (uses `KanbanBoard.jsx` / `KanbanColumn.jsx` / `SortableTaskCard.jsx` with `@dnd-kit`), `TimesheetCalendarView.jsx`; plus `TimesheetAdminPage.jsx` for elevated views (`EmployeeWorkloadTable.jsx`, `TimesheetWidgets.jsx`).

Permission/scope model:

| Role | Scope |
|---|---|
| Admin | All employees |
| HOD | Managed teams (own + team lead + members) |
| Manager | Treated as HOD-equivalent by `effectiveRole()` |
| Team Lead | Own team |
| Employee | Own tasks for edit; broader team visibility for read depending on team membership |

Archive lifecycle (`archive` / `restore` / permanently `delete archived`) is admin/HOD-only, enforced in the controller via `canArchiveTimesheetTask` etc. from `permissionMiddleware.js`.

No `createNotification` calls exist anywhere in `timesheetController.js` — task assignment, overdue tasks, and status changes do not generate notifications in the current code.

---

# 15. Department Master Module Flow

**Backend:** `departmentRoutes.js` → `departmentController.js` → `Department.js`, seeded on boot via `departmentSeedService.js` → `seedDefaultDepartments()`.
**Frontend:** `DepartmentPage.jsx` → `components/department/DepartmentForm.jsx`, `api/departmentService.js`.

Supports multi-HOD (`hods[]`, with `hod` retained for backward compatibility) and a single `teamLead`. Consumed by: `UsersPage.jsx` (assign a user's department), `TicketForm.jsx` (ticket `department` free-text field, populated from Department Master options rather than a hardcoded enum). `Project.js` planning templates (`config/projectPlanningTemplates.js`) still use hardcoded department name strings rather than referencing Department Master records — this remains an inconsistency between the two representations of "department" in the system.

---

# 16. Integration Settings Module Flow

**Backend:** `integrationRoutes.js` → `integrationController.js` → `IntegrationSettings.js`, `emailSettingsService.js`, `whatsappService.js`.
**Frontend:** `IntegrationSettingsPage.jsx` — calls the API directly through `api/axios.js`; there is **no** separate `integrationService.js` file in `frontend/src/api/` (confirmed by directory listing — only `axios.js`, `departmentService.js`, `projectService.js`, `ticketService.js`, `timesheetService.js` exist there).

All routes require `protect` + a local inline `requireAdmin` check (`req.user?.role !== 'admin'` → 403).

| Area | Capability |
|---|---|
| Email | View settings, save SMTP settings, verify SMTP/login, password stored encrypted (`passwordEncrypted`, `select: false`) |
| WhatsApp | View client status, restart client, logout/clear session |

Email active-config precedence: (1) database `IntegrationSettings` when `isEnabled` and a password exists, (2) environment fallback. `emailSettingsService.js` reads `process.env.OUTLOOK_EMAIL` and `process.env.OUTLOOK_PASS` — confirmed exact variable names in the current source (an older Markdown's reference to `OUTLOOK_PASSWORD` does not match this file).

---

# 17. Notification and WhatsApp Flow

## 17.1 Internal notifications

`services/notificationService.js` exports `createNotification({...})`, wraps `Notification.create()` and an optional `sendOutlookNotification()` email call in a try/catch so notification failures never bubble up as a 500 to the calling controller.

Confirmed callers, by direct search of `controllers/` and `services/`: **only `controllers/inquiryController.js`**. No other active controller (`ticketController.js`, `timesheetController.js`, `projectController.js`, `customerController.js`, `departmentController.js`, `userController.js`, `dashboardController.js`, `integrationController.js`, `kickoffWorkflowController.js`) calls it.

A second, structurally similar implementation exists at `backend/utils/createNotification.js`. It is never imported by any controller, route, or service — confirmed dead/duplicate code, not an alternate active path.

The `workflow_error` value in the `Notification` model's `type` enum is not referenced by any `createNotification(...)` call anywhere in the codebase — an unused enum value.

`NotificationsPage.jsx` (frontend) therefore surfaces a feed that in practice only ever contains Inquiry-originated notifications.

## 17.2 WhatsApp

```text
backend/services/whatsappService.js
```

Built on `whatsapp-web.js` with `LocalAuth`, session id `nexus-session`, session persisted at `backend/.wwebjs_auth/session-nexus-session` (present as a runtime artifact in the ZIP). Cache directory `backend/.wwebjs_cache/` is also present but empty in this ZIP snapshot.

Exports: `initWhatsApp`, `getWhatsAppStatus`, `restartWhatsApp`, `logoutWhatsApp`, `sendWhatsAppNotification`, `sendWhatsAppGroupNotification`, `sendTestMessage`, plus attachment-capable group sending used by kickoff flows.

Outgoing result shape: `{ ok, status, recipient, error }`; statuses include `Sent`, `Queued`, `Skipped`, `Failed`.

WhatsApp inbound project-task command parsing supports both a pipe-delimited single-line style (`NEXUS | NAPL-0209 | GA Approval | Completed | Sent to client`, also accepting a `PROJECT |` prefix) and a multi-line `PROJECT:` / `TASK:` / `STATUS:` / `REMARK:` style, used to update project planning task status from a WhatsApp message.

`GET /api/test-whatsapp` remains publicly reachable with no auth middleware, confirmed by direct inspection of both `server.js` and `testWhatsappRoute.js` — this is an unauthenticated diagnostic endpoint that can trigger a real WhatsApp send.

Kickoff Workflow's WhatsApp usage (group notify, configured-number notify, customer notify, attendee notify) goes directly through `whatsappService.js`, bypassing the internal `Notification` model entirely — kickoff notifications are WhatsApp/email-only, not reflected in `NotificationsPage.jsx`.

---

# 18. Project-to-Timesheet Sync Flow

Two independent sync services now exist, moving data in opposite directions:

## 18.1 Forward sync — Project → Timesheet

```text
backend/services/projectTimesheetSyncService.js
```

Invoked from `projectController.js` on:

| Project action | Sync action |
|---|---|
| Create project | Sync assigned planning tasks into Timesheet |
| Copy project | Sync copied project's planning tasks |
| Update project | Sync changed/newly-assigned planning tasks |
| Delete project | Archive all linked timesheet tasks |

Task extraction order: (1) `planningGrids`, (2) fallback to flattened `planningTasks`. A planning task only becomes a timesheet task once it has a valid assignee. Archive reasons map to `PROJECT_TASK_REMOVED`, `PROJECT_TASK_UNASSIGNED`, `PROJECT_DELETED` per the `TimesheetTask` archive-reason enum.

A companion service, `backend/services/projectTimesheetBackfillService.js`, exists to backfill existing/older project tasks into Timesheet, but is **not required by any controller, route, or `server.js`** — confirmed dead-wired. Pre-existing project tasks created before this sync logic was introduced will not automatically appear in Timesheet unless this service is invoked manually (e.g. via a one-off script run), which is not part of the normal request/response or boot flow.

## 18.2 Reverse sync — Timesheet → Project (new since the last Markdown snapshot)

```text
backend/services/timesheetProjectReverseSyncService.js
```

Invoked from `timesheetController.js`. Keeps the corresponding Project planning task's status aligned when a user changes a **project-linked** (`taskSource: 'PROJECT'`) Timesheet task to `In Progress` or `Completed` (`TIMESHEET_TO_PROJECT_STATUS` mapping). Internally reuses `extractProjectPlanningTasks()` from the forward-sync service to locate the matching planning task inside `Project.planningGrids` / `planningTasks` before writing the status back.

This closes part of the loop the older Markdown flagged as one-directional, but the dual `planningGrids`/`planningTasks` representation risk (§19.5) still applies to both directions of sync.

---

# 19. Confirmed Broken / Mismatched Flows

| # | Location | Issue | Why it matters |
|---|---|---|---|
| 1 | `backend/middleware/authMiddleware.js` (`authorize`, `authorizeHierarchy`) | Access-denied errors are created without a `statusCode`, so `errorMiddleware.js` defaults to HTTP 500 instead of 403 | A legitimate permission denial looks like a server crash to the frontend and to API consumers; `permissionMiddleware.js`'s equivalent functions are unaffected (they default to 403 correctly) |
| 2 | `backend/server.js` + `backend/routes/testWhatsappRoute.js` | `GET /api/test-whatsapp` has no `protect` middleware | Anyone who can reach the backend can trigger a real outbound WhatsApp send |
| 3 | `frontend/src/App.jsx` vs `TicketViewPage.jsx` | `/tickets/:id` routes to `TicketFormPage`, not `TicketViewPage` | `TicketViewPage.jsx` is fully dead code; any future fix targeting "the ticket view page" must target `TicketFormPage.jsx` instead |
| 4 | `backend/controllers/ticketController.js` vs `frontend/src/components/ticket/ticketPermissions.js` | Backend `canVoidTicket` allows `admin, hod, manager, team_lead`; frontend `canVoidTicket` only allows `admin, hod` | `manager`/`team_lead` users are backend-authorized to void a ticket but the UI never shows them the button |
| 5 | `backend/services/notificationService.js` usage | `createNotification` is only ever called from `inquiryController.js` | Ticket and Timesheet users receive zero in-app/email notifications for their own module's events, despite the `NotificationsPage.jsx` UI existing generically for "notifications" |

---

# 20. Architectural Risks

## 20.1 Dual project-planning representation

`Project.js` stores both `planningGrids[]` (structured, current primary) and `planningTasks[]` (flattened legacy copy). `projectController.js`, both sync services (§18), and `dashboardController.js` all need to stay aware of which representation they read from; a change that updates one without the other can silently desync reports, sync jobs, and dashboard aggregates.

## 20.2 Project-timesheet backfill service unwired

`projectTimesheetBackfillService.js` is fully implemented but not called from anywhere reachable at runtime. Any project tasks that predate the sync services will not appear in Timesheet automatically.

## 20.3 Notification coverage gap

The `Notification` model and `notificationService.js` are generic and reusable, but only the Inquiry module uses them. This is architecture debt more than a bug: Ticket and Timesheet modules would need explicit `createNotification(...)` calls added at their relevant transition points to reach parity with Inquiry.

## 20.4 Status string duplication

`Inquiry.js`'s `status` enum retains at least nine spelling/casing variants of "BOM Submitted" alone, plus other legacy aliases (`Order Recieved`, `Inq. Lost`). Any new status handling logic added to `inquiryController.js`, `dashboardController.js`, or the frontend status components risks missing one of these variants.

## 20.5 Frontend layout componentization is partial

`PageHeader.jsx` / `StickyActionBar.jsx` are adopted in detail/form pages (Ticket, Project, Customer, Inquiry) but not in the five list pages (Inquiries, Projects, Customers, Tickets, Timesheet views). Until the list pages are migrated, the codebase carries two parallel patterns for page chrome — the shared components and each list page's own inline header/toolbar markup.

## 20.6 Duplicate/backup files present in the active source tree

Several `_old`/`_ol` files sit alongside their live counterparts inside `controllers/`, `pages/`, `components/`, and `data/` (full list in §21). None are imported anywhere, but their presence increases the chance a future edit accidentally targets the wrong file, especially since some pairs have near-identical names (`ProjectsPage.jsx` / `ProjectsPage_ol.jsx`).

## 20.7 Runtime/private artifacts bundled with the source ZIP

`.env`, the WhatsApp session directory (`.wwebjs_auth/`), uploaded files (`backend/uploads/`), `node_modules/` (both backend and frontend), and the frontend production build (`frontend/dist/`) are all present inside the uploaded ZIP. These should not be treated as part of a clean source-only handoff; the `.env` in particular represents a credential-leakage risk if this ZIP is shared or committed anywhere.

---

# 21. Unused / Old / Duplicate Files

Every file below was checked with a repository-wide `grep` for imports/requires; none were found to be referenced from any active file.

## 21.1 Backend

| File | Status |
|---|---|
| `backend/controllers/inquiryController_old.js` | Old inquiry controller backup, unused |
| `backend/controllers/projectController_old.js` | Old project controller backup, unused |
| `backend/package_old.json` | Old backend package manifest backup (differs from live `package.json` by the `qrcode` dependency, which the live file has and the old one lacks) |
| `backend/utils/createNotification.js` | Duplicate of `services/notificationService.js`'s `createNotification`; never imported |
| `backend/services/documentExtractionService.js` | Present but not required by any controller/route — placeholder/unused |
| `backend/services/projectTimesheetBackfillService.js` | Implemented but not wired into any route or startup call (see §20.2) |
| `backend/routes/testWhatsappRoute.js` | Active but explicitly documented in its own header as a temporary diagnostic route meant to be removed once WhatsApp is confirmed stable |
| `backend/scripts/backfillCustomerRefs.js`, `removeAlternateNumberFromCustomers.js`, `scripts/migrations/001_add_team_hierarchy.js` | One-off scripts outside the normal request/boot flow — run manually only |
| `backend/seed/seedData.js`, `seed/seedTask.js` | Seed scripts outside normal runtime; only `departmentSeedService.js` runs automatically on boot |

Files present in prior Markdown reports that **no longer exist** in this ZIP (do not carry these forward): `backend/server_old.js`, `backend/controllers/userController_old.js`, `backend/models/User_old.js`, `backend/utils/departmentUtils_old.js`.

## 21.2 Frontend

| File | Status |
|---|---|
| `frontend/src/pages/InquiriesPage_old.jsx` | Old page backup, unused |
| `frontend/src/pages/ProjectsPage_ol.jsx` | Old page backup, unused (note the truncated filename — not a typo made by this report) |
| `frontend/src/pages/TicketViewPage.jsx` | Exists, imports live components, but not referenced in `App.jsx` — dead route target |
| `frontend/src/pages/TimesheetCalendarPage.jsx` | Exists but not referenced in `App.jsx` — superseded by `components/timesheet/TimesheetCalendarView.jsx`, which is the component actually mounted at `/timesheet/calendar` |
| `frontend/src/data/inquiryMasterData_old.js` | Old master data backup, unused |
| `frontend/src/components/common/FormComponents.extended_old.jsx` | Old form-components backup, unused (the live `FormComponents.extended.jsx` is heavily used — see §4) |
| `frontend/src/components/inquiry/forms/CommonInquirySections_old.jsx` | Old inquiry section backup, unused |

Files present in prior Markdown reports that **no longer exist** in this ZIP: `frontend/src/components/common/Sidebar_old.jsx`.

`frontend/src/components/common/MainLayout.jsx` still exists alongside `frontend/src/layouts/MainLayout.jsx`; `App.jsx` imports the latter (`from './layouts/MainLayout'`). The `components/common/` copy is a same-named duplicate component, not imported anywhere in the routed app — confirmed dead.

---

# 22. Runtime / Deployment Artifacts (not source, but present in the ZIP)

```text
backend/.env
backend/.wwebjs_auth/session-nexus-session
backend/.wwebjs_cache/
backend/uploads/inquiry, projects, tickets, users
backend/node_modules/
frontend/node_modules/
frontend/dist/
```

These reflect a working local/deployed instance rather than a clean source-only export. Treat any file under these paths as environment state, not as project source to review or refactor.

---

# 23. Final Current-System Understanding Summary

The current Nexus Dashboard ZIP is a MERN-stack (MongoDB, Express, React, Node.js) internal CRM/ERP for an electrical panel manufacturing business, organized into the following functionally verified modules:

1. **Inquiry Management** — full lifecycle for PLC/VFD/MCC/MCC+PLC panel inquiries, attachments, extensive (if duplicated) status enum, customer sync, and the system's only wired notification/email side effects.
2. **Kickoff Workflow** — schedules a kickoff meeting from an Order-Won inquiry (now with a final-BoM upload at schedule time), tracks due/ready/completed states, and creates a Project on completion, driving WhatsApp/email notifications directly rather than through the internal Notification model.
3. **Project Management** — NAPL-numbered projects with a dual planning-task representation, document attachments, activity logging, delay computation, project copy, and two-way sync with Timesheet.
4. **Timesheet** — list/Kanban/calendar/admin views with hierarchy-based scoping (admin/HOD/manager/team lead/employee), project-linked vs. user-created task distinctions, and a now-bidirectional sync relationship with Project planning tasks. No notifications wired.
5. **Department Master** — active model/routes/UI with multi-HOD and team-lead support, consumed by User Management and the Ticket form; still not the source of truth for the hardcoded department names baked into project planning templates.
6. **Ticket Module** — full lifecycle (New → Assigned → Working → Customer Side Pending → Closed, with Void/Reopen), comments, attachments, activity timeline, `brand`/`panelFamily` tracked as distinct fields. No notifications wired; a confirmed frontend/backend permission mismatch on Void for `manager`/`team_lead` roles; a dead unrouted view page.
7. **Customer Module** — straightforward CRUD master, shared normalization logic (`customerUniversal.js`) used by Inquiry and Project.
8. **Integration Settings** — admin-only email SMTP configuration (with encrypted password storage and environment fallback) and WhatsApp client status/restart/logout controls; no dedicated frontend service file, calls go through the shared axios client.
9. **Notifications and WhatsApp** — internal `Notification` model and email side effects are Inquiry-only in practice, with an unused `workflow_error` type and a dead-duplicate `utils/createNotification.js`; WhatsApp is a separate, more broadly used channel (kickoff flow, inbound project-task commands) with a still-public diagnostic test route.

## 23.1 Primary open risks, ranked by likely impact

1. Public, unauthenticated `GET /api/test-whatsapp` route.
2. `authMiddleware.js` returning 500 instead of 403 on authorization failures.
3. Notification coverage gap (Ticket/Timesheet users get no in-app/email notifications).
4. Dual `planningGrids`/`planningTasks` representation requiring manual sync discipline across two sync services now instead of one.
5. Project-timesheet backfill service present but unreachable at runtime.
6. Ticket Void permission mismatch between backend and frontend for `manager`/`team_lead`.
7. Inquiry status-string duplication increasing the chance of incomplete status-handling changes.
8. Partial rollout of `PageHeader`/`StickyActionBar` leaving two page-chrome patterns active simultaneously.
9. Runtime/private artifacts (`.env`, WhatsApp session, uploads, build output, `node_modules`) bundled inside the same ZIP as the source.
