// Runs all update jobs (ARN.txt, ARN Pro.txt, ARN ULTRA.txt, ARN Multi.txt)
// once at startup, then on an hourly cron schedule.
// Also starts the Telegram bot for on-demand admin control.

import cron from "node-cron";
import { runUltra } from "./jobs/ultra.js";
import { runPro } from "./jobs/pro.js";
import { runBasic } from "./jobs/basic.js";
import { runMulti } from "./jobs/multi.js";
import { startBot } from "./bot.js";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "0 * * * *"; // every hour

if (!GITHUB_TOKEN) {
  console.error("GITHUB_TOKEN env var is required.");
  process.exit(1);
}

/**
 * Runs all four update jobs.
 * @param {{ excludes?: { basic?: Set<number>, pro?: Set<number>, ultra?: Set<number> }, extraLines?: string[] }} [overrides]
 */
export async function runAll({ excludes = {}, extraLines = [] } = {}) {
  const excBasic = excludes.basic ?? new Set();
  const excPro   = excludes.pro   ?? new Set();
  const excUltra = excludes.ultra ?? new Set();

  const results = await Promise.allSettled([
    runBasic({ token: GITHUB_TOKEN, exclude: excBasic }),
    runPro({ token: GITHUB_TOKEN, exclude: excPro }),
    runUltra({ token: GITHUB_TOKEN, exclude: excUltra }),
    runMulti({ token: GITHUB_TOKEN, excludes: { basic: excBasic, pro: excPro, ultra: excUltra }, extraLines }),
  ]);
  results.forEach((r) => {
    if (r.status === "rejected") {
      console.error("Job failed:", r.reason?.message || r.reason);
    }
  });
}

async function main() {
  // Start Telegram bot (non-blocking).
  startBot(runAll);

  if (process.env.RUN_ONCE === "true") {
    console.log(`[${new Date().toISOString()}] Running once...`);
    await runAll();
    return;
  }

  console.log(`[${new Date().toISOString()}] Running initial update...`);
  await runAll();

  console.log(`Scheduling updates with cron "${CRON_SCHEDULE}" (every hour by default).`);
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled update...`);
    await runAll();
  });
}

main();
