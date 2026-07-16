/**
 * Unit conversions. The calculator works internally in canonical units — inches, psi,
 * lbf, in³, grams — and converts only at the input/display edges. Flyers think in mixed
 * units, so the UI lets each quantity be entered and shown in whichever is natural.
 */

export const MM_PER_IN = 25.4;
export const KPA_PER_PSI = 6.894757;
export const BAR_PER_PSI = KPA_PER_PSI / 100; // 1 bar = 100 kPa, so bar-per-psi = kPa-per-psi ÷ 100
export const N_PER_LBF = 4.4482216;
export const CC_PER_IN3 = 16.387064;
export const GR_PER_G = 15.432358; // grains per gram

export type LengthUnit = "in" | "mm";
export type PressureUnit = "psi" | "kPa" | "bar";
export type ForceUnit = "lbf" | "N";

// Length — canonical: inches
export const toInches = (value: number, unit: LengthUnit): number =>
  unit === "mm" ? value / MM_PER_IN : value;
export const fromInches = (inches: number, unit: LengthUnit): number =>
  unit === "mm" ? inches * MM_PER_IN : inches;

// Pressure — canonical: psi
export const toPsi = (value: number, unit: PressureUnit): number =>
  unit === "kPa" ? value / KPA_PER_PSI : unit === "bar" ? value / BAR_PER_PSI : value;
export const fromPsi = (psi: number, unit: PressureUnit): number =>
  unit === "kPa" ? psi * KPA_PER_PSI : unit === "bar" ? psi * BAR_PER_PSI : psi;

/** Sensible display precision per pressure unit. A typical ejection target is ~8–15 psi, i.e.
 *  ~55–105 kPa but only ~0.55–1.0 bar — so bar needs an extra decimal (and a finer input step)
 *  to stay legible where psi and kPa read fine at one. */
export const pressureDecimals = (unit: PressureUnit): number => (unit === "bar" ? 2 : 1);
export const pressureStep = (unit: PressureUnit): number =>
  unit === "kPa" ? 5 : unit === "bar" ? 0.05 : 1;

// Force — canonical: lbf
export const toLbf = (value: number, unit: ForceUnit): number =>
  unit === "N" ? value / N_PER_LBF : value;
export const fromLbf = (lbf: number, unit: ForceUnit): number =>
  unit === "N" ? lbf * N_PER_LBF : lbf;

// Volume — canonical: in³
export const in3ToCc = (in3: number): number => in3 * CC_PER_IN3;

// Mass — canonical: grams. Black powder is always reported in grams in the UI; this
// grams↔grains conversion (many powder scales and dippers read in grains) backs the
// unit round-trip tests and is here for any future readout.
export const gToGrains = (g: number): number => g * GR_PER_G;
export const grainsToG = (grains: number): number => grains / GR_PER_G;
