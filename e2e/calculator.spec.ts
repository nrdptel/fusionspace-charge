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
    await expect(page.getByText("1.50 g").first()).toBeVisible();
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
    await expect(page.getByText("1.20 g").first()).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export (.json)" }).click(),
    ]);
    const file = await download.path();

    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByText("1.20 g")).toHaveCount(0);

    await page.locator('#ground-test input[type="file"]').setInputFiles(file);
    await expect(page.getByText("1.20 g").first()).toBeVisible();
  });

  test("activating a saved rocket pre-fills the ground-test airframe", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Av-Bay 4");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    // Saving makes it the active rocket, which seeds the log's airframe field.
    await expect(page.getByLabel("Section / airframe")).toHaveValue("Av-Bay 4");
  });

  test("the layout doesn't scroll sideways on a narrow phone, even with the save form open", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/");
    // Opening the save form adds a fixed-width input + two buttons — the row must wrap, not
    // push the page wider than the viewport.
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("A fairly long airframe name");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1); // allow sub-pixel rounding
  });

  test("closing the save form returns focus to the trigger, not the body", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Save current setup" });
    // Cancel returns focus to the trigger.
    await trigger.click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(trigger).toBeFocused();
    // So does Escape from the name field.
    await trigger.click();
    await page.getByPlaceholder("Name this setup").press("Escape");
    await expect(trigger).toBeFocused();
    // And so does a successful save.
    await trigger.click();
    await page.getByPlaceholder("Name this setup").fill("Focus Bird");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(trigger).toBeFocused();
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
    // The caution is an alert region so a screen reader announces it when it appears.
    await expect(
      page.getByRole("alert").filter({ hasText: /did you mean mm/i }),
    ).toBeVisible();
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
    await page.getByLabel("Section / airframe").fill("Iter");
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
    await page.getByLabel("Section / airframe").fill("Iter");
    await page.getByLabel("Charge tested").fill("0.6");
    await page.getByRole("button", { name: "None", exact: true }).click();
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await page.getByText("Why might it not have separated?").click();
    await expect(page.getByText(/Charge too small/)).toBeVisible();
  });

  test("a later no-separation above the proven charge withdraws 'fly it' and re-opens the coach", async ({
    page,
  }) => {
    await page.goto("/?mode=p&dep=s");
    // Save a named airframe so the proven-charge callout tracks it and the log's label seeds to it.
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Bird");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const charge = page.getByLabel("Charge tested");
    const logBtn = page.getByRole("button", { name: "Log test", exact: true });
    // Two clean separations at 1.0 g → validated (clean is the default outcome).
    await charge.fill("1.0");
    await logBtn.click();
    await charge.fill("1.0");
    await logBtn.click();
    await expect(page.getByText(/Validated/)).toBeVisible();
    await expect(page.getByText(/Fly the charge you tested/)).toBeVisible();
    // Now a no-separation at a HIGHER charge — the validated charge can no longer be trusted.
    await charge.fill("2.0");
    await page.getByRole("button", { name: "None", exact: true }).click();
    await logBtn.click();
    // The "fly it" assertion is withdrawn, a warning appears, and the coach re-opens with a step-up.
    await expect(page.getByText(/Fly the charge you tested/)).toHaveCount(0);
    await expect(page.getByText(/didn't separate/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Use 2\.5/ })).toBeVisible();
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
    // Announced to assistive tech as it crosses the threshold.
    await expect(page.getByRole("alert").filter({ hasText: /the air is thinner/i })).toBeVisible();
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
    expect(html).toContain("References &amp; sources"); // sources cited for cert docs
    expect(html).toContain("vernk.com");
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

  test("warns when a proven airframe's setup has drifted", async ({ page }) => {
    await page.goto("/?mode=p&dep=s&mg=1"); // single well ≈ 0.93 g
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Drift Bird");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    // Log a clean test from the ladder (captures the model estimate it was planned at).
    await page.getByRole("button", { name: /Estimate/ }).first().click();
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await expect(page.getByText(/proven Drift Bird/i)).toBeVisible();
    // Change the geometry enough to drift the estimate — the proven callout flags it.
    await page.getByRole("spinbutton", { name: /Pressurized length/ }).first().fill("24");
    await expect(page.getByText(/re-test before trusting the proven charge/i)).toBeVisible();
  });

  test("a drifted setup drops the proven charge from the printed card", async ({ page }) => {
    await page.goto("/?mode=p&dep=s&mg=1");
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Card Drift Bird");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: /Estimate/ }).first().click();
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await expect(page.getByText(/proven Card Drift Bird/i)).toBeVisible();

    // Before drift, the card carries the proven charge line.
    const cardHtml = async () => {
      const [dl] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Download card as HTML" }).click(),
      ]);
      return fs.readFileSync(await dl.path(), "utf8");
    };
    expect(await cardHtml()).toContain("Proven charge:");

    // Before drift, bench mode also carries the proven callout.
    await page.getByRole("button", { name: "Bench mode" }).click();
    const dialog = page.getByRole("dialog", { name: /bench mode/i });
    await expect(dialog.getByText(/fly the charge you proved/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Drift the geometry — neither the card nor the bench view may assert a charge the
    // on-screen guard is warning about.
    await page.getByRole("spinbutton", { name: /Pressurized length/ }).first().fill("24");
    await expect(page.getByText(/re-test before trusting the proven charge/i)).toBeVisible();
    expect(await cardHtml()).not.toContain("Proven charge:");
    await page.getByRole("button", { name: "Bench mode" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/fly the charge you proved/i)).toBeHidden();
  });

  test("a drifted setup drops the proven charge from the recovery report too", async ({ page }) => {
    await page.goto("/?mode=p&dep=s&mg=1");
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Report Drift Bird");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: /Estimate/ }).first().click();
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await expect(page.getByText(/proven Report Drift Bird/i)).toBeVisible();

    const reportHtml = async () => {
      const [dl] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Download report as HTML" }).click(),
      ]);
      return fs.readFileSync(await dl.path(), "utf8");
    };
    // Before drift the report asserts the clean separation…
    expect(await reportHtml()).toContain("Most recent clean separation");

    // …after drift it must warn to re-test instead, matching the card/bench/on-screen guard.
    await page.getByRole("spinbutton", { name: /Pressurized length/ }).first().fill("24");
    await expect(page.getByText(/re-test before trusting the proven charge/i)).toBeVisible();
    const drifted = await reportHtml();
    expect(drifted).not.toContain("Most recent clean separation");
    expect(drifted).toContain("Setup has changed since the last clean test");
  });

  test("the report's worked example uses a well that actually has a charge", async ({ page }) => {
    // Dual deploy with an empty drogue (pressure 0 → mass 0) but a filled main. The drogue
    // block is dropped; the worked example must derive from the main well, not print a
    // zeroed drogue derivation for a well that isn't in the report.
    await page.goto("/?mode=p&dep=d&mg=1&dp=0");
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download report as HTML" }).click(),
    ]);
    const html = fs.readFileSync(await dl.path(), "utf8");
    expect(html).toContain("Worked example — main well");
    expect(html).not.toContain("Worked example — drogue well");
  });

  test("loading a corrupt saved rocket doesn't crash the calculator", async ({ page }) => {
    // A tampered/legacy store with a null well would crash a shallow-merge load at
    // computeWell(state.drogue); normalizeState must rebuild it into a valid state.
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "charge.rockets",
        JSON.stringify([
          { id: "x", name: "Corrupt Bird", state: { mode: "force", drogue: null, main: "oops" } },
        ]),
      );
    });
    await page.reload();
    await page.getByRole("button", { name: "Corrupt Bird", exact: true }).click();
    // Still alive and computing — the heading renders and a mass is shown, no white-screen.
    await expect(page.getByRole("heading", { name: "Charge", level: 1 })).toBeVisible();
    await expect(page.getByTestId("mass").first()).toBeVisible();
  });

  test("saved rockets sync across tabs without one clobbering the other", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    const tabB = await context.newPage();
    await tabB.goto("/");

    // Save in tab A — tab B adopts it through the storage event.
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Tab A Bird");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(tabB.getByRole("button", { name: "Tab A Bird", exact: true })).toBeVisible();

    // Now save in tab B. Because B synced A's rocket first, its write carries both — so tab A
    // ends up with A's *and* B's, instead of B's stale empty list wiping A's rocket.
    await tabB.getByRole("button", { name: "Save current setup" }).click();
    await tabB.getByPlaceholder("Name this setup").fill("Tab B Bird");
    await tabB.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Tab A Bird", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tab B Bird", exact: true })).toBeVisible();
    await tabB.close();
  });

  test("warns when a ground test can't be saved to this device", async ({ page }) => {
    // Simulate a full/blocked store: writes for the log key throw. The entry still shows in
    // the list, so without this warning the user would think it saved and lose it on reload.
    await page.addInitScript(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === "charge.testlog" && v && v !== "[]") throw new Error("QuotaExceededError");
        return orig.call(this, k, v);
      };
    });
    await page.goto("/");
    await page.getByLabel("Charge tested").fill("1.5");
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /couldn't save to this device/i })).toBeVisible();
  });

  test("a field's hint is part of its accessible description", async ({ page }) => {
    await page.goto("/"); // force mode default — margin hint mentions "+50%"
    await expect(page.getByLabel("Safety margin")).toHaveAccessibleDescription(/1\.5 = \+50%/);
  });

  test("an empty configuration exports a card and report that prompt instead of a void", async ({
    page,
  }) => {
    await page.goto("/?mode=p&dep=s&dp=0"); // pressure 0 → no charge sized
    const download = async (name: string) => {
      const [dl] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name }).click(),
      ]);
      return fs.readFileSync(await dl.path(), "utf8");
    };
    expect(await download("Download card as HTML")).toContain("No charge to size yet");
    expect(await download("Download report as HTML")).toContain("No charge well is sized yet");
  });

  test("backs up everything and restores it", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Backup Bird");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Back up all (.json)" }).click(),
    ]);
    const path = await dl.path();
    expect(fs.readFileSync(path, "utf8")).toContain("Backup Bird");
    // Delete it, then restore from the backup — it comes back after the reload.
    await page.getByRole("button", { name: "Delete Backup Bird" }).click();
    await expect(page.getByRole("button", { name: "Backup Bird", exact: true })).toHaveCount(0);
    await page.locator("#restore-file").setInputFiles(path);
    await expect(page.getByRole("button", { name: "Backup Bird", exact: true })).toBeVisible();
  });

  test("a corrupt saved-rockets / test-log store doesn't crash the whole tool", async ({ page }) => {
    // A null entry, or an old/foreign entry missing fields, must not reach the render and throw
    // — the route error boundary would reload into the same store, an unrecoverable loop. The
    // load path sanitizes, so the tool renders normally and simply drops the junk.
    await page.addInitScript(() => {
      // A null, a nameless (unusable) entry, and one good rocket; a null and a field-missing log entry.
      localStorage.setItem("charge.rockets", '[null, {"id":"x","state":{}}, {"id":"a","name":"Good","state":{}}]');
      localStorage.setItem(
        "charge.testlog",
        '[null, {"outcome":"clean","charge":2}, {"date":"2026-01-01","label":"L","charge":1.5,"outcome":"clean","notes":""}]',
      );
    });
    await page.goto("/");
    // The calculator renders rather than the error boundary… (default is dual, so two masses).
    await expect(page.getByTestId("mass").first()).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    // …and the one salvageable saved rocket survives (null and the nameless entry are dropped).
    await expect(page.getByRole("button", { name: "Good", exact: true })).toBeVisible();
  });

  test("the methodology cites its sources", async ({ page }) => {
    await page.goto("/");
    await page.getByText("References & sources").click();
    await expect(page.getByRole("link", { name: /How to size ejection charges/i })).toBeVisible();
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

    // The durable layer: the SW cache should hold the JS/CSS, not just the HTML shell,
    // so the app survives even if the browser's own asset cache is evicted.
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const n of await caches.keys()) {
        const c = await caches.open(n);
        for (const r of await c.keys()) urls.push(new URL(r.url).pathname);
      }
      return {
        js: urls.some((u) => u.includes("/_next/static/") && u.endsWith(".js")),
        css: urls.some((u) => u.endsWith(".css")),
      };
    });
    expect(cached.js, "SW cached JS chunks").toBe(true);
    expect(cached.css, "SW cached CSS").toBe(true);

    await context.setOffline(true);
    await page.goto("/?mode=p&dep=s&mg=1");
    // Not just the static heading — the calculator must hydrate and compute offline.
    await expect(page.getByRole("heading", { name: "Charge", level: 1 })).toBeVisible();
    await expect(page.getByTestId("mass").first()).toHaveText("0.93");
    // …and stay reactive: switching to dual deploy adds a second well.
    await page.getByRole("button", { name: "Dual" }).click();
    await expect(page.getByTestId("mass")).toHaveCount(2);

    // An asset requested only offline (never cached) degrades to a real 504 response
    // rather than a hard SW error (respondWith would throw on undefined). Asserted here,
    // where the SW is already proven to control the page, to avoid a flaky standalone test.
    const status = await page.evaluate(async () => {
      try {
        const r = await fetch(`/never-cached-${Math.random().toString(36).slice(2)}.js`);
        return r.status;
      } catch {
        return "threw";
      }
    });
    expect(status).toBe(504);

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

  test("has no serious accessibility violations in dark theme", async ({ page }) => {
    // The app's dark mode is class-based (not OS-media), so seed the stored theme before load.
    // Dark theme is where the chip / ladder / result-chip labels previously failed contrast — a
    // scan the light-only default test can't catch — so this guards those against regressing.
    await page.addInitScript(() => localStorage.setItem("charge.theme", "dark"));
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  test("a skip link jumps keyboard focus past the header to the calculator", async ({
    page,
  }) => {
    await page.goto("/");
    // The skip link is the first tab stop and is revealed when focused.
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to the calculator" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    // Activating it moves the focus start into the calculator, past the header controls.
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    const focusedInCalculator = await page.evaluate(
      () => !!document.activeElement?.closest("#calculator"),
    );
    expect(focusedInCalculator).toBe(true);
  });

  test("bench mode traps focus and restores it to the trigger on close", async ({ page }) => {
    await page.goto("/?mode=p&dep=d&mg=1");
    const open = page.getByRole("button", { name: "Bench mode" });
    await open.focus();
    await open.click();
    const dialog = page.getByRole("dialog", { name: /bench mode/i });
    await expect(dialog).toBeVisible();
    // Tab repeatedly — focus must stay inside the dialog (not reach the page behind).
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]'),
      );
      expect(inside).toBe(true);
    }
    // Escape closes and returns focus to the trigger (WCAG 2.4.3).
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });

  test("a fractional pin count sizes the same as its rounded whole number", async ({ page }) => {
    await page.goto("/?mode=f&dep=s&mg=1");
    const pins = page.getByLabel("Shear pins").first();
    const mass = page.getByTestId("mass").first();
    await pins.fill("3");
    const at3 = (await mass.textContent())!.trim();
    // 2.7 pins must size the charge as 3 pins — matching the report's rounded display.
    await pins.fill("2.7");
    await expect(mass).toHaveText(at3);
  });

  test("switching pressure units converts the target without changing the charge", async ({
    page,
  }) => {
    await page.goto("/?mode=p&dep=s&mg=1");
    // Wait for the URL decode to settle into pressure mode before reading the charge.
    await expect(page.getByLabel("Target pressure").first()).toBeVisible();
    const mass = page.getByTestId("mass").first();
    const before = (await mass.textContent())!.trim();
    await page
      .getByRole("group", { name: "Pressure unit" })
      .getByRole("button", { name: "kPa" })
      .click();
    // The entered target is now shown in kPa, but the sized charge is unchanged.
    await expect(page.getByText(/kPa/).first()).toBeVisible();
    await expect(mass).toHaveText(before);
  });

  test("choosing redundant altimeters reveals the backup charge and its controls", async ({
    page,
  }) => {
    await page.goto("/?mode=p&dep=s&mg=1");
    await expect(page.getByTestId("backup-mass")).toHaveCount(0);
    await page
      .getByRole("group", { name: "Altimeter configuration" })
      .getByRole("button", { name: "Redundant" })
      .click();
    await expect(page.getByTestId("backup-mass").first()).toBeVisible();
    await expect(page.getByLabel("Backup charge uplift")).toBeVisible();
    await expect(page.getByRole("button", { name: /Backup/ }).first()).toBeVisible();
  });

  test("the recovery report embeds the airframe's logged ground tests", async ({ page }) => {
    await page.goto("/?mode=p&dep=s&mg=1");
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Report Bird");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    // Log a clean test at the ladder estimate (0.93 g) for the active airframe.
    await page.getByRole("button", { name: /Estimate/ }).first().click();
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download report as HTML" }).click(),
    ]);
    const html = fs.readFileSync(await dl.path(), "utf8");
    expect(html).toContain("Report Bird");
    expect(html).toContain("Ground-test results");
    expect(html).toContain("0.93 g");
    expect(html).toContain("Clean");
  });

  test("a malformed ground-test import is rejected without altering the log", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Charge tested").fill("1.5");
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await expect(page.getByText("1.50 g").first()).toBeVisible();
    page.on("dialog", (d) => d.accept());
    await page.locator('#ground-test input[type="file"]').setInputFiles({
      name: "not-charge.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"foo":1}'),
    });
    // The existing entry is untouched — a bad import can't corrupt or clear the log.
    await expect(page.getByText("1.50 g").first()).toBeVisible();
  });

  test("deleting a ground-test entry removes just that row and persists", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Charge tested").fill("1.1");
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await page.getByLabel("Charge tested").fill("2.2");
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await expect(page.getByText("1.10 g")).toBeVisible();
    await expect(page.getByText("2.20 g")).toBeVisible();
    // Entries are newest-first, so the first Delete removes the 2.2 g entry.
    await page.getByRole("button", { name: "Delete entry" }).first().click();
    await expect(page.getByText("2.20 g")).toHaveCount(0);
    await expect(page.getByText("1.10 g")).toBeVisible();
    await page.reload();
    await expect(page.getByText("2.20 g")).toHaveCount(0);
    await expect(page.getByText("1.10 g")).toBeVisible();
  });

  test("copies the share link to the clipboard", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/?mode=p&dep=s&mg=1");
    await page.getByRole("button", { name: "Copy share link" }).click();
    await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
    // The success is also announced to assistive tech via a live region, not just the
    // button-label flip (which a screen reader won't re-read on a focused button).
    await expect(page.getByRole("status").filter({ hasText: /copied to clipboard/i })).toHaveText(
      /share link copied to clipboard/i,
    );
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("http");
    expect(text).toContain("mode=p");
  });

  test("the vent-port tool converts bay dimensions on a unit switch", async ({ page }) => {
    await page.goto("/");
    const vent = page.locator("#vent");
    const dia = vent.getByLabel("Bay inner diameter");
    await expect(dia).toHaveValue("4"); // default 4 in
    await vent.getByRole("group", { name: "Length unit" }).getByRole("button", { name: "mm" }).click();
    await expect(dia).toHaveValue("101.6"); // 4 in → 101.6 mm
  });

  test("a chosen theme survives a reload", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /Color theme/ });
    await toggle.click(); // System → Light
    await toggle.click(); // Light → Dark
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    // The inline pre-paint script must re-apply the choice with no second click.
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: /Dark/ })).toBeVisible();
  });

  test("deleting a saved rocket removes it and it stays gone after reload", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Save current setup" }).click();
    await page.getByPlaceholder("Name this setup").fill("Del Bird");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Del Bird", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Delete Del Bird" }).click();
    await expect(page.getByRole("button", { name: "Del Bird", exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Del Bird", exact: true })).toHaveCount(0);
  });

  test("deleting a saved rocket keeps focus in the list, not on the body", async ({ page }) => {
    await page.goto("/");
    for (const n of ["Bird One", "Bird Two"]) {
      await page.getByRole("button", { name: "Save current setup" }).click();
      await page.getByPlaceholder("Name this setup").fill(n);
      await page.getByRole("button", { name: "Save", exact: true }).click();
    }
    // Deleting the first chip moves focus to the neighbour's delete control, so a keyboard
    // user can delete several without being dumped to the top each time.
    await page.getByRole("button", { name: "Delete Bird One" }).click();
    await expect(page.getByRole("button", { name: "Delete Bird Two" })).toBeFocused();
  });

  test("deleting a ground-test entry keeps focus on a delete control", async ({ page }) => {
    await page.goto("/");
    for (const c of ["1.20", "1.50"]) {
      await page.getByLabel("Charge tested").fill(c);
      await page.getByRole("button", { name: "Log test", exact: true }).click();
    }
    const deletes = page.getByRole("button", { name: "Delete entry" });
    await expect(deletes).toHaveCount(2);
    await deletes.first().click();
    // One entry left; focus landed on its delete control rather than falling to <body>.
    await expect(page.getByRole("button", { name: "Delete entry" })).toBeFocused();
  });

  test("tapping a bench-mode step announces the queued charge", async ({ page }) => {
    await page.goto("/?mode=p&dep=s&mg=1"); // single well ≈ 0.93 g
    await page.getByRole("button", { name: "Bench mode" }).click();
    const dialog = page.getByRole("dialog", { name: /bench mode/i });
    await dialog.getByRole("button", { name: /Estimate/ }).click();
    await expect(page.getByRole("status").filter({ hasText: /queued/i })).toHaveText(
      /Queued 0\.93 g in the ground-test log/i,
    );
  });

  test("every in-page jump-link resolves to a real anchor", async ({ page }) => {
    await page.goto("/");
    await page.getByText("What's in here").click(); // expand the overview so its links render
    const hrefs = await page.locator('a[href^="#"]').evaluateAll((els) => [
      ...new Set(els.map((e) => e.getAttribute("href")!).filter((h) => h.length > 1)),
    ]);
    expect(hrefs.length).toBeGreaterThan(3);
    for (const href of hrefs) {
      expect(await page.locator(href).count(), `${href} should exist`).toBeGreaterThan(0);
    }
  });

  test("every new-tab link is safe (rel includes noopener)", async ({ page }) => {
    await page.goto("/?mode=x"); // fetter mode surfaces the paper/talk links too
    const unsafe = await page.locator('a[target="_blank"]').evaluateAll((els) =>
      els
        .filter((e) => !(e.getAttribute("rel") || "").includes("noopener"))
        .map((e) => e.getAttribute("href")),
    );
    expect(unsafe).toEqual([]);
  });

  test("the Fetter model reproduces the reference charge and shows the traditional delta", async ({
    page,
  }) => {
    // Default Fetter compartment (3"×15", 2×2-56, full chute, 40% safety) → ~2.01 g, versus the
    // traditional ideal-gas ~0.67 g at the same pressure — the delta the mode exists to show.
    await page.goto("/?mode=x&dep=s");
    await expect(page.getByTestId("fetter-mass")).toHaveText("2.01");
    await expect(page.getByTestId("fetter-traditional")).toContainText("0.67");
    await expect(page.getByTestId("fetter-ratio")).toContainText("×");
    // Charge's ×-multiplier "Safety margin" never applies in Fetter (the model has its own).
    await expect(page.getByLabel("Safety margin")).toHaveCount(0);
    // Deployment DOES apply — single/dual works in Fetter just like the ideal-gas modes.
    await expect(page.getByRole("group", { name: "Deployment" })).toBeVisible();
    // The mode is credited at the mode, with the paper linked (not buried in a footer).
    await expect(page.getByRole("link", { name: /Read the paper/i })).toBeVisible();
  });

  test("the Fetter safety factor is the model's margin — no separate multiplier", async ({
    page,
  }) => {
    await page.goto("/?mode=x&dep=s");
    // The mode exposes Fetter's own safety factor as a percent, defaulting to 40%…
    await expect(page.getByLabel("Safety factor")).toHaveValue("40");
    // …framed as built-in, so no separate multiplier is layered on…
    await expect(page.getByLabel("Safety factor")).toHaveAccessibleDescription(
      /no separate multiplier/i,
    );
    // …and Charge's ×-multiplier "Safety margin" control is absent entirely.
    await expect(page.getByLabel("Safety margin")).toHaveCount(0);
  });

  test("outside the altitude envelope the Fetter mode withholds a number", async ({ page }) => {
    await page.goto("/?mode=x&dep=s&xalt=25000");
    // No charge is presented; instead a redirect to the traditional modes + a ground test.
    await expect(page.getByTestId("fetter-mass")).toHaveCount(0);
    await expect(
      page.getByRole("alert").filter({ hasText: /Outside the Fetter model.s envelope/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /target-pressure or separation-force modes/i })).toBeVisible();
    // Bringing it back into the envelope restores the number.
    await page.getByLabel("Deployment altitude").fill("5000");
    await expect(page.getByTestId("fetter-mass")).toHaveText("2.01");
  });

  test("a Fetter charge is loggable from the ground-test ladder", async ({ page }) => {
    await page.goto("/?mode=x");
    // Tapping the Estimate step pre-fills the log's charge field, closing the loop.
    await page.getByRole("button", { name: /Estimate/ }).first().click();
    await expect(page.getByLabel("Charge tested")).toHaveValue("2.01");
  });

  test("switching to the Fetter model writes it to the shareable URL", async ({ page }) => {
    await page.goto("/?dep=s");
    await page
      .getByRole("group", { name: "Sizing method" })
      .getByRole("button", { name: "Fetter model" })
      .click();
    await expect(page).toHaveURL(/mode=x/);
    await expect(page).toHaveURL(/xdia=3/);
    await expect(page.getByTestId("fetter-mass")).toBeVisible();
  });

  test("the Fetter recovery report carries the model, the delta, and the credit", async ({
    page,
  }) => {
    await page.goto("/?mode=x");
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download report as HTML" }).click(),
    ]);
    const html = fs.readFileSync(await dl.path(), "utf8");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Fetter model"); // the sizing method
    expect(html).toContain("Traditional ideal-gas"); // the delta is shown alongside
    expect(html).toContain("Tom Fetter"); // credited, with the paper linked
    expect(html).toContain("speedmotionrockets.com");
    // The model's own margin — never Charge's separate multiplier stacked on top.
    expect(html).toContain("no separate multiplier");
    // Default deploy is dual, so both compartments are carried.
    expect(html).toContain("Drogue compartment");
    expect(html).toContain("Main compartment");
    expect(html).not.toContain("<script");
  });

  test("the Fetter bench card names the length like the report — 'compartment', not 'pressurized'", async ({
    page,
  }) => {
    await page.goto("/?mode=x");
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download card as HTML" }).click(),
    ]);
    const html = fs.readFileSync(await dl.path(), "utf8");
    // The printable card and the recovery report must agree on the measurement's name.
    expect(html).toContain("Compartment length");
    expect(html).not.toContain("Pressurized length");
  });

  test("the measure guide speaks the Fetter card's vocabulary, not the ideal-gas 'well'", async ({
    page,
  }) => {
    await page.goto("/?mode=x&dep=s");
    await page.getByText("What am I measuring?").click();
    // The diagram names the same dimension the card does ("compartment length"), so the two
    // don't mix "well" and "compartment" copy on one screen.
    await expect(page.getByRole("img", { name: /the compartment length runs/i })).toBeVisible();
    await expect(page.getByRole("img", { name: /pressurized length runs/i })).toHaveCount(0);
  });

  test("an unsized Fetter report explains the compartment, never 'enter a pressure or force'", async ({
    page,
  }) => {
    await page.goto("/?mode=x&dep=s");
    // Wait for hydration + the first compute before touching an input, so the clear isn't lost to
    // a pre-hydration render (the default 3"×15" compartment sizes to 2.01 g).
    const mass = page.getByTestId("fetter-mass");
    await expect(mass).toHaveText("2.01");
    // Clear the geometry so nothing is sized — the report has no compartment to show. The headline
    // dropping to the empty-value dash confirms the recompute landed before we export.
    await page.getByRole("spinbutton", { name: /Inner diameter/ }).first().fill("0");
    await expect(mass).toHaveText("—");
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download report as HTML" }).click(),
    ]);
    const html = fs.readFileSync(await dl.path(), "utf8");
    expect(html).toContain("No compartment is sized yet");
    // The ideal-gas empty copy (a "well", a "target pressure or separation force") must not leak
    // into a mode that has none of those inputs.
    expect(html).not.toContain("No charge well is sized yet");
    expect(html).not.toContain("target pressure or separation force");
  });

  test("switching units in Fetter mode converts the compartment, not the charge", async ({
    page,
  }) => {
    await page.goto("/?mode=x&dep=s");
    const dia = page.getByRole("spinbutton", { name: /Inner diameter/ }).first();
    await expect(dia).toHaveValue("3"); // 3 in
    const mass = page.getByTestId("fetter-mass");
    const before = (await mass.textContent())!.trim();
    // Switch to mm: the physical geometry — and the charge — must not change, only the units.
    // Scope to the calculator's unit group (the vent-port tool has its own "Length unit" group).
    await page
      .locator("#calculator")
      .getByRole("group", { name: "Length unit" })
      .getByRole("button", { name: "mm" })
      .click();
    await expect(dia).toHaveValue("76.2"); // 3 in → 76.2 mm, not a silent 3 mm
    await expect(mass).toHaveText(before);
  });

  test("deployment altitude reads as an envelope check and never changes the charge below the limit", async ({
    page,
  }) => {
    await page.goto("/?mode=x&dep=s");
    // Framed as a validity check in its own "Model envelope" panel, not a sizing knob.
    await expect(page.getByText("Model envelope")).toBeVisible();
    await expect(page.getByText(/within envelope/i)).toBeVisible();
    const mass = page.getByTestId("fetter-mass");
    await expect(mass).toHaveText("2.01");
    // Changing it below the limit does not change the charge — the model is fixed at sea level.
    await page.getByLabel("Deployment altitude").fill("10000");
    await expect(mass).toHaveText("2.01");
    await expect(page.getByText(/within envelope/i)).toBeVisible();
    // At the limit the status flips and the number is withheld.
    await page.getByLabel("Deployment altitude").fill("25000");
    await expect(page.getByText(/out of envelope/i)).toBeVisible();
    await expect(mass).toHaveCount(0);
  });

  test("out of the envelope, no surface recites a charge — not the report, not the methodology", async ({
    page,
  }) => {
    await page.goto("/?mode=x&dep=s&xalt=25000");
    // On-screen: the compartment card withholds the number…
    await expect(page.getByTestId("fetter-mass")).toHaveCount(0);
    // …and the methodology's worked comparison must not print it either.
    await page.getByText("Worked comparison — your compartment").click();
    await expect(
      page.locator("#methodology").getByText(/no charge is sized here/i),
    ).toBeVisible();
    // The downloaded recovery report — the durable, shareable artifact — must not size one.
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download report as HTML" }).click(),
    ]);
    const html = fs.readFileSync(await dl.path(), "utf8");
    expect(html).not.toContain("Fetter charge"); // the method's charge line is gone
    expect(html).toContain("outside the model"); // replaced by the envelope note (apostrophe escaped)
  });

  test("out of envelope, bench mode explains the envelope instead of 'enter an airframe'", async ({
    page,
  }) => {
    await page.goto("/?mode=x&dep=s&xalt=25000");
    await page.getByRole("button", { name: "Bench mode" }).click();
    const dialog = page.getByRole("dialog", { name: "Bench mode" });
    await expect(dialog.getByText(/outside the Fetter model.s envelope/i)).toBeVisible();
    await expect(dialog.getByText(/Enter an airframe to see its charges/i)).toHaveCount(0);
  });

  test("Fetter mode flags a diameter that looks like a unit or OD mix-up", async ({ page }) => {
    await page.goto("/?mode=x&dep=s");
    const dia = page.getByRole("spinbutton", { name: /Inner diameter/ }).first();
    await dia.fill("98"); // 98 "inches" is really 98 mm typed into an inches field
    await expect(page.getByText(/did you mean mm, or enter the outside diameter/i)).toBeVisible();
    await dia.fill("3");
    await expect(page.getByText(/did you mean mm, or enter the outside diameter/i)).toHaveCount(0);
  });

  test("Fetter packing factor is clamped to its physical range on entry", async ({ page }) => {
    // Start below full so the clamp changes the value (and the field visibly resyncs).
    await page.goto("/?mode=x&dep=s&xpk=0.5");
    const pk = page.getByLabel("Parachute packing factor");
    await expect(pk).toHaveValue("0.5");
    await pk.fill("3"); // nonsensical; clamps to the full-tube maximum of 1
    await expect(pk).toHaveValue("1");
  });

  test("the Fetter mode has no serious accessibility violations", async ({ page }) => {
    // The default-mode axe scan doesn't reach the Fetter UI (the screw <select>, the
    // attribution box, the envelope alert), so it gets its own scan — in dual deploy, to also
    // cover the two-compartment layout.
    await page.goto("/?mode=x");
    await expect(page.getByTestId("fetter-mass").first()).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  test("dual deploy sizes two Fetter compartments — a drogue and a main", async ({ page }) => {
    await page.goto("/?mode=x&dep=d");
    await expect(page.getByRole("heading", { name: "Drogue compartment" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Main compartment" })).toBeVisible();
    // Two independent charges, one per bay; the longer main bay sizes larger than the drogue.
    await expect(page.getByTestId("fetter-mass")).toHaveCount(2);
    const masses = await page.getByTestId("fetter-mass").allTextContents();
    expect(Number(masses[1])).toBeGreaterThan(Number(masses[0]));
  });

  test("redundant altimeters add a Fetter backup charge, larger than the primary", async ({
    page,
  }) => {
    await page.goto("/?mode=x&dep=s&rdn=1");
    const primary = Number(await page.getByTestId("fetter-mass").textContent());
    const backup = Number(await page.getByTestId("fetter-backup-mass").textContent());
    expect(backup).toBeGreaterThan(primary); // +20% / +0.5 g redundancy convention
    // The ×-multiplier "Safety margin" is still never applied — the backup is redundancy, not margin.
    await expect(page.getByLabel("Safety margin")).toHaveCount(0);
  });

  test("per-bay envelope: a high drogue is withheld while the low main still sizes", async ({
    page,
  }) => {
    // Drogue fires at apogee (25k ft, out of envelope); the main deploys low (in envelope).
    await page.goto("/?mode=x&dep=d&xalt=25000");
    await expect(page.getByTestId("fetter-mass")).toHaveCount(1); // main only
    await expect(
      page.getByRole("alert").filter({ hasText: /Outside the Fetter model.s envelope/i }),
    ).toBeVisible(); // the drogue's redirect
  });

  test("switching units in dual Fetter converts BOTH compartments, not just the drogue", async ({
    page,
  }) => {
    await page.goto("/?mode=x&dep=d");
    const mainDia = page.getByRole("spinbutton", { name: /Inner diameter/ }).nth(1);
    await expect(mainDia).toHaveValue("3");
    const mainMass = page.getByTestId("fetter-mass").nth(1);
    const before = (await mainMass.textContent())!.trim();
    await page
      .locator("#calculator")
      .getByRole("group", { name: "Length unit" })
      .getByRole("button", { name: "mm" })
      .click();
    await expect(mainDia).toHaveValue("76.2"); // the main converts too, not a silent 3 mm
    await expect(mainMass).toHaveText(before); // its charge is unchanged
  });

  test("in dual deploy the methodology walks the in-envelope compartment, not always the drogue", async ({
    page,
  }) => {
    // Drogue fires at 25k (out of envelope); the main deploys low (in envelope) and is sized.
    await page.goto("/?mode=x&dep=d&xalt=25000");
    const methodology = page.locator("#methodology");
    // The worked comparison is labeled for the main — the compartment that actually sized —
    // and shows its numbers, not the drogue's "no charge is sized here".
    await page.getByText("Worked comparison — Main compartment").click();
    await expect(methodology.getByText(/no charge is sized here/i)).toHaveCount(0);
    await expect(methodology.getByText(/× the traditional charge/i)).toBeVisible();
  });

  test("dual Fetter round-trips the main compartment through the shareable URL", async ({
    page,
  }) => {
    await page.goto("/?mode=x&dep=d&xmdia=4&xml=30");
    await expect(page).toHaveURL(/xmdia=4/);
    await expect(page).toHaveURL(/xml=30/);
    // The main compartment (second card) reflects the shared geometry.
    await expect(
      page.getByRole("spinbutton", { name: /Inner diameter/ }).nth(1),
    ).toHaveValue("4");
  });

});
