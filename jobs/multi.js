// ARN Multi.txt job.
//
// Combines Ultra + Pro + Basic configs (in that order) without any suffix label.
// The first HEADER_LINES lines of the file are never modified (traffic bump aside).
// Optional extraLines (raw vless:// lines) are appended at the end.

import { pushConfigsToGitHub } from "../lib/github.js";
import { buildBasicConfigs } from "./basic.js";
import { buildProConfigs } from "./pro.js";
import { buildUltraConfigs } from "./ultra.js";

const GITHUB_OWNER = process.env.GITHUB_OWNER || "Armeecoff";
const GITHUB_REPO = process.env.GITHUB_REPO || "ARN";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_FILE_PATH = process.env.MULTI_FILE_PATH || "ARN Multi.txt";
const HEADER_LINES = Number(process.env.HEADER_LINES || 6);

/**
 * @param {{ token: string, excludes?: { basic?: Set<number>, pro?: Set<number>, ultra?: Set<number> }, extraLines?: string[] }} opts
 */
export async function runMulti({ token, excludes = {}, extraLines = [] }) {
  console.log(`[multi] Rebuilding Ultra/Pro/Basic config lists...`);
  const [ultra, pro, basic] = await Promise.all([
    buildUltraConfigs({ exclude: excludes.ultra ?? new Set() }),
    buildProConfigs({ exclude: excludes.pro ?? new Set() }),
    buildBasicConfigs({ exclude: excludes.basic ?? new Set() }),
  ]);

  const configLines = [...ultra, ...pro, ...basic, ...extraLines];
  if (extraLines.length > 0) {
    console.log(`[multi] +${extraLines.length} extra configs from bot session.`);
  }
  console.log(`[multi] Pushing ${configLines.length} configs (Ultra:${ultra.length} Pro:${pro.length} Basic:${basic.length} Extra:${extraLines.length})...`);

  await pushConfigsToGitHub({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: GITHUB_FILE_PATH,
    branch: GITHUB_BRANCH, token, headerLines: HEADER_LINES, configLines,
  });
  console.log(`[multi] Done.`);
}
