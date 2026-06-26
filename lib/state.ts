/** Calculator state, its defaults, and the URL serialization that makes a configured
 *  calculation a shareable link — the same convention the Motor Finder uses. */

import type { LengthUnit, PressureUnit, ForceUnit } from "./units";

export type Mode = "pressure" | "force";
export type Deploy = "single" | "dual";

export interface WellInput {
  /** Tube inner diameter for this well, in the active length unit. */
  diameter: number;
  /** Pressurized section length, in the active length unit. */
  length: number;
  /** Target pressure (pressure mode), in the active pressure unit. */
  pressure: number;
  /** Shear pins holding the joint (force mode). */
  pinCount: number;
  /** Per-pin shear force (force mode), in the active force unit. */
  pinForce: number;
  /** Extra friction/holding force beyond the pins (force mode), in the active force unit. */
  friction: number;
}

export interface State {
  mode: Mode;
  deploy: Deploy;
  lengthUnit: LengthUnit;
  pressureUnit: PressureUnit;
  forceUnit: ForceUnit;
  /** Safety margin applied to required force in force mode (e.g. 1.5 = +50%). */
  margin: number;
  /** Whether the airframe carries a redundant (backup) altimeter firing its own charge. */
  redundant: boolean;
  /** How much larger the backup charge is than the primary, as a percent (e.g. 20 = +20%). */
  backupPct: number;
  drogue: WellInput;
  main: WellInput;
}

/** Common nylon shear screws. Values are widely-cited single-shear approximations and
 *  vary by source and supplier — they are starting points to edit, not authority. */
export const SHEAR_PIN_PRESETS: { label: string; lbf: number }[] = [
  { label: "2-56 nylon", lbf: 32 },
  { label: "4-40 nylon", lbf: 50 },
  { label: "6-32 nylon", lbf: 65 },
];

export const DEFAULT_STATE: State = {
  mode: "force",
  deploy: "dual",
  lengthUnit: "in",
  pressureUnit: "psi",
  forceUnit: "lbf",
  margin: 1.5,
  redundant: false,
  backupPct: 20,
  drogue: { diameter: 4, length: 12, pressure: 12, pinCount: 2, pinForce: 32, friction: 0 },
  main: { diameter: 4, length: 24, pressure: 12, pinCount: 4, pinForce: 32, friction: 0 },
};

// --- URL serialization -------------------------------------------------------------

const MODE_TO: Record<Mode, string> = { pressure: "p", force: "f" };
const MODE_FROM: Record<string, Mode> = { p: "pressure", f: "force" };
const DEPLOY_TO: Record<Deploy, string> = { single: "s", dual: "d" };
const DEPLOY_FROM: Record<string, Deploy> = { s: "single", d: "dual" };

export function encodeState(s: State): string {
  const p = new URLSearchParams();
  p.set("mode", MODE_TO[s.mode]);
  p.set("dep", DEPLOY_TO[s.deploy]);
  p.set("lu", s.lengthUnit);
  p.set("pu", s.pressureUnit);
  p.set("fu", s.forceUnit);
  p.set("mg", String(s.margin));
  p.set("rdn", s.redundant ? "1" : "0");
  p.set("bpct", String(s.backupPct));
  const well = (prefix: string, w: WellInput) => {
    p.set(`${prefix}dia`, String(w.diameter));
    p.set(`${prefix}l`, String(w.length));
    p.set(`${prefix}p`, String(w.pressure));
    p.set(`${prefix}n`, String(w.pinCount));
    p.set(`${prefix}pf`, String(w.pinForce));
    p.set(`${prefix}fr`, String(w.friction));
  };
  well("d", s.drogue);
  if (s.deploy === "dual") well("m", s.main);
  return p.toString();
}

export function decodeState(query: string): State {
  const p = new URLSearchParams(query);
  if ([...p.keys()].length === 0) return DEFAULT_STATE;

  const numOr = (key: string, fallback: number) => {
    const v = p.get(key);
    if (v == null) return fallback;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const well = (prefix: string, d: WellInput): WellInput => ({
    // Per-well diameter, falling back to the legacy shared `dia` param so older
    // shared links still resolve to a diameter.
    diameter: numOr(`${prefix}dia`, numOr("dia", d.diameter)),
    length: numOr(`${prefix}l`, d.length),
    pressure: numOr(`${prefix}p`, d.pressure),
    pinCount: numOr(`${prefix}n`, d.pinCount),
    pinForce: numOr(`${prefix}pf`, d.pinForce),
    friction: numOr(`${prefix}fr`, d.friction),
  });

  const lu = (p.get("lu") as LengthUnit) || DEFAULT_STATE.lengthUnit;
  const pu = (p.get("pu") as PressureUnit) || DEFAULT_STATE.pressureUnit;
  const fu = (p.get("fu") as ForceUnit) || DEFAULT_STATE.forceUnit;

  return {
    mode: MODE_FROM[p.get("mode") ?? ""] ?? DEFAULT_STATE.mode,
    deploy: DEPLOY_FROM[p.get("dep") ?? ""] ?? DEFAULT_STATE.deploy,
    lengthUnit: lu === "mm" ? "mm" : "in",
    pressureUnit: pu === "kPa" ? "kPa" : "psi",
    forceUnit: fu === "N" ? "N" : "lbf",
    // Floor the safety margin at 1: a value in (0,1) from a hand-edited or shared
    // link would otherwise under-size the charge.
    margin: Math.max(1, numOr("mg", DEFAULT_STATE.margin)),
    redundant: p.get("rdn") === "1",
    // Floor the backup uplift at 0 so a hand-edited link can't shrink the backup
    // below the primary; the UI default and convention is +20%.
    backupPct: Math.max(0, numOr("bpct", DEFAULT_STATE.backupPct)),
    drogue: well("d", DEFAULT_STATE.drogue),
    main: well("m", DEFAULT_STATE.main),
  };
}
