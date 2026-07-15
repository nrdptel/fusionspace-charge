/**
 * Builds a self-contained HTML recovery report: the documentation half of the tool. The
 * field card is "what to do at the pad"; this is "proof of how it was designed and
 * validated" — for a cert package (Tripoli/NAR L1–L3), a project writeup, or a build
 * thread. It compiles the configuration, the sizing rationale with the actual formula and
 * constants, and the logged ground-test results into one printable, shareable file with no
 * external dependencies, so it opens anywhere and survives offline.
 *
 * Pure: takes already-formatted strings and returns an HTML document. Everything from the
 * user (airframe name, notes) is escaped.
 */

export interface ReportData {
  title: string;
  generatedAt: string;
  /** Configuration rows: [label, value]. */
  summary: [string, string][];
  /** One block per charge well, each a list of [label, value] rows. */
  wells: { title: string; rows: [string, string][] }[];
  /** The sizing method, as already-formatted lines (formula, constants, worked example). */
  method: string[];
  /** Ground-test table header cells. */
  testsHeader: string[];
  /** Ground-test table rows (cells). Empty when nothing is logged. */
  tests: string[][];
  /** Validation / calibration summary, or a prompt to go test. */
  testsNote: string;
  /** Overrides the default "no charge well is sized yet" copy when there are no wells for a
   *  reason other than empty ideal-gas inputs — e.g. a Fetter compartment awaiting geometry,
   *  or a deployment outside the model's altitude envelope. Keeps the report from telling a
   *  Fetter user to "enter a target pressure or separation force" that mode doesn't have. */
  emptyNote?: string;
  /** Where the values come from — citations for the cert/build documentation. */
  references?: { label: string; detail: string; url?: string }[];
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const rows = (pairs: [string, string][]): string =>
  pairs
    .map(
      ([k, v]) =>
        `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`,
    )
    .join("");

// Only emit a link for a safe, non-scripting scheme. Reference URLs are hardcoded today,
// but this guarantees a `javascript:`/`data:` URL can never become a live link in the
// downloaded document even if a URL ever comes from data. Returns null to drop the href.
function safeHref(url: string): string | null {
  const u = url.trim();
  // Emit the same trimmed value that was validated, so a passing href can't carry leading/trailing
  // whitespace the check ignored.
  return /^(https?:\/\/|#|\/)/i.test(u) ? u : null;
}

export function buildReportHtml(d: ReportData): string {
  const wells =
    d.wells.length > 0
      ? d.wells
          .map(
            (w) =>
              `<section><h2>${escapeHtml(w.title)}</h2><table class="kv">${rows(w.rows)}</table></section>`,
          )
          .join("")
      : `<section><h2>Charge wells</h2><p class="note">${escapeHtml(
          d.emptyNote ??
            "No charge well is sized yet. Enter an inner diameter and a pressurized length (and a target pressure or separation force) for at least one well.",
        )}</p></section>`;

  const method = `<section><h2>How the number was sized</h2><pre>${d.method
    .map(escapeHtml)
    .join("\n")}</pre></section>`;

  const testTable =
    d.tests.length > 0
      ? `<table class="grid"><thead><tr>${d.testsHeader
          .map((h) => `<th>${escapeHtml(h)}</th>`)
          .join("")}</tr></thead><tbody>${d.tests
          .map(
            (r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`,
          )
          .join("")}</tbody></table>`
      : "";

  const references = d.references?.length
    ? `<section><h2>References &amp; sources</h2><ul class="refs">${d.references
        .map((r) => {
          const href = r.url ? safeHref(r.url) : null;
          return `<li><strong>${escapeHtml(r.label)}.</strong> ${escapeHtml(r.detail)}${
            href ? ` <a href="${escapeHtml(href)}">source</a>` : ""
          }</li>`;
        })
        .join("")}</ul></section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(d.title)} — recovery report</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #18181b; background: #fff; margin: 0; padding: 2.5rem 1.5rem; }
  main { max-width: 50rem; margin: 0 auto; }
  header { border-bottom: 2px solid #18181b; padding-bottom: .75rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
  h1 { font-size: 1.4rem; margin: 0; letter-spacing: -.01em; }
  .meta { color: #52525b; font-size: .85rem; }
  h2 { font-size: 1.05rem; margin: 1.6rem 0 .5rem; border-bottom: 1px solid #d4d4d8; padding-bottom: .25rem; }
  table { border-collapse: collapse; width: 100%; }
  table.kv th { text-align: left; font-weight: 600; color: #3f3f46; width: 14rem; padding: .25rem .5rem .25rem 0; vertical-align: top; }
  table.kv td { padding: .25rem 0; font-variant-numeric: tabular-nums; }
  table.grid th, table.grid td { border: 1px solid #d4d4d8; padding: .4rem .55rem; text-align: left; font-size: .9rem; vertical-align: top; }
  table.grid th { background: #f4f4f5; font-weight: 600; }
  pre { background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 6px; padding: .75rem .9rem; overflow-x: auto; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; }
  .note { color: #3f3f46; font-size: .9rem; margin-top: .6rem; }
  ul.refs { margin: .5rem 0 0; padding-left: 1.1rem; font-size: .9rem; color: #3f3f46; }
  ul.refs li { margin: .35rem 0; }
  a { color: #4f46e5; }
  footer { border-top: 2px solid #18181b; margin-top: 2rem; padding-top: .75rem; color: #52525b; font-size: .8rem; }
  footer strong { color: #18181b; }
  @media print {
    body { padding: 0; }
    a { color: inherit; text-decoration: none; }
    /* Keep a well block, the formula, and the test table from splitting across a page. */
    section, pre, table.grid { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<main>
  <header>
    <h1>${escapeHtml(d.title)} — recovery report</h1>
    <span class="meta">${escapeHtml(d.generatedAt)} · charge.fusionspace.co</span>
  </header>

  <section><h2>Configuration</h2><table class="kv">${rows(d.summary)}</table></section>
  ${wells}
  ${method}

  <section>
    <h2>Ground-test results</h2>
    ${testTable}
    <p class="note">${escapeHtml(d.testsNote)}</p>
  </section>
  ${references}

  <footer>
    <strong>These charges are theoretical starting estimates, not numbers to fly unverified.</strong>
    Bench-test from the low charge up until separation is clean and energetic, and fly the
    charge you proved — not the one the formula guessed. Black powder is an explosive; sizing,
    handling, and use are your responsibility.
  </footer>
</main>
</body>
</html>`;
}
