import { describe, it, expect } from "vitest";
import { calibrationFromEntries, summarizeFor, type TestEntry } from "./testlog";

const entry = (p: Partial<TestEntry>): TestEntry => ({
  id: Math.random().toString(36).slice(2),
  date: "2026-01-01",
  label: "4\" drogue",
  charge: 1.2,
  outcome: "clean",
  notes: "",
  ...p,
});

describe("ground-test summary", () => {
  it("returns nothing for an empty label or no entries", () => {
    expect(summarizeFor([], "Av-Bay")).toEqual({ cleanCount: 0 });
    expect(summarizeFor([entry({})], "  ")).toEqual({ cleanCount: 0 });
  });

  it("matches case- and whitespace-insensitively on the label", () => {
    const s = summarizeFor([entry({ label: "Nike-X" })], "  nike-x ");
    expect(s.cleanCount).toBe(1);
    expect(s.lastClean?.label).toBe("Nike-X");
  });

  it("counts only clean tests with a real charge", () => {
    const entries = [
      entry({ label: "X", outcome: "clean", charge: 1.5 }),
      entry({ label: "X", outcome: "partial", charge: 1.2 }),
      entry({ label: "X", outcome: "none", charge: 1.0 }),
      entry({ label: "X", outcome: "clean", charge: 0 }),
    ];
    expect(summarizeFor(entries, "X").cleanCount).toBe(1);
  });

  it("picks the most recent clean test by date", () => {
    const entries = [
      entry({ label: "X", date: "2026-03-10", charge: 2.0 }),
      entry({ label: "X", date: "2026-06-01", charge: 2.4 }),
      entry({ label: "X", date: "2026-01-15", charge: 1.8 }),
    ];
    const s = summarizeFor(entries, "X");
    expect(s.lastClean?.date).toBe("2026-06-01");
    expect(s.lastClean?.charge).toBe(2.4);
  });

  it("does not match a different airframe", () => {
    expect(summarizeFor([entry({ label: "Drogue" })], "Main")).toEqual({ cleanCount: 0 });
  });
});

describe("model calibration", () => {
  it("needs at least two clean tests with an estimate", () => {
    expect(calibrationFromEntries([])).toBeNull();
    expect(
      calibrationFromEntries([entry({ charge: 1.2, estimate: 1.0 })]),
    ).toBeNull();
  });

  it("averages the charge-to-estimate ratio across clean tests", () => {
    const c = calibrationFromEntries([
      entry({ charge: 1.2, estimate: 1.0 }), // 1.2×
      entry({ charge: 1.6, estimate: 1.0 }), // 1.6×
    ]);
    expect(c?.count).toBe(2);
    expect(c?.mean).toBeCloseTo(1.4, 5);
    expect(c?.min).toBeCloseTo(1.2, 5);
    expect(c?.max).toBeCloseTo(1.6, 5);
  });

  it("ignores tests without an estimate, with no charge, or that weren't clean", () => {
    const c = calibrationFromEntries([
      entry({ charge: 1.2, estimate: 1.0 }),
      entry({ charge: 1.5, estimate: 1.0 }),
      entry({ charge: 2.0, estimate: undefined }), // no estimate
      entry({ charge: 2.0, estimate: 1.0, outcome: "partial" }), // not clean
      entry({ charge: 0, estimate: 1.0 }), // no charge
    ]);
    expect(c?.count).toBe(2);
  });
});
