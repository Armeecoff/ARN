// TLS reachability probe for VPN config lines.
//
// Parses host:port from vless://, vmess://, trojan://, hysteria2://, ss://
// lines and tests a full TLS handshake with a short timeout.  A successful
// TLS handshake is a much stronger signal than a raw TCP connect: it confirms
// the server is actually up and responding to the TLS layer, which is what
// Reality servers require.
//
// Used by fetchLiveConfigLines() in source.js to filter out dead servers
// before position-based selection happens in jobs.

import tls from "tls";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CONCURRENCY = 40;

// ---------------------------------------------------------------------------
// Host/port extraction
// ---------------------------------------------------------------------------

function parseHostPort(line) {
  try {
    if (line.startsWith("vmess://")) {
      // vmess://base64encodedJSON
      const b64 = line.slice(8).split("#")[0];
      const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      const host = json.add || json.host;
      const port = parseInt(json.port, 10);
      if (host && port) return { host, port };
      return null;
    }

    // vless://, trojan://, hysteria2://, ss:// all follow URL syntax
    const url = new URL(line);
    const host = url.hostname;
    const port = parseInt(url.port, 10);
    if (host && port) return { host, port };
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Single TLS handshake probe
// ---------------------------------------------------------------------------
// We use rejectUnauthorized:false because Reality servers present self-signed
// or domain-fronted certs — we only care that the TLS handshake completes,
// not that the certificate chain is trusted.

function tlsProbe(host, port, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    let socket;
    try {
      socket = tls.connect(
        { host, port, rejectUnauthorized: false, servername: host },
        () => {
          // secureConnect callback — TLS handshake succeeded
          clearTimeout(timer);
          socket.destroy();
          done(true);
        }
      );
    } catch {
      done(false);
      return;
    }

    const timer = setTimeout(() => {
      socket.destroy();
      done(false);
    }, timeoutMs);

    socket.on("error", () => {
      clearTimeout(timer);
      socket.destroy();
      done(false);
    });

    socket.on("timeout", () => {
      clearTimeout(timer);
      socket.destroy();
      done(false);
    });
  });
}

// ---------------------------------------------------------------------------
// Batch probe (concurrency-limited)
// ---------------------------------------------------------------------------

/**
 * Returns only the lines whose server completes a TLS handshake.
 *
 * A TLS handshake is far more reliable than a raw TCP connect for VPN servers
 * because it proves the server is actually alive and processing TLS — not just
 * that a port happens to be open on a firewall.  This eliminates ghost servers
 * that accept TCP but never finish the handshake.
 *
 * @param {string[]} lines       - Raw config lines (vless://, vmess://, etc.)
 * @param {object}   [opts]
 * @param {number}   [opts.timeoutMs=5000]  - Per-probe TLS timeout in ms.
 * @param {number}   [opts.concurrency=40]  - Max simultaneous probes.
 * @param {string}   [opts.logPrefix='probe'] - Console log prefix.
 * @returns {Promise<string[]>} Live config lines in original order.
 */
export async function filterReachable(lines, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  concurrency = DEFAULT_CONCURRENCY,
  logPrefix = "probe",
} = {}) {
  const results = new Array(lines.length).fill(false);

  for (let i = 0; i < lines.length; i += concurrency) {
    const batch = lines.slice(i, i + concurrency);
    const checks = await Promise.all(
      batch.map((line) => {
        const hp = parseHostPort(line);
        if (!hp) return Promise.resolve(false);
        return tlsProbe(hp.host, hp.port, timeoutMs);
      })
    );
    checks.forEach((ok, j) => { results[i + j] = ok; });
  }

  const live = lines.filter((_, i) => results[i]);
  console.log(
    `[${logPrefix}] ${live.length}/${lines.length} servers passed TLS handshake (timeout ${timeoutMs}ms).`
  );
  return live;
}
