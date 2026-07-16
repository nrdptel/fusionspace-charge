// Post-build: compute a hash-based Content-Security-Policy for the static export and inject it
// into out/_headers, replacing the `# CSP-PLACEHOLDER` marker.
//
// Why hashes: the Next.js App Router static export emits inline scripts — the pre-paint theme-init
// script, the JSON-LD block, and ~a dozen per-page `self.__next_f` hydration scripts. A static
// export has no request-time nonce, so hashes are the only way to keep `script-src` free of
// 'unsafe-inline'. We hash the *exact bytes* in the built HTML, which are the bytes Cloudflare
// serves, so the policy always matches the page. Because the hydration scripts change every build,
// this runs on every build (npm `postbuild`) and stays in sync automatically.
//
// The policy is the union of all pages' inline-script hashes; a hash whitelisted for one page is
// harmless on another (all are first-party). If no inline scripts are found the script fails hard
// rather than write a policy that would blank the site.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const OUT = "out";
const PLACEHOLDER = "# CSP-PLACEHOLDER";

function htmlFiles(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) found.push(...htmlFiles(p));
    else if (name.endsWith(".html")) found.push(p);
  }
  return found;
}

// Every inline <script> (no src=) — executable JS and the ld+json data block alike, so a browser
// that enforces script-src on ld+json still finds a matching hash. Non-greedy body: an inline
// script can never contain a literal </script>, so the first close tag is always the real one.
const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;

const files = htmlFiles(OUT);
const hashes = new Set();
for (const file of files) {
  const html = readFileSync(file, "utf8");
  for (const [, body] of html.matchAll(INLINE_SCRIPT)) {
    const digest = createHash("sha256").update(body, "utf8").digest("base64");
    hashes.add(`'sha256-${digest}'`);
  }
}

if (hashes.size === 0) {
  console.error("gen-csp: found no inline scripts — refusing to write a script-src that would break the app");
  process.exit(1);
}

const csp = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' ${[...hashes].sort().join(" ")}`,
  // Tailwind/React set inline styles; inline <style> is far lower risk than inline script.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  // 'self' only — the app makes no third-party requests; this enforces that at the browser.
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const headersPath = join(OUT, "_headers");
const headers = readFileSync(headersPath, "utf8");
if (!headers.includes(PLACEHOLDER)) {
  console.error(`gen-csp: '${PLACEHOLDER}' not found in ${headersPath} — is public/_headers set up?`);
  process.exit(1);
}
writeFileSync(headersPath, headers.replace(PLACEHOLDER, `Content-Security-Policy: ${csp}`));
console.log(`gen-csp: wrote CSP with ${hashes.size} script hashes from ${files.length} HTML file(s).`);
