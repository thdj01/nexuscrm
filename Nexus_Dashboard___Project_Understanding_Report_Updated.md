# Nexus Dashboard — Project Understanding Report (Updated)

## 0. Analysis Scope

This report merges and supersedes the previously uploaded documents:

```text
Nexus Dashboard — Project Understanding Report          (narrative/flow-analysis base)
Nexus Dashboard — Latest Codebase Understanding.md
Nexus Dashboard — Updated Codebase Understanding Report (v2 / v3)
```

Every claim carried forward from those files was re-checked directly against the actual extracted source in the latest uploaded `nexus-dashboard.zip`. Where a prior finding no longer matches the code, it is corrected or removed below and the correction is called out explicitly rather than silently dropped, so this document can be trusted as the single current reference.

No source code was modified. This is an understanding/analysis document only.

Backend JavaScript was spot-checked across routes/controllers/models/services/middleware with no failures found. Frontend production build was not re-run in this pass; an earlier-reported Rollup native-binary issue (`@rollup/rollup-linux-x64-gnu` missing from the uploaded `node_modules`) was a `node_modules` installation-state problem, not a source-code defect, and was not re-validated here — treat frontend build status as unconfirmed until an actual `npm install && npm run build` is run in a clean environment.

---

## 0.1 What Materially Changed Since the Last Full Understanding Pass

| Area | Change |
|---|---|
| Old/backup files removed | A large number of backup files referenced by earlier reports **no longer exist** in the current ZIP: `backend/server_old.js`, `backend/controllers/userController_old.js`, `backend/models/User_old.js`, `backend/utils/departmentUtils_old.js`, `frontend/src/App_old.jsx`, `frontend/src/components/common/Sidebar_old.jsx`, `frontend/src/pages/ProjectDetailPage_old.jsx`, `frontend/src/pages/UsersPage_old.jsx`, `frontend/src/components/project/ProjectPlanningGrid_old.jsx`, `frontend/src/components/timesheet/TimesheetForm_old.jsx`, `frontend/src/utils/departmentUtils_old.js`. The project has clearly been cleaned up in stages — do not carry these forward into future reports. |
| Old/backup file added | `backend/package_old.json` now exists (not present in earlier reports). |
| Status alias handling is more mature than previously reported | `dashboardController.js` contains a full `INQUIRY_STATUS_ALIASES` map that normalizes every legacy/misspelled status (`Order Recieved`, `Inq. Lost`, `Quotation Submit`, etc.) into 9 canonical statuses before counting. `frontend/src/components/common/StatusBadge.jsx` has an equivalent alias-to-label map. **The dashboard miscounting and follow-up-exclusion bugs described in earlier reports are not reproducible in the current code** — they were either already fixed or were based on a stale snapshot. See §12.3 below for the corrected framing. |
| Ticket roles | Earlier reports flagged `engineer` / `technical_communication` role references in ticket logic. **Neither string appears anywhere in the current backend or frontend source.** This issue no longer applies. |
| Kickoff WhatsApp result-shape mismatch | Earlier reports flagged `kickoffWorkflowService.normaliseNotificationResult()` expecting `success`/`queued`/`skipped` while `whatsappService` returns `ok`/`status`. **Confirmed fixed** — `normaliseNotificationResult()` in the current source explicitly handles both `result.ok` and `result.status`. |
| Timesheet Admin sidebar visibility | Earlier reports flagged the sidebar showing "Timesheet Admin" to `admin` only while the backend allows `admin/hod/team_lead(/manager)`. **Confirmed fixed** — the current `Sidebar.jsx` computes `canAccessTimesheetAdmin = isAdmin || isHod || isTeamLead || role === 'manager'`, matching the backend's `authorizeHierarchy('team_lead')` gate. |
| Hardcoded departments in `Ticket.js` | Earlier reports claimed `Ticket.js` still hardcodes department values. **Not true of the current model** — `Ticket.department` is a free-text string field (max 80 chars) populated from Department Master options on the frontend, not a hardcoded enum. Hardcoded department names do still exist in `config/projectPlanningTemplates.js` (project planning templates), which remains a valid, narrower version of this finding — see §12.2. |
| Project → Timesheet sync is now two-way | A **new** service, `backend/services/timesheetProjectReverseSyncService.js`, pushes Timesheet task status changes (`In Progress`, `Completed`) back onto the linked Project planning task. This did not exist in any prior report and is documented in §8.2. |
| Kickoff final BoM upload | `kickoffWorkflowRoutes.js` now attaches a `kickoffFinalBomUpload` multer middleware to the schedule route, allowing a final technical BoM document to be attached at kickoff-scheduling time. New since prior reports. |
| Notification coverage precisely measured | Direct search confirms `createNotification` (`services/notificationService.js`) is called **only** from `inquiryController.js`. Ticket, Timesheet, Project, Customer, Department, User, Dashboard, and Integration controllers make **zero** calls to it. The `workflow_error` notification type in the `Notification` model enum is unused anywhere. A second, unused, duplicate implementation exists at `backend/utils/createNotification.js`. |
| Frontend layout componentization | `PageHeader.jsx` / `StickyActionBar.jsx` (shared components) are adopted in detail/form pages (Ticket, Project, Customer, Inquiry) but **not yet** in the five list pages (Inquiries, Projects, Customers, Tickets, Timesheet views), which still carry their own inline header/toolbar markup. |
| `authMiddleware.js` 500-vs-403 bug | Confirmed still present, and confirmed to be isolated to `authMiddleware.js`'s `authorize()`/`authorizeHierarchy()`. The separate `permissionMiddleware.js` has its own `createError(message, statusCode = 403)` with a correct default, so `requireRoles`/`scopeToHierarchy` denials already return proper 403s. |
| Ticket Void permission mismatch | Confirmed still present: backend `canVoidTicket` allows `admin, hod, manager, team_lead`; frontend `ticketPermissions.js` restricts the Void button to `admin, hod` only. |
| `/api/test-whatsapp` | Confirmed still public/unauthenticated. |
| Project-timesheet backfill service | Confirmed still unwired — `projectTimesheetBackfillService.js` is not required by any controller, route, or `server.js`. |

---

# 1. Project Structure Analysis

## 1.1 Backend structure

```text
backend/
├── config/          db.js, projectPlanningTemplates.js
├── controllers/      16 files (2 are unused "_old" backups)
├── middleware/         authMiddleware.js, errorMiddleware.js, permissionMiddleware.js
├── models/               15 files
├── routes/                14 files
├── scripts/                 backfillCustomerRefs.js, removeAlternateNumberFromCustomers.js, migrations/001_add_team_hierarchy.js
├── seed/                      seedData.js, seedTask.js
├── services/                    12 files
├── uploads/                       runtime artifact (inquiry/, projects/, tickets/, users/)
├── .wwebjs_auth/, .wwebjs_cache/     runtime WhatsApp session artifacts
├── .env                                runtime/secrets artifact
├── package.json, package_old.json
└── server.js
```

Runtime boot sequence, verified directly against the current `server.js`:

1. `dotenv.config()` loads environment variables.
2. `connectDB()` connects MongoDB; `.then()` chains `seedDefaultDepartments()`.
3. `initWhatsApp()` boots the WhatsApp client (non-blocking; failures are logged only).
4. `initKickoffWorkflowScheduler()` starts the kickoff due-date scheduler.
5. Express app created; `cors()`, `express.json()`, `express.urlencoded({ extended: true })` applied.
6. `morgan('dev')` applied only when `NODE_ENV === 'development'`.
7. `/uploads` served statically (registered before API routes).
8. API routers mounted.
9. `/api/health` health check.
10. `errorMiddleware` mounted last.
11. `app.listen(PORT || 5000)`.

Mounted API prefixes (exact, from `server.js`):

```text
/uploads   (static file serving)
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

Note: `/api/integrations` is mounted in the current `server.js` — earlier reports omitted it from the prefix list. It exists and is fully functional (§16 in the earlier report structure, §4.10 / §7 here).

Minor code-hygiene note in `server.js`: `ticketRoutes` is `require`'d once at the top of the file into an unused local binding, then mounted via a *second*, separate `require('./routes/ticketRoutes')` call right below a commented-out mount line. Both requires resolve to the same singleton Express router so this has no runtime effect, but it's leftover clutter from an edit.

## 1.2 Frontend structure

```text
frontend/src/
├── api/            axios.js, departmentService.js, projectService.js, ticketService.js, timesheetService.js
├── assets/
├── components/
│   ├── activity/     ActivityGraph.jsx, ProjectActivityLogHistory.jsx
│   ├── common/          PageHeader.jsx, StickyActionBar.jsx, Sidebar.jsx, Topbar.jsx, Table.jsx, Modal.jsx,
│   │                     Avatar.jsx, Spinner.jsx, StatusBadge.jsx, FormComponents.jsx, FormComponents.extended.jsx,
│   │                     FormComponents.extended_old.jsx (unused), MainLayout.jsx (unused duplicate — see §10.2)
│   ├── customer/          CustomerForm.jsx
│   ├── department/         DepartmentForm.jsx
│   ├── inquiry/              InquiryForm.jsx, forms/ (Common/Plc/Vfd/Mcc InquirySections.jsx + 1 unused "_old"),
│   │                          tables/ (ComponentRequirementTable.jsx, InquiryLoadTable.jsx)
│   ├── project/                ProjectForm.jsx, ProjectPlanningGrid.jsx, ProjectDocumentAttachments.jsx
│   ├── ticket/                   TicketForm.jsx, ticketPermissions.js
│   └── timesheet/                  KanbanBoard.jsx, KanbanColumn.jsx, SortableTaskCard.jsx, TimesheetListView.jsx,
│                                    TimesheetKanbanView.jsx, TimesheetCalendarView.jsx, TimesheetForm.jsx,
│                                    EmployeeWorkloadTable.jsx, TimesheetWidgets.jsx, timesheetPermissions.js
├── context/          AuthContext.jsx, ToastContext.jsx
├── data/               masterData.js, inquiryMasterData.js (+ 1 unused "_old"), projectPlanningTemplates.js
├── layouts/              MainLayout.jsx  (the one actually routed — see §10.2)
├── pages/                  22 files (3 unrouted: TicketViewPage.jsx, TimesheetCalendarPage.jsx, plus 2 "_old"/"_ol" backups)
├── routes/                   ProtectedRoute.jsx
├── utils/                      calendarEventMapper.js, customerUtils.js, departmentUtils.js, inquiryValidation.js
└── App.jsx
```

Vite dev-server proxy configuration confirmed in `vite.config.js`:

```text
/api      -> http://localhost:5000
/uploads  -> http://localhost:5000   (added specifically so dev-mode attachment downloads don't 404)
```

Frontend dependencies confirmed in `package.json`: React 18, React Router 6, Axios, Recharts, Day.js, Lucide icons, `@dnd-kit/core`+`sortable`+`utilities` (Kanban drag-and-drop), `react-big-calendar`, `@fullcalendar/*` (daygrid/interaction/react/timegrid — present in dependencies; confirm which calendar library `TimesheetCalendarView.jsx` actually imports before assuming both are live), Tailwind 3, Vite 5.

---

# 2. Module Inventory

## 2.1 Active backend modules

| Module | Backend files | Purpose |
|---|---|---|
| Authentication | `authRoutes.js`, `authController.js`, `authMiddleware.js`, `User.js` | Login, profile, avatar, password change, JWT auth |
| Users | `userRoutes.js`, `userController.js`, `User.js` | Admin user management, hierarchy-scoped assignable users |
| Teams | `teamRoutes.js`, `teamController.js`, `Team.js` | HOD/team lead/member hierarchy (join table for department-independent team grouping) |
| Departments | `departmentRoutes.js`, `departmentController.js`, `Department.js`, `departmentSeedService.js` | Department Master, seeded on boot |
| Customers | `customerRoutes.js`, `customerController.js`, `Customer.js`, `customerUniversal.js` | Customer master + cross-module normalization |
| Inquiries | `inquiryRoutes.js`, `inquiryController.js`, `Inquiry.js` | Inquiry creation/editing/attachments/follow-ups, the only module wired to notifications |
| Projects | `projectRoutes.js`, `projectController.js`, `Project.js`, `ProjectActivityLog.js` | Project management, planning grids/tasks, activity logs |
| Kickoff Workflow | `kickoffWorkflowRoutes.js`, `kickoffWorkflowController.js`, `KickoffWorkflow.js`, `kickoffWorkflowService.js`, `kickoffWorkflowScheduler.js` | Order Won → kickoff → project creation |
| Notifications | `notificationRoutes.js`, `notificationController.js`, `Notification.js`, `notificationService.js` | Internal notification records + optional email side effect (Inquiry-only in practice) |
| Email | `emailSettingsService.js`, `outlookService.js`, `notificationTemplates.js` | SMTP settings resolution, email sending, HTML email templating |
| WhatsApp | `whatsappService.js`, `testWhatsappRoute.js` | Outbound messaging + inbound project-task command parsing |
| Timesheet | `timesheetRoutes.js`, `timesheetController.js`, `TimesheetTask.js`, `projectTimesheetSyncService.js`, `timesheetProjectReverseSyncService.js` | User/project tasks, Kanban/list/calendar/admin views, two-way project sync |
| Tickets | `ticketRoutes.js`, `ticketController.js`, `Ticket.js`, `TicketActivity.js`, `TicketComment.js` | Support/repair ticket workflow, no notifications wired |
| Dashboard | `dashboardRoutes.js`, `dashboardController.js` | Stats, charts, recent activity, status-alias normalization |
| Integration Settings | `integrationRoutes.js`, `integrationController.js`, `IntegrationSettings.js` | Admin email/WhatsApp integration settings |

## 2.2 Active frontend modules

| Module | Frontend files |
|---|---|
| Login | `LoginPage.jsx` |
| Dashboard | `DashboardPage.jsx` |
| Inquiries | `InquiriesPage.jsx`, `ElectricalPanelInquiryPage.jsx`, `components/inquiry/*` |
| Projects | `ProjectsPage.jsx`, `ProjectDetailPage.jsx`, `ProjectActivityPage.jsx`, `ProjectDocumentPreviewPage.jsx`, `components/project/*` |
| Customers | `CustomersPage.jsx`, `CustomerDetailPage.jsx`, `components/customer/CustomerForm.jsx` |
| Tickets | `TicketsPage.jsx`, `TicketFormPage.jsx`, `components/ticket/*` |
| Notifications | `NotificationsPage.jsx` |
| Users | `UsersPage.jsx` |
| Department Master | `DepartmentPage.jsx`, `components/department/DepartmentForm.jsx`, `api/departmentService.js` |
| Timesheet | `TimesheetPage.jsx` (shell), `TimesheetAdminPage.jsx`, `components/timesheet/*` |
| Integration Settings | `IntegrationSettingsPage.jsx` (calls API directly via `api/axios.js`; no dedicated service file) |
| Layout/Auth | `layouts/MainLayout.jsx`, `components/common/Sidebar.jsx`, `Topbar.jsx`, `routes/ProtectedRoute.jsx`, `context/AuthContext.jsx` |
| Shared layout primitives | `components/common/PageHeader.jsx`, `StickyActionBar.jsx` — partially adopted, see §0.1 |

---

# 3. Database Model Analysis

## 3.1 `User`

`backend/models/User.js`.

Roles: `admin, hod, team_lead, employee, manager`. Role order (high→low): `admin > hod > manager > team_lead > employee`.

Fields: `name`, `email` (unique, lowercased), `password` (bcrypt-hashed, `select:false`, min 8 chars), `phone`, `avatar`, `role`, `department` (`Mixed` — legacy string or Department ObjectId), `hodDepartments` (`Mixed[]`), `teamId` (ref `Team`), `reportsTo` (ref `User`), `isActive`, `passwordResetToken`/`passwordResetExpires`.

Instance methods: `comparePassword`, `hasRole(...roles)`, `outranks(targetRole)`. Static: `findByTeam(teamId)`.

There is no hardcoded department-name enum on `User.js` in the current source — the `USER_DEPARTMENTS` legacy constant referenced in an earlier report does not exist in this ZIP.

## 3.2 `Department`

`backend/models/Department.js`. Fields: `name`, `code` (both uppercased, unique), `hod` (backward-compatible single reference), `hods[]` (current multi-HOD array), `teamLead`, `isActive`, `createdBy`.

Seed defaults, confirmed verbatim from `departmentSeedService.js`:

```text
ADMIN (ADM)
SALES (SAL)
ESTIMATION (EST)
DESIGN (DES)
AUTOMATION (AUT)
PRODUCTION (PRO)
PURCHASE (PUR)
STORE (STO)
QC (QC)
```

Seeding uses `findOneAndUpdate(..., { upsert: true, setDefaultsOnInsert: true })` matched on `code` OR `name`, so it's safe to run on every boot without creating duplicates.

## 3.3 `Team`

`backend/models/Team.js`. Represents the Admin → HOD → Team Lead → Employee hierarchy as a join table: `hod` (single User ref), `teamLead` (single User ref), `members[]` (User refs), plus `name`, `description`, `isActive`, `createdBy`, `updatedBy`. One employee belongs to exactly one team by application-layer convention (enforced in `teamController.js`, backed by a sparse unique index on `User.teamId`). Heavily used by Timesheet and assignable-user scoping via `attachTeamContext`/`scopeToHierarchy` in `permissionMiddleware.js`.

## 3.4 `Customer`

`backend/models/Customer.js`. Fields: `customerId` (auto-generated via shared `Counter` model), `customerName` (current primary field), `companyName` (legacy-compatible), `companyType`, `contacts[]`, `contactPerson` (legacy), `email`, `mobileNumber`, `city`, `address`, `gstNumber`, `totalProjects`, `notes`, `isActive`. `customerUniversal.js` centers on `customerName` as canonical and clears legacy `companyName` during sync where applicable.

## 3.5 `Inquiry`

`backend/models/Inquiry.js` (729 lines). Large model covering customer/company/contact details, site/location, project/application details, inquiry type, panel/product details, type-specific detail blocks (PLC/VFD/MCC), component requirement rows, load rows, attachments, follow-up fields, an embedded `kickoffMeeting` sub-document, and project-conversion linkage.

Inquiry types: `PLC_AUTOMATION`, `VFD_PANEL`, `MCC_PANEL`, `MCC_CUM_PLC`, `LEGACY`.

Main `status` enum, verified directly from the schema (current file):

```text
New, Technical Evaluation, Technical BoM Submitted, BoM Approval Pending, Revision,
Commercial BOM Submission, Order Won, Order Lost, Inquiry Hold,
In Progress, Commercial Discussion, Commercial Submit, Technical Submit,
Technical BOM Submission, Technical BoM Submission, BoM Submitted, Technical BOM Submitted,
Technical BoM Submitted, BOM Submitted, Bom Submitted, BOM SUBMITTED,
Technical BOM Approval, Technical BoM Approval, Order Received, Order Recieved,
Inquiry Lost, Inq. Lost, Quotation Submit
```

The first 9 values are the canonical/current statuses; the remainder are legacy spellings/aliases kept so old records still validate on save. `'Project Won'` is **not** in this enum — one earlier report claimed it was; that claim does not match the current schema.

The embedded `kickoffMeeting` sub-schema has its own, separate status enum: `Not Scheduled, Scheduled, Ready For Completion, Completed, Project Created, Failed, Cancelled`.

PLC-specific fields confirmed present (an earlier report had flagged these as missing from the backend — they are present in the current schema): `plcDetails.switchgearMake`, `.customSwitchgearMake`, `.programmingDevelopmentScope`, `.automationRequirements`, `.supportRequirements.onsiteSupportRequired/.onsiteSupportDays`, `.supportRequirements.commissioningSupportRequired/.commissioningSupportDays`, `.ioDetails.*`.

**Inquiry ID generation** — verified directly against `models/Counter.js` and the pre-save hook in `Inquiry.js`:

```js
// Counter.js
seq: { type: Number, default: 1349 }

// Inquiry.js pre-save
const counter = await Counter.findOneAndUpdate(
  { id: 'inquiryId' },
  { $inc: { seq: 1 } },
  { upsert: true, new: true }
);
this.inquiryId = `INQ-${counter.seq + 1349}`;
```

Note the double-offset: the `Counter` document's `seq` field *itself* defaults to 1349, and the inquiry-numbering formula then adds another literal `1349` on top of the current `seq` value. On the very first inquiry ever created, this produces `INQ-2699` rather than something closer to `INQ-1350`. This looks unintentional (a leftover from an earlier numbering scheme change) but it is deterministic and won't cause collisions — flagged here as a naming-offset oddity rather than a functional bug.

## 3.6 `Project`

`backend/models/Project.js` (370 lines). `projectId` auto-generated as `NAPL-####` via a dedicated `NaplCounter` model with its own starting `seq: 199` (so the first project is `NAPL-0200`). Panel types: `PLC, MCC, VFD, PLC_MCC`.

Fields include `inquiryReference`/`sourceInquirySnapshot`, `customerRef`, `customerName`, `companyName`, `projectName`, `projectType`, `panelType`, `quantity`, `orderValue`, `orderDate`, `expectedDeliveryDate`, `projectEndDate`, `projectStatus`, `completionPercentage`, `assignedTeamMembers`, `assignedTo`, `delayedDays`/`delayedEndDate` (computed delay tracking), `kickoffMeeting`, and the dual planning representation:

- `planningTasks[]` — flattened legacy copy, retained "so existing reports, charts, reminders, and integrations keep working" (per the model's own inline comment).
- `planningGrids[]` — current structured grid-of-tasks representation, each grid containing its own `planningTasks[]`.

Both sync services (§8) extract from `planningGrids` first and fall back to `planningTasks`.

## 3.7 `TimesheetTask`

`backend/models/TimesheetTask.js` (404 lines).

```text
TASK_STATUSES   = Backlog, Planned, In Progress, Review, Completed
TASK_TYPES      = Development, Design, Meeting, Review, Testing, Documentation, Support, Other
TASK_SOURCES    = USER, PROJECT
SYNC_STATUSES   = SYNCED, PENDING, FAILED
ARCHIVE_REASONS = PROJECT_TASK_REMOVED, PROJECT_TASK_UNASSIGNED, PROJECT_DELETED, MANUAL_ARCHIVE
```

`taskSource` distinguishes user-created tasks from project-linked ones; project-linked tasks get extra structural protection via `canModifyProjectLinkedTaskStructure()`.

## 3.8 `Ticket`

`backend/models/Ticket.js` (553 lines).

```text
TICKET_TYPES          = N/A, Support, Repairing & Replacement
TICKET_STATUSES        = New, Assigned, Working, Customer Side Pending, Closed, Void
TICKET_PRIORITIES       = Low, Medium, High, Critical
SUPPORT_TYPES             = Free, Paid, Warranty, Comprehensive AMC, Non Comprehensive AMC, Other
PRODUCT_TYPES               = N/A, HMI, PLC, Servo, VFD, SCADA, Industrial PC, Other
RR_SOLUTION_STATUSES          = N/A, Repair Done, Replacement Done, Vendor Return, Scrap, Awaiting Approval, Awaiting Material
REPAIR_STATUSES                 = N/A, Pending, In Progress, Under Inspection, Repair Done, Replacement Done,
                                   Ready for Dispatch, Dispatched, Vendor Return, Scrap
```

`source` enum: `Call, Mail, WhatsApp, Internal, Other` (required). `brand` and `panelFamily` are two separate free-text fields on the product sub-schema (not combined), consistent with the Ticket Module Phase 2 architecture decisions. `department` is free text (max 80 chars), sourced from Department Master on the frontend — not a hardcoded enum in this model.

## 3.9 `Notification`

`backend/models/Notification.js`. `type` enum: `follow_up, overdue, project_delay, order_confirmed, kickoff_scheduled, project_created, workflow_error, info, status, warning`. `priority`: `High/Medium/Low`. Refs `recipient` (User), `relatedInquiry`, `relatedProject`. `workflow_error` is unused anywhere in the current codebase (confirmed by search).

## 3.10 `KickoffWorkflow`

`backend/models/KickoffWorkflow.js`. Tracks scheduling state, attendees, notification logs, and the Inquiry → Project linkage. Consumed by `kickoffWorkflowController.js` / `kickoffWorkflowService.js`.

## 3.11 `ProjectActivityLog`

`backend/models/ProjectActivityLog.js`. Append-only per-project activity log. `actionType` enum covers project-level events (`created, updated, deleted, status_changed, assignee_changed, end_date_changed, start_date_changed, delay_updated, completed`) and task-level events (`task_created, task_added, task_updated, task_deleted, task_assigned, task_status_changed, task_completed`), plus `commented`, `whatsapp_sent`, `whatsapp_failed`. Carries optional task-context fields (`taskId`, `taskTitle`, `taskStatus`, `gridId`, `gridName`, `assignedUserId/Name`, `activityDate`) used to drive the Activity Timeline and a "tasks vs. days" graph on the frontend (`ProjectActivityLogHistory.jsx`, `ActivityGraph.jsx`).

## 3.12 `TicketActivity` / `TicketComment`

`backend/models/TicketActivity.js` — append-only ticket audit log. `actionType` enum: `created, updated, assigned, reassigned, status_changed, priority_changed, department_changed, started_work, customer_pending, closed, reopened, voided, comment_created, comment_updated, comment_deleted, attachment_uploaded, attachment_deleted`.

`backend/models/TicketComment.js` — discussion thread per ticket: `ticket`/`ticketId` refs, `author` (required), `authorName`, `authorRole` (denormalized snapshot fields), `content`.

## 3.13 `IntegrationSettings`

`backend/models/IntegrationSettings.js`. Singleton document (`singletonKey: 'default'`, unique + immutable). `email.*`: `isEnabled`, `provider` (default `outlook`), `host` (default `smtp.office365.com`), `port` (default 587), `secure`, `username`, `fromEmail`, `passwordEncrypted` (`select:false`), `lastVerifiedAt`, `lastVerificationStatus` (`Pending/Success/Failed`), `lastVerificationError`. `updatedBy` refs `User`.

---

# 4. API Route Analysis

## 4.1 Auth — `/api/auth`

| Method | Path | Protection |
|---|---|---|
| POST | `/login` | Public |
| GET | `/me` | Auth |
| PUT | `/profile` | Auth |
| POST | `/profile/avatar` | Auth + upload |
| PUT | `/change-password` | Auth |

## 4.2 Users — `/api/users`

| Method | Path | Protection |
|---|---|---|
| GET | `/assignable` | Auth + team context + hierarchy scope (declared before the admin gate) |
| GET, POST | `/` | Admin |
| POST | `/:id/avatar` | Admin + upload |
| GET, PUT, DELETE | `/:id` | Admin |

## 4.3 Departments — `/api/departments`

| Method | Path | Protection |
|---|---|---|
| GET | `/` | Auth (admin can include inactive via query) |
| POST | `/` | Admin |
| GET | `/:id` | Auth |
| PUT, DELETE | `/:id` | Admin |

## 4.4 Customers — `/api/customers`

| Method | Path | Protection |
|---|---|---|
| GET, POST | `/` | Auth |
| GET, PUT | `/:id` | Auth |
| DELETE | `/:id` | Admin |

## 4.5 Inquiries — `/api/inquiries`

| Method | Path | Protection |
|---|---|---|
| GET | `/follow-ups` | Auth |
| GET, POST | `/` | Auth (POST + upload, field `attachments`) |
| PATCH | `/:id/status` | Auth + upload |
| GET, PUT | `/:id` | Auth (PUT + upload) |
| DELETE | `/:id` | Admin |

## 4.6 Projects — `/api/projects`

| Method | Path | Protection |
|---|---|---|
| POST | `/convert/:inquiryId` | Auth |
| POST | `/recalc-delays` | Auth |
| GET | `/planning-templates` | Auth |
| GET, POST | `/` | Auth |
| POST | `/:id/copy` | Auth |
| POST | `/:id/documents` | Auth + upload (max 10) |
| DELETE | `/:id/documents/:documentId` | Auth |
| GET, PUT | `/:id` | Auth |
| DELETE | `/:id` | Admin |
| GET | `/:id/activity` | Auth |
| GET | `/:id/task-completion-history` | Auth |

## 4.7 Kickoff Workflow — `/api/kickoff-workflows`

| Method | Path | Protection |
|---|---|---|
| POST | `/:inquiryId/schedule` | Auth + `kickoffFinalBomUpload` upload |
| POST | `/:inquiryId/complete` | Auth |
| GET | `/:inquiryId` | Auth |
| POST | `/process/due` | Admin |

## 4.8 Notifications — `/api/notifications`

| Method | Path | Protection |
|---|---|---|
| GET | `/` | Auth |
| PUT | `/read-all`, `/:id/read` | Auth |
| DELETE | `/:id` | Auth |

## 4.9 Dashboard — `/api/dashboard`

| Method | Path | Protection |
|---|---|---|
| GET | `/stats`, `/recent` | Auth |

## 4.10 Integration Settings — `/api/integrations`

All routes require `protect` + inline `requireAdmin`.

| Method | Path |
|---|---|
| GET | `/status`, `/email`, `/whatsapp/status` |
| PUT | `/email` |
| POST | `/email/verify`, `/whatsapp/restart`, `/whatsapp/logout` |

## 4.11 Timesheet — `/api/timesheet`

All routes run `protect` → `attachTeamContext`.

| Method | Path | Extra middleware |
|---|---|---|
| GET | `/list`, `/kanban`, `/calendar` | `scopeToHierarchy()` |
| GET, POST | `/tasks` | `scopeToHierarchy()` |
| GET | `/tasks/:id` | — |
| PUT, DELETE | `/tasks/:id` | `scopeToHierarchy()` |
| PATCH | `/tasks/:id/status`, `/tasks/:id/kanban` | `scopeToHierarchy()` |
| PATCH | `/tasks/:id/archive`, `/tasks/:id/restore` | `scopeToHierarchy()` (admin/HOD enforced in controller) |
| DELETE | `/tasks/:id/archived` | `scopeToHierarchy()` |
| GET | `/admin/all`, `/admin/summary`, `/admin/workload`, `/admin/daily-breakdown` | `authorizeHierarchy('team_lead')` + `scopeToHierarchy()` |

## 4.12 Teams — `/api/teams`

| Method | Path | Protection |
|---|---|---|
| GET | `/` | Auth |
| POST | `/` | `requireRoles('admin')` |
| GET | `/:id` | Auth |
| PUT, DELETE | `/:id` | `requireRoles('admin')` |
| PATCH | `/:id/hod` | `requireRoles('admin')` |
| PATCH | `/:id/team-lead` | `requireRoles('admin','hod')` |
| GET | `/:id/members` | Auth |
| POST | `/:id/members` | `requireRoles('admin','hod','team_lead')` |
| DELETE | `/:id/members/:userId` | `requireRoles('admin','hod','team_lead')` |

## 4.13 Tickets — `/api/tickets`

| Method | Path |
|---|---|
| PUT, DELETE | `/comments/:commentId` (registered before `/:id` to avoid route clash) |
| GET, POST | `/` |
| GET, PUT | `/:id` |
| PATCH | `/:id/assign`, `/:id/start-work`, `/:id/customer-pending`, `/:id/close`, `/:id/reopen`, `/:id/void` |
| GET, POST | `/:id/comments` |
| POST | `/:id/attachments` |
| DELETE | `/:id/attachments/:attachmentId` |
| GET | `/:id/activity` |

All ticket routes require only `protect`; role/assignment checks are enforced inside `ticketController.js`.

## 4.14 WhatsApp diagnostic route — `/api/test-whatsapp`

| Method | Path | Protection |
|---|---|---|
| GET | `/` | **None** — confirmed still public |

---

# 5. Frontend Page Analysis

## 5.1 Active routes in `frontend/src/App.jsx`

| Route | Component | Access |
|---|---|---|
| `/auth/login` | `LoginPage` | Public |
| `/` | `DashboardPage` | Protected |
| `/inquiries`, `/inquiries/new`, `/inquiries/:id`, `/inquiries/:id/edit` | `InquiriesPage` / `ElectricalPanelInquiryPage` | Protected |
| `/projects`, `/projects/new`, `/projects/:id`, `/projects/:id/edit` | `ProjectsPage` / `ProjectDetailPage` | Protected |
| `/projects/:id/activity` | `ProjectActivityPage` | Protected |
| `/projects/:id/documents/preview` | `ProjectDocumentPreviewPage` | Protected |
| `/customers`, `/customers/:id` | `CustomersPage` / `CustomerDetailPage` | Protected |
| `/tickets`, `/tickets/new`, `/tickets/:id`, `/tickets/:id/edit` | `TicketsPage` / `TicketFormPage` | Protected |
| `/notifications` | `NotificationsPage` | Protected |
| `/timesheet` (index → redirect to `kanban`), `/timesheet/list`, `/timesheet/kanban`, `/timesheet/calendar` | Lazy-loaded Timesheet views | Protected |
| `/timesheet/admin` | `TimesheetAdminPage` | Protected (child route; not role-gated at router level — gating is via Sidebar visibility + backend authorization) |
| `/users` | `UsersPage` | Protected + `roles={['admin']}` |
| `/masters/departments` | `DepartmentPage` | Protected + `roles={['admin']}` |
| `/masters/integrations` | `IntegrationSettingsPage` | Protected + `roles={['admin']}` |
| `/404`, `*` | `NotFoundPage` | Public |

Unrouted pages on disk: `TicketViewPage.jsx`, `TimesheetCalendarPage.jsx`, `InquiriesPage_old.jsx`, `ProjectsPage_ol.jsx`.

## 5.2 Sidebar navigation

Main items (all authenticated users): `Dashboard, Inquiries, Projects, Customers, Tickets, Timesheet`.

Master section (`getMasterItems()`): `Timesheet` (admin view) shown to `admin || hod || team_lead || role === 'manager'`; `User Management`, `Department`, `Integration Settings` shown to `admin` only. This now matches the backend's timesheet elevated-route gate (`authorizeHierarchy('team_lead')`) — the mismatch flagged in earlier reports is resolved.

## 5.3 Frontend API layer

`frontend/src/api/axios.js` is the shared Axios instance (base URL, auth header injection). Dedicated service wrapper files exist only for `departmentService.js`, `projectService.js`, `ticketService.js`, `timesheetService.js`. Inquiries, Customers, Users, Dashboard, and Integration Settings all call the shared Axios instance directly from their page components rather than through a dedicated service file — this is an intentional inconsistency in the codebase's API-layer pattern, not a bug, but worth knowing before assuming every module has a service file.

---

# 6. Authentication & Permissions Analysis

## 6.1 JWT authentication

`protect` (in `authMiddleware.js`) reads the JWT from the `Authorization: Bearer` header or a `token` cookie, verifies it with `JWT_SECRET`, and hydrates `req.user` from a fresh DB lookup (`name, email, phone, role, department, hodDepartments, teamId, reportsTo, isActive, avatar`), excluding the password. Rejects with 401 on missing/invalid/expired token, inactive account, or deleted user.

## 6.2 Backend role checks — two parallel systems

`authMiddleware.js` exports `authorize(...roles)` (exact allowlist with `'manager'`-expands-to-`hod`+`team_lead` backward-compat) and `authorizeHierarchy(minimumRole)` (allows anything at or above `minimumRole` in `ROLE_ORDER`).

`permissionMiddleware.js` exports a separate, more granular system: `requireRoles`, `attachTeamContext`, `scopeToHierarchy()`, plus task-level helpers `canEditTask`/`canReadTask` and timesheet-archive helpers.

**Confirmed still-active issue:** `authMiddleware.js`'s local `createError(message, statusCode)` has no default `statusCode`, and both `authorize()` and `authorizeHierarchy()` call it with only a message on the denial path. `err.statusCode` ends up `undefined`, and `errorMiddleware.js`'s `err.statusCode || 500` fallback returns HTTP 500 for what should be a 403. This affects every route gated by `authorize()`/`authorizeHierarchy()` (Auth/Customer/Department/Inquiry/Project/User/Kickoff routes and the Timesheet elevated routes). `permissionMiddleware.js`'s own `createError(message, statusCode = 403)` defaults correctly, so `requireRoles`/`scopeToHierarchy` denials are unaffected.

## 6.3 Permission middleware details

`attachTeamContext` computes `req.teamContext.memberIds` per role (admin sees everything with `memberIds: null`; HOD sees all teams they head plus those teams' leads/members; team lead sees own team; employee sees own team if a member, else self-only). `scopeToHierarchy()` derives `req.allowedEmployeeIds` from that context, with a scope-checked `employeeId` query-param override. `canModifyProjectLinkedTaskStructure(req, task)` restricts structural edits on `taskSource: 'PROJECT'` timesheet tasks to admin/HOD.

## 6.4 Frontend auth behavior

`AuthContext.jsx` derives `isAdmin`, `isHod`, `isManagerRole`, `isTeamLead`, `isEmployee`, a combined `isManager` (any of admin/hod/manager/team_lead), and `isTicketAssignee` (alias for `isEmployee`). No `technical_communication`/`engineer` role references exist anywhere in the current frontend — an earlier report's concern about those does not apply to this codebase.

---

# 7. Notification & WhatsApp Flow Analysis

## 7.1 Internal notification flow

`backend/services/notificationService.js` exports `createNotification({...})` — creates a `Notification` document and optionally sends an Outlook email, all wrapped in try/catch so failures never block the calling controller's primary save.

**Precisely confirmed usage** (not "used by inquiry/project/kickoff/status events" as loosely stated in earlier reports): `createNotification` is called **exclusively from `controllers/inquiryController.js`**. No calls exist in `projectController.js`, `kickoffWorkflowController.js`, `ticketController.js`, `timesheetController.js`, or any other controller. Kickoff Workflow's "notifications" are WhatsApp/email sends via `whatsappService.js` directly — they do not create `Notification` documents and therefore never appear on `NotificationsPage.jsx`.

A second, unused, structurally similar implementation exists at `backend/utils/createNotification.js` — never imported anywhere, confirmed dead code.

## 7.2 Outlook/email flow

`backend/services/outlookService.js` sends email via `emailSettingsService.js`'s active config resolution (database `IntegrationSettings` when enabled + password present, else environment fallback) and `notificationTemplates.js` for HTML templating. The environment variables actually read are `process.env.OUTLOOK_EMAIL` and `process.env.OUTLOOK_PASS` (confirmed by direct inspection of `emailSettingsService.js`) — not `OUTLOOK_PASSWORD`/`OUTLOOK_FROM`/`OUTLOOK_TO` as an earlier report stated. For inquiry creation, attachments are pulled from inquiry upload paths (`buildInquiryAttachments()`).

## 7.3 WhatsApp outbound flow

`backend/services/whatsappService.js`, built on `whatsapp-web.js` with `LocalAuth`, session id `nexus-session`, session persisted at `backend/.wwebjs_auth/session-nexus-session`.

Exports: `initWhatsApp`, `getWhatsAppStatus`, `restartWhatsApp`, `logoutWhatsApp`, `sendWhatsAppNotification`, `sendWhatsAppGroupNotification`, `sendWhatsAppGroupWithAttachments`, `sendTestMessage`. Result shape: `{ ok, status, recipient, error }`; statuses include `Sent, Queued, Skipped, Failed`.

## 7.4 WhatsApp inquiry flow

On inquiry creation: inquiry saved → `createNotification` (in-app + optional email) → customer auto-created/updated → WhatsApp notify-number message → WhatsApp group message (with attachments where applicable) → response returned.

On inquiry update: `createNotification` runs again (status-change variant included where relevant); WhatsApp group sending is **not** part of the normal update flow.

## 7.5 Kickoff notification flow

When kickoff is scheduled: workflow created/updated → inquiry status/kickoff-state updated → WhatsApp group notification attempted → WhatsApp configured-notify-number notification attempted → customer WhatsApp notification attempted (if phone exists) → attendee WhatsApp notifications attempted → Outlook emails attempted for customer/attendees → notification logs written to the workflow document.

**Confirmed fixed since earlier reports:** `kickoffWorkflowService.normaliseNotificationResult()` explicitly handles both `result.ok` and `result.status` fields from `whatsappService`'s actual return shape. The earlier "WhatsApp sends but gets logged as failed" mismatch does not reproduce in the current source.

## 7.6 WhatsApp inbound project-task command flow

Supported formats:

```text
NEXUS | NAPL-0209 | GA Approval | Completed | Sent to client
PROJECT | NAPL-0209 | GA Approval | Completed | Sent to client
```

or multiline:

```text
PROJECT: NAPL-0209
TASK: GA Approval
STATUS: Completed
REMARK: Sent to client
```

Inbound logic: ignore non-command messages → de-duplicate message IDs → validate allowed group (if configured) → resolve sender phone to an active `User` → parse project/task/status/remark → update the matching project planning task → log activity → send a WhatsApp reply.

## 7.7 Public diagnostic route risk

`GET /api/test-whatsapp` remains mounted with no `protect` middleware, confirmed in both `server.js` and `testWhatsappRoute.js`. Anyone who can reach the backend can trigger a real outbound WhatsApp send.

---

# 8. Project ↔ Timesheet Sync Flow Analysis

## 8.1 Forward sync — Project → Timesheet

Service: `backend/services/projectTimesheetSyncService.js`. Controller integration: `projectController.js`, via error-swallowing wrappers `runProjectTimesheetSyncSafe()` / `archiveProjectTimesheetTasksSafe()` so a sync failure never fails project create/update/delete.

| Project action | Sync action |
|---|---|
| Create project | Sync assigned planning tasks |
| Copy project | Sync copied project's planning tasks |
| Update project | Sync changed/newly-assigned planning tasks |
| Delete project | Archive all linked timesheet tasks |

**Source task extraction:** `planningGrids` first, fallback to flat `planningTasks`. For each task the service builds source metadata (project id, grid id/name, task id/name, department, planned start/end dates, assigned user, task status).

**Assignment conversion:** accepts multiple assigned-user shapes (`assignedTo` as a plain ObjectId, or a nested object with `_id`/`id`) and normalizes to ObjectId; unassigned tasks are skipped or their existing linked timesheet task is archived.

**Source key generation:** each project task gets a deterministic `sourceTaskKey` conceptually `PROJECT:<project>:GRID:<grid>:TASK:<task>`, used with a unique partial index on `TimesheetTask` to prevent duplicate synced records.

**Create/update behavior:** a `TimesheetTask` (`taskSource: PROJECT`) is created if no matching source key exists, or updated in place if task data changed. `syncStatus` is one of `SYNCED, PENDING, FAILED`.

**Archive behavior:**

| Trigger | Archive reason |
|---|---|
| Project planning task removed | `PROJECT_TASK_REMOVED` |
| Project planning task becomes unassigned | `PROJECT_TASK_UNASSIGNED` |
| Project deleted | `PROJECT_DELETED` |

**Project task status → Timesheet status mapping**, confirmed directly from `PROJECT_TO_TIMESHEET_STATUS` in `projectTimesheetSyncService.js`:

| Project task status | Timesheet status |
|---|---|
| Pending | Planned |
| Not Started | Planned |
| Hold | Planned |
| Delayed | In Progress |
| (default, if status not in the map) | Planned |

(In Progress and Completed also map through directly where the project task status string matches a `TimesheetTask` status verbatim.)

## 8.2 Reverse sync — Timesheet → Project (new)

Service: `backend/services/timesheetProjectReverseSyncService.js`, invoked from `timesheetController.js`. This did **not** exist in any prior understanding report.

Keeps the linked Project planning task's status aligned when a user changes a project-linked (`taskSource: 'PROJECT'`) Timesheet task's status. Mapping (`TIMESHEET_TO_PROJECT_STATUS`):

```text
In Progress → In Progress
Completed   → Completed
```

Internally reuses `extractProjectPlanningTasks()` from the forward-sync service to locate the matching planning task inside `Project.planningGrids`/`planningTasks` before writing the status back — so both directions of sync share the same task-location logic, but the dual `planningGrids`/`planningTasks` representation risk (§12.4) still applies to writes going in either direction.

## 8.3 Backfill service — confirmed unwired

`backend/services/projectTimesheetBackfillService.js` exists and is fully implemented but is not `require`'d by any controller, route, or `server.js` — confirmed by a repository-wide search. Existing project tasks created before the sync services were introduced will not automatically appear in Timesheet unless this service is invoked manually (e.g. a one-off script run) outside the normal request/boot flow.

## 8.4 Project-linked task protection

`permissionMiddleware.js` differentiates user-created vs. project-linked tasks: for project-linked tasks, an employee can update work/status-oriented fields, but structural task fields are protected via `canModifyProjectLinkedTaskStructure()`, and archive/restore/permanently-delete-archived are limited to admin/HOD scope via `canArchiveTimesheetTask`/`canRestoreTimesheetTask`/`canDeleteArchivedTimesheetTask`.

---

# 9. Inquiry Workflow Analysis

## 9.1 Inquiry creation flow

Frontend: `ElectricalPanelInquiryPage.jsx`. Backend: `inquiryController.createInquiry`.

1. User fills the electrical panel inquiry form (PLC/VFD/MCC/MCC+PLC sections rendered conditionally).
2. Form submits a multipart request (JSON body + `attachments` files).
3. Backend parses the JSON payload alongside multer-handled files.
4. Inquiry is validated and created; `inquiryId` generated via the `Counter` model (see §3.5 for the exact — slightly unusual — offset formula).
5. Attachments saved under `backend/uploads/inquiry/`.
6. `createNotification()` runs (in-app + optional Outlook email).
7. Customer is auto-created or updated via `customerUniversal.js`.
8. WhatsApp notify-number message and group message (with attachments where applicable) are sent.
9. Response returns the created inquiry.

## 9.2 Inquiry update flow

Frontend loads the inquiry by id → form submits updated JSON + optional new attachments → backend keeps selected existing attachments and appends new ones → fields updated via an allowlisted payload → `createNotification()` runs (status-change variant included where relevant) → updated inquiry returned. WhatsApp group sending is not part of this path.

## 9.3 Follow-up flow

`GET /api/inquiries/follow-ups` filters by `nextFollowUpDate <= today` and status not in an exclusion list.

**Corrected from earlier reports:** the concern that this exclusion list uses only the misspelled variants (`Order Recieved`, `Inq. Lost`) while the model enum also has the correctly-spelled forms is real at the raw-enum level, but `dashboardController.js`'s `INQUIRY_STATUS_ALIASES`/`normalizeInquiryStatus()` normalization layer (§3.5, §12.3) exists specifically to collapse all spelling variants to one canonical value for counting/filtering purposes elsewhere in the system. Whether `getFollowUps` in `inquiryController.js` itself uses this same normalization or its own separate exclusion list should be checked directly in that function before relying on this report for a fix — this report did not trace that specific function line-by-line in this pass, so treat the follow-up-filter correctness as **unconfirmed** rather than either "broken" or "fixed."

## 9.4 Order Won → Kickoff flow

Frontend: `InquiriesPage.jsx` (or the inquiry detail page) triggers kickoff scheduling. Backend: `kickoffWorkflowController.scheduleKickoffMeeting` → `kickoffWorkflowService`.

1. Inquiry status moves to `Order Won` (the canonical current status — `Order Received` is one of the legacy aliases that normalizes to it, per §3.5).
2. Frontend opens the kickoff scheduling UI.
3. Frontend calls `POST /api/kickoff-workflows/:inquiryId/schedule` (now with optional final-BoM upload).
4. Backend validates the inquiry, scheduled date/time, and attendees.
5. `KickoffWorkflow` document created/updated.
6. Inquiry's embedded `kickoffMeeting.status` becomes `Scheduled`.
7. Notifications (WhatsApp/email) are sent/logged per §7.5.

## 9.5 Due kickoff flow

`kickoffWorkflowScheduler.js` → the due-processing routine finds scheduled workflows whose meeting time has passed, moves workflow status to `Ready For Completion`, and updates the inquiry's kickoff state accordingly. A project is **not** automatically created at this point — completion is a separate, explicit step.

## 9.6 Complete kickoff → Project creation flow

`POST /api/kickoff-workflows/:inquiryId/complete`:

1. User marks the kickoff meeting done.
2. Backend validates the scheduled time has passed.
3. Workflow status becomes `Completed`; inquiry's `kickoffMeeting.status` becomes `Completed`/`Project Created`.
4. Project created from the Inquiry/Workflow, receiving a snapshot of source inquiry data (`sourceInquirySnapshot`) and assigned team members derived from workflow attendees.
5. Inquiry marked converted; customer's `totalProjects` count incremented.
6. `ProjectActivityLog` entry created (`actionType: 'created'`).
7. Project-created notifications sent.

**Important:** project creation from kickoff does not by itself run `projectTimesheetSyncService` in a way that produces timesheet tasks immediately, because the newly created project typically has no `planningGrids`/`planningTasks` populated yet at that instant. Project-linked timesheet tasks only start appearing once planning tasks are added and a subsequent project update triggers the sync.

---

# 10. Undocumented / Unused / Duplicate Files (Current State)

Every file below was checked with a repository-wide search for imports/requires; none were found referenced from any active file. This section supersedes the equivalent sections in all three prior reports — several files those reports flagged as present are confirmed **removed** in the current ZIP (noted explicitly below so they are not re-flagged in future passes).

## 10.1 Backend

| File | Status |
|---|---|
| `backend/controllers/inquiryController_old.js` | Unused backup |
| `backend/controllers/projectController_old.js` | Unused backup |
| `backend/package_old.json` | Unused backup (new since earlier reports; differs from the live `package.json` by lacking the `qrcode` dependency) |
| `backend/utils/createNotification.js` | Unused duplicate of `services/notificationService.js`'s `createNotification` |
| `backend/services/documentExtractionService.js` | Present but not required anywhere — placeholder/unused |
| `backend/services/projectTimesheetBackfillService.js` | Implemented, not wired into any route/startup path (§8.3) |
| `backend/routes/testWhatsappRoute.js` | Active but self-documented in its own header comment as a temporary diagnostic route meant for removal once WhatsApp is confirmed stable |
| `backend/scripts/*` | One-off scripts outside normal boot/request flow (`backfillCustomerRefs.js`, `removeAlternateNumberFromCustomers.js`, `migrations/001_add_team_hierarchy.js`) |
| `backend/seed/seedData.js`, `seed/seedTask.js` | Seed scripts outside normal runtime; only `departmentSeedService.js` auto-runs on boot |

**No longer present** (do not carry forward): `backend/server_old.js`, `backend/controllers/userController_old.js`, `backend/models/User_old.js`, `backend/utils/departmentUtils_old.js`.

## 10.2 Frontend

| File | Status |
|---|---|
| `frontend/src/pages/InquiriesPage_old.jsx` | Unused backup |
| `frontend/src/pages/ProjectsPage_ol.jsx` | Unused backup (note the truncated filename — not a transcription error in this report) |
| `frontend/src/pages/TicketViewPage.jsx` | Exists, imports live components, but not referenced in `App.jsx` — dead route target (`/tickets/:id` routes to `TicketFormPage`) |
| `frontend/src/pages/TimesheetCalendarPage.jsx` | Exists but not referenced in `App.jsx` — superseded by `components/timesheet/TimesheetCalendarView.jsx`, the component actually mounted at `/timesheet/calendar` |
| `frontend/src/data/inquiryMasterData_old.js` | Unused backup |
| `frontend/src/components/common/FormComponents.extended_old.jsx` | Unused backup (the live `FormComponents.extended.jsx` is heavily used) |
| `frontend/src/components/inquiry/forms/CommonInquirySections_old.jsx` | Unused backup |
| `frontend/src/components/common/MainLayout.jsx` | Same-named duplicate of `frontend/src/layouts/MainLayout.jsx`; `App.jsx` imports the `layouts/` version — the `components/common/` copy is confirmed dead |

**No longer present** (do not carry forward): `frontend/src/App_old.jsx`, `frontend/src/components/common/Sidebar_old.jsx`, `frontend/src/pages/ProjectDetailPage_old.jsx`, `frontend/src/pages/UsersPage_old.jsx`, `frontend/src/components/project/ProjectPlanningGrid_old.jsx`, `frontend/src/components/timesheet/TimesheetForm_old.jsx`, `frontend/src/utils/departmentUtils_old.js`.

## 10.3 Runtime / deployment artifacts (not source)

```text
backend/.env
backend/.wwebjs_auth/session-nexus-session
backend/.wwebjs_cache/
backend/uploads/inquiry, projects, tickets, users
backend/node_modules/
frontend/node_modules/
frontend/dist/
```

These reflect a working local/deployed instance bundled into the same ZIP as the source — not clean source-only files. The `.env` in particular is a credential-leakage risk if this ZIP is shared or committed anywhere.

---

# 11. Confirmed Broken / Mismatched Flows

Only issues re-verified against the current source are listed here. Issues from earlier reports that did **not** reproduce against the current code (ticket `engineer`/`technical_communication` roles, Timesheet Admin sidebar visibility, kickoff WhatsApp result-shape mismatch, hardcoded departments in `Ticket.js`) are explicitly retired — see §0.1 for the corrections.

## 11.1 `authMiddleware.js` denial can return HTTP 500 instead of 403

File: `backend/middleware/authMiddleware.js`. `authorize()`/`authorizeHierarchy()` call `createError(message)` without a status code on the denial path, so `errorMiddleware.js` defaults to 500. Isolated to this file — `permissionMiddleware.js`'s equivalent already defaults to 403 correctly. **Impact:** forbidden access can look like a server crash rather than a permission denial to both the frontend and any API consumer.

## 11.2 `/api/test-whatsapp` is unauthenticated

File: `backend/routes/testWhatsappRoute.js`, mounted in `server.js` with no `protect` middleware. **Impact:** anyone who can reach the backend can trigger a real WhatsApp send.

## 11.3 Ticket view route points to the form page

`frontend/src/App.jsx`'s `/tickets/:id` routes to `TicketFormPage`, not the separate, unrouted `TicketViewPage.jsx`. **Impact:** "view ticket" navigation always opens the form-style page; `TicketViewPage.jsx` is fully dead code unless a future change intentionally re-routes to it.

## 11.4 Ticket Void permission mismatch

Backend `canVoidTicket` (`ticketController.js`) = `canManageTickets` = `admin, hod, manager, team_lead`. Frontend `canVoidTicket` (`ticketPermissions.js`) = `isAdminOrHod` = `admin, hod` only. **Impact:** `manager`/`team_lead` users are backend-authorized to void a ticket but the UI never shows them the button; they could only do it via a direct API call.

## 11.5 Project-timesheet backfill service is not wired to runtime

`backend/services/projectTimesheetBackfillService.js` exists but is not required by any controller/route/`server.js`. **Impact:** pre-existing project tasks are not automatically backfilled into Timesheet.

## 11.6 Notification coverage gap

`createNotification` is only called from `inquiryController.js`. **Impact:** Ticket and Timesheet events (assignment, status change, closure, overdue) generate no in-app or email notifications, despite `NotificationsPage.jsx` presenting itself as a general notification feed.

## 11.7 Inquiry follow-up exclusion list — unconfirmed in this pass

Earlier reports claimed the follow-up exclusion in `inquiryController.getFollowUps` only lists misspelled status variants. This report did not trace that specific function's exclusion list line-by-line against `dashboardController.js`'s alias-normalization approach in this pass — flagged as **needs direct verification** before treating it as either broken or fixed (see §9.3).

---

# 12. Architectural Risks Observed

## 12.1 Mixed legacy and new architecture

Several modules carry both a "legacy" and a "current" representation simultaneously by design (Customer's `companyName`/`customerName`, Department's `hod`/`hods[]`, Project's `planningTasks`/`planningGrids`, User's `department` as `Mixed` string-or-ObjectId). This is a deliberate backward-compatibility strategy, not an oversight, but it means every new feature touching these fields needs to consider both representations.

## 12.2 Department Master is partially integrated

Department Master (`Department.js`) is active and used by User Management and the Ticket form (populated dynamically, not hardcoded — corrects an earlier report's claim). It is **not** yet the source of truth for `config/projectPlanningTemplates.js`, which still uses hardcoded department name strings for project planning templates. This is the one place hardcoded department values were confirmed still present in this pass.

## 12.3 Status strings are handled via alias normalization, not centralized — but the normalization itself works

`Inquiry.js`'s `status` enum retains ~20 legacy spelling/casing variants. Rather than being an active counting/filtering bug (as earlier reports characterized it), `dashboardController.js` contains a purpose-built `INQUIRY_STATUS_ALIASES`/`normalizeInquiryStatus()` layer that correctly collapses every variant into 9 canonical statuses for dashboard counting, and `StatusBadge.jsx` has an equivalent alias-to-label map on the frontend. The remaining risk is forward-looking: any *new* status-handling logic added in the future (a new controller function, a new frontend filter, a new report) has to remember to route through this same alias layer, or it will silently miss legacy records. It is a maintainability/consistency risk, not a currently-active counting bug.

## 12.4 Project planning exists in two formats

`planningGrids[]` (current) and flat `planningTasks[]` (legacy, retained for backward compatibility) both exist on `Project.js` and both are read by the forward and reverse timesheet sync services and by `dashboardController.js`. A change that updates one representation without the other can silently desync reports, sync jobs, and dashboard aggregates. This risk is now slightly larger than in earlier reports because there are two sync services (forward and reverse) instead of one, both needing to stay aware of which representation they're reading/writing.

## 12.5 Side effects are embedded in controllers/services

Notification creation, email sending, WhatsApp sending, and customer sync are all triggered inline from `inquiryController.js` and `kickoffWorkflowService.js` rather than through a queue or event-bus pattern. Each side effect is individually try/catch-wrapped so failures don't roll back the primary save, which is a reasonable mitigation, but it does mean side-effect logic is duplicated/scattered per-module rather than centralized (visible directly in the Notification coverage gap, §11.6/§12.6).

## 12.6 Notification system is generic but under-adopted

The `Notification` model and `notificationService.js` are reusable and reasonably well-designed (try/catch isolation, flexible `type`/`priority`/`recipient` fields), but only the Inquiry module actually uses them. Extending Ticket/Timesheet to reach parity would mean adding explicit `createNotification(...)` calls at their relevant transition points — it is not a structural blocker, just unimplemented.

## 12.7 WhatsApp session data is present inside the uploaded codebase

`backend/.wwebjs_auth/session-nexus-session` and `backend/.wwebjs_cache/` are bundled inside the ZIP. This is live session/credential state, not source, and should not be committed or shared as part of a source handoff.

## 12.8 Frontend route and backend authorization are not always aligned

Most role-gating is now aligned (Timesheet Admin sidebar, department-driven ticket form). The one confirmed remaining misalignment is the Ticket Void permission gap (§11.4) — `manager`/`team_lead` are backend-authorized but frontend-hidden.

## 12.9 Frontend layout componentization is partial

`PageHeader.jsx`/`StickyActionBar.jsx` are adopted in detail/form pages but not in the five list pages (Inquiries, Projects, Customers, Tickets, Timesheet views), which still carry their own inline header/toolbar markup. Two parallel page-chrome patterns are active simultaneously until the list pages are migrated.

## 12.10 Duplicate/backup files remain in the active source tree

Several `_old`/`_ol` files sit alongside their live counterparts (full list in §10). None are imported anywhere, but their presence increases the chance a future edit accidentally targets the wrong file — particularly the near-identical `ProjectsPage.jsx` / `ProjectsPage_ol.jsx` pair.

## 12.11 Inquiry numbering offset is unusual

The `Counter` document's `seq` field defaults to 1349, and the `inquiryId` formula adds another literal 1349 on top of the current `seq`, producing an unusually large starting number (`INQ-2699` on the first-ever inquiry). Deterministic and non-colliding, but likely not the intended numbering scheme — worth confirming with whoever owns the numbering requirement before assuming it's correct.

---

# 13. Current System Understanding Summary

Nexus Dashboard is a MERN-stack (MongoDB, Express, React 18 + Vite, Node.js) internal CRM/ERP for an electrical panel manufacturing and industrial automation business, covering:

1. **Inquiry Management** — full lifecycle for PLC/VFD/MCC/MCC+PLC panel inquiries, attachments, an extensive (but alias-normalized) status enum, customer auto-sync, and the system's only wired notification/email side effects.
2. **Kickoff Workflow** — schedules a kickoff meeting from an Order-Won inquiry (now with optional final-BoM upload at schedule time), tracks due/ready/completed states via a scheduler, and creates a Project on completion — driving WhatsApp/email notifications directly rather than through the internal Notification model.
3. **Project Management** — NAPL-numbered projects with a dual planning-task representation, document attachments, activity logging, delay computation, project copy, and now **two-way** sync with Timesheet.
4. **Timesheet** — list/Kanban/calendar/admin views with hierarchy-based scoping (admin/HOD/manager/team lead/employee), project-linked vs. user-created task distinctions, drag-and-drop Kanban via `@dnd-kit`, and bidirectional sync with Project planning tasks. No notifications wired.
5. **Department Master** — active model/routes/UI with multi-HOD and team-lead support, seeded with 9 default departments on boot, consumed by User Management and the Ticket form; not yet the source of truth for project planning template department names.
6. **Ticket Module** — full lifecycle (New → Assigned → Working → Customer Side Pending → Closed, with Void/Reopen), comments, attachments, activity timeline, `brand`/`panelFamily` tracked as distinct fields. No notifications wired; a confirmed frontend/backend permission mismatch on Void for `manager`/`team_lead`; a dead unrouted view page.
7. **Customer Module** — CRUD master with shared normalization logic (`customerUniversal.js`) consumed by Inquiry and Project.
8. **Integration Settings** — admin-only email SMTP configuration (encrypted password storage, environment fallback) and WhatsApp client status/restart/logout controls; no dedicated frontend service file.
9. **Notifications and WhatsApp** — internal `Notification` model is Inquiry-only in practice, with an unused `workflow_error` type and a dead-duplicate utility function; WhatsApp is a separate, more broadly used channel (kickoff flow, inbound project-task commands) with a still-public diagnostic test route.

## 13.1 Primary open risks, ranked by likely impact

1. Public, unauthenticated `GET /api/test-whatsapp` route.
2. `authMiddleware.js` returning 500 instead of 403 on authorization failures.
3. Notification coverage gap (Ticket/Timesheet users get no in-app/email notifications).
4. Dual `planningGrids`/`planningTasks` representation, now requiring sync discipline across two services (forward + reverse) instead of one.
5. Project-timesheet backfill service present but unreachable at runtime.
6. Ticket Void permission mismatch between backend and frontend for `manager`/`team_lead`.
7. Hardcoded department names in project planning templates, bypassing Department Master.
8. Partial rollout of `PageHeader`/`StickyActionBar` leaving two page-chrome patterns active simultaneously.
9. Runtime/private artifacts (`.env`, WhatsApp session, uploads, build output, `node_modules`) bundled inside the same ZIP as the source.
10. Inquiry numbering offset producing an unexpectedly large starting sequence — confirm intent before treating as correct.

## 13.2 Items resolved since earlier reports (do not re-flag)

- Ticket `engineer`/`technical_communication` non-existent role references — gone.
- Timesheet Admin sidebar visibility vs. backend permission mismatch — aligned.
- Kickoff WhatsApp `normaliseNotificationResult()` result-shape mismatch — fixed.
- Hardcoded department enum on `Ticket.js` — now free text sourced from Department Master.
- A long list of `_old` backup files across both backend and frontend — removed (see §10 for the exact removed list).
- Dashboard "wrong status string" counting concern — dashboard has a working alias-normalization layer; reframed as a forward-looking maintainability risk rather than an active bug (§12.3).
