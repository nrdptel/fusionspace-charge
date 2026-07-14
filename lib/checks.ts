/**
 * Sanity hints for the calculator inputs.
 *
 * These never change the math. They only nudge the flyer to re-check an input when a
 * value lands well outside what hobby airframes normally use — most importantly a unit
 * mix-up (millimetres typed while the field is in inches, or the outside diameter entered
 * as the bore). On a tool that drives a pyrotechnic event, catching that at the screen is
 * worth a quiet line of text. Thresholds are deliberately wide so a real, unusual build
 * doesn't get nagged; the message always says "check", never "wrong".
 */

import type { State, WellInput } from "./state";
import { toInches, toPsi } from "./units";
import { fmt } from "./format";

export interface Caution {
  id: string;
  message: string;
}

/** A charge far larger than typical hobby ejection charges (a few grams), in grams. */
export const LARGE_CHARGE_G = 20;

/**
 * The "this charge looks too big — re-check the inputs" caution, shared by every mode so the
 * wording can't drift between the ideal-gas wells and the Fetter card. `screws` swaps the
 * ideal-gas input list ("diameter, length, and units") for the Fetter one, which also has
 * the shear-screw geometry among its inputs. Returns null below the threshold.
 */
export function largeChargeCaution(massG: number, opts?: { screws?: boolean }): Caution | null {
  if (massG <= LARGE_CHARGE_G) return null;
  const fields = opts?.screws ? "diameter, length, screws, and units" : "diameter, length, and units";
  return {
    id: "mass-big",
    message: `${fmt(massG, 1)} g is a large ejection charge — double-check the ${fields}.`,
  };
}

export function wellCautions(
  state: Pick<State, "mode" | "lengthUnit" | "pressureUnit">,
  well: WellInput,
  computed: { mass: number },
): Caution[] {
  const out: Caution[] = [];

  // Diameter that reads like a unit/OD mix-up. HPR airframes run roughly 1.5–8" ID; well
  // past that in either direction usually means mm entered as inches, inches as mm, or the
  // outside diameter in place of the bore.
  if (well.diameter > 0) {
    const diaIn = toInches(well.diameter, state.lengthUnit);
    if (state.lengthUnit === "in" && diaIn >= 12) {
      out.push({
        id: "dia-big",
        message: `An inner diameter of ${fmt(well.diameter, 2)} in is very large for an airframe — did you mean mm, or enter the outside diameter?`,
      });
    } else if (state.lengthUnit === "mm" && well.diameter <= 20) {
      out.push({
        id: "dia-small",
        message: `An inner diameter of ${fmt(well.diameter, 2)} mm is very small for an airframe — did you mean inches?`,
      });
    }
  }

  // Target pressure outside the usual ~8–15 psi band. Pressure mode only, and measured on
  // the entered target so the safety margin doesn't trip it.
  if (state.mode === "pressure" && well.pressure > 0) {
    const tPsi = toPsi(well.pressure, state.pressureUnit);
    if (tPsi < 6) {
      out.push({
        id: "p-low",
        message: `A target of ${fmt(well.pressure, 1)} ${state.pressureUnit} is below the usual ~8–15 psi — too little pressure can fail to separate.`,
      });
    } else if (tPsi > 20) {
      out.push({
        id: "p-high",
        message: `A target of ${fmt(well.pressure, 1)} ${state.pressureUnit} is above the usual ~8–15 psi — confirm that's intended.`,
      });
    }
  }

  // A charge much larger than typical is a strong sign of an input error upstream.
  const big = largeChargeCaution(computed.mass);
  if (big) out.push(big);

  return out;
}
