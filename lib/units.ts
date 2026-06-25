/**
 * Unit conversions. The calculator works internally in canonical units — inches, psi,
 * lbf, in³, grams — and converts only at the input/display edges. Flyers think in mixed
 * units, so the UI lets each quantity be entered and shown in whichever is natural.
 */

export const MM_PER_IN = 25.4;
export const KPA_PER_PSI = 6.894757;
export const N_PER_LBF = 4.4482216;
export const CC_PER_IN3 = 16.387064;

export type LengthUnit = "in" | "mm";
export type PressureUnit = "psi" | "kPa";
export type ForceUnit = "lbf" | "N";

// Length — canonical: inches
export const toInches = (value: number, unit: LengthUnit): number =>
  unit === "mm" ? value / MM_PER_IN : value;
export const fromInches = (inches: number, unit: LengthUnit): number =>
  unit === "mm" ? inches * MM_PER_IN : inches;

// Pressure — canonical: psi
export const toPsi = (value: number, unit: PressureUnit): number =>
  unit === "kPa" ? value / KPA_PER_PSI : value;
export const fromPsi = (psi: number, unit: PressureUnit): number =>
  unit === "kPa" ? psi * KPA_PER_PSI : psi;

// Force — canonical: lbf
export const toLbf = (value: number, unit: ForceUnit): number =>
  unit === "N" ? value / N_PER_LBF : value;
export const fromLbf = (lbf: number, unit: ForceUnit): number =>
  unit === "N" ? lbf * N_PER_LBF : lbf;

// Volume — canonical: in³
export const in3ToCc = (in3: number): number => in3 * CC_PER_IN3;
