# Nexus Dashboard Code Review — Issues + Suggestions

Reviewed current uploaded codebase from the latest ZIP.

## Highest priority issues

### 1. User Management Add User still has blank-page crash in latest ZIP

In the latest uploaded ZIP, this issue is still present unless you manually replaced the file with the fixed one I gave earlier.

File:

```text
frontend/src/pages/UsersPage.jsx
```

Issue:

```jsx
{DEPARTMENTS.map((department) => (
```

`DEPARTMENTS` is not defined. The page crashes when Add User modal opens because default role is `employee`, so the Department dropdown renders immediately.

Impact:

```text
User Management → Add User = blank document / white screen
```

Suggestion:

Use the existing dynamic `departments` state instead of old hardcoded `DEPARTMENTS`.

---

### 2. Department Master is not fully connected to User Management

Department Master exists, but user assignment is still mixed between:

```text
Department Master ObjectIds
old hardcoded department names
legacy fallback department list
```

Files involved:

```text
backend/models/User.js
backend/controllers/userController.js
frontend/src/pages/UsersPage.jsx
frontend/src/pages/DepartmentPage.jsx
frontend/src/components/department/DepartmentForm.jsx
```

Current state:

* `Department` model has real departments.
* `User.department` and `User.hodDepartments` use `Mixed`.
* `UsersPage.jsx` still keeps `FALLBACK_DEPARTMENTS`.
* `User.js` still exports old `USER_DEPARTMENTS`.

Suggestion:

Make Department Master the final source of truth for:

```text
Employee department
Team Lead department
HOD departments
Ticket department
Timesheet department filters
Project planning department
```

Keep legacy strings only for migration/backward compatibility.

---

### 3. One department can have only one HOD

Current model:

```js
hod: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null,
}
```

File:

```text
backend/models/Department.js
```

Frontend also has only a single HOD dropdown:

```text
frontend/src/components/department/DepartmentForm.jsx
```

Current behavior:

```text
One Department → One HOD only
One HOD → Multiple Departments possible
```

Suggestion:

If business needs multiple HODs per department later, change `hod` to `hods: [ObjectId]` and update Department UI to a multi-select.

---

### 4. Inquiry frontend/backend mismatch

Several fields exist in frontend but are not fully persisted in backend schema.

#### PLC Switchgear Make

Frontend uses:

```text
plcDetails.switchgearMake
plcDetails.customSwitchgearMake
```

Backend `plcDetailsSchema` does not contain these fields in latest ZIP.

Impact:

```text
PLC Switchgear Make can be selected in UI but may not save in MongoDB.
```

---

#### PLC Support Requirements

Frontend uses:

```text
plcDetails.supportRequirements.onsiteSupportRequired
plcDetails.supportRequirements.onsiteSupportDays
plcDetails.supportRequirements.commissioningSupportRequired
plcDetails.supportRequirements.commissioningSupportDays
```

Backend `plcDetailsSchema` does not contain `supportRequirements`.

Impact:

```text
PLC Support Requirements may disappear after save/reload.
```

---

#### MCC Support Days

Frontend uses:

```text
mccDetails.notesAndSupport.onsiteSupportDays
mccDetails.notesAndSupport.commissioningSupportDays
```

Backend does not store those two day fields.

Impact:

```text
MCC on-site days and commissioning days may not persist.
```

---

#### MCC Ventilation

Frontend removed Ventilation, but backend still has:

```js
mccDetails.layoutPreferences.ventilation
```

File:

```text
backend/models/Inquiry.js
```

Impact:

```text
Frontend and backend schema are not aligned.
```

Suggestion:

Before more Inquiry UI changes, align `Inquiry.js`, `inquiryMasterData.js`, `inquiryValidation.js`, and all Inquiry form components together.

---

### 5. Timesheet Admin access mismatch

Backend elevated timesheet routes allow:

```text
admin
hod
team_lead
```

Frontend page guard allows:

```text
admin
hod
```

Sidebar shows Timesheet Admin only to:

```text
admin
```

File:

```text
frontend/src/pages/TimesheetAdminPage.jsx
frontend/src/components/common/Sidebar.jsx
backend/routes/timesheetRoutes.js
```

Another issue:

`TimesheetAdminPage.jsx` loads employees from:

```js
API.get('/users')
```

But `/api/users` is admin-only.

Impact:

```text
HOD may open Timesheet Admin but employee dropdown can fail.
Team Lead is allowed by backend but blocked by frontend.
```

Suggestion:

Use `/api/users/assignable` instead of `/api/users` for HOD/team lead scoped users.

---

### 6. Auth middleware returns 500 instead of 403 in some denied cases

File:

```text
backend/middleware/authMiddleware.js
```

Issue:

```js
createError('Access denied...')
```

is called without status code in `authorize()` and `authorizeHierarchy()`.

Impact:

```text
Permission denied can appear as server error 500 instead of 403.
```

Suggestion:

Always pass status:

```text
403
```

for access denied.

---

### 7. WhatsApp test route is public

File:

```text
backend/routes/testWhatsappRoute.js
backend/server.js
```

Route:

```text
GET /api/test-whatsapp
```

Current state:

```text
No authentication
No admin check
Mounted in runtime
```

Impact:

Anyone who can reach backend can trigger WhatsApp test sending.

Suggestion:

Protect with admin auth or remove from production.

---

## Medium priority issues

### 8. Ticket module roles do not match User model

User model supports:

```text
admin
hod
team_lead
employee
manager
```

Ticket module references:

```text
technical_communication
engineer
```

Files:

```text
backend/models/User.js
backend/controllers/ticketController.js
frontend/src/context/AuthContext.jsx
frontend/src/components/ticket/TicketForm.jsx
```

Impact:

```text
technical_communication and engineer cannot be created as valid users.
Ticket permission logic expects roles that User model does not allow.
```

Suggestion:

Either add those roles properly to User model or remove those role assumptions from Ticket module.

---

### 9. Ticket departments are still hardcoded

File:

```text
backend/models/Ticket.js
frontend/src/data/masterData.js
frontend/src/components/ticket/TicketForm.jsx
```

Current hardcoded departments include:

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

Impact:

Department Master changes do not automatically reflect in Ticket module.

Suggestion:

Ticket department dropdown should read from `/api/departments`.

---

### 10. Project planning has two active structures

Project model stores both:

```text
planningTasks
planningGrids
```

Files:

```text
backend/models/Project.js
backend/controllers/projectController.js
backend/services/projectTimesheetSyncService.js
backend/controllers/dashboardController.js
```

Current behavior:

* Timesheet sync prefers `planningGrids`.
* Dashboard delayed task count reads `planningTasks`.
* Controller tries to keep both aligned.

Impact:

```text
If planningGrids and planningTasks drift, dashboard/sync/reporting can show inconsistent data.
```

Suggestion:

Choose one source of truth. Prefer `planningGrids`, and generate flat tasks only for read/report compatibility.

---

### 11. Project-timesheet backfill service exists but is not wired

File:

```text
backend/services/projectTimesheetBackfillService.js
```

Current state:

```text
Service exists
No route
No startup call
No admin tool
```

Impact:

Old projects will not automatically create project-linked timesheet tasks.

Suggestion:

Add controlled admin-only backfill action later.

---

### 12. Frontend has unused pages/components

Examples:

```text
frontend/src/pages/TicketViewPage.jsx
frontend/src/pages/TimesheetCalendarPage.jsx
frontend/src/components/common/MainLayout.jsx
frontend/src/components/common/Sidebar_old.jsx
```

Impact:

Developers may edit unused files by mistake.

Suggestion:

Remove old/unused files or move them to an archive folder outside runtime source.

---

### 13. Backend has old/runtime files mixed with source

Examples:

```text
backend/server_old.js
backend/utils/departmentUtils_old.js
backend/.env
backend/.wwebjs_auth
backend/uploads
backend/node_modules
frontend/node_modules
frontend/dist
```

Impact:

* Deployment ZIP contains secrets/runtime/session data.
* WhatsApp session data is bundled with source.
* Uploads are bundled with source.
* Review becomes confusing.

Suggestion:

Source ZIP should exclude:

```text
.env
node_modules
dist
uploads
.wwebjs_auth
old backup files
```

---

## Code quality risks

### 14. Very large files are becoming hard to maintain

Largest files:

```text
backend/controllers/projectController.js       ~2140 lines
backend/controllers/inquiryController.js       ~1690 lines
backend/controllers/ticketController.js        ~1589 lines
frontend/src/pages/ElectricalPanelInquiryPage.jsx ~1302 lines
frontend/src/pages/InquiriesPage.jsx           ~1187 lines
frontend/src/components/inquiry/forms/CommonInquirySections.jsx ~1145 lines
frontend/src/pages/UsersPage.jsx               ~1038 lines
backend/models/Inquiry.js                      ~1025 lines
```

Impact:

```text
Small changes can easily break unrelated flows.
```

Suggestion:

Do not refactor immediately, but future modules should split into:

```text
controller
service
validator
mapper
constants
side-effect notifier
```

---

### 15. Constants are repeated in too many places

Repeated values exist for:

```text
Inquiry statuses
Departments
Ticket statuses
User roles
Project planning statuses
IP ratings
Supply voltage
Support requirement options
```

Impact:

One label change requires editing many files.

Suggestion:

Create shared frontend constants and backend constants separately, then map API values consistently.

---

### 16. No automated tests found

I did not find real test/spec files for:

```text
backend controllers
services
frontend pages
timesheet sync
inquiry workflow
ticket workflow
```

Impact:

Regression risk is high, especially because this codebase has many side effects.

Suggested first tests:

```text
User create/update
Inquiry create/update
Order Won kickoff flow
Project planning → timesheet sync
Ticket assignment
Department Master create/update
```

---

## Security / deployment concerns

### 17. JWT token is stored in localStorage

File:

```text
frontend/src/api/axios.js
```

Current behavior:

```text
token stored in localStorage
Authorization header added from localStorage
```

Impact:

Works fine functionally, but localStorage tokens are more exposed to XSS than httpOnly cookies.

Suggestion:

For production hardening, use httpOnly cookie-based auth later.

---

### 18. Upload serving is public

Backend serves:

```text
/uploads
```

directly.

Impact:

Anyone with file URL can access uploaded inquiry/project/avatar files.

Suggestion:

For sensitive documents, serve files through protected download endpoints.

---

### 19. WhatsApp and email side effects run inside business workflows

Examples:

```text
Inquiry create
Kickoff schedule
Project create/update
Ticket workflow
```

Impact:

Primary save can succeed while notifications fail, or notification logs may not represent real delivery cleanly.

Suggestion:

Long-term improvement: queue side effects separately from save operations.

---

## Suggested improvement order

### Phase 1 — Fix active breakages

1. Fix `UsersPage.jsx` undefined `DEPARTMENTS`.
2. Align Inquiry frontend/backend schema:

   * PLC switchgear
   * PLC support requirements
   * MCC support days
   * MCC ventilation removal
3. Fix auth 403 errors.
4. Protect or remove `/api/test-whatsapp`.

### Phase 2 — Align permissions and master data

1. Make Timesheet Admin frontend/backend access consistent.
2. Use `/users/assignable` where non-admin users need employee lists.
3. Replace Ticket hardcoded departments with Department Master.
4. Decide final role list for Ticket module.

### Phase 3 — Clean architecture

1. Remove old backup files from runtime source.
2. Exclude `.env`, `.wwebjs_auth`, `uploads`, `node_modules`, and `dist` from project ZIP.
3. Split large controllers gradually.
4. Add regression tests for Inquiry, Project Sync, Timesheet, Tickets, and Users.

## Overall review

The system is functional and has many major modules already integrated, but it is now in a **mixed migration state**:

```text
Old hardcoded values + new master data
Old statuses + new statuses
Old project planning + new planning grids
Old role assumptions + new hierarchy
Frontend fields + backend schema mismatch
```

The safest next work is not adding new features, but first stabilizing the mismatches that can cause data loss or blank screens.
