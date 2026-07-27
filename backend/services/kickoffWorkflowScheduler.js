'use strict';

const { processDueKickoffWorkflows } = require('./kickoffWorkflowService');

let timer = null;
let running = false;

async function runOnce() {
  if (running) return;
  running = true;
  try {
    const result = await processDueKickoffWorkflows();
    if (result.processed > 0) {
      console.log(`[kickoffWorkflowScheduler] Marked ${result.processed} due workflow(s) ready for completion`);
    }
  } catch (error) {
    console.error('[kickoffWorkflowScheduler] Failed:', error.message);
  } finally {
    running = false;
  }
}

function initKickoffWorkflowScheduler() {
  const enabled = String(process.env.KICKOFF_WORKFLOW_SCHEDULER_ENABLED || 'true') !== 'false';
  if (!enabled) {
    console.log('[kickoffWorkflowScheduler] Disabled by KICKOFF_WORKFLOW_SCHEDULER_ENABLED=false');
    return;
  }

  const intervalMs = Math.max(
    30_000,
    Number(process.env.KICKOFF_WORKFLOW_INTERVAL_MS || 60_000)
  );

  if (timer) clearInterval(timer);

  setTimeout(runOnce, 10_000);
  timer = setInterval(runOnce, intervalMs);

  console.log(`[kickoffWorkflowScheduler] Started. Interval: ${intervalMs} ms`);
}

module.exports = {
  initKickoffWorkflowScheduler,
  runOnce,
};
