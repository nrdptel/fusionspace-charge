import { describe, it, expect } from "vitest";
import { buildCardHtml, type PrintPlan } from "./card";

const plan: PrintPlan = {
  title: "Nike Smoke 4\"",
  meta: "Single deploy · sized by separation force",
  tested: "1.50 g — Nike (2026-06-01)",
  wells: [
    {
      title: "Ejection charge",
      idText: "4 in",
      lenText: "12 in",
      estimate: "0.59",
      backup: "1.09",
      steps: [
        { label: "low −20%", grams: "0.48" },
        { label: "estimate", grams: "0.59" },
      ],
    },
  ],
};

describe("build & ground-test card HTML", () => {
  it("is a self-contained document with the charges and a fill-in grid", () => {
    const html = buildCardHtml(plan, "2026-06-27");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<style>");
    expect(html).not.toContain("<script");
    expect(html).toContain("Ejection charge");
    expect(html).toContain("0.59");
    expect(html).toContain("Backup 1.09 g");
    expect(html).toContain("clean"); // checkbox row
    expect(html).toContain("Proven charge:");
  });

  it("reframes the proven line as ambiguous for a multi-compartment build", () => {
    // With more than one well sized, the log can't attribute a clean test to a compartment, so the
    // card must NOT tell the builder to "fly the charge you tested" — it qualifies instead.
    const html = buildCardHtml({ ...plan, provenAmbiguous: true }, "2026-06-27");
    expect(html).toContain("Largest clean charge logged:");
    expect(html).toContain("match it to the right well");
    expect(html).not.toContain("Fly the charge you tested");
    expect(html).not.toContain("Proven charge:");
    // The tested charge value itself is still shown.
    expect(html).toContain("1.50 g — Nike");
  });

  it("omits the proven line when no tested charge is set", () => {
    // The calculator drops plan.tested when the setup has drifted from what was proven,
    // so the printed card must not assert a proven charge the on-screen guard is warning about.
    const html = buildCardHtml({ ...plan, tested: undefined }, "2026-06-27");
    expect(html).not.toContain("Proven charge:");
    expect(html).not.toContain("Fly the charge you tested");
    // The rest of the card is unaffected.
    expect(html).toContain("Ejection charge");
  });

  it("labels the length by mode — matching the recovery report's vocabulary", () => {
    // Default (ideal-gas) keeps "Pressurized length"; Fetter passes "Compartment length" so the
    // bench card and the recovery report don't disagree on the same measurement.
    expect(buildCardHtml(plan, "2026-06-27")).toContain("Pressurized length 12 in");
    const fetter = buildCardHtml({ ...plan, lengthLabel: "Compartment length" }, "2026-06-27");
    expect(fetter).toContain("Compartment length 12 in");
    expect(fetter).not.toContain("Pressurized length");
  });

  it("relaxes the fixed table widths on a narrow screen so the card doesn't scroll sideways", () => {
    const html = buildCardHtml(plan, "2026-06-27");
    expect(html).toContain("@media screen and (max-width: 26rem)");
  });

  it("prompts instead of rendering an empty card when no well has a charge", () => {
    const html = buildCardHtml({ ...plan, wells: [], tested: undefined }, "2026-06-27");
    expect(html).toContain("No charge to size yet");
    expect(html).not.toContain("Proven charge:");
    // Header and footer safety copy still present.
    expect(html).toContain("Ejection charge &amp; ground-test card");
    expect(html).toContain("not numbers to fly unverified");
  });

  it("escapes user-supplied text", () => {
    const html = buildCardHtml(
      { ...plan, title: "<script>x</script>" },
      "2026-06-27",
    );
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
  });
});
