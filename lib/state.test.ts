import { describe, it, expect } from "vitest";
import { DEFAULT_STATE, decodeState, encodeState, type State } from "./state";

describe("URL state", () => {
  it("returns defaults for an empty query", () => {
    expect(decodeState("")).toEqual(DEFAULT_STATE);
  });

  it("round-trips the default state", () => {
    expect(decodeState(encodeState(DEFAULT_STATE))).toEqual(DEFAULT_STATE);
  });

  it("round-trips a customized state with different per-well diameters", () => {
    const custom: State = {
      ...DEFAULT_STATE,
      mode: "force",
      deploy: "dual",
      lengthUnit: "mm",
      pressureUnit: "kPa",
      forceUnit: "N",
      margin: 2,
      drogue: { diameter: 98, length: 300, pressure: 100, pinCount: 3, pinForce: 142, friction: 20 },
      main: { diameter: 152, length: 600, pressure: 120, pinCount: 4, pinForce: 220, friction: 30 },
    };
    expect(decodeState(encodeState(custom))).toEqual(custom);
  });

  it("falls back to defaults for unknown enum values", () => {
    const s = decodeState("mode=zzz&dep=qqq&lu=furlong");
    expect(s.mode).toBe(DEFAULT_STATE.mode);
    expect(s.deploy).toBe(DEFAULT_STATE.deploy);
    expect(s.lengthUnit).toBe(DEFAULT_STATE.lengthUnit);
  });

  it("reads a per-well diameter and leaves the other well at its default", () => {
    const s = decodeState("ddia=6");
    expect(s.drogue.diameter).toBe(6);
    expect(s.main.diameter).toBe(DEFAULT_STATE.main.diameter);
  });

  it("falls back to the legacy shared diameter param for both wells", () => {
    const s = decodeState("dia=5.5");
    expect(s.drogue.diameter).toBe(5.5);
    expect(s.main.diameter).toBe(5.5);
  });

  it("floors a sub-1 safety margin from a hand-edited link", () => {
    // A margin in (0,1) would scale required force down and under-size the charge.
    expect(decodeState("mode=f&mg=0.5").margin).toBe(1);
    expect(decodeState("mode=f&mg=-3").margin).toBe(1);
    expect(decodeState("mode=f&mg=2").margin).toBe(2);
  });

  it("round-trips redundant altimeter settings", () => {
    const custom: State = { ...DEFAULT_STATE, redundant: true, backupPct: 30 };
    expect(decodeState(encodeState(custom))).toEqual(custom);
  });

  it("defaults to a single altimeter when the param is absent", () => {
    expect(decodeState("ddia=6").redundant).toBe(false);
    expect(decodeState("ddia=6").backupPct).toBe(DEFAULT_STATE.backupPct);
  });

  it("floors a negative backup uplift so the backup can't drop below the primary", () => {
    expect(decodeState("rdn=1&bpct=-10").backupPct).toBe(0);
    expect(decodeState("rdn=1&bpct=25").backupPct).toBe(25);
  });
});
