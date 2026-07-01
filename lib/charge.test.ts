import { describe, it, expect } from "vitest";
import {
  boreArea,
  cylinderVolume,
  pressureFromForce,
  blackPowderMass,
  sizeByPressure,
  sizeByForce,
  IN3_PER_FT3,
  LBM_TO_G,
  PSI_TO_PSF,
  R_BP,
  T_BP,
} from "./charge";
import { toInches, toPsi, in3ToCc } from "./units";
import { round } from "./format";

// The Methodology panel shows a worked example: it re-derives the mass from the same
// intermediates (pressure×144, volume÷1728, ÷(R·T), ×LBM_TO_G). This locks that displayed
// chain to what the lib actually computes, so a future edit to either can't silently drift.
describe("worked-example self-consistency (Methodology ↔ lib)", () => {
  for (const [dia, len, psi] of [
    [4, 12, 15],
    [3, 24, 12],
    [6, 36, 10],
  ] as const) {
    it(`reconciles for ${dia}"x${len}" at ${psi} psi`, () => {
      const r = sizeByPressure({ diameterIn: dia, lengthIn: len, pressurePsi: psi });
      const pressurePsf = r.pressure * PSI_TO_PSF;
      const volumeFt3 = r.volume / IN3_PER_FT3;
      const massLbm = (pressurePsf * volumeFt3) / (R_BP * T_BP);
      // The chain the panel prints must round to the same 2-dp gram value as r.mass.
      expect(round(massLbm * LBM_TO_G, 2)).toBe(round(r.mass, 2));
    });
  }

  it("recovers the raw target from the sized pressure and margin (pressure mode)", () => {
    // Methodology prints "(your <target> psi x <margin> margin)" as r.pressure / margin.
    const target = 12;
    const margin = 1.5;
    const r = sizeByPressure({ diameterIn: 4, lengthIn: 12, pressurePsi: target * margin });
    expect(round(r.pressure / margin, 2)).toBe(target);
  });
});

describe("geometry", () => {
  it("computes bore area of a 4 in tube", () => {
    expect(boreArea(4)).toBeCloseTo(12.566, 3);
  });

  it("computes cylinder volume", () => {
    // 4 in dia × 12 in long = 150.796 in³
    expect(cylinderVolume(4, 12)).toBeCloseTo(150.796, 2);
  });
});

describe("blackPowderMass", () => {
  // Canonical worked example used across HPR references: a 4 in ID section, 12 in long,
  // at 15 psi needs ~1.17 g of black powder.
  it("matches the standard 4 in / 12 in / 15 psi result", () => {
    const v = cylinderVolume(4, 12);
    expect(blackPowderMass(15, v)).toBeCloseTo(1.17, 1);
  });

  it("is linear in pressure and in volume", () => {
    const v = cylinderVolume(4, 12);
    expect(blackPowderMass(30, v)).toBeCloseTo(2 * blackPowderMass(15, v), 6);
    expect(blackPowderMass(15, 2 * v)).toBeCloseTo(2 * blackPowderMass(15, v), 6);
  });

  it("returns zero for non-positive inputs", () => {
    expect(blackPowderMass(0, 100)).toBe(0);
    expect(blackPowderMass(15, 0)).toBe(0);
    expect(blackPowderMass(-5, 100)).toBe(0);
  });
});

describe("pressureFromForce", () => {
  it("converts force over bore area to pressure", () => {
    // 100 lbf over a 4 in bore (12.566 in²) ≈ 7.96 psi
    expect(pressureFromForce(100, 4)).toBeCloseTo(7.958, 3);
  });
});

describe("sizeByPressure / sizeByForce agree through the pressure they imply", () => {
  it("force mode equals pressure mode at the equivalent pressure", () => {
    const byForce = sizeByForce({ diameterIn: 4, lengthIn: 12, forceLbf: 100 });
    const byPressure = sizeByPressure({
      diameterIn: 4,
      lengthIn: 12,
      pressurePsi: byForce.pressure,
    });
    expect(byForce.mass).toBeCloseTo(byPressure.mass, 9);
  });
});

describe("unit conversions round-trip and convert", () => {
  it("98 mm tube is ~3.858 in", () => {
    expect(toInches(98, "mm")).toBeCloseTo(3.858, 3);
  });

  it("converts kPa to psi", () => {
    expect(toPsi(100, "kPa")).toBeCloseTo(14.504, 3);
  });

  it("converts in³ to cc", () => {
    expect(in3ToCc(10)).toBeCloseTo(163.87, 2);
  });
});
