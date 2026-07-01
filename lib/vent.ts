/**
 * Altimeter static vent-port ("sampling port") sizing.
 *
 * A barometric altimeter reads the air through small ports drilled into its electronics
 * bay. Size them right and the bay tracks outside pressure cleanly; too small and it
 * lags — a late or missed apogee event; too large and gusts and the rocket's own
 * slipstream inject noise that can trip a deployment at the wrong moment.
 *
 * The standard high-power rule of thumb is one 1/4" port per 100 in³ of bay volume,
 * split across several evenly-spaced ports of equal size. Everything here is the area
 * form of that single rule, so the math can be audited on its own — the same approach
 * the charge calculation takes. All functions are pure and take canonical inches.
 */

import { boreArea, cylinderVolume } from "./charge";

/** Reference port diameter the rule of thumb is stated in, inches. */
export const VENT_REF_DIAMETER_IN = 0.25;

/** Bay volume that one reference port serves, in³. */
export const VENT_REF_VOLUME_IN3 = 100;

/** Required vent area per in³ of bay volume — the area of one 1/4" port ÷ 100 in³. */
export const VENT_AREA_PER_IN3 = boreArea(VENT_REF_DIAMETER_IN) / VENT_REF_VOLUME_IN3;

export interface VentResult {
  /** Bay (sampled compartment) volume, in³. */
  bayVolumeIn3: number;
  /** Total vent area the rule calls for, in². */
  totalAreaIn2: number;
  /** Area of each of the N equal ports, in². */
  perPortAreaIn2: number;
  /** Diameter to drill each port, inches. */
  perPortDiameterIn: number;
}

/**
 * Size the static ports for an altimeter bay. The total vent area follows the
 * 1/4"-per-100-in³ rule; spreading it across `ports` equal holes gives each port's
 * diameter, d = √(4·A/π).
 */
export function sizeVentPorts(args: {
  diameterIn: number;
  lengthIn: number;
  ports: number;
}): VentResult {
  const ports = Math.max(1, Math.floor(args.ports));
  const bayVolumeIn3 = cylinderVolume(args.diameterIn, args.lengthIn);
  const totalAreaIn2 = bayVolumeIn3 * VENT_AREA_PER_IN3;
  const perPortAreaIn2 = totalAreaIn2 / ports;
  const perPortDiameterIn =
    perPortAreaIn2 > 0 ? Math.sqrt((4 * perPortAreaIn2) / Math.PI) : 0;
  return { bayVolumeIn3, totalAreaIn2, perPortAreaIn2, perPortDiameterIn };
}

export interface DrillBit {
  label: string;
  in: number;
}

/** Common fractional-inch bits in the range static ports actually fall in. */
export const COMMON_PORT_BITS: DrillBit[] = [
  { label: '1/16"', in: 1 / 16 },
  { label: '5/64"', in: 5 / 64 },
  { label: '3/32"', in: 3 / 32 },
  { label: '7/64"', in: 7 / 64 },
  { label: '1/8"', in: 1 / 8 },
  { label: '9/64"', in: 9 / 64 },
  { label: '5/32"', in: 5 / 32 },
  { label: '3/16"', in: 3 / 16 },
  { label: '7/32"', in: 7 / 32 },
  { label: '1/4"', in: 1 / 4 },
];

/**
 * The common bit nearest a computed port diameter, for a practical drilling suggestion.
 * Returns null when the required diameter is larger than the biggest listed bit (1/4"): a
 * bay that needs a bigger single port than that should be split across more ports, and
 * suggesting "1/4"" for a port that needs to be twice that would badly under-vent — the
 * opposite of the "err small" guidance. The caller shows an add-ports hint instead.
 */
export function nearestPortBit(diameterIn: number): DrillBit | null {
  if (!(diameterIn > 0)) return null;
  const largest = COMMON_PORT_BITS[COMMON_PORT_BITS.length - 1];
  if (diameterIn > largest.in) return null;
  return COMMON_PORT_BITS.reduce((best, b) =>
    Math.abs(b.in - diameterIn) < Math.abs(best.in - diameterIn) ? b : best,
  );
}
