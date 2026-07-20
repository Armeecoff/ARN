// ARN ULTRA.txt job.
//
// Sources and picks:
//   1. flaafix/AetrisVPN-white-list-lite — config #1  → "LTE | 🇩🇪 Германия"
//   2. kama55726/KomaryServers           — config #2  → "LTE | 🇫🇷 Франция"
//                                        — config #3  → "LTE | 🇳🇱 Нидерланды"
//   3. RKPchannel/RKP_bypass_configs     — config #31 → "LTE | 🇷🇺 Россия"
//   4. igareck/WHITE-CIDR-RU-checked     — config #19 → "LTE | 🇭🇺 Венгрия"
//
// Random specials applied to final list:
//   1 → 🇸🇴 Автовыбор
//   1 → 🇸🇴 Выбор по пингу❇️
//   3 → 🇪🇺 Европа
//   3 → existing tag + 🔥
//
// All configs get ?serverDescription=base64("VLESS/GPRC/XHTTP/REALITY") appended.

import { fetchLiveConfigLines } from "../lib/source.js";
import { pushConfigsToGitHub } from "../lib/github.js";
import { addServerDescription } from "../lib/rename.js";

const GITHUB_OWNER     = process.env.GITHUB_OWNER     || "Armeecoff";
const GITHUB_REPO      = process.env.GITHUB_REPO      || "ARN";
const GITHUB_BRANCH    = process.env.GITHUB_BRANCH    || "main";
const GITHUB_FILE_PATH = process.env.ULTRA_FILE_PATH  || "ARN ULTRA.txt";
const HEADER_LINES     = Number(process.env.HEADER_LINES || 6);

// ── Sources ─────────────────────────────────────────────────────────────────

const SRC_AETRIS  = "https://raw.githubusercontent.com/flaafix/AetrisVPN-white-list-lite/refs/heads/main/AetrisVPN.txt";
const SRC_KOMARY  = "https://raw.githubusercontent.com/kama55726/KomaryServers/refs/heads/main/KomaryServ";
const SRC_RKP     = "https://raw.githubusercontent.com/RKPchannel/RKP_bypass_configs/refs/heads/main/whitelist.txt";
const SRC_IGARECK = "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/WHITE-CIDR-RU-checked.txt";

// ── Tag helpers ──────────────────────────────────────────────────────────────

function getBase(line) {
  const idx = line.lastIndexOf("#");
  return idx === -1 ? line : line.slice(0, idx);
}

function getTagRaw(line) {
  const idx = line.lastIndexOf("#");
  return idx === -1 ? "" : decodeURIComponent(line.slice(idx + 1));
}

function withTag(line, tag) {
  return `${getBase(line)}#${encodeURIComponent(tag)}`;
}

// Pick a 1-based position from a lines array; returns null if out of range.
function pick(lines, pos1) {
  const line = lines[pos1 - 1];
  return line || null;
}

// ── Special renames ──────────────────────────────────────────────────────────

function pickRandom(len, n, used) {
  const pool = [];
  for (let i = 0; i < len; i++) if (!used.has(i)) pool.push(i);
  for (let i = 0; i < Math.min(n, pool.length); i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

function applySpecialRenames(configs) {
  const result = configs.slice();
  const used = new Set();

  function pickN(n) {
    const indices = pickRandom(result.length, n, used);
    indices.forEach(i => used.add(i));
    return indices;
  }

  for (const i of pickN(1)) result[i] = withTag(result[i], `🇸🇴 Автовыбор`);
  for (const i of pickN(1)) result[i] = withTag(result[i], `🇸🇴 Выбор по пингу❇️`);
  for (const i of pickN(3)) result[i] = withTag(result[i], `🇪🇺 Европа`);
  for (const i of pickN(3)) result[i] = withTag(result[i], `${getTagRaw(result[i])} 🔥`);

  return result;
}

// ── Build ────────────────────────────────────────────────────────────────────

/**
 * @param {{ exclude?: Set<number> }} [opts]
 * @returns {Promise<string[]>}
 */
export async function buildUltraConfigs({ exclude = new Set() } = {}) {
  console.log(`[ultra] Fetching all sources in parallel...`);

  const [aetrisLines, komaryLines, rkpLines, igareckLines] = await Promise.all([
    fetchLiveConfigLines(SRC_AETRIS),
    fetchLiveConfigLines(SRC_KOMARY),
    fetchLiveConfigLines(SRC_RKP),
    fetchLiveConfigLines(SRC_IGARECK),
  ]);

  console.log(`[ultra] Lines: aetris=${aetrisLines.length}, komary=${komaryLines.length}, rkp=${rkpLines.length}, igareck=${igareckLines.length}`);

  const picks = [
    { src: aetrisLines,  pos: 1,  tag: "LTE | 🇩🇪 Германия"   },
    { src: komaryLines,  pos: 2,  tag: "LTE | 🇫🇷 Франция"    },
    { src: komaryLines,  pos: 3,  tag: "LTE | 🇳🇱 Нидерланды" },
    { src: rkpLines,     pos: 31, tag: "LTE | 🇷🇺 Россия"      },
    { src: igareckLines, pos: 19, tag: "LTE | 🇭🇺 Венгрия"    },
  ];

  const renamed = [];
  for (const { src, pos, tag } of picks) {
    const line = pick(src, pos);
    if (!line) {
      console.warn(`[ultra] Position ${pos} not found in source for "${tag}", skipping.`);
      continue;
    }
    renamed.push(withTag(line, tag));
    console.log(`[ultra] Picked pos=${pos} → "${tag}"`);
  }

  const withSpecials = applySpecialRenames(renamed);
  const final = withSpecials.map(addServerDescription);

  if (exclude.size > 0) {
    const filtered = final.filter((_, i) => !exclude.has(i + 1));
    console.log(`[ultra] Excluded ${final.length - filtered.length} via bot session. Total: ${filtered.length}.`);
    return filtered;
  }

  console.log(`[ultra] Total: ${final.length} configs.`);
  return final;
}

/**
 * @param {{ token: string, exclude?: Set<number> }} opts
 */
export async function runUltra({ token, exclude = new Set() }) {
  const configLines = await buildUltraConfigs({ exclude });
  await pushConfigsToGitHub({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: GITHUB_FILE_PATH,
    branch: GITHUB_BRANCH, token, headerLines: HEADER_LINES, configLines,
  });
  console.log(`[ultra] Done.`);
}
