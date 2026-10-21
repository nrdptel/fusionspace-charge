/**
 * Tom Fetter's black-powder deployment model — a third way to size an ejection charge.
 *
 * The traditional ideal-gas method (lib/charge.ts) sizes powder purely from a target
 * pressure and volume. Fetter's pressure-chamber and deployment-fixture testing found that
 * the traditional model under-predicts the powder needed to deploy a parachute — by roughly
 * 1–4× for small-to-medium high-power rockets — because a parachute protector / recovery
 * blanket absorbs a large share of the combustion energy before it can pressurize the tube.
 * His model accounts for that absorption, the moles of air already in the compartment, and
 * the heating of both the air and the combustion products, then solves for the powder mass
 * that shears the pins (plus friction) with an energetic margin.
 *
 * The model is Tom Fetter's. This is a clean-room reimplementation of the published math —
 * "Using Black Powder for Parachute Deployment" (Rev 1.2, NARCON-2025) and the reference
 * spreadsheet (Rev 1.3). The paper is the source of truth for the equations; the spreadsheet
 * resolves ambiguity in the closed form. Every constant and step here was checked against the
 * paper, and the implementation reproduces the paper's deployment-test results (Table 16-1)
 * and shear-pin table (Table 17-2) and the spreadsheet's worked example — see fetter.test.ts.
 *
 *   Paper: http://speedmotionrockets.com/Papers.html
 *   The published derivation lives in §8 (chemistry / thermodynamics) and §16 (the model).
 *
 * All functions are pure and take canonical units (inches, lbf, dimensionless factors) and
 * return grams / psi / lbf, so the math can be audited independently of the UI's unit
 * handling — exactly like lib/charge.ts.
 */

import { blackPowderMass } from "./charge";

/**
 * Model constants, in the paper's USCS-native unit system (mass in lb, length in ft, time in
 * s — so force is lb·ft/s², a poundal, and pressure is lb/(ft·s²)). Values verified against
 * the paper (Rev 1.2) and identical in the reference spreadsheet (Rev 1.3).
 */
export const FETTER = {
  /** Molar mass of black-powder combustion gas, from Chevreuil's equation (lb/mol). §5, §8. */
  MBPcpgas: 0.149,
  /** Molar mass of air (lb/mol). §8. */
  Mair: 0.0642,
  /** Molar mass of black powder (lb/mol). §8. */
  MBP: 0.09939,
  /** Universal gas constant in USCS-native units — 8.314 J/(mol·K) (lb·ft²)/(s²·K·mol). §4. */
  Ru: 197.305,
  /** Specific heat of the BP combustion products, ft²/(s²·K). §8, Table 8-3. */
  cvBPcp: 7247,
  /** Specific heat of air, ft²/(s²·K). §8, Table 8-3. */
  cvair: 7730,
  /** Delta enthalpy of black powder for Chevreuil's equation, (lb·ft²)/(s²·mol). §8, Table 8-1. */
  deltaHBP: -2245000,
  /** Ambient temperature (70 °F), K. */
  Tamb: 294.261,
  /** Ambient (sea-level) pressure, 14.7 psi expressed as lb/(ft·s²). §11. */
  Patm: 68110,
  /** Nylon 6/6 minimum shear strength, psi, on the thread's minor-diameter area. §6, Table 6-1.
   *  Used only to reproduce the paper's tables (see pinForcePaperLbf). It is the low end of the
   *  strength range, so it gives the least pin force and errs toward too little powder. */
  nylonShearMinPsi: 9600,
  /** Nylon 6/6 shear strength at the high end, psi, on the thread's pitch-diameter area: the
   *  only published upper bound, B. Feretich, "Shear Pin/Screw Calculations" (archived
   *  2026-04-17, https://web.archive.org/web/20260417090259/http://feretich.com/Rocketry/Resources/shearPins.html).
   *  It gives 46 / 76 / 114 lbf for 2-56 / 4-40 / 6-32, about 1.5× the paper's Table 6-1. A
   *  stronger pin needs more powder, so the calculator sizes from this (pinForceHighLbf). */
  nylonShearHighPsi: 10500,
} as const;

/**
 * Attribution for the model, reused wherever it's credited (the mode, the methodology, the
 * recovery report, the README). The model and the source documents are Tom Fetter's; only the
 * math is reimplemented here. The site is plain HTTP.
 */
export const FETTER_LINKS = {
  author: "Tom Fetter",
  paper:
    "http://speedmotionrockets.com/Using%20Black%20Powder%20for%20Parachute%20Deployment%20-%20Rev1_2.pdf",
  papers: "http://speedmotionrockets.com/Papers.html",
  video: "https://www.youtube.com/watch?v=KEiH5g9ek8s",
} as const;

/** Standard gravity, lbf ↔ poundal and psi ↔ lb/(ft·s²): 1 lbf = 32.174 lb·ft/s². */
const GC = 32.174;
/** Pounds-mass → grams, the unit you actually weigh on a scale. */
const LBM_TO_G = 453.592;
/** psi → lb/(ft·s²): ×144 (in²→ft²) ×GC (lbf→poundal). */
const PSI_TO_NATIVE = GC * 144;
/**
 * Shear screws Fetter characterises, with two diameters of the thread, in inches:
 * - `minorIn`, the minor (root) diameter, from the paper's Table 6-1 (originally feretich.com).
 *   A loose fit breaks the pin along the root, so this area gives the least force.
 * - `pitchIn`, the basic pitch diameter: the minimum for a class 2B internal thread (ASME
 *   B1.1) for the inch sizes, and ISO 724's d2 = d − 0.6495·P for M2 × 0.4 (1.7402 mm) and
 *   M3 × 0.5 (2.6753 mm), rounded up. A close fit forces the cut through part of the thread, so
 *   this area gives the most force (Feretich's rule). Feretich published inch sizes only; the
 *   M2 and M3 forces apply his rule to the ISO diameters.
 * The shear force follows from the nylon strength and one of these areas, so the screw itself
 * drives the number.
 */
export const FETTER_SCREWS = [
  { label: "M2", minorIn: 0.05942, pitchIn: 0.06852 },
  { label: "2-56", minorIn: 0.0641, pitchIn: 0.0744 },
  { label: "4-40", minorIn: 0.0813, pitchIn: 0.0958 },
  { label: "M3", minorIn: 0.09396, pitchIn: 0.10533 },
  { label: "6-32", minorIn: 0.0997, pitchIn: 0.1177 },
] as const;

export type ScrewSize = (typeof FETTER_SCREWS)[number]["label"];

/** The minor diameter (in) for a screw label, or 0 if unknown. */
export function screwMinorIn(size: ScrewSize): number {
  return FETTER_SCREWS.find((s) => s.label === size)?.minorIn ?? 0;
}

/** The basic pitch diameter (in) for a screw label, or 0 if unknown. */
export function screwPitchIn(size: ScrewSize): number {
  return FETTER_SCREWS.find((s) => s.label === size)?.pitchIn ?? 0;
}

/**
 * The force that breaks one nylon pin at the high end of its strength, lbf: Feretich's upper
 * bound, 10,500 psi on the pitch-diameter area, π/4 · D_pitch² · 10,500. This is the force the
 * calculator sizes from. A pin that breaks harder than the model assumes needs more powder, so
 * the high end errs toward more powder than the paper's force. It is not a ceiling: one builder's
 * 6-32 broke at 116 lbf, just above it, and a cold pin broken fast can go higher (resin data; no
 * pin test). Measured breaks mostly fall below it. Ground test first.
 */
export function pinForceHighLbf(size: ScrewSize): number {
  const d = screwPitchIn(size);
  return d > 0 ? (Math.PI / 4) * d * d * FETTER.nylonShearHighPsi : 0;
}

/**
 * The paper's force for one pin, lbf: Table 6-1's minimum, 9,600 psi on the minor-diameter
 * area, π/4 · D_minor² · 9,600. Used to reproduce Fetter's published tables, never to size a
 * charge: it is the low end of the range, about 1.5× below pinForceHighLbf.
 */
export function pinForcePaperLbf(minorIn: number): number {
  return minorIn > 0 ? (Math.PI / 4) * minorIn * minorIn * FETTER.nylonShearMinPsi : 0;
}

/** Whether an arbitrary value is a known screw size — used to validate untrusted state. */
export function isScrewSize(x: unknown): x is ScrewSize {
  return typeof x === "string" && FETTER_SCREWS.some((s) => s.label === x);
}

/**
 * Deployment altitude at or above which Fetter's model no longer applies (~20k ft): black
 * powder stops burning completely as ambient pressure falls, and the model assumes sea level.
 * §11–12.
 */
export const FETTER_ALT_LIMIT_FT = 20000;

/**
 * A charge below which Fetter cautions against going: an 18 mm motor's own ejection charge is
 * roughly 0.5 g, so a smaller result is usually too little powder to light reliably. Advisory.
 */
export const FETTER_MIN_TYPICAL_G = 0.5;

/**
 * Whether a deployment altitude is within the model's envelope. The model assumes sea-level
 * ambient pressure and is not intended for high-altitude deployment (~20k ft and up), where
 * black powder no longer burns completely. At or above the limit the UI must not present a
 * number — it points back to the traditional modes plus a ground test instead.
 */
export function withinAltitudeEnvelope(deployAltFt: number): boolean {
  return !(deployAltFt >= FETTER_ALT_LIMIT_FT);
}

/**
 * The parachute energy-absorption fraction as a function of packing factor Pf (0 = empty tube,
 * 1 = full), the high-absorption curve A_H from the paper's Equation (16-17):
 *
 *     A_H(Pf) = 0.951 · (1 − e^(−4.491·Pf))
 *
 * The paper fits two curves (high and low) to the deployment data; the high curve is used
 * throughout — it is the conservative one, so the model does not under-estimate the powder.
 */
export function absorptionHigh(packing: number): number {
  const pf = Math.min(1, Math.max(0, packing));
  return 0.951 * (1 - Math.exp(-4.491 * pf));
}

/** Shear force of the screws, in lbf, for display: one pin's break force × the count. */
export function shearForceLbf(pinForceLbf: number, count: number): number {
  if (!(pinForceLbf > 0) || !(count > 0)) return 0;
  return pinForceLbf * count;
}

export interface FetterArgs {
  /** Body-tube inner diameter (bore the gas pressurizes), in. */
  diameterIn: number;
  /** Parachute compartment inner length, in. */
  lengthIn: number;
  /** Break force of one shear screw, lbf (0 if no screws are used). The calculator passes
   *  pinForceHighLbf, the high end; the paper's tables are reproduced with pinForcePaperLbf. */
  pinForceLbf: number;
  /** Number of shear screws across the joint. */
  pinCount: number;
  /** Nosecone / coupler friction beyond the pins, lbf. */
  frictionLbf: number;
  /** Parachute packing factor: fraction of the compartment filled by chute + protector +
   *  shock cord (0 empty, 1 full). Drives the absorption. */
  packing: number;
  /** Fetter's safety factor, the fraction of powder above the bare shear+friction force needed
   *  for an energetic deployment. His testing found 0.4 (40%) works for typical HPR — this IS
   *  the model's own margin, so no separate multiplier is applied on top. */
  safety: number;
}

export interface FetterResult {
  /** Fetter-model black-powder mass, grams. */
  mass: number;
  /** Compartment volume, in³. */
  volumeIn3: number;
  /** Bore cross-section, in². */
  areaIn2: number;
  /** Pressure the powder must build to deploy (includes the safety factor), psi. */
  pressurePsi: number;
  /** Total force the powder must generate (shear + friction, ×(1+safety)), lbf. */
  forceLbf: number;
  /** Shear force of the screws alone, lbf. */
  shearLbf: number;
  /** Parachute absorption fraction A_H used. */
  absorption: number;
  /** The traditional ideal-gas charge for the SAME required pressure and volume, grams — what
   *  lib/charge.ts would size ignoring the protector. The whole point of the model is the gap. */
  traditionalMass: number;
  /** Fetter mass ÷ traditional mass, the delta the model predicts (0 if traditional is 0). */
  ratio: number;
}

/**
 * Size a parachute-compartment ejection charge by the Fetter model.
 *
 * The closed form below is the paper's §16 pressure/energy balance solved for the powder mass
 * mBP — a quadratic in mBP whose positive root is taken. It is transcribed from the reference
 * spreadsheet's model cell (Rev 1.3), with the intermediate quantities named a,b,cc,d,f,g,h,
 * j,k,n exactly as there so the expression can be checked against the source line for line:
 *
 *   a  = MBPcpgas                              molar mass of the combustion gas
 *   b  = Patm·V/(Ru·Tamb)                      moles of air already in the compartment
 *   cc = −(deltaHBP/MBP)·(1−A_H)               combustion energy left after parachute absorption
 *   d  = cvair·Patm·V·Mair/(Ru·Tamb)           heat capacity of that air
 *   f  = cvBPcp                                specific heat of the combustion products
 *   g  = Tamb ,  h = Patm
 *   j  = π/4·Dr²                               bore area (ft²)
 *   k  = Fmix = (Fshear + Ffrict)·(1+safety)   force the powder must generate (poundals)
 *   n  = Ru/V
 *
 * Non-positive geometry returns a zeroed result rather than NaN, matching lib/charge.ts.
 */
export function fetterCharge(args: FetterArgs): FetterResult {
  const areaIn2 = (Math.PI / 4) * args.diameterIn * args.diameterIn;
  const volumeIn3 = areaIn2 * args.lengthIn;
  const empty: FetterResult = {
    mass: 0,
    volumeIn3: Math.max(0, volumeIn3),
    areaIn2: Math.max(0, areaIn2),
    pressurePsi: 0,
    forceLbf: 0,
    shearLbf: 0,
    absorption: absorptionHigh(args.packing),
    traditionalMass: 0,
    ratio: 0,
  };
  if (!(args.diameterIn > 0) || !(args.lengthIn > 0)) return empty;

  const safety = Math.max(0, args.safety);
  const friction = Math.max(0, args.frictionLbf);
  const pins = Math.max(0, Math.round(args.pinCount));

  // Native-unit geometry (feet) and the two forces, in poundals (lb·ft/s²).
  const V = volumeIn3 / 1728; // ft³
  const Dr = args.diameterIn / 12; // ft
  const Fshear = shearForceLbf(args.pinForceLbf, pins) * GC; // poundals
  const Ffrict = friction * GC;

  const AH = absorptionHigh(args.packing);

  const a = FETTER.MBPcpgas;
  const b = (FETTER.Patm * V) / (FETTER.Ru * FETTER.Tamb);
  const cc = -(FETTER.deltaHBP / FETTER.MBP) * (1 - AH);
  const d = (FETTER.cvair * FETTER.Patm * V * FETTER.Mair) / (FETTER.Ru * FETTER.Tamb);
  const f = FETTER.cvBPcp;
  const g = FETTER.Tamb;
  const h = FETTER.Patm;
  const j = (Math.PI / 4) * Dr * Dr;
  const k = (Fshear + Ffrict) * (1 + safety); // Fmix, poundals
  const n = FETTER.Ru / V;

  // Discriminant of the quadratic (grouped as in the source). Guard against a tiny negative
  // from floating-point cancellation so Math.sqrt can't return NaN.
  const inner =
    ((a * a * b * b * f * f - 2 * a * b * d * f + d * d) * g * g +
      (2 * a * a * b * b * cc * f - 2 * a * b * cc * d) * g +
      a * a * b * b * cc * cc) *
      j * j * n * n +
    (((2 * a * d * f - 2 * a * a * b * f * f) * g + (4 * a * cc * d - 2 * a * a * b * cc * f)) *
      j *
      k +
      ((2 * a * d * f - 2 * a * a * b * f * f) * g + (4 * a * cc * d - 2 * a * a * b * cc * f)) *
        h *
        j *
        j) *
      n +
    a * a * f * f * k * k +
    2 * a * a * f * f * h * j * k +
    a * a * f * f * h * h * j * j;

  const disc = Math.sqrt(Math.max(0, inner));
  const numerator = disc + (a * f * k + a * f * h * j - ((a * b * f + d) * g + a * b * cc) * j * n);
  const denominator = 2 * j * n * (f * g + cc);
  const massLbm = denominator !== 0 ? numerator / denominator : 0;
  const mass = massLbm > 0 ? massLbm * LBM_TO_G : 0;

  const forceNative = k; // Fmix, poundals
  const forceLbf = forceNative / GC;
  const pressureNative = j > 0 ? forceNative / j : 0; // Pmix, lb/(ft·s²)
  const pressurePsi = pressureNative / PSI_TO_NATIVE;

  // The traditional ideal-gas charge for the SAME pressure and volume: identical target,
  // no parachute-absorption term. The ratio is what the model is fundamentally about.
  const traditionalMass = blackPowderMass(pressurePsi, volumeIn3);

  return {
    mass,
    volumeIn3,
    areaIn2,
    pressurePsi,
    forceLbf,
    shearLbf: shearForceLbf(args.pinForceLbf, pins),
    absorption: AH,
    traditionalMass,
    ratio: traditionalMass > 0 ? mass / traditionalMass : 0,
  };
}

/**
 * Nosecone ejection velocity, ft/s — the model's energetic-deployment check (paper §16). The
 * safety factor exists partly to keep this in a healthy band (Fetter: ~20–50 ft/s is fine; if
 * it is too low, raise the safety factor). It does not affect the powder mass, so it is a
 * diagnostic only. Kept here so the model is complete and validated against the spreadsheet.
 */
export function ejectionVelocity(a: {
  forceLbf: number;
  frictionLbf: number;
  shoulderIn: number;
  noseMassLb: number;
  rocketMassLb: number;
}): number {
  const mnc = a.noseMassLb;
  if (!(mnc > 0) || !(a.rocketMassLb > mnc) || !(a.shoulderIn > 0)) return 0;
  const Fmix = a.forceLbf * GC; // poundals
  const Ffrict = Math.max(0, a.frictionLbf) * GC;
  const dsholder = a.shoulderIn / 12; // ft
  const knc = (a.rocketMassLb - mnc) / mnc;
  const net = 2 * (Fmix - Ffrict) * dsholder;
  if (net <= 0) return 0;
  return (
    (Math.sqrt(knc / (knc + 1)) + Math.sqrt(1 / (knc * (knc + 1)))) * Math.sqrt(net / mnc)
  );
}
