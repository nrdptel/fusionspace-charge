/** Calculator state, its defaults, and the URL serialization that makes a configured
 *  calculation a shareable link — the same convention the Motor Finder uses. */

import type { LengthUnit, PressureUnit, ForceUnit } from "./units";
import { type ScrewSize, isScrewSize } from "./fetter";

export type Mode = "pressure" | "force" | "fetter";
export type Deploy = "single" | "dual";

/**
 * Inputs for the Fetter deployment model (mode "fetter"). Unlike the two ideal-gas modes, this
 * sizes a single parachute compartment and derives the shear force from the screw geometry
 * itself, so it carries a screw size, a parachute packing factor, and the model's own safety
 * factor. See lib/fetter.ts for the math and the attribution.
 */
export interface FetterInput {
  /** Body-tube inner diameter, in the active length unit. */
  diameter: number;
  /** Parachute compartment inner length, in the active length unit. */
  length: number;
  /** Shear screw size (drives the shear force via the nylon shear strength). */
  screw: ScrewSize;
  /** Number of shear screws across the joint (0 = friction-only deployment). */
  pinCount: number;
  /** Nosecone / coupler friction beyond the pins, in the active force unit. */
  friction: number;
  /** Parachute packing factor: fraction of the compartment the chute + protector fill (0–1). */
  packing: number;
  /** Fetter's safety factor as a fraction (0.4 = 40%) — the model's own margin. */
  safety: number;
  /** Deployment altitude, ft — drives the envelope guard only; never the math. */
  deployAlt: number;
}

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
  /** Launch field elevation in feet — drives an altitude advisory only; never the math. */
  elevation: number;
  drogue: WellInput;
  main: WellInput;
  /** The Fetter-model compartment (mode "fetter"). In single deploy this is the one
   *  compartment; in dual deploy it's the drogue. Kept separate from the ideal-gas wells so
   *  switching modes never disturbs the other's inputs. */
  fetter: FetterInput;
  /** The Fetter main compartment, used only in dual deploy — the drogue is `fetter`. */
  fetterMain: FetterInput;
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
  elevation: 0,
  drogue: { diameter: 4, length: 12, pressure: 12, pinCount: 2, pinForce: 32, friction: 0 },
  main: { diameter: 4, length: 24, pressure: 12, pinCount: 4, pinForce: 32, friction: 0 },
  // Fetter's own 3"×15" test-rocket geometry: a full chute (packing 1), two 2-56 screws, and
  // the 40% safety factor his testing settled on. Sizes to ~2 g, versus ~0.7 g the traditional
  // model would give — the delta the model exists to correct.
  fetter: {
    diameter: 3,
    length: 15,
    screw: "2-56",
    pinCount: 2,
    friction: 0,
    packing: 1,
    safety: 0.4,
    deployAlt: 0,
  },
  // The main compartment (dual deploy only): same tube, a longer bay for the larger main
  // chute. Deploys low, so its deployment altitude stays at sea level by default.
  fetterMain: {
    diameter: 3,
    length: 24,
    screw: "2-56",
    pinCount: 2,
    friction: 0,
    packing: 1,
    safety: 0.4,
    deployAlt: 0,
  },
};

// --- Normalization -----------------------------------------------------------------

/**
 * Rebuild a fully valid State from arbitrary/untrusted input — a saved rocket restored from
 * localStorage, an imported backup, or a tampered store. Unlike a shallow `{...DEFAULT, ...raw}`
 * merge, this guarantees every field (and both nested wells) has the right type and is clamped
 * the same way `decodeState` clamps a shared link, so a corrupt `drogue: null` (or a missing
 * well, or a string where a number belongs) can't reach the compute path and crash the render.
 */
export function normalizeState(raw: unknown): State {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number): number => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  const well = (v: unknown, d: WellInput): WellInput => {
    const w = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return {
      diameter: num(w.diameter, d.diameter),
      length: num(w.length, d.length),
      pressure: num(w.pressure, d.pressure),
      pinCount: Math.max(0, Math.round(num(w.pinCount, d.pinCount))),
      pinForce: num(w.pinForce, d.pinForce),
      friction: num(w.friction, d.friction),
    };
  };
  const fetter = (v: unknown, d: FetterInput): FetterInput => {
    const w = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return {
      diameter: num(w.diameter, d.diameter),
      length: num(w.length, d.length),
      screw: isScrewSize(w.screw) ? w.screw : d.screw,
      pinCount: Math.max(0, Math.round(num(w.pinCount, d.pinCount))),
      friction: num(w.friction, d.friction),
      // Packing factor is a fraction; clamp to [0,1] so a tampered value can't drive the
      // absorption term out of range.
      packing: Math.min(1, Math.max(0, num(w.packing, d.packing))),
      // Safety factor is the model's own margin; floor at 0 so it can never scale the charge
      // below the bare shear+friction requirement.
      safety: Math.max(0, num(w.safety, d.safety)),
      deployAlt: Math.max(0, num(w.deployAlt, d.deployAlt)),
    };
  };
  return {
    mode:
      o.mode === "pressure" || o.mode === "force" || o.mode === "fetter"
        ? o.mode
        : DEFAULT_STATE.mode,
    deploy: o.deploy === "single" || o.deploy === "dual" ? o.deploy : DEFAULT_STATE.deploy,
    lengthUnit: o.lengthUnit === "mm" ? "mm" : "in",
    pressureUnit:
      o.pressureUnit === "kPa" ? "kPa" : o.pressureUnit === "bar" ? "bar" : "psi",
    forceUnit: o.forceUnit === "N" ? "N" : "lbf",
    margin: Math.max(1, num(o.margin, DEFAULT_STATE.margin)),
    redundant: o.redundant === true,
    backupPct: Math.max(0, num(o.backupPct, DEFAULT_STATE.backupPct)),
    elevation: Math.max(0, num(o.elevation, DEFAULT_STATE.elevation)),
    drogue: well(o.drogue, DEFAULT_STATE.drogue),
    main: well(o.main, DEFAULT_STATE.main),
    fetter: fetter(o.fetter, DEFAULT_STATE.fetter),
    fetterMain: fetter(o.fetterMain, DEFAULT_STATE.fetterMain),
  };
}

// --- URL serialization -------------------------------------------------------------

const MODE_TO: Record<Mode, string> = { pressure: "p", force: "f", fetter: "x" };
const MODE_FROM: Record<string, Mode> = { p: "pressure", f: "force", x: "fetter" };
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
  p.set("el", String(s.elevation));
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
  // The Fetter compartments are encoded only in their own mode — like the main well in dual
  // deploy — so pressure/force links stay exactly as they were and existing shared links don't
  // change. Keys are "x"-prefixed to avoid colliding with the well params; the drogue keeps the
  // original bare `x*` keys (so single-compartment links from before dual are unchanged) and the
  // main uses `xm*`, encoded only in dual deploy.
  const fetterEnc = (prefix: string, f: FetterInput) => {
    p.set(`${prefix}dia`, String(f.diameter));
    p.set(`${prefix}l`, String(f.length));
    p.set(`${prefix}sc`, f.screw);
    p.set(`${prefix}n`, String(f.pinCount));
    p.set(`${prefix}fr`, String(f.friction));
    p.set(`${prefix}pk`, String(f.packing));
    p.set(`${prefix}sf`, String(f.safety));
    p.set(`${prefix}alt`, String(f.deployAlt));
  };
  if (s.mode === "fetter") {
    fetterEnc("x", s.fetter);
    if (s.deploy === "dual") fetterEnc("xm", s.fetterMain);
  }
  return p.toString();
}

export function decodeState(query: string): State {
  const p = new URLSearchParams(query);
  // Return a fresh copy, never the shared DEFAULT_STATE singleton: a bare visit would otherwise
  // seed React state with the module-level default (and its shared nested wells), so any future
  // in-place edit of a nested field would corrupt the process-wide default. Every non-empty
  // decode already builds fresh objects.
  if ([...p.keys()].length === 0) return normalizeState(DEFAULT_STATE);

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
    // Pins are discrete: coerce to a non-negative integer so a hand-edited or shared
    // link (e.g. `dn=2.7`) can't size the charge for a fractional pin count while the
    // exported report rounds it to a different whole number.
    pinCount: Math.max(0, Math.round(numOr(`${prefix}n`, d.pinCount))),
    pinForce: numOr(`${prefix}pf`, d.pinForce),
    friction: numOr(`${prefix}fr`, d.friction),
  });

  const lu = (p.get("lu") as LengthUnit) || DEFAULT_STATE.lengthUnit;
  const pu = (p.get("pu") as PressureUnit) || DEFAULT_STATE.pressureUnit;
  const fu = (p.get("fu") as ForceUnit) || DEFAULT_STATE.forceUnit;

  // Drogue keeps the bare `x*` keys; main uses `xm*`. Same clamps as normalizeState: packing
  // to [0,1], safety/deployAlt floored at 0, pins to a non-negative integer — so a hand-edited
  // link can't push the absorption out of range or size below the bare requirement.
  const fetterDec = (prefix: string, d: FetterInput): FetterInput => {
    const sc = p.get(`${prefix}sc`);
    return {
      diameter: numOr(`${prefix}dia`, d.diameter),
      length: numOr(`${prefix}l`, d.length),
      screw: isScrewSize(sc) ? sc : d.screw,
      pinCount: Math.max(0, Math.round(numOr(`${prefix}n`, d.pinCount))),
      friction: numOr(`${prefix}fr`, d.friction),
      packing: Math.min(1, Math.max(0, numOr(`${prefix}pk`, d.packing))),
      safety: Math.max(0, numOr(`${prefix}sf`, d.safety)),
      deployAlt: Math.max(0, numOr(`${prefix}alt`, d.deployAlt)),
    };
  };
  const fetter = fetterDec("x", DEFAULT_STATE.fetter);
  const fetterMain = fetterDec("xm", DEFAULT_STATE.fetterMain);

  return {
    mode: MODE_FROM[p.get("mode") ?? ""] ?? DEFAULT_STATE.mode,
    deploy: DEPLOY_FROM[p.get("dep") ?? ""] ?? DEFAULT_STATE.deploy,
    lengthUnit: lu === "mm" ? "mm" : "in",
    pressureUnit: pu === "kPa" ? "kPa" : pu === "bar" ? "bar" : "psi",
    forceUnit: fu === "N" ? "N" : "lbf",
    // Floor the safety margin at 1: a value in (0,1) from a hand-edited or shared
    // link would otherwise under-size the charge.
    margin: Math.max(1, numOr("mg", DEFAULT_STATE.margin)),
    redundant: p.get("rdn") === "1",
    // Floor the backup uplift at 0 so a hand-edited link can't shrink the backup
    // below the primary; the UI default and convention is +20%.
    backupPct: Math.max(0, numOr("bpct", DEFAULT_STATE.backupPct)),
    elevation: Math.max(0, numOr("el", DEFAULT_STATE.elevation)),
    drogue: well("d", DEFAULT_STATE.drogue),
    main: well("m", DEFAULT_STATE.main),
    fetter,
    fetterMain,
  };
}
