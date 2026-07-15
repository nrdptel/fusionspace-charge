/**
 * Builds the build & ground-test card as a self-contained HTML document — the field
 * artifact you bring to the bench or the pad. Same source for both export formats: "HTML"
 * downloads this string as a file; "PDF" renders it and invokes the browser's print →
 * Save as PDF. Pure (data → string), with every user-supplied value escaped.
 */

import { escapeHtml } from "./report";

export interface PlanStep {
  label: string;
  grams: string;
}

export interface PlanWell {
  title: string;
  idText: string;
  lenText: string;
  estimate: string;
  backup?: string;
  steps: PlanStep[];
}

export interface PrintPlan {
  title: string;
  meta: string;
  wells: PlanWell[];
  tested?: string;
  /** Overrides the default "no charge sized yet" copy when there are no wells for a reason
   *  other than empty inputs — e.g. a Fetter deployment outside the model's altitude envelope. */
  emptyNote?: string;
  /** Label for the length dimension, so the card matches the mode's vocabulary and the recovery
   *  report — "Compartment length" in Fetter mode, "Pressurized length" in the ideal-gas modes.
   *  Defaults to the ideal-gas term. */
  lengthLabel?: string;
}

export function buildCardHtml(plan: PrintPlan, generatedAt: string): string {
  const wells = plan.wells
    .map((w) => {
      const head = [
        `Inner Ø ${w.idText}`,
        `${plan.lengthLabel ?? "Pressurized length"} ${w.lenText}`,
        `Estimate ${w.estimate} g`,
        ...(w.backup ? [`Backup ${w.backup} g`] : []),
      ]
        .map(escapeHtml)
        .join(" &nbsp;·&nbsp; ");
      const rows = w.steps
        .map(
          (s) =>
            `<tr><td><strong>${escapeHtml(s.grams)}</strong> <span class="dim">${escapeHtml(
              s.label,
            )}</span></td><td>&#9744; clean &nbsp; &#9744; partial &nbsp; &#9744; no sep.</td><td></td></tr>`,
        )
        .join("");
      return `<section class="well"><h2>${escapeHtml(w.title)}</h2>
      <p class="head">${head}</p>
      <table class="grid"><thead><tr><th>Charge (g)</th><th>Result</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    })
    .join("");

  // When no well has a charge yet, print a clear prompt instead of a headerless empty page.
  const body =
    plan.wells.length > 0
      ? wells
      : `<p class="empty">${escapeHtml(
          plan.emptyNote ??
            "No charge to size yet. Enter an inner diameter and a pressurized length (and a target pressure or separation force) for at least one well, then generate the card.",
        )}</p>`;

  const proven = plan.tested
    ? `<p class="proven"><strong>Proven charge:</strong> ${escapeHtml(plan.tested)}. Fly the charge you tested.</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(plan.title)} — build & ground-test card</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #18181b; background: #fff; margin: 0; padding: 2rem 1.5rem; }
  main { max-width: 48rem; margin: 0 auto; }
  header { border-bottom: 2px solid #18181b; padding-bottom: .6rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
  h1 { font-size: 1.3rem; margin: 0; }
  .meta { color: #52525b; font-size: .8rem; }
  .sub { color: #3f3f46; font-size: .9rem; margin: 0 0 1rem; }
  .proven { border: 1px solid #18181b; padding: .5rem .75rem; margin: 0 0 1rem; font-size: .95rem; }
  .well { margin-top: 1.25rem; page-break-inside: avoid; }
  h2 { font-size: 1.05rem; margin: 0 0 .25rem; border-bottom: 1px solid #18181b; padding-bottom: .2rem; }
  .head { color: #3f3f46; font-size: .85rem; margin: .35rem 0 .5rem; }
  table.grid { border-collapse: collapse; width: 100%; }
  table.grid th, table.grid td { border: 1px solid #a1a1aa; padding: .45rem .55rem; text-align: left; font-size: .9rem; }
  table.grid th { background: #f4f4f5; font-weight: 600; }
  table.grid td:first-child { width: 8rem; font-variant-numeric: tabular-nums; }
  table.grid td:nth-child(2) { width: 16rem; }
  .dim { color: #71717a; font-size: .75rem; text-transform: uppercase; }
  .empty { color: #3f3f46; font-size: .9rem; margin: 1.25rem 0; }
  /* The fixed column widths lay the print grid out cleanly, but sum wider than a phone.
     On a narrow screen (the card is also downloaded/shared as HTML) let them shrink to fit
     instead of forcing the whole document to scroll sideways. */
  @media screen and (max-width: 26rem) {
    table.grid td:first-child, table.grid td:nth-child(2) { width: auto; }
  }
  footer { border-top: 2px solid #18181b; margin-top: 1.5rem; padding-top: .6rem; color: #52525b; font-size: .78rem; line-height: 1.5; }
  footer strong { color: #18181b; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<main>
  <header>
    <h1>Ejection charge &amp; ground-test card</h1>
    <span class="meta">${escapeHtml(generatedAt)} · charge.fusionspace.co</span>
  </header>
  <p class="sub"><strong>${escapeHtml(plan.title)}</strong> · ${escapeHtml(plan.meta)}</p>
  ${proven}
  ${body}
  <footer>
    <strong>These are theoretical starting estimates, not numbers to fly unverified.</strong>
    Bench-test from the low charge up until separation is clean and energetic — fire it remotely
    from behind cover, airframe restrained and pointed somewhere safe, eye protection on. Fly the
    charge you proved, not the one the formula guessed. Black powder is an explosive — sizing,
    handling, and use are your responsibility.
  </footer>
</main>
</body>
</html>`;
}
