import { describe, it, expect } from "vitest";
import {
  calibrationFromEntries,
  nextChargeSuggestion,
  summarizeFor,
  validatedCharge,
  type TestEntry,
} from "./testlog";

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

describe("validated charge", () => {
  it("needs two clean separations at the same charge for one airframe", () => {
    expect(validatedCharge([entry({ label: "X", charge: 1.5 })], "X")).toBeNull();
    const v = validatedCharge(
      [entry({ label: "X", charge: 1.5 }), entry({ label: "X", charge: 1.5 })],
      "X",
    );
    expect(v).toEqual({ charge: 1.5, count: 2 });
  });

  it("does not count partials, different charges, or other airframes", () => {
    expect(
      validatedCharge(
        [
          entry({ label: "X", charge: 1.5 }),
          entry({ label: "X", charge: 1.5, outcome: "partial" }),
          entry({ label: "X", charge: 1.7 }),
          entry({ label: "Y", charge: 1.5 }),
        ],
        "X",
      ),
    ).toBeNull();
  });

  it("prefers the most-tested charge, breaking ties toward the larger", () => {
    const v = validatedCharge(
      [
        entry({ label: "X", charge: 1.5 }),
        entry({ label: "X", charge: 1.5 }),
        entry({ label: "X", charge: 1.8 }),
        entry({ label: "X", charge: 1.8 }),
      ],
      "X",
    );
    expect(v).toEqual({ charge: 1.8, count: 2 });
  });
});

describe("next-charge suggestion", () => {
  it("steps up ~25% after no separation", () => {
    const n = nextChargeSuggestion([entry({ label: "X", charge: 0.6, outcome: "none" })], "X");
    expect(n).toEqual({ kind: "increase", fromCharge: 0.6, fromOutcome: "none", suggested: 0.75 });
  });

  it("steps up ~15% after a partial", () => {
    const n = nextChargeSuggestion([entry({ label: "X", charge: 1.0, outcome: "partial" })], "X");
    expect(n?.kind).toBe("increase");
    expect(n?.suggested).toBeCloseTo(1.15, 5);
  });

  it("suggests repeating the same charge after a single clean test", () => {
    const n = nextChargeSuggestion([entry({ label: "X", charge: 1.2, outcome: "clean" })], "X");
    expect(n).toEqual({ kind: "confirm", fromCharge: 1.2, fromOutcome: "clean", suggested: 1.2 });
  });

  it("reads the most recently added test, and goes quiet once validated", () => {
    // newest-first: a partial added after a none drives the suggestion.
    const n = nextChargeSuggestion(
      [
        entry({ label: "X", charge: 0.8, outcome: "partial" }),
        entry({ label: "X", charge: 0.6, outcome: "none" }),
      ],
      "X",
    );
    expect(n?.fromCharge).toBe(0.8);
    // two cleans at the same charge → validated → no more suggestions.
    const done = nextChargeSuggestion(
      [entry({ label: "X", charge: 1.5 }), entry({ label: "X", charge: 1.5 })],
      "X",
    );
    expect(done).toBeNull();
  });
});
