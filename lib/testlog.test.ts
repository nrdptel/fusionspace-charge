import { describe, it, expect } from "vitest";
import {
  calibrationFromEntries,
  failureCauses,
  nextChargeSuggestion,
  sanitizeEntries,
  summarizeFor,
  validatedCharge,
  type TestEntry,
} from "./testlog";

describe("sanitizeEntries", () => {
  const gen = () => "gen-id";
  const today = "2026-07-01";

  it("drops non-object items and entries without a real charge", () => {
    const out = sanitizeEntries(
      [
        null,
        7,
        "x",
        { id: "neg", charge: -5 },
        { id: "nan", charge: "abc" },
        { id: "zero", charge: 0 },
        { id: "missing" },
        { id: "ok", charge: 2, outcome: "clean", label: "Bird", notes: "n", date: "2026-06-01" },
      ] as unknown[],
      gen,
      today,
    );
    expect(out).toEqual([
      { id: "ok", date: "2026-06-01", label: "Bird", charge: 2, outcome: "clean", notes: "n" },
    ]);
  });

  it("keeps a numeric charge string that coerces to a positive number", () => {
    const out = sanitizeEntries([{ id: "a", charge: "1.5" }] as unknown[], gen, today);
    expect(out[0].charge).toBe(1.5);
  });

  it("gives a stable id: reuse string ids, stringify numeric ids, mint only when missing", () => {
    const out = sanitizeEntries(
      [
        { id: "keep", charge: 1 },
        { id: 42, charge: 1 },
        { charge: 1 },
      ] as unknown[],
      gen,
      today,
    );
    expect(out.map((e) => e.id)).toEqual(["keep", "42", "gen-id"]);
  });

  it("defaults label/outcome/notes/date and only keeps a positive estimate", () => {
    const out = sanitizeEntries(
      [
        { id: "a", charge: 1, outcome: "weird", estimate: 0 },
        { id: "b", charge: 1, estimate: 0.9 },
      ] as unknown[],
      gen,
      today,
    );
    expect(out[0]).toEqual({ id: "a", date: today, label: "—", charge: 1, outcome: "clean", notes: "" });
    expect(out[1].estimate).toBe(0.9);
  });

  it("caps a pathologically large import", () => {
    const huge = Array.from({ length: 6000 }, () => ({ charge: 1 }));
    expect(sanitizeEntries(huge as unknown[], gen, today).length).toBe(5000);
  });

  it("replaces a non-ISO or impossible date with today so it can't hijack 'most recent'", () => {
    // "most recent clean" is chosen by lexicographic date order, so "9999-99-99" or a
    // free-text date would sort above every real test and become the surfaced charge.
    const out = sanitizeEntries(
      [
        { id: "a", charge: 1, date: "9999-99-99" },
        { id: "b", charge: 1, date: "tomorrow" },
        { id: "c", charge: 1, date: "2026-02-30" }, // Feb 30 — not a real day
        { id: "d", charge: 1, date: "2026-06-15" }, // valid, kept
      ] as unknown[],
      gen,
      today,
    );
    expect(out.map((e) => e.date)).toEqual([today, today, today, "2026-06-15"]);
  });
});

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

  it("treats charges equal at display precision as the same (ladder-picked vs typed)", () => {
    // One test picked from the ladder (already rounded) and one typed by hand with float
    // slop must both count as 1.50 g — otherwise the flagship 'prove it twice' flow never
    // earns the badge.
    const v = validatedCharge(
      [entry({ label: "X", charge: 1.5 }), entry({ label: "X", charge: 1.50000001 })],
      "X",
    );
    expect(v).toEqual({ charge: 1.5, count: 2 });
  });

  it("handles the classic 0.1 + 0.2 float case as one charge", () => {
    const v = validatedCharge(
      [entry({ label: "X", charge: 0.3 }), entry({ label: "X", charge: 0.1 + 0.2 })],
      "X",
    );
    expect(v).toEqual({ charge: 0.3, count: 2 });
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

describe("failure causes", () => {
  it("lists charge-size-first causes for no separation", () => {
    const c = failureCauses("none");
    expect(c.length).toBeGreaterThan(2);
    expect(c[0].toLowerCase()).toContain("too small");
  });

  it("gives partial-specific causes", () => {
    const c = failureCauses("partial");
    expect(c.length).toBeGreaterThan(1);
    expect(c.join(" ").toLowerCase()).toContain("light");
  });

  it("has nothing to say about a clean test", () => {
    expect(failureCauses("clean")).toEqual([]);
  });
});
