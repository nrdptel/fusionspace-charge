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

    await page.locator('#ground-test input[type="file"]').setInputFiles(file);
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
    await expect(page.getByText("1.5 g").first()).toBeVisible();
    page.on("dialog", (d) => d.accept());
    await page.locator('#ground-test input[type="file"]').setInputFiles({
      name: "not-charge.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"foo":1}'),
    });
    // The existing entry is untouched — a bad import can't corrupt or clear the log.
    await expect(page.getByText("1.5 g").first()).toBeVisible();
  });

  test("deleting a ground-test entry removes just that row and persists", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Charge tested").fill("1.1");
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await page.getByLabel("Charge tested").fill("2.2");
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await expect(page.getByText("1.1 g")).toBeVisible();
    await expect(page.getByText("2.2 g")).toBeVisible();
    // Entries are newest-first, so the first Delete removes the 2.2 g entry.
    await page.getByRole("button", { name: "Delete entry" }).first().click();
    await expect(page.getByText("2.2 g")).toHaveCount(0);
    await expect(page.getByText("1.1 g")).toBeVisible();
    await page.reload();
    await expect(page.getByText("2.2 g")).toHaveCount(0);
    await expect(page.getByText("1.1 g")).toBeVisible();
  });

  test("copies the share link to the clipboard", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/?mode=p&dep=s&mg=1");
    await page.getByRole("button", { name: "Copy share link" }).click();
    await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
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
    await page.goto("/");
    const unsafe = await page.locator('a[target="_blank"]').evaluateAll((els) =>
      els
        .filter((e) => !(e.getAttribute("rel") || "").includes("noopener"))
        .map((e) => e.getAttribute("href")),
    );
    expect(unsafe).toEqual([]);
  });

});
