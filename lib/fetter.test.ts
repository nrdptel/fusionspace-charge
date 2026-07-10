import { describe, it, expect } from "vitest";
import {
  FETTER,
  FETTER_ALT_LIMIT_FT,
  absorptionHigh,
  fetterCharge,
  ejectionVelocity,
  screwMinorIn,
  shearForceLbf,
  withinAltitudeEnvelope,
  type FetterArgs,
} from "./fetter";
import { toInches, toPsi, gToGrains, grainsToG, MM_PER_IN, KPA_PER_PSI, GR_PER_G } from "./units";

// The Fetter model is safety-critical: a charge that doesn't separate loses the rocket, one
// that's wildly oversized destroys it. This fixture pins the implementation to Tom Fetter's
// *published* numbers — the deployment-fixture test results (paper Table 16-1) and shear-pin
// table (Table 17-2) from "Using Black Powder for Parachute Deployment" Rev 1.2, plus the
// worked example baked into the reference spreadsheet (Rev 1.3). If any of these drift, the
// implementation no longer reproduces his work and must not ship.
//
// Sizing helper: every published case has friction 0 unless noted, and the paper's tables use
// the high-absorption curve. `case` builds the canonical-unit args.
const args = (o: Partial<FetterArgs> & Pick<FetterArgs, "diameterIn" | "lengthIn">): FetterArgs => ({
  screwMinorIn: screwMinorIn("2-56"),
  pinCount: 2,
  frictionLbf: 0,
  packing: 1,
  safety: 0.4,
  ...o,
});

describe("Fetter model — reproduces the paper's deployment-test results (Table 16-1)", () => {
  // Table 16-1 lists, for two real deployment fixtures, the model's predicted charge with and
  // without the 40% safety factor. Both fixtures use two 2-56 nylon shear pins. TR-1 is a
  // 2.15"×9" parachute section; VTS-1 is 3"×15". These are the paper's primary, test-backed
  // validation — measured energetic-deployment charges the model was built to match.
  // The paper prints these charges to 2–3 significant figures, so the model can only be held
  // to the table's own precision. Every case lands within 0.01 g of the printed value; 0.02 g
  // leaves headroom for the paper's rounding direction (e.g. its 1.28 vs the model's 1.289).
  const TOL = 0.02; // g

  const rows: [string, FetterArgs, number][] = [
    // [source note, args, published grams]
    ["TR-1 full chute, no safety factor", args({ diameterIn: 2.15, lengthIn: 9, safety: 0 }), 0.89],
    ["TR-1 full chute, with safety factor", args({ diameterIn: 2.15, lengthIn: 9 }), 1.28],
    ["VTS-1 full chute, no safety factor", args({ diameterIn: 3, lengthIn: 15, safety: 0 }), 1.39],
    ["VTS-1 full chute, with safety factor", args({ diameterIn: 3, lengthIn: 15 }), 2.0],
    ["VTS-1 half chute (Pf 0.5), with safety factor", args({ diameterIn: 3, lengthIn: 15, packing: 0.5 }), 1.05],
    ["VTS-1 quarter chute (Pf 0.25), with safety factor", args({ diameterIn: 3, lengthIn: 15, packing: 0.25 }), 0.48],
  ];

  for (const [note, a, expected] of rows) {
    it(`${note} → ${expected} g`, () => {
      expect(Math.abs(fetterCharge(a).mass - expected)).toBeLessThanOrEqual(TOL);
    });
  }
});

describe("Fetter model — reproduces the shear-pin table (Table 17-2)", () => {
  // Table 17-2: a fixed 4"×20" tube (Pf 0.5, 40% safety factor) with different shear pins.
  // The paper rounds the charge to ~2 significant figures, so the tolerance is one rounding
  // step. This exercises every shear-screw preset and both pin counts.
  const rows: [string, FetterArgs, number][] = [
    ["3 × 2-56", args({ diameterIn: 4, lengthIn: 20, screwMinorIn: screwMinorIn("2-56"), pinCount: 3, packing: 0.5 }), 2.1],
    ["3 × 4-40", args({ diameterIn: 4, lengthIn: 20, screwMinorIn: screwMinorIn("4-40"), pinCount: 3, packing: 0.5 }), 3.5],
    ["6 × 4-40", args({ diameterIn: 4, lengthIn: 20, screwMinorIn: screwMinorIn("4-40"), pinCount: 6, packing: 0.5 }), 7.8],
    ["3 × 6-32", args({ diameterIn: 4, lengthIn: 20, screwMinorIn: screwMinorIn("6-32"), pinCount: 3, packing: 0.5 }), 5.6],
  ];
  for (const [note, a, expected] of rows) {
    it(`4"×20", ${note} → ${expected} g`, () => {
      expect(fetterCharge(a).mass).toBeCloseTo(expected, 1);
    });
  }
});

describe("Fetter model — reproduces the reference spreadsheet's worked example (Rev 1.3)", () => {
  // The spreadsheet ships configured for a 3"×15" test rocket, two 2-56 screws, 2 lbf nosecone
  // friction, full chute (Pf 1), 40% safety factor. Its own cells give 2.0784 g of powder,
  // 12.67 psi, and — with an 8 lb rocket / 0.5 lb nosecone / 3" shoulder — 54.81 ft/s ejection.
  const a = args({ diameterIn: 3, lengthIn: 15, frictionLbf: 2 });
  const r = fetterCharge(a);

  it("black-powder mass = 2.078 g (cell 'New BP Calc Model'!C40)", () => {
    expect(r.mass).toBeCloseTo(2.0784, 2);
  });
  it("required pressure = 12.67 psi (cell C18)", () => {
    expect(r.pressurePsi).toBeCloseTo(12.67, 1);
  });
  it("nosecone ejection velocity = 54.81 ft/s (cell C19)", () => {
    const v = ejectionVelocity({
      forceLbf: r.forceLbf,
      frictionLbf: 2,
      shoulderIn: 3,
      noseMassLb: 0.5,
      rocketMassLb: 8,
    });
    expect(v).toBeCloseTo(54.81, 1);
  });
});

describe("Fetter model — Table 17-1 is a documented discrepancy, not a target", () => {
  // Table 17-1 (a model-illustration table, no test data behind it) prints absolute charges
  // that are internally inconsistent with the test-backed Table 16-1, Table 17-2, and the
  // reference spreadsheet — no single safety factor or friction reconciles them, so it appears
  // to predate a model refinement and was not regenerated for Rev 1.2. Its *scaling ratios*
  // — the only thing the surrounding text actually derives from it — do reproduce exactly, so
  // we assert those and record (do not chase) the absolute divergence. Implementing to the
  // test-backed data is both the faithful choice and the conservative one: Table 17-1 would
  // over-predict powder for small rockets.
  it("reproduces the paper's stated 4.75× scaling (2\"×40\" vs 4\"×10\", equal volume)", () => {
    const twoBy40 = fetterCharge(args({ diameterIn: 2, lengthIn: 40, packing: 0.5 })).mass;
    const fourBy10 = fetterCharge(args({ diameterIn: 4, lengthIn: 10, packing: 0.5 })).mass;
    // Paper §17: "requires 4.75 times more black powder".
    expect(twoBy40 / fourBy10).toBeCloseTo(4.75, 1);
  });

  it("diverges from Table 17-1's absolute values (the known, documented gap)", () => {
    // Table 17-1 prints 4"×20", 2×2-56, Pf 0.5 → 1.6 g. The test-backed model gives ~1.33 g,
    // ~20% lower. This test exists so the divergence is asserted and visible, not silent.
    const model = fetterCharge(args({ diameterIn: 4, lengthIn: 20, packing: 0.5 })).mass;
    expect(model).toBeCloseTo(1.33, 1);
    expect(model).toBeLessThan(1.6); // conservative-safe direction is not the issue; fidelity is
  });
});

describe("absorption factor A_H (Equation 16-17)", () => {
  it("is zero for an empty tube and ~0.94 for a full one", () => {
    expect(absorptionHigh(0)).toBeCloseTo(0, 6);
    expect(absorptionHigh(1)).toBeCloseTo(0.9403, 3);
  });
  it("matches 0.951·(1 − e^(−4.491·Pf)) and rises monotonically", () => {
    for (const pf of [0.1, 0.25, 0.5, 0.75]) {
      expect(absorptionHigh(pf)).toBeCloseTo(0.951 * (1 - Math.exp(-4.491 * pf)), 9);
    }
    expect(absorptionHigh(0.25)).toBeLessThan(absorptionHigh(0.5));
  });
  it("clamps a packing factor outside [0,1]", () => {
    expect(absorptionHigh(-1)).toBe(absorptionHigh(0));
    expect(absorptionHigh(2)).toBe(absorptionHigh(1));
  });
});

describe("traditional-vs-Fetter delta (the model's whole point)", () => {
  // At a realistic packing factor the model predicts 1–4× the traditional ideal-gas charge —
  // the under-prediction Fetter's paper set out to correct. The traditional figure is the
  // ideal-gas mass at the SAME required pressure and volume (lib/charge.ts), so the ratio is
  // purely the parachute-absorption physics.
  it("runs 1–4× the traditional charge across full-to-half packing", () => {
    for (const packing of [0.5, 0.75, 1]) {
      const r = fetterCharge(args({ diameterIn: 3, lengthIn: 15, packing }));
      expect(r.ratio).toBeGreaterThan(1);
      expect(r.ratio).toBeLessThan(4);
      expect(r.traditionalMass).toBeGreaterThan(0);
      expect(r.traditionalMass).toBeLessThan(r.mass);
    }
  });
});

describe("shear force from the screw geometry", () => {
  it("a 2-56 nylon screw shears near the paper's ~31 lbf", () => {
    // §6: min nylon strength 9600 psi over the 2-56 minor area → ~31 lbf per screw.
    expect(shearForceLbf(screwMinorIn("2-56"), 1)).toBeCloseTo(31, 0);
    expect(shearForceLbf(screwMinorIn("2-56"), 2)).toBeCloseTo(62, 0);
  });
  it("is zero without screws (friction-only deployment)", () => {
    expect(shearForceLbf(screwMinorIn("2-56"), 0)).toBe(0);
    expect(shearForceLbf(0, 3)).toBe(0);
  });
});

describe("degenerate and hostile inputs (never NaN, never under-size silently)", () => {
  it("returns a zeroed result for non-positive geometry", () => {
    expect(fetterCharge(args({ diameterIn: 0, lengthIn: 15 })).mass).toBe(0);
    expect(fetterCharge(args({ diameterIn: 3, lengthIn: -1 })).mass).toBe(0);
  });
  it("never produces a negative or NaN mass", () => {
    for (const packing of [0, 0.5, 1]) {
      for (const pins of [0, 2, 6]) {
        const m = fetterCharge(args({ diameterIn: 3, lengthIn: 15, pinCount: pins, packing })).mass;
        expect(Number.isFinite(m)).toBe(true);
        expect(m).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it("no screws and no friction gives no charge; friction alone gives a small one", () => {
    expect(fetterCharge(args({ diameterIn: 3, lengthIn: 15, pinCount: 0, frictionLbf: 0 })).mass).toBe(0);
    expect(fetterCharge(args({ diameterIn: 3, lengthIn: 15, pinCount: 0, frictionLbf: 5 })).mass).toBeGreaterThan(0);
  });
});

describe("envelope — altitude limit (~20k ft)", () => {
  it("is within the envelope below the limit and out at or above it", () => {
    expect(withinAltitudeEnvelope(0)).toBe(true);
    expect(withinAltitudeEnvelope(15000)).toBe(true);
    expect(withinAltitudeEnvelope(FETTER_ALT_LIMIT_FT - 1)).toBe(true);
    expect(withinAltitudeEnvelope(FETTER_ALT_LIMIT_FT)).toBe(false);
    expect(withinAltitudeEnvelope(30000)).toBe(false);
  });
});

describe("unit round-trips (canonical ↔ display)", () => {
  it("grams ↔ grains", () => {
    expect(gToGrains(1)).toBeCloseTo(GR_PER_G, 6);
    expect(gToGrains(2.0784)).toBeCloseTo(32.08, 1); // the worked example, in grains
    expect(grainsToG(gToGrains(2.0784))).toBeCloseTo(2.0784, 9);
  });
  it("inches ↔ millimetres", () => {
    expect(toInches(MM_PER_IN, "mm")).toBeCloseTo(1, 9);
    expect(toInches(76.2, "mm")).toBeCloseTo(3, 9); // the 3" example tube
  });
  it("psi ↔ kPa on the worked example pressure", () => {
    const psi = fetterCharge(args({ diameterIn: 3, lengthIn: 15, frictionLbf: 2 })).pressurePsi;
    const kPa = psi * KPA_PER_PSI;
    expect(toPsi(kPa, "kPa")).toBeCloseTo(psi, 6);
    expect(kPa).toBeCloseTo(87.3, 0); // ~12.67 psi in kPa
  });
});

describe("constants match the paper's USCS-native values", () => {
  it("carries the verified molar masses, gas constant, and specific heats", () => {
    expect(FETTER.MBPcpgas).toBe(0.149);
    expect(FETTER.Ru).toBe(197.305);
    expect(FETTER.cvBPcp).toBe(7247);
    expect(FETTER.nylonShearMinPsi).toBe(9600);
  });
});
