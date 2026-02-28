/**
 * Daily Notification Job
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every day at 08:00 (America/Sao_Paulo) to check all users' tasks and
 * generate notifications for:
 *   • Tasks due within the next 24 hours (prazo_proximo)
 *   • Overdue tasks that haven't been notified yet (atrasada)
 *
 * The scheduler uses a pure-JS approach (setInterval every minute) to avoid
 * adding an external cron dependency. It converts the current UTC time to
 * America/Sao_Paulo and fires once per day when the local hour is 8.
 */

import { getAllUserIds, runNotificationJob } from "./db";

const JOB_HOUR_SP = 8; // 08:00 America/Sao_Paulo
const CHECK_INTERVAL_MS = 60 * 1000; // check every minute

let lastFiredDate: string | null = null; // "YYYY-MM-DD" in São Paulo timezone

function getSaoPauloDateString(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }); // returns "YYYY-MM-DD"
}

function getSaoPauloHour(): number {
  return parseInt(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    }),
    10
  );
}

async function runDailyJob() {
  const today = getSaoPauloDateString();

  // Guard: only fire once per day
  if (lastFiredDate === today) return;
  lastFiredDate = today;

  console.log(`[DailyJob] Running notification job for ${today} at 08:00 (America/Sao_Paulo)`);

  try {
    const userIds = await getAllUserIds();
    let totalDeadline = 0;
    let totalOverdue = 0;

    for (const userId of userIds) {
      const result = await runNotificationJob(userId);
      totalDeadline += result.deadlineCount;
      totalOverdue += result.overdueCount;
    }

    console.log(
      `[DailyJob] Done — ${userIds.length} user(s) processed, ` +
        `${totalDeadline} deadline notification(s), ${totalOverdue} overdue notification(s)`
    );
  } catch (err) {
    console.error("[DailyJob] Error running notification job:", err);
    // Reset so it retries on the next minute if it failed
    lastFiredDate = null;
  }
}

/**
 * Start the scheduler. Call this once at server startup.
 * The interval checks every minute whether it's 08:xx in São Paulo and
 * whether the job hasn't already run today.
 */
export function startDailyJobScheduler() {
  console.log("[DailyJob] Scheduler started — will fire daily at 08:00 (America/Sao_Paulo)");

  const tick = () => {
    const hour = getSaoPauloHour();
    if (hour === JOB_HOUR_SP) {
      runDailyJob().catch(console.error);
    }
  };

  // Run immediately on startup to catch any missed notifications
  // (e.g., server restarted after 08:00)
  const startupHour = getSaoPauloHour();
  if (startupHour >= JOB_HOUR_SP) {
    console.log("[DailyJob] Server started after 08:00 — running catch-up job now");
    runDailyJob().catch(console.error);
  }

  setInterval(tick, CHECK_INTERVAL_MS);
}
