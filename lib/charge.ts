/**
 * The black-powder ejection-charge calculation.
 *
 * This is the standard ideal-gas method used across high-power rocketry. Given a
 * pressurized volume and a target pressure, it returns the theoretical mass of black
 * powder whose combustion gas would reach that pressure in that volume:
 *
 *     m = (P · V) / (R · T)
 *
 * The result is a theoretical starting point. It assumes complete, instantaneous,
 * adiabatic combustion with no leakage past bulkheads or out the vent/shear path — real
 * wells lose heat to the walls and vent gas, so the real requirement can differ. This is
 * exactly why every charge must be ground-tested and adjusted before it flies.
 *
 * All functions here are pure and take canonical units (inches, psi, lbf, in³, grams) so
 * the math can be audited on its own, independent of the UI's unit handling.
 */

/** Specific gas constant of black-powder combustion gas, ft·lbf/(lbm·°R). */
export const R_BP = 22.16;

/** Combustion (flame) temperature of black powder, °R (≈ 1837 K). */
export const T_BP = 3307;

/** Square inches per square foot — converts psi (lbf/in²) to lbf/ft² (psf). */
export const PSI_TO_PSF = 144;

/** Pounds-mass to grams. */
export const LBM_TO_G = 453.59237;

/** Cubic inches per cubic foot. */
export const IN3_PER_FT3 = 1728;

/** Cross-sectional bore area (in²) from inner diameter (in). */
export function boreArea(diameterIn: number): number {
  return (Math.PI / 4) * diameterIn * diameterIn;
}

/** Volume of a cylindrical section (in³) from inner diameter and length (in). */
export function cylinderVolume(diameterIn: number, lengthIn: number): number {
  return boreArea(diameterIn) * lengthIn;
}

/**
 * Pressure (psi) needed for a given separation force (lbf) acting over the bore area.
 * P = F / A.
 */
export function pressureFromForce(forceLbf: number, diameterIn: number): number {
  const area = boreArea(diameterIn);
  return area > 0 ? forceLbf / area : 0;
}

/**
 * Black-powder mass (grams) to reach a target pressure (psi) in a volume (in³),
 * by the ideal-gas method. m = (P · V) / (R · T), worked in consistent units.
 */
export function blackPowderMass(pressurePsi: number, volumeIn3: number): number {
  if (pressurePsi <= 0 || volumeIn3 <= 0) return 0;
  const pressurePsf = pressurePsi * PSI_TO_PSF; // lbf/ft²
  const volumeFt3 = volumeIn3 / IN3_PER_FT3; // ft³
  const massLbm = (pressurePsf * volumeFt3) / (R_BP * T_BP);
  return massLbm * LBM_TO_G;
}

export interface WellResult {
  /** Bore cross-section, in². */
  area: number;
  /** Pressurized volume, in³. */
  volume: number;
  /** Pressure the charge is sized to build, psi. */
  pressure: number;
  /** Black-powder mass, grams. */
  mass: number;
}

/** Size a charge well from a target pressure. */
export function sizeByPressure(args: {
  diameterIn: number;
  lengthIn: number;
  pressurePsi: number;
}): WellResult {
  const area = boreArea(args.diameterIn);
  const volume = cylinderVolume(args.diameterIn, args.lengthIn);
  return {
    area,
    volume,
    pressure: args.pressurePsi,
    mass: blackPowderMass(args.pressurePsi, volume),
  };
}

/**
 * Size a charge well from a required separation force (lbf). The force passed in is the
 * total the charge must overcome — shear pins, friction, and any safety margin already
 * folded in by the caller. The pressure needed follows from P = F / A.
 */
export function sizeByForce(args: {
  diameterIn: number;
  lengthIn: number;
  forceLbf: number;
}): WellResult {
  const area = boreArea(args.diameterIn);
  const volume = cylinderVolume(args.diameterIn, args.lengthIn);
  const pressure = pressureFromForce(args.forceLbf, args.diameterIn);
  return { area, volume, pressure, mass: blackPowderMass(pressure, volume) };
}
