import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "fs";

test.describe("Charge calculator", () => {
  test("loads with a clean hydration and the heading", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Charge", level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("force mode is the default", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Force per pin").first()).toBeVisible();
  });

  test("computes the pressure-mode benchmark charges", async ({ page }) => {
    // mg=1 isolates the bare ideal-gas result (no safety margin).
    await page.goto("/?mode=p&dep=d&mg=1");
    const masses = page.getByTestId("mass");
    // 4 in airframe, 12 psi: drogue (12 in) ≈ 0.93 g, main (24 in) ≈ 1.87 g.
    await expect(masses.nth(0)).toHaveText("0.93");
    await expect(masses.nth(1)).toHaveText("1.87");
  });

  test("the safety margin sizes the charge up in target-pressure mode", async ({
    page,
  }) => {
    // Same 0.93 g bare charge, with a 2× safety margin, sizes to ~1.87 g — the charge
    // is loaded so an ideal well would reach 2× the 12 psi target.
    await page.goto("/?mode=p&dep=s&mg=2");
    await expect(page.getByTestId("mass").first()).toHaveText("1.87");
    // The entered target stays honest; the chip shows target → sized pressure.
    await expect(page.getByText("12 → 24 psi")).toBeVisible();
  });

  test("a deep link restores force mode and dual deploy", async ({ page }) => {
    await page.goto("/?mode=f&dep=d");
    await expect(page.getByText("Force per pin").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "2-56 nylon" }).first()).toBeVisible();
  });

  test("each well takes its own diameter, written to the URL", async ({ page }) => {
    await page.goto("/?dep=d");
    const diameters = page.getByRole("spinbutton", { name: /Inner diameter/ });
    await diameters.nth(0).fill("6"); // drogue
    await diameters.nth(1).fill("4"); // main
    await expect(page).toHaveURL(/ddia=6/);
    await expect(page).toHaveURL(/mdia=4/);
  });

  test("the theme toggle cycles and persists", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /Color theme/ });
    // System -> Light -> Dark
    await toggle.click();
    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    const stored = await page.evaluate(() => localStorage.getItem("charge.theme"));
    expect(stored).toBe("dark");
  });

  test("System mode follows the OS color scheme", async ({ page }) => {
    // No explicit choice (System): the theme must come from the OS preference.
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const light = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    await page.emulateMedia({ colorScheme: "dark" });
    const dark = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(light).not.toBe(dark); // the background tracks the OS, not a fixed light
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/\bdark\b/);
    await expect(html).not.toHaveClass(/\blight\b/);
  });

  test("logging a ground test adds an entry", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Charge tested").fill("1.5");
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await expect(page.getByText("1.5 g").first()).toBeVisible();
  });

  test("saves and reloads a rocket setup", async ({ page }) => {
    await page.goto("/");
    const dia = page.getByRole("spinbutton", { name: /Inner diameter/ }).first();
    await dia.fill("5.5");
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Test Bird");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    // Change the value away, then load the saved setup back.
    await dia.fill("3");
    await expect(dia).toHaveValue("3");
    await page.getByRole("button", { name: "Test Bird", exact: true }).click();
    await expect(dia).toHaveValue("5.5");
  });

  test("ground-test log exports and re-imports", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Charge tested").fill("1.2");
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await expect(page.getByText("1.2 g").first()).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export (.json)" }).click(),
    ]);
    const file = await download.path();

    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByText("1.2 g")).toHaveCount(0);

    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByText("1.2 g").first()).toBeVisible();
  });

  test("activating a saved rocket pre-fills the ground-test airframe", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Av-Bay 4");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    // Saving makes it the active rocket, which seeds the log's airframe field.
    await expect(page.getByLabel("Well / airframe")).toHaveValue("Av-Bay 4");
  });

  test("surfaces the airframe's proven charge once a clean test is logged", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Loop Bird");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    // Log a clean ground test for the now-active airframe (label auto-fills to its name).
    await page.getByLabel("Charge tested").fill("1.5");
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    // The calculator now points past the estimate to the proven charge.
    await expect(page.getByText(/proven Loop Bird/)).toBeVisible();
    await expect(page.locator("p").filter({ hasText: "proven Loop Bird" })).toContainText(
      "1.50 g",
    );
  });

  test("a sub-1 margin in a shared link is floored to 1", async ({ page }) => {
    await page.goto("/?mode=f&dep=s&mg=0.5");
    // The dangerous value must be sanitized on load, not used to shrink the charge.
    await expect(page.getByLabel("Safety margin")).toHaveValue("1");
  });

  test("negative force inputs cannot under-size the charge", async ({ page }) => {
    await page.goto("/?mode=f&dep=s");
    const friction = page.getByLabel("Friction / extra hold").first();
    await expect(friction).toBeVisible(); // wait for force mode to apply before reading
    const mass = page.getByTestId("mass").first();
    const baseline = (await mass.textContent())!.trim();
    // A stray negative friction must be clamped to 0, not subtracted from the
    // required force (which would dangerously reduce the charge).
    await friction.fill("-100");
    await expect(mass).toHaveText(baseline);
  });

  test("a redundant altimeter adds a backup charge sized above the primary", async ({
    page,
  }) => {
    // Pressure/single drogue ≈ 0.93 g (mg=1, bare). At this size the +20% uplift (0.19 g)
    // is below the +0.5 g floor, so the backup is 0.93 + 0.5 = 1.43 g and the label names
    // the floor, per the "20% or 0.5 g, whichever is greater" convention.
    await page.goto("/?mode=p&dep=s&rdn=1&bpct=20&mg=1");
    await expect(page.getByTestId("mass").first()).toHaveText("0.93");
    await expect(page.getByTestId("backup-mass").first()).toHaveText("1.43");
    await expect(page.getByText(/backup charge \(\+0\.5 g\)/i)).toBeVisible();
  });

  test("the backup uses the percentage once it exceeds the +0.5 g floor", async ({
    page,
  }) => {
    // A larger 6" × 30" bay at 15 psi (mg=1) ≈ 6.56 g, where +20% (1.31 g) beats the
    // 0.5 g floor — so the backup is 6.56 × 1.2 = 7.88 g and the label quotes the percent.
    await page.goto("/?mode=p&dep=s&rdn=1&bpct=20&mg=1&ddia=6&dl=30&dp=15");
    await expect(page.getByTestId("mass").first()).toHaveText("6.56");
    await expect(page.getByTestId("backup-mass").first()).toHaveText("7.88");
    await expect(page.getByText(/backup charge \(\+20%\)/i)).toBeVisible();
  });

  test("warns when an inner diameter looks like a unit or OD mix-up", async ({ page }) => {
    await page.goto("/?mode=f&dep=s");
    const dia = page.getByRole("spinbutton", { name: /Inner diameter/ }).first();
    await expect(dia).toBeVisible();
    // A 98 in "inner diameter" is really 98 mm typed into an inches field.
    await dia.fill("98");
    await expect(page.getByText(/did you mean mm, or enter the outside diameter/i)).toBeVisible();
    // Fixing it clears the caution.
    await dia.fill("4");
    await expect(page.getByText(/did you mean mm, or enter the outside diameter/i)).toHaveCount(0);
  });

  test("sizes altimeter vent ports by the rule of thumb", async ({ page }) => {
    await page.goto("/");
    const port = page.getByTestId("port-diameter");
    // Default 4" × 6" bay over 3 ports → ~0.125" each.
    await expect(port).toHaveText("0.125");
    // The same bay through a single port needs a bigger hole.
    await page
      .getByRole("group", { name: "Number of ports" })
      .getByRole("button", { name: "1" })
      .click();
    await expect(port).toHaveText("0.217");
  });

  test("learns your calibration from clean tests planned via the ladder", async ({
    page,
  }) => {
    await page.goto("/?mode=p&dep=s&mg=1"); // single well ≈ 0.93 g
    // Plan two clean tests from ladder steps (which carry the model estimate), at the
    // estimate and at +20% — enough for a calibration to appear.
    await page.getByRole("button", { name: /Estimate/ }).first().click();
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await page.getByRole("button", { name: /High/ }).first().click();
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await expect(page.getByText("Your calibration")).toBeVisible();
    await expect(page.getByText(/× est/).first()).toBeVisible();
  });

  test("coaches the next charge to try after a failed test", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Well / airframe").fill("Iter");
    await page.getByLabel("Charge tested").fill("0.6");
    await page.getByRole("button", { name: "None", exact: true }).click();
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    // A no-separation result suggests stepping up ~25% (0.6 → 0.75).
    await expect(page.getByText(/try 0\.75 g next/i)).toBeVisible();
    await page.getByRole("button", { name: "Use 0.75 g" }).click();
    await expect(page.getByLabel("Charge tested")).toHaveValue("0.75");
  });

  test("offers failure causes after a failed test", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Well / airframe").fill("Iter");
    await page.getByLabel("Charge tested").fill("0.6");
    await page.getByRole("button", { name: "None", exact: true }).click();
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await page.getByText("Why might it not have separated?").click();
    await expect(page.getByText(/Charge too small/)).toBeVisible();
  });

  test("offers a native share sheet where the browser supports it", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __shared?: unknown }).__shared = null;
      // Stub the Web Share API so the (mobile-only) button appears and we can observe it.
      (navigator as unknown as { share: (d: unknown) => Promise<void> }).share = (d) => {
        (window as unknown as { __shared?: unknown }).__shared = d;
        return Promise.resolve();
      };
    });
    await page.goto("/");
    const shareBtn = page.getByRole("button", { name: "Share", exact: true });
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();
    const shared = (await page.evaluate(() => (window as unknown as { __shared: { url?: string } }).__shared)) as {
      url?: string;
    };
    expect(shared?.url).toContain("http");
  });

  test("marks a charge validated after two clean separations", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Val Bird");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    // Two clean tests at the same charge for the active airframe.
    await page.getByLabel("Charge tested").fill("1.5");
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await page.getByLabel("Charge tested").fill("1.5");
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    // The log calls it flight-ready and the calculator shows the validated badge.
    await expect(page.getByText(/Val Bird is validated/)).toBeVisible();
    await expect(page.getByText(/✓ Validated/)).toBeVisible();
  });

  test("shows the dual-deploy sequence diagram only for dual deploy", async ({ page }) => {
    await page.goto("/?dep=d");
    await expect(page.getByText("How dual deployment works")).toBeVisible();
    await page.goto("/?dep=s");
    await expect(page.getByText("How dual deployment works")).toHaveCount(0);
  });

  test("flags thinner air at a high field elevation, and stays quiet low down", async ({
    page,
  }) => {
    await page.goto("/?el=6000");
    await expect(page.getByText(/the air is thinner/)).toBeVisible();
    await page.goto("/?el=0");
    await expect(page.getByText(/the air is thinner/)).toHaveCount(0);
  });

  test("a tube-ID preset sets the inner diameter", async ({ page }) => {
    await page.goto("/?dep=s&lu=in");
    const dia = page.getByRole("spinbutton", { name: /Inner diameter/ }).first();
    await page.getByRole("button", { name: "3.9 in" }).first().click();
    await expect(dia).toHaveValue("3.9");
  });

  test("copies the plan as text to the clipboard", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/?dep=s&mg=1");
    await page.getByRole("button", { name: "Copy text" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("Ejection charge plan");
    expect(text).toContain("Ladder:");
  });

  test("bench mode opens a focused view and hands a charge to the log", async ({ page }) => {
    await page.goto("/?mode=p&dep=s&mg=1"); // single well ≈ 0.93 g
    await page.getByRole("button", { name: "Bench mode" }).click();
    const dialog = page.getByRole("dialog", { name: /bench mode/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("0.93").first()).toBeVisible();
    // Tapping a step closes bench mode and pre-fills the log's charge.
    await dialog.getByRole("button", { name: /Estimate/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Charge tested")).toHaveValue("0.93");
  });

  test("bench mode closes on Done and on Escape", async ({ page }) => {
    await page.goto("/");
    const open = page.getByRole("button", { name: "Bench mode" });
    const dialog = page.getByRole("dialog", { name: /bench mode/i });
    await open.click();
    await expect(dialog).toBeVisible();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toBeHidden();
    await open.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("downloads the recovery report as a self-contained HTML file", async ({ page }) => {
    await page.goto("/?mode=p&dep=s&mg=1");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download report as HTML" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^charge-report-.*\.html$/);
    const html = fs.readFileSync(await download.path(), "utf8");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("recovery report");
    expect(html).toContain("How the number was sized");
    expect(html).toContain("m = (P · V) / (R · T)");
    expect(html).not.toContain("<script"); // self-contained, no external/injected scripts
  });

  test("downloads the build & ground-test card as a self-contained HTML file", async ({
    page,
  }) => {
    await page.goto("/?mode=p&dep=s&mg=1");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download card as HTML" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^charge-card-.*\.html$/);
    const html = fs.readFileSync(await download.path(), "utf8");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("ground-test card");
    expect(html).toContain("Charge (g)"); // the fill-in grid
    expect(html).not.toContain("<script");
  });

  test("the card and report each offer an HTML and a PDF option", async ({ page }) => {
    await page.goto("/");
    for (const name of [
      "Download card as HTML",
      "Print card to PDF",
      "Download report as HTML",
      "Print report to PDF",
    ]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
  });

  test("the header has a Ko-fi tip link", async ({ page }) => {
    await page.goto("/");
    const tip = page.getByRole("link", { name: "Tip" });
    await expect(tip).toBeVisible();
    await expect(tip).toHaveAttribute("href", "https://ko-fi.com/nrdptel");
  });

  test("the measure guide explains inner diameter and pressurized length", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByText("What am I measuring?").click();
    await expect(page.getByRole("img", { name: /inner diameter/i })).toBeVisible();
    await expect(page.getByText(/the bay the gas/i)).toBeVisible();
  });

  test("a ground-test plan step pre-fills the log's charge field", async ({ page }) => {
    await page.goto("/?mode=p&dep=s&mg=1"); // pressure/single, bare: drogue ≈ 0.93 g
    // The "Estimate" step equals the computed mass; tap it and the log picks it up.
    await page.getByRole("button", { name: /Estimate/ }).first().click();
    await expect(page.getByLabel("Charge tested")).toHaveValue("0.93");
  });

  test("a ground-test plan step still works with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?mode=p&dep=s&mg=1");
    // The scroll falls back to an instant jump, but the charge still pre-fills.
    await page.getByRole("button", { name: /Estimate/ }).first().click();
    await expect(page.getByLabel("Charge tested")).toHaveValue("0.93");
  });

  test("tells the user it works offline and how to install", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Use it offline & install it").click();
    await expect(page.getByText(/Add to Home Screen/)).toBeVisible();
  });

  test("works offline once the service worker is registered", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Reload so the page is controlled by the SW and the shell + assets are cached.
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Charge", level: 1 })).toBeVisible();
    await context.setOffline(false);
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toEqual([]);
  });
});
