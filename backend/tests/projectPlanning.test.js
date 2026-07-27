'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EXCEL_PLANNING_CATALOG,
  isKickoffTask,
  normalizeTaskName,
  normalizeExcelDepartment,
  isDepartmentAllowedForPanel,
} = require('../config/projectPlanningCatalog');
const {
  positiveInteger,
  validatePanelSelections,
  recalculateTaskSequence,
  effectiveTaskStatus,
  calculateDelayedDays,
  assertPlanningStartDateAllowed,
} = require('../utils/projectPlanning');

test('Kick-off variations are excluded', () => {
  ['Kick-off', 'Kick Off', 'Kickoff', 'Kick-off Task', 'Project Kick-off'].forEach((name) => assert.equal(isKickoffTask(name), true));
  const allNames = Object.values(EXCEL_PLANNING_CATALOG.tasksByDepartment).flat().map((task) => task.taskName);
  assert.equal(allNames.some((name) => isKickoffTask(name)), false);
});

test('BOM Preparation is renamed once', () => {
  assert.equal(normalizeTaskName('BOM preparation'), 'Engineering BOM Preparation');
  const production = EXCEL_PLANNING_CATALOG.tasksByDepartment.Production.map((task) => task.taskName);
  assert.equal(production.filter((name) => name === 'Engineering BOM Preparation').length, 1);
  assert.equal(production.includes('BOM Preparation'), false);
});

test('Excel Assigned To is interpreted as department and ambiguous values are issues', () => {
  assert.equal(normalizeExcelDepartment('Programmer').department, 'Automation');
  assert.equal(normalizeExcelDepartment('Electrical').department, 'Design');
  assert.equal(normalizeExcelDepartment('Dispatch').department, 'Store');
  assert.equal(normalizeExcelDepartment('Quality Control').department, 'QC');
  assert.equal(normalizeExcelDepartment('Design/Production').department, null);
  assert.ok(EXCEL_PLANNING_CATALOG.issues.length > 0);
});

test('panel quantity and duration accept positive whole numbers only', () => {
  assert.equal(positiveInteger(3, 'Quantity'), 3);
  [0, -1, 1.5, 'abc'].forEach((value) => assert.throws(() => positiveInteger(value, 'Quantity')));
});

test('panel selections support single and multiple departments/panels', () => {
  const result = validatePanelSelections(['Design', 'Production'], [
    { department: 'Design', panelType: 'PLC', quantity: 1, planningMode: 'separate' },
    { department: 'Design', panelType: 'VFD', quantity: 2, planningMode: 'common' },
    { department: 'Production', panelType: 'MCC', quantity: 3, planningMode: 'separate' },
  ]);
  assert.equal(result[0].planningMode, 'common');
  assert.equal(result.length, 3);
  assert.throws(() => validatePanelSelections(['Design'], [{ department: 'Design', panelType: 'PLC', quantity: 2 }]));
});


test('MCC and VFD exclude Automation while other panels allow it', () => {
  assert.equal(isDepartmentAllowedForPanel('Automation', 'MCC'), false);
  assert.equal(isDepartmentAllowedForPanel('Automation', 'VFD'), false);
  assert.equal(isDepartmentAllowedForPanel('Automation', 'PLC'), true);
  assert.equal(isDepartmentAllowedForPanel('Automation', 'MCC cum PLC'), true);
  assert.throws(() => validatePanelSelections(['Automation'], [
    { department: 'Automation', panelType: 'MCC', quantity: 1, planningMode: 'common' },
  ]));
});


test('planning start dates block previous dates and Sundays', () => {
  const today = new Date('2026-07-20T12:00:00'); // Monday
  assert.doesNotThrow(() => assertPlanningStartDateAllowed('2026-07-20', { today }));
  assert.doesNotThrow(() => assertPlanningStartDateAllowed('2026-07-21', { today }));
  assert.throws(
    () => assertPlanningStartDateAllowed('2026-07-19', { today }),
    /Sunday is not allowed/
  );
  assert.throws(
    () => assertPlanningStartDateAllowed('2026-07-18', { today }),
    /Previous dates are not allowed/
  );
  assert.doesNotThrow(() => assertPlanningStartDateAllowed('2026-07-18', {
    today,
    existingValue: '2026-07-18',
  }));
});

test('task dates chain automatically and skip Sunday', () => {
  const tasks = recalculateTaskSequence([
    { taskName: 'A', totalDays: 2, status: 'Pending' },
    { taskName: 'B', totalDays: 1, status: 'Pending' },
  ], '2026-07-18'); // Saturday
  assert.equal(tasks[0].plannedStartDate.toISOString().slice(0, 10), '2026-07-18');
  assert.equal(tasks[0].plannedEndDate.toISOString().slice(0, 10), '2026-07-20');
  assert.equal(tasks[1].plannedStartDate.toISOString().slice(0, 10), '2026-07-21');
  assert.equal(tasks[1].order, 2);
});

test('automatic delay status and delayed days follow completion/on-hold rules', () => {
  const end = '2026-07-10';
  const now = new Date('2026-07-14T12:00:00');
  assert.equal(effectiveTaskStatus({ status: 'Pending', plannedEndDate: end }, now), 'Delay');
  assert.equal(effectiveTaskStatus({ status: 'On Hold', plannedEndDate: end }, now), 'On Hold');
  assert.equal(calculateDelayedDays({ status: 'Completed', plannedEndDate: end, actualCompletedDate: '2026-07-10' }, now), 0);
  assert.equal(calculateDelayedDays({ status: 'Completed', plannedEndDate: end, actualCompletedDate: '2026-07-13' }, now), 2); // Sunday excluded
  assert.equal(calculateDelayedDays({ status: 'On Hold', plannedEndDate: end, delayDays: 0 }, now), 0);
});
