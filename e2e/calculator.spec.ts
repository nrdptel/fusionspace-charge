import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
    await page.goto("/?mode=p&dep=d");
    const masses = page.getByTestId("mass");
    // 4 in airframe, 12 psi: drogue (12 in) ≈ 0.93 g, main (24 in) ≈ 1.87 g.
    await expect(masses.nth(0)).toHaveText("0.93");
    await expect(masses.nth(1)).toHaveText("1.87");
  });

  test("a deep link restores force mode and dual deploy", async ({ page }) => {
    await page.goto("/?mode=f&dep=d");
    await expect(page.getByText("Force per pin").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "2-56 nylon" }).first()).toBeVisible();
  });

  test("each well takes its own diameter, written to the URL", async ({ page }) => {
    await page.goto("/?dep=d");
    const diameters = page.getByLabel("Inner diameter");
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
    const dia = page.getByLabel("Inner diameter").first();
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

  test("the header has a Ko-fi tip link", async ({ page }) => {
    await page.goto("/");
    const tip = page.getByRole("link", { name: "Tip" });
    await expect(tip).toBeVisible();
    await expect(tip).toHaveAttribute("href", "https://ko-fi.com/nrdptel");
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
