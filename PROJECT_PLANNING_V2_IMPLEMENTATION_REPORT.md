# Project Planning V2 — Implementation Report

Date: 18 July 2026

## Result

The project module was redesigned around department-specific and panel-specific planning grids while retaining the existing authentication, user management, project permissions, customer linkage, inquiry conversion, activity history, timesheet synchronization, documents, and notification flows.

The stored project quantity field remains `quantity` for compatibility. The UI and API alias use **Project Quantity** / `projectQuantity`.

## Completed changes

### Project details

Removed from active project create, edit, detail, list, filter, request handling, response handling, bot, and notification flows:

- Legacy Project Type
- Legacy project-level Panel Type
- Project Scope / Project Department
- Project-level Remark / notes

The model retains these fields as `select: false` only for the controlled migration window. New API responses delete them explicitly. Incoming values are ignored.

The task-level planning-grid `remark` field remains and is editable only through planning permissions.

### Planning hierarchy

Implemented the hierarchy:

1. Project Quantity
2. Selected departments
3. Panel types per selected department
4. Panel quantity per department/panel pair
5. Common or Separate planning mode when panel quantity is greater than one
6. Department/panel planning grids
7. Ordered planning tasks

Supported departments:

- Design
- Production
- Purchase
- Automation
- Store
- QC

Supported panel types:

- PLC
- MCC
- VFD
- MCC cum PLC
- FLP
- RIO Box

For quantity one, one common grid is generated and no mode selector or Add Planning Grid action is shown. For quantity above one, Common/Separate is required. Separate grid count cannot exceed quantity and duplicate unit numbers are rejected.

### Planning task table

The table columns are implemented in this exact order:

1. Serial Number
2. Task Name
3. Assigned To
4. Days
5. Start Date
6. End Date
7. Status
8. Delayed Days
9. Remark
10. Actions

Serial numbers are generated from row order. Add, remove, and reorder actions recalculate ordering and dates. Saved task deletion requires confirmation.

### Dates and delay

- Days accepts only positive whole numbers.
- The first task Start Date is manually set by an authorized user.
- Later task Start Dates derive from the preceding task.
- End Dates derive from Start Date and Days.
- Date sequences recalculate after duration, insertion, removal, or reorder changes.
- Existing application behavior of excluding Sunday is preserved.
- No holiday-calendar model was found, so no additional holidays are excluded.
- Status values are exactly: Pending, In Progress, Delay, Completed, On Hold.
- Incomplete tasks after End Date receive effective status Delay in backend responses and are normalized during saves.
- Delayed Days is backend-calculated and read-only.
- Completed tasks use `actualCompletedDate` for frozen historical delay.
- On Hold tasks are excluded from automatic delay and return zero automatic Delayed Days.

### Assigned To users

Excel `Assigned To` is interpreted only as a department. It never directly assigns an application user.

The application Assigned To list:

- loads active users from User Management;
- filters users by the planning grid department;
- supports users with multiple department associations;
- excludes inactive users from new assignment;
- preserves an existing inactive historical assignee where already stored;
- is revalidated by the backend during write operations.

### Permissions

Existing permission keys remain in use. Backend route permission middleware is combined with controller-level department scope checks.

- Admin can manage all planning departments.
- HOD and Manager roles are restricted to their configured departments.
- Team Lead is restricted to its configured department/team context as represented by existing User Management data and project permissions.
- Other users cannot alter planning structure merely because they can view a project.
- Backend checks enforce department ownership, active-user assignment, and user/department matching.

### Bot, notifications, and integrations

- Removed legacy project-detail fields from project creation/detail responses.
- Project notifications use Project Quantity, selected departments, and department/panel plans.
- WhatsApp task status mapping supports Delay and On Hold.
- Project-to-timesheet status mapping supports the new statuses.
- Inquiry-to-project kickoff creates new department/panel metadata and Excel-derived department task grids.
- Inquiry notes remain only inside the preserved inquiry snapshot, not as a project-level Remark.

## Excel processing

Source inspected: `Panel_and_Development_Master_Plan(1).xlsx`, sheet `Master_Panel+Dev`.

Only these columns were used:

- `Task Name` → planning task name
- `Assigned To` → planning department

### Normalization mappings

| Excel value | Planning department |
|---|---|
| Design | Design |
| Engineering Design | Design |
| Electrical | Design |
| Production | Production |
| Prod | Production |
| Manufacturing | Production |
| Purchase | Purchase |
| Purchasing | Purchase |
| Procurement | Purchase |
| Automation | Automation |
| Programmer | Automation |
| Programming | Automation |
| Software | Automation |
| Store | Store |
| Stores | Store |
| Dispatch | Store |
| Despatch | Store |
| QC | QC |
| QA | QC |
| Quality | QC |
| Quality Control | QC |

### Required transformations

- `Project Kick-off` and reasonable Kick-off variants are excluded during mapping.
- `BOM Preparation` is stored and displayed as `Engineering BOM Preparation`.
- Imported order is preserved inside each department.
- No imported row is duplicated across departments.

### Import validation issues

The following rows were not assigned silently because their department value is ambiguous or unsupported. They are returned by the validation API and displayed as an authorized-user warning:

| Excel row | Task | Assigned To | Result |
|---:|---|---|---|
| 3 | URS & Scope Freeze | PM/All | Manual review |
| 6 | BOM Approval | PM/Production | Manual review |
| 7 | GAD Design | Design/Production | Manual review |
| 8 | GAD Approval | PM/Customer | Manual review |
| 10 | Electrical Drawing Approval | PM/Customer | Manual review |
| 12 | Material Inspection & Review | QC/Store | Manual review |
| 27 | Internal FAT (Panel + Program) | All | Manual review |
| 28 | FAT Observation Closure | All | Manual review |
| 29 | Final Backup & Handover | PM/Programmer | Manual review |
| 30 | Final Inspection & Testing | QC/All | Manual review |

These tasks are not automatically put into an incorrect grid. An authorized user can add them manually after deciding the correct single department, or the mapping catalog can be updated after business approval.

## Model changes

### Project

Added or standardized:

- `quantity` — stored field; exposed as `projectQuantity`
- `selectedDepartments[]`
- `panelSelections[]`
  - department
  - panelType
  - quantity
  - planningMode
- `planningGrids[]`
  - department
  - panelType
  - panelQuantity
  - planningMode
  - unitNumber
  - isCommon
  - planningTasks[]
- `legacyProjectDetails`
- `migrationReviewRequired`
- `migrationIssues[]`

### Planning task

Added or standardized:

- order
- department
- taskName
- assignedTo User reference
- totalDays
- plannedStartDate
- plannedEndDate
- status
- actualCompletedDate
- delayDays
- remark

The planning structure remains embedded in the Project document because the existing application architecture already uses embedded grids and tasks. A planning mutation therefore commits atomically as one MongoDB project-document write rather than uncontrolled client-only JSON updates.

## API changes

New or updated endpoints:

- `GET /api/projects/planning-templates`
- `GET /api/projects/planning-users?department=Design`
- `GET /api/projects/planning-import/validate`
- `POST /api/projects/planning-preview/recalculate`
- `POST /api/projects/:id/planning-grids`
- `POST /api/projects/:id/planning-grids/:gridId/tasks`
- `PATCH /api/projects/:id/planning-grids/:gridId/tasks/reorder`
- `PATCH /api/projects/:id/planning-grids/:gridId/tasks/:taskId`
- `DELETE /api/projects/:id/planning-grids/:gridId/tasks/:taskId`

Existing create/update/list/detail APIs accept and return the new planning structure. The old stored `quantity` remains in responses temporarily for old-client compatibility; `projectQuantity` is the preferred API property.

## Migration

Migration file:

`backend/scripts/migrations/002_project_planning_department_panel_grids.js`

The migration is dry-run by default:

```bash
cd backend
npm run migrate:project-planning-v2
```

Apply only after reviewing dry-run output and taking a database backup:

```bash
npm run migrate:project-planning-v2 -- --apply
```

Behavior:

- reads deprecated fields using explicit `+field` selection;
- stores an exact legacy backup in `legacyProjectDetails`;
- excludes Kick-off tasks;
- renames BOM Preparation;
- maps safe department tasks;
- preserves unmapped tasks in the legacy backup;
- sets `migrationReviewRequired` and `migrationIssues` when conversion is uncertain;
- unsets deprecated fields only in apply mode.

The migration was not executed against the user's live database because no database credentials or live database connection were supplied with the ZIP.

## Modified files

### Backend

- `backend/config/projectPlanningCatalog.js` — new
- `backend/docs/Panel_and_Development_Master_Plan_SOURCE.xlsx` — reference copy of inspected workbook
- `backend/controllers/projectController.js`
- `backend/controllers/ticketController.js`
- `backend/models/Project.js`
- `backend/routes/projectRoutes.js`
- `backend/scripts/migrations/002_project_planning_department_panel_grids.js` — new
- `backend/seed/seedData.js`
- `backend/services/kickoffWorkflowService.js`
- `backend/services/notificationTemplates.js`
- `backend/services/projectTimesheetSyncService.js`
- `backend/services/whatsappService.js`
- `backend/tests/projectPlanning.test.js` — new
- `backend/tests/projectPlanningStructure.test.js` — new
- `backend/utils/projectPlanning.js` — new
- `backend/package.json`

### Frontend

- `frontend/src/api/projectService.js`
- `frontend/src/components/project/ProjectForm.jsx`
- `frontend/src/components/project/ProjectPlanningGrid.jsx`
- `frontend/src/pages/ProjectDetailPage.jsx`
- `frontend/src/pages/ProjectsPage.jsx`
- `frontend/dist/*` — regenerated production build

### Removed obsolete project implementations

- `backend/config/projectPlanningTemplates.js`
- `backend/controllers/projectController_old.js`
- `frontend/src/data/projectPlanningTemplates.js`
- `frontend/src/pages/ProjectsPage_ol.jsx`

## Automated verification

Commands run:

```bash
cd backend
npm test
```

Result: **19 tests passed, 0 failed**.

Coverage includes:

- Kick-off exclusion
- BOM rename
- Excel Assigned To department interpretation
- ambiguous mapping issues
- positive whole-number validation
- multiple department/panel selections
- quantity-one mode normalization
- Common/Separate rules
- Sunday-aware date chaining
- automatic Delay
- completed-task delayed days
- On Hold behavior
- Project Quantity UI label
- deprecated field omission
- exact planning column order
- exact statuses
- task Remark preservation
- normalized model fields
- API routes and permission middleware
- inactive/wrong-department assignment checks
- duplicate/excess separate unit prevention
- safe migration backup behavior
- bot and notification integration

Backend JavaScript syntax checks passed for all source files.

Frontend production build command:

```bash
cd frontend
npm run build
```

Result: **Build passed**. Vite reported only the existing large-bundle advisory for the main JavaScript chunk; it is not a build failure.

## Manual testing steps

1. Back up MongoDB.
2. Run the migration in dry-run mode and review every `migrationIssues` result.
3. Run the migration with `--apply` in a staging database.
4. Start backend and frontend.
5. Create a project with one department, one panel type, and quantity one.
6. Verify one grid appears without Common/Separate or Add Planning Grid.
7. Create a project with multiple departments and panel types.
8. Set panel quantity above one and test Common mode.
9. Set Separate mode and create grids up to the quantity limit.
10. Try a duplicate or out-of-range unit number and verify backend rejection.
11. Verify imported tasks appear only in their mapped department.
12. Verify Kick-off is absent and Engineering BOM Preparation is present once.
13. Verify the Excel validation warning lists the ten ambiguous rows.
14. Verify Assigned To only lists active users from the grid department.
15. Test an existing inactive assignee: historical display should remain, but new assignment must be rejected.
16. Set the first Start Date and verify all dates recalculate after changing Days, adding, deleting, and reordering.
17. Verify Sunday is skipped.
18. Test all five statuses.
19. Test an overdue incomplete task, a late completed task, and an On Hold task.
20. Verify Admin, HOD, TL, and unauthorized users through both UI and direct API requests.
21. Verify project documents, customer linkage, inquiry conversion, activity log, timesheet sync, and WhatsApp notification flows.

## Known limitations and manual-review items

- The live MongoDB migration and database integration tests were not run because no database connection was provided.
- WhatsApp delivery was not executed because it requires a live authenticated WhatsApp session.
- Browser end-to-end tests were not present in the original project; verification used automated unit/structural tests and a production build.
- Ten Excel rows have ambiguous or unsupported department values and require business confirmation before automatic assignment.
- Legacy tasks without a safely mappable department remain in `legacyProjectDetails` and are flagged for manual review.
- Legacy multi-grid records are consolidated by department during automatic migration; their exact original structure remains in the legacy backup.
- Where a legacy panel type cannot be inferred, migration uses MCC only as a reviewable fallback and marks the project for review.
- Working-day logic excludes Sunday only because the current application has no holiday calendar.
- MongoDB transactions require a replica set. New planning-grid/task mutations are atomic single-document Project updates; deployment environments using standalone MongoDB do not support multi-document transactions.
