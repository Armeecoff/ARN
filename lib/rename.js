// Shared tag-renaming helpers used across jobs.

import { toRussianCountryTag } from "./countries.js";

const VLESS_NOTE = "VLESS/GPRC/XHTTP/REALITY";

function splitTag(line) {
  const hashIndex = line.lastIndexOf("#");
  const base = hashIndex === -1 ? line : line.slice(0, hashIndex);
  const tag = hashIndex === -1 ? "" : decodeURIComponent(line.slice(hashIndex + 1));
  return { base, tag };
}

function withTag(base, tag) {
  return `${base}#${encodeURIComponent(tag)}`;
}

// ---------------------------------------------------------------------------
// Basic / generic helpers
// ---------------------------------------------------------------------------

// Renames a config's tag to the matching Russian country name + flag.
// Returns the original line unchanged (with a warning) if no known country found.
export function renameFlagCountry(line, { logPrefix = "rename" } = {}) {
  const { base, tag } = splitTag(line);
  const ruTag = toRussianCountryTag(tag);
  if (!ruTag) {
    console.warn(`[${logPrefix}] Could not detect country for tag "${tag}", keeping it as-is.`);
    return line;
  }
  return withTag(base, ruTag);
}

// Renames a config's tag to "<fixedTag> — #<number>".
export function renameSequential(line, fixedTag, number) {
  const { base } = splitTag(line);
  return withTag(base, `${fixedTag} — #${number}`);
}

// Renames a config's tag to a fixed string.
export function renameFixed(line, fixedTag) {
  const { base } = splitTag(line);
  return withTag(base, fixedTag);
}

// Appends " (<suffix>)" to a config's existing tag.
export function appendSuffix(line, suffix) {
  const { base, tag } = splitTag(line);
  return withTag(base, `${tag} (${suffix})`);
}

// ---------------------------------------------------------------------------
// Ultra helpers  (return null → caller should skip the config)
// ---------------------------------------------------------------------------

// Ultra main + extra: "LTE | {flag} {Russian country}"
export function renameUltraMain(line, { logPrefix = "rename" } = {}) {
  const { base, tag } = splitTag(line);
  const ruTag = toRussianCountryTag(tag);
  if (!ruTag) {
    console.warn(`[${logPrefix}] No Russian name for "${tag}", skipping config.`);
    return null;
  }
  return withTag(base, `LTE | ${ruTag}`);
}

export function renameUltraExtra(line, { logPrefix = "rename" } = {}) {
  const { base, tag } = splitTag(line);
  const ruTag = toRussianCountryTag(tag);
  if (!ruTag) {
    console.warn(`[${logPrefix}] No Russian name for "${tag}", skipping config.`);
    return null;
  }
  return withTag(base, `LTE | ${ruTag}`);
}

// ---------------------------------------------------------------------------
// Pro helper  (returns null → caller falls back to original line with warning)
// ---------------------------------------------------------------------------

// Pro source: "WIFI | {flag} {Russian country}"
export function renameProWifi(line, { logPrefix = "rename" } = {}) {
  const { base, tag } = splitTag(line);
  const ruTag = toRussianCountryTag(tag);
  if (!ruTag) {
    console.warn(`[${logPrefix}] No Russian name for "${tag}", keeping as-is.`);
    return null;
  }
  return withTag(base, `WIFI | ${ruTag}`);
}

// ---------------------------------------------------------------------------
// serverDescription parameter
// ---------------------------------------------------------------------------

// Adds ?serverDescription=<base64("VLESS/GPRC/XHTTP/REALITY")> to a config's URL params.
// The description is always the fixed protocol-info string, base64-encoded.
// Only applied to URL-format protocols (vless, trojan, hysteria2, ss).
// vmess (base64 blob) is returned unchanged.
const SERVER_DESCRIPTION_B64 = Buffer.from("VLESS/GPRC/XHTTP/REALITY", "utf8").toString("base64");

export function addServerDescription(line) {
  if (line.startsWith("vmess://")) return line; // vmess is a base64 blob, not a URL
  const hashIndex = line.lastIndexOf("#");
  if (hashIndex === -1) return line;
  const urlPart = line.slice(0, hashIndex);
  const encodedTag = line.slice(hashIndex + 1);
  const sep = urlPart.includes("?") ? "&" : "?";
  return `${urlPart}${sep}serverDescription=${SERVER_DESCRIPTION_B64}#${encodedTag}`;
}
