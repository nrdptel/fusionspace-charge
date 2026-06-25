/** Calculator state, its defaults, and the URL serialization that makes a configured
 *  calculation a shareable link — the same convention the Motor Finder uses. */

import type { LengthUnit, PressureUnit, ForceUnit } from "./units";

export type Mode = "pressure" | "force";
export type Deploy = "single" | "dual";

export interface WellInput {
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
  /** Airframe inner diameter, shared across wells, in the active length unit. */
  diameter: number;
  /** Safety margin applied to required force in force mode (e.g. 1.5 = +50%). */
  margin: number;
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
  mode: "pressure",
  deploy: "dual",
  lengthUnit: "in",
  pressureUnit: "psi",
  forceUnit: "lbf",
  diameter: 4,
  margin: 1.5,
  drogue: { length: 12, pressure: 12, pinCount: 2, pinForce: 32, friction: 0 },
  main: { length: 24, pressure: 12, pinCount: 4, pinForce: 32, friction: 0 },
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
  p.set("dia", String(s.diameter));
  p.set("mg", String(s.margin));
  const well = (prefix: string, w: WellInput) => {
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
    diameter: numOr("dia", DEFAULT_STATE.diameter),
    margin: numOr("mg", DEFAULT_STATE.margin),
    drogue: well("d", DEFAULT_STATE.drogue),
    main: well("m", DEFAULT_STATE.main),
  };
}
