// Bumps the `#subscription-userinfo:` header line by a random amount each
// run, simulating traffic usage growth (upload and download both increase by
// the same random value, independently per file).

const GB = 1024 ** 3;
const MIN_GB = Number(process.env.TRAFFIC_BUMP_MIN_GB || 1);
const MAX_GB = Number(process.env.TRAFFIC_BUMP_MAX_GB || 4);

const USERINFO_RE = /^(#subscription-userinfo:\s*)upload=(\d+);\s*download=(\d+);(.*)$/;

function randomBumpBytes() {
  const gb = MIN_GB + Math.random() * (MAX_GB - MIN_GB);
  return Math.round(gb * GB);
}

export function bumpUserInfoLine(line) {
  const match = line.match(USERINFO_RE);
  if (!match) return line;

  const [, prefix, upload, download, rest] = match;
  const bump = randomBumpBytes();
  const newUpload = BigInt(upload) + BigInt(bump);
  const newDownload = BigInt(download) + BigInt(bump);

  return `${prefix}upload=${newUpload}; download=${newDownload};${rest}`;
}

export function bumpHeader(headerLines) {
  return headerLines.map((line) => bumpUserInfoLine(line));
}
