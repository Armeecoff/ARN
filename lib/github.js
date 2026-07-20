// Shared GitHub read/write helpers.

import { bumpHeader } from "./traffic.js";

export async function getExistingFile({ owner, repo, path, branch, token, headerLines }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(
    path
  )}?ref=${branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (res.status === 404) return { sha: null, header: [] };
  if (!res.ok) {
    throw new Error(`Failed to read existing file ${path}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  const header = content.split("\n").slice(0, headerLines);
  return { sha: data.sha, header };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function putFile({ owner, repo, path, branch, token, sha, content }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message: `Update ${path} — ${new Date().toISOString()}`,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch,
    ...(sha ? { sha } : {}),
  };

  return fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// GitHub's content API can briefly serve a stale sha right after another
// write (read-replica lag), which makes the PUT fail with 409 Conflict even
// though nothing else is really racing us. Retry a couple of times with a
// fresh sha before giving up.
export async function pushConfigsToGitHub({
  owner,
  repo,
  path,
  branch,
  token,
  headerLines,
  configLines,
  maxRetries = 3,
  bumpTraffic = bumpHeader,
  announceBase64 = null, // if set, rewrites only the "#announce: base64:..." line
}) {
  const buildHeader = (fetched) => {
    const bumped = bumpTraffic ? bumpTraffic(fetched) : fetched;
    if (!announceBase64) return bumped;
    return bumped.map(line =>
      /^#announce:/.test(line)
        ? `#announce: base64:${announceBase64}`
        : line
    );
  };

  const content = (header) => [...header, ...configLines].join("\n") + "\n";

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { sha, header: fetchedHeader } = await getExistingFile({ owner, repo, path, branch, token, headerLines });
    const header = buildHeader(fetchedHeader);
    const res = await putFile({ owner, repo, path, branch, token, sha, content: content(header) });

    if (res.ok) {
      return res.json();
    }

    const errText = await res.text();
    lastError = new Error(`GitHub update failed for ${path}: ${res.status} ${res.statusText} — ${errText}`);

    if (res.status !== 409 || attempt === maxRetries) {
      throw lastError;
    }

    console.warn(`[github] ${path}: sha conflict (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`);
    await sleep(750 * (attempt + 1));
  }

  throw lastError;
}
