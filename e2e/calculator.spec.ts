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

  test("computes the default pressure-mode charges", async ({ page }) => {
    await page.goto("/");
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

  test("editing an input writes shareable state into the URL", async ({ page }) => {
    await page.goto("/");
    const dia = page.getByLabel("Airframe inner diameter");
    await dia.fill("6");
    await expect(page).toHaveURL(/dia=6/);
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

  test("logging a ground test adds an entry", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Charge tested").fill("1.5");
    await page.getByRole("button", { name: "Log test", exact: true }).click();
    await expect(page.getByText("1.5 g").first()).toBeVisible();
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
