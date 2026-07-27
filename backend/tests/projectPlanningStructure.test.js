'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const projectForm = read('frontend/src/components/project/ProjectForm.jsx');
const planningGrid = read('frontend/src/components/project/ProjectPlanningGrid.jsx');
const projectsPage = read('frontend/src/pages/ProjectsPage.jsx');
const projectModel = read('backend/models/Project.js');
const projectController = read('backend/controllers/projectController.js');
const projectRoutes = read('backend/routes/projectRoutes.js');
const migration = read('backend/scripts/migrations/002_project_planning_department_panel_grids.js');
const botService = read('backend/services/whatsappService.js');
const notificationTemplates = read('backend/services/notificationTemplates.js');

function indexSequence(source, values) {
  let position = -1;
  values.forEach((value) => {
    const next = source.indexOf(value, position + 1);
    assert.ok(next > position, `Expected ${value} after previous column`);
    position = next;
  });
}

test('project screens use Project Quantity and omit deprecated detail controls', () => {
  assert.match(projectForm, /Project Quantity/);
  assert.match(projectsPage, /Project Quantity/);
  ['name="projectType"', 'name="projectDepartment"', 'name="notes"'].forEach((token) => {
    assert.equal(projectForm.includes(token), false);
  });
  assert.equal(projectsPage.includes('All Project Types'), false);
});

test('department and panel options are complete', () => {
  ['Design', 'Production', 'Purchase', 'Automation', 'Store', 'QC'].forEach((value) => assert.ok(projectForm.includes(`'${value}'`)));
  ['PLC', 'MCC', 'VFD', 'MCC cum PLC', 'FLP', 'RIO Box'].forEach((value) => assert.ok(projectForm.includes(`'${value}'`)));
});


test('project planning selects panel first and shows completion percentages', () => {
  assert.ok(projectForm.indexOf('label="Panel Types"') < projectForm.indexOf('label="Departments"'));
  assert.match(projectForm, /Overall Completion/);
  assert.match(projectForm, /Department Completion/);
  assert.match(projectForm, /Automation is not applicable/);
  assert.match(projectController, /disallowedDepartmentsByPanel/);
});

test('common and separate planning UI follows quantity rules', () => {
  assert.match(projectForm, /quantity > 1/);
  assert.match(projectForm, /planningMode === 'separate'/);
  assert.match(projectForm, /Add Planning Grid/);
  assert.match(projectForm, /Common/);
  assert.match(projectForm, /Separate/);
});

test('planning columns are in the required compact order', () => {
  indexSequence(planningGrid, [
    "['Sr.', 'Task Name', 'Remark', 'Assigned To', 'Days', 'Start Date', 'End Date', 'Status', 'Delayed', 'Actions']",
  ]);
});

test('department planning cards contain their own grids and date restrictions', () => {
  assert.match(projectForm, /onDepartmentPlanningGridChange/);
  assert.match(projectForm, /planningGrids=\{relatedGrids\}/);
  assert.match(planningGrid, /min=\{todayDateInput\(\)\}/);
  assert.match(planningGrid, /Sunday is blocked/);
  assert.match(projectController, /validateIncomingPlanningStartDates/);
});

test('planning grid keeps task remark and has no row department selector', () => {
  assert.match(planningGrid, /task\.remark/);
  assert.equal(planningGrid.includes('Department</th>'), false);
  assert.match(planningGrid, /window\.confirm/);
});

test('exact task statuses are offered', () => {
  ['Pending', 'In Progress', 'Delay', 'Completed', 'On Hold'].forEach((value) => assert.ok(planningGrid.includes(`'${value}'`)));
});

test('project model contains normalized selections, grids, tasks and legacy backup', () => {
  ['selectedDepartments', 'panelSelections', 'planningMode', 'unitNumber', 'isCommon', 'actualCompletedDate', 'delayDays', 'remark', 'legacyProjectDetails'].forEach((field) => assert.ok(projectModel.includes(field)));
  assert.match(projectModel, /select: false/);
});

test('backend ignores deprecated project-detail request fields', () => {
  ['delete body.projectType', 'delete body.projectScopes', 'delete body.projectDepartment', 'delete body.panelType', 'delete body.notes', 'delete body.remark'].forEach((line) => assert.ok(projectController.includes(line)));
});

test('planning APIs and backend permission middleware exist', () => {
  [
    '/planning-templates', '/planning-users', '/planning-import/validate',
    '/planning-preview/recalculate', '/:id/planning-grids', '/tasks/reorder',
  ].forEach((route) => assert.ok(projectRoutes.includes(route)));
  assert.match(projectRoutes, /requirePermission\(PROJECT_PERMISSIONS\.PLANNING_GRID\)/);
  assert.match(projectController, /assertPlanningDepartmentScope/);
  assert.match(projectController, /Inactive user/);
  assert.match(projectController, /does not belong to the/);
});

test('separate-grid backend prevents excess and duplicate units', () => {
  assert.match(projectController, /Maximum .* separate grids allowed/);
  assert.match(projectController, /already has a planning grid/);
  assert.match(projectController, /Duplicate unit numbers are not allowed/);
});

test('migration is dry-run by default and preserves legacy details before unsetting', () => {
  assert.match(migration, /--apply/);
  assert.match(migration, /legacyProjectDetails/);
  assert.match(migration, /migrationReviewRequired/);
  assert.match(migration, /\$unset/);
});

test('bot and notifications use new planning concepts', () => {
  ['Delay', 'On Hold'].forEach((status) => assert.ok(botService.includes(status)));
  assert.match(notificationTemplates, /Project Quantity/);
  assert.match(notificationTemplates, /panelSelections/);
  assert.match(notificationTemplates, /selectedDepartments/);
});
