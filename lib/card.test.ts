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

  it("omits the proven line when no tested charge is set", () => {
    // The calculator drops plan.tested when the setup has drifted from what was proven,
    // so the printed card must not assert a proven charge the on-screen guard is warning about.
    const html = buildCardHtml({ ...plan, tested: undefined }, "2026-06-27");
    expect(html).not.toContain("Proven charge:");
    expect(html).not.toContain("Fly the charge you tested");
    // The rest of the card is unaffected.
    expect(html).toContain("Ejection charge");
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
