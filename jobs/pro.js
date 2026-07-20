// ARN Pro.txt job.
//
// From SOURCE_URL, picks configs at fixed 1-based positions, renames each to
// "WIFI | {flag} {Russian country}". One randomly chosen config is renamed to
// "🇪🇺 Европа". Configs whose country cannot be detected keep their original
// tag (with a warning). All configs get ?serverDescription=<base64(tag)>.

import { fetchLiveConfigLines } from "../lib/source.js";
import { pushConfigsToGitHub } from "../lib/github.js";
import { renameProWifi, addServerDescription } from "../lib/rename.js";

const SOURCE_URL =
  process.env.PRO_SOURCE_URL ||
  "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/Vless-Reality-White-Lists-Rus-Mobile.txt";

const GITHUB_OWNER = process.env.GITHUB_OWNER || "Armeecoff";
const GITHUB_REPO = process.env.GITHUB_REPO || "ARN";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_FILE_PATH = process.env.PRO_FILE_PATH || "ARN Pro.txt";
const HEADER_LINES = Number(process.env.HEADER_LINES || 6);

const CONFIG_INDICES = [5, 22, 26, 27, 28, 29, 30, 31, 32, 33, 34, 40, 41, 42, 43, 13, 14, 15, 16, 17];

function getBase(line) {
  const idx = line.lastIndexOf("#");
  return idx === -1 ? line : line.slice(0, idx);
}

function withTag(line, tag) {
  return `${getBase(line)}#${encodeURIComponent(tag)}`;
}

/**
 * @param {{ exclude?: Set<number> }} [opts]
 * @returns {Promise<string[]>}
 */
export async function buildProConfigs({ exclude = new Set() } = {}) {
  console.log(`[pro] Fetching source...`);
  const sourceLines = await fetchLiveConfigLines(SOURCE_URL);
  console.log(`[pro] ${sourceLines.length} configs.`);

  const uniqueSorted = [...new Set(CONFIG_INDICES)].sort((a, b) => a - b);
  const selected = uniqueSorted.map(i => sourceLines[i - 1]).filter(Boolean);

  if (selected.length !== uniqueSorted.length) {
    console.warn(`[pro] Expected ${uniqueSorted.length} configs but found ${selected.length}.`);
  }

  // Rename all to "WIFI | {flag} {country}" (fallback: keep original tag).
  const renamed = selected.map(line => renameProWifi(line, { logPrefix: "pro" }) ?? line);

  // Pick 1 random index → 🇪🇺 Европа.
  if (renamed.length > 0) {
    const idx = Math.floor(Math.random() * renamed.length);
    renamed[idx] = withTag(renamed[idx], "🇪🇺 Европа");
    console.log(`[pro] Config #${idx + 1} renamed to 🇪🇺 Европа.`);
  }

  const built = renamed.map(addServerDescription);

  if (exclude.size > 0) {
    const filtered = built.filter((_, i) => !exclude.has(i + 1));
    console.log(`[pro] Excluded ${built.length - filtered.length} configs via bot session.`);
    return filtered;
  }
  return built;
}

/**
 * @param {{ token: string, exclude?: Set<number> }} opts
 */
export async function runPro({ token, exclude = new Set() }) {
  const configLines = await buildProConfigs({ exclude });
  console.log(`[pro] Pushing ${configLines.length} configs...`);
  await pushConfigsToGitHub({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: GITHUB_FILE_PATH,
    branch: GITHUB_BRANCH, token, headerLines: HEADER_LINES, configLines,
  });
  console.log(`[pro] Done.`);
}
