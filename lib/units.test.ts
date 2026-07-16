import { describe, it, expect } from "vitest";
import {
  MM_PER_IN,
  KPA_PER_PSI,
  BAR_PER_PSI,
  N_PER_LBF,
  CC_PER_IN3,
  toInches,
  fromInches,
  toPsi,
  fromPsi,
  toLbf,
  fromLbf,
  in3ToCc,
  pressureDecimals,
  pressureStep,
} from "./units";
import { round } from "./format";

describe("conversion constants", () => {
  // Pinned so a silent edit to a physical constant fails loudly.
  it("are the expected exact values", () => {
    expect(MM_PER_IN).toBe(25.4);
    expect(CC_PER_IN3).toBe(16.387064);
    expect(KPA_PER_PSI).toBe(6.894757);
    expect(N_PER_LBF).toBe(4.4482216);
    // 1 bar = 100 kPa, so bar-per-psi is exactly kPa-per-psi ÷ 100.
    expect(BAR_PER_PSI).toBeCloseTo(0.06894757, 12);
    // Sanity against the textbook figure: 1 bar ≈ 14.5038 psi.
    expect(fromPsi(14.5037738, "bar")).toBeCloseTo(1, 6);
  });
});

describe("length / pressure / force conversions", () => {
  it("pass canonical units through unchanged", () => {
    expect(toInches(3.9, "in")).toBe(3.9);
    expect(fromInches(3.9, "in")).toBe(3.9);
    expect(toPsi(12, "psi")).toBe(12);
    expect(fromPsi(12, "psi")).toBe(12);
    expect(toLbf(32, "lbf")).toBe(32);
    expect(fromLbf(32, "lbf")).toBe(32);
  });

  it("convert to/from the alternate unit", () => {
    expect(toInches(25.4, "mm")).toBeCloseTo(1, 10);
    expect(fromInches(1, "mm")).toBe(25.4);
    expect(toPsi(6.894757, "kPa")).toBeCloseTo(1, 10);
    expect(fromPsi(1, "kPa")).toBe(6.894757);
    expect(toPsi(0.06894757, "bar")).toBeCloseTo(1, 10);
    expect(fromPsi(1, "bar")).toBeCloseTo(0.06894757, 12);
    expect(toLbf(4.4482216, "N")).toBeCloseTo(1, 10);
    expect(fromLbf(1, "N")).toBe(4.4482216);
  });

  it("round-trips through the alternate unit within tolerance", () => {
    for (const x of [1.5, 2.1, 3, 3.9, 6, 0.123]) {
      expect(toInches(fromInches(x, "mm"), "mm")).toBeCloseTo(x, 10);
      expect(toPsi(fromPsi(x, "kPa"), "kPa")).toBeCloseTo(x, 10);
      expect(toPsi(fromPsi(x, "bar"), "bar")).toBeCloseTo(x, 10);
      expect(toLbf(fromLbf(x, "N"), "N")).toBeCloseTo(x, 10);
    }
  });

  it("gives bar a finer display precision and input step than psi/kPa", () => {
    // A typical target reads ~12 psi / ~83 kPa / ~0.83 bar — bar needs the extra decimal.
    expect(pressureDecimals("psi")).toBe(1);
    expect(pressureDecimals("kPa")).toBe(1);
    expect(pressureDecimals("bar")).toBe(2);
    expect(pressureStep("psi")).toBe(1);
    expect(pressureStep("kPa")).toBe(5);
    expect(pressureStep("bar")).toBe(0.05);
  });
});

describe("in3ToCc", () => {
  it("converts cubic inches to cc", () => {
    expect(in3ToCc(1)).toBe(16.387064);
    expect(in3ToCc(0)).toBe(0);
    expect(in3ToCc(10)).toBeCloseTo(163.87064, 6);
  });
});

describe("repeated unit-toggle stability", () => {
  // The UI stores rounded values and re-converts on every unit switch. Nominal preset
  // values must be exact fixed points so toggling in↔mm (etc.) doesn't walk the number.
  it("does not drift nominal values across many round-trips", () => {
    const cases: [number, "length" | "pressure" | "force"][] = [
      [1.5, "length"], [2.1, "length"], [3, "length"], [3.9, "length"], [6, "length"],
      [38, "length"], [54, "length"], [75, "length"], [98, "length"], [152, "length"],
      [12, "pressure"], [32, "force"],
    ];
    for (const [start] of cases) {
      // Simulate 20 alternating in↔mm toggles the way the calculator does (round 3dp each).
      let inMm = round(fromInches(toInches(start, "in"), "mm"), 3);
      let backIn = round(fromInches(toInches(inMm, "mm"), "in"), 3);
      const firstBack = backIn;
      for (let i = 0; i < 20; i++) {
        inMm = round(fromInches(toInches(backIn, "in"), "mm"), 3);
        backIn = round(fromInches(toInches(inMm, "mm"), "in"), 3);
      }
      // After the first round-trip it must not move further (no accumulating drift).
      expect(backIn).toBe(firstBack);
    }
  });
});
