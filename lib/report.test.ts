import { describe, it, expect } from "vitest";
import { buildReportHtml, escapeHtml, type ReportData } from "./report";

const base: ReportData = {
  title: "Nike Smoke 4\"",
  generatedAt: "2026-06-27",
  summary: [["Deployment", "Dual (drogue + main)"], ["Sized by", "Separation force"]],
  wells: [{ title: "Drogue well", rows: [["Inner diameter", "4 in"], ["Charge (estimate)", "0.93 g"]] }],
  method: ["m = (P · V) / (R · T)", "R = 22.16 ft·lbf/(lbm·°R)"],
  testsHeader: ["Date", "Charge", "Result", "Notes"],
  tests: [["2026-06-01", "1.5 g", "Clean", "pins sheared"]],
  testsNote: "Validated — 2 clean separations at 1.50 g.",
};

describe("recovery report", () => {
  it("produces a self-contained HTML document", () => {
    const html = buildReportHtml(base);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<style>"); // inline CSS, no external deps
    expect(html).not.toContain("<script");
  });

  it("includes the configuration, wells, method, and tests", () => {
    const html = buildReportHtml(base);
    expect(html).toContain("Deployment");
    expect(html).toContain("Dual (drogue + main)");
    expect(html).toContain("Drogue well");
    expect(html).toContain("0.93 g");
    expect(html).toContain("m = (P · V) / (R · T)");
    expect(html).toContain("pins sheared");
    expect(html).toContain("Validated — 2 clean separations at 1.50 g.");
  });

  it("escapes user-supplied text", () => {
    const html = buildReportHtml({
      ...base,
      title: '<script>alert(1)</script>',
      tests: [["2026-06-01", "1.5 g", "Clean", 'note <b>x</b> & "y"']],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("note &lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;");
  });

  it("escapeHtml handles the dangerous characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("renders a references section with linked sources when provided", () => {
    const html = buildReportHtml({
      ...base,
      references: [
        { label: "Method", detail: "the ideal-gas method", url: "https://example.com/x" },
        { label: "Pins", detail: "approximate single-shear values" },
      ],
    });
    expect(html).toContain("References &amp; sources");
    expect(html).toContain("the ideal-gas method");
    expect(html).toContain('<a href="https://example.com/x">source</a>');
    expect(html).toContain("approximate single-shear values");
  });

  it("omits the references section when there are none", () => {
    expect(buildReportHtml(base)).not.toContain("References &amp; sources");
  });
});
