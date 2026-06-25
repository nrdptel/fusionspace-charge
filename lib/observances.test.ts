import { describe, it, expect } from "vitest";
import { observancesForDate, type Observance } from "./observances";

describe("observances", () => {
  it("returns an array for every month", () => {
    for (let m = 0; m < 12; m++) {
      const list = observancesForDate(new Date(2026, m, 15));
      expect(Array.isArray(list)).toBe(true);
    }
  });

  it("shows Pride and Men's Mental Health in June", () => {
    const ids = observancesForDate(new Date(2026, 5, 15)).map((o) => o.id);
    expect(ids).toContain("pride");
    expect(ids).toContain("mens-mental-health");
  });

  it("every observance has the fields the UI needs", () => {
    for (let m = 0; m < 12; m++) {
      for (const o of observancesForDate(new Date(2026, m, 1))) {
        expectValid(o);
      }
    }
  });
});

function expectValid(o: Observance) {
  expect(o.id).toBeTruthy();
  expect(o.emoji).toBeTruthy();
  expect(o.message).toBeTruthy();
  if (o.bar) expect(o.bar.background).toMatch(/gradient|#/);
}
