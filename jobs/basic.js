// ARN.txt (Basic) job.
//
// Takes the first BASIC_CONFIG_COUNT configs (in source order) from
// SOURCE_URL, renames all of them to the fixed tag "🇷🇺 Россия Ютуб"
// (flag always included, regardless of what the source tag had), and
// replaces the config lines of ARN.txt (the file's header lines are left
// untouched aside from the traffic bump).

import { fetchLiveConfigLines } from "../lib/source.js";
import { pushConfigsToGitHub } from "../lib/github.js";
import { renameFixed } from "../lib/rename.js";

const SOURCE_URL =
  process.env.BASIC_SOURCE_URL ||
  process.env.PRO_SOURCE_URL ||
  "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/Vless-Reality-White-Lists-Rus-Mobile.txt";

const GITHUB_OWNER = process.env.GITHUB_OWNER || "Armeecoff";
const GITHUB_REPO = process.env.GITHUB_REPO || "ARN";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_FILE_PATH = process.env.BASIC_FILE_PATH || "ARN.txt";
const HEADER_LINES = Number(process.env.HEADER_LINES || 6);

const BASIC_CONFIG_COUNT = 4;
const NEW_TAG = "🇷🇺 Россия Ютуб";

/**
 * @param {{ exclude?: Set<number> }} [opts]
 * @returns {Promise<string[]>}
 */
export async function buildBasicConfigs({ exclude = new Set() } = {}) {
  console.log(`[basic] Fetching source configs from ${SOURCE_URL}...`);
  const sourceLines = await fetchLiveConfigLines(SOURCE_URL);
  console.log(`[basic] Fetched ${sourceLines.length} configs.`);

  const selected = sourceLines.slice(0, BASIC_CONFIG_COUNT);
  if (selected.length !== BASIC_CONFIG_COUNT) {
    console.warn(
      `[basic] Expected ${BASIC_CONFIG_COUNT} configs but only found ${selected.length} — source list may have shrunk.`
    );
  }

  const built = selected.map((line) => renameFixed(line, NEW_TAG));

  if (exclude.size > 0) {
    const filtered = built.filter((_, i) => !exclude.has(i + 1));
    console.log(`[basic] Excluded ${built.length - filtered.length} configs via bot session.`);
    return filtered;
  }
  return built;
}

/**
 * @param {{ token: string, exclude?: Set<number> }} opts
 */
export async function runBasic({ token, exclude = new Set() }) {
  const configLines = await buildBasicConfigs({ exclude });
  console.log(`[basic] Pushing ${configLines.length} configs to ${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_FILE_PATH}...`);
  await pushConfigsToGitHub({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: GITHUB_FILE_PATH,
    branch: GITHUB_BRANCH,
    token,
    headerLines: HEADER_LINES,
    configLines,
  });
  console.log(`[basic] Done.`);
}
