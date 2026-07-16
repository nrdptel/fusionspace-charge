import { test, expect, type Page } from "@playwright/test";
import fs from "fs";

// The static export ships a hash-based Content-Security-Policy in out/_headers, generated
// after every build by scripts/gen-csp.mjs (it hashes each inline script the export emits).
// A stale or wrong policy blanks the site — inline hydration scripts get refused and nothing
// runs — so this suite loads the ACTUAL generated policy and enforces it in the browser,
// exactly as Cloudflare does (a response header on the document), then drives the app and
// fails on any CSP violation.
//
// Cloudflare's _headers file is not interpreted by the local `serve`, so the policy is applied
// here by rewriting the document response's Content-Security-Policy header via route
// interception. (A same-origin about:blank iframe — the print-to-PDF path — inherits this
// policy, so the export flow is covered too.)

function readGeneratedCsp(): string {
  const headers = fs.readFileSync("out/_headers", "utf8");
  const m = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m);
  if (!m) {
    throw new Error(
      "No Content-Security-Policy in out/_headers — run `npm run build` (postbuild runs gen-csp.mjs) before the e2e suite.",
    );
  }
  return m[1].trim();
}

const CSP = readGeneratedCsp();

// Apply the generated CSP to every top-level document response and collect any violation the
// browser reports (CSP violations surface as console errors). Returns the growing list.
async function enforceCspAndCollect(page: Page): Promise<string[]> {
  const violations: string[] = [];
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(t)) violations.push(t);
  });
  page.on("pageerror", (e) => violations.push(`pageerror: ${String(e)}`));
  await page.route("**/*", async (route) => {
    const resp = await route.fetch();
    const h = { ...resp.headers() };
    if (route.request().resourceType() === "document") h["content-security-policy"] = CSP;
    await route.fulfill({ response: resp, headers: h });
  });
  return violations;
}

test.describe("Content-Security-Policy", () => {
  test("lists a hash for every inline script (no 'unsafe-inline' in script-src)", () => {
    expect(CSP).toContain("script-src 'self'");
    expect(CSP).toMatch(/script-src[^;]*'sha256-/);
    // The whole point of the hashes is to avoid 'unsafe-inline' for scripts.
    const scriptSrc = CSP.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
    expect(scriptSrc).not.toContain("unsafe-inline");
    // The privacy property the copy promises: no third-party connections.
    expect(CSP).toContain("connect-src 'self'");
  });

  test("the app hydrates and computes with the policy enforced", async ({ page }) => {
    const violations = await enforceCspAndCollect(page);
    // These masses are computed client-side from the URL params on hydration (the static HTML
    // is pre-rendered with the defaults), so seeing them proves the inline hydration scripts
    // ran — i.e. the hashes match and nothing was refused.
    await page.goto("/?mode=p&dep=d&mg=1");
    const masses = page.getByTestId("mass");
    await expect(masses.nth(0)).toHaveText("0.93");
    await expect(masses.nth(1)).toHaveText("1.87");
    // And a live interaction still recomputes under the policy.
    await page.getByRole("button", { name: "Separation force" }).first().click();
    await expect(page.getByText("Force per pin").first()).toBeVisible();
    expect(violations).toEqual([]);
  });

  test("the print-to-PDF export runs under the policy", async ({ page }) => {
    const violations = await enforceCspAndCollect(page);
    // The print path writes the export HTML into a hidden about:blank iframe, which inherits
    // this page's CSP — so its inline <style> must be allowed and it must carry no inline
    // <script>. Stub print() so the dialog never blocks the run.
    await page.addInitScript(() => {
      window.print = () => {};
    });
    page.on("download", () => {}); // let the HTML-download clicks resolve without a save prompt
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Charge", level: 1 })).toBeVisible();

    const pdfButtons = page.getByRole("button", { name: /Print .* to PDF/i });
    const htmlButtons = page.getByRole("button", { name: /Download .* as HTML/i });
    const nPdf = await pdfButtons.count();
    expect(nPdf).toBeGreaterThan(0);
    for (let i = 0; i < nPdf; i++) {
      await pdfButtons.nth(i).click();
      await page.waitForTimeout(400); // the iframe write + 250ms print tick
    }
    const nHtml = await htmlButtons.count();
    for (let i = 0; i < nHtml; i++) await htmlButtons.nth(i).click();
    await page.waitForTimeout(400);
    expect(violations).toEqual([]);
  });
});
