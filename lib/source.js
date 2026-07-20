// Shared helper to fetch and parse a subscription-style txt file into config lines.
// Reachability probing is intentionally disabled — all configs from the source
// are returned regardless of whether the server is currently reachable.

const CONFIG_PREFIXES = ["vless://", "vmess://", "trojan://", "hysteria2://", "ss://"];

export async function fetchConfigLines(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch source list ${url}: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => CONFIG_PREFIXES.some((p) => l.startsWith(p)));
}

// Alias kept so existing job imports don't need changing.
export const fetchLiveConfigLines = fetchConfigLines;
