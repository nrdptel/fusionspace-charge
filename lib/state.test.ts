import { describe, it, expect } from "vitest";
import { DEFAULT_STATE, decodeState, encodeState, type State } from "./state";

describe("URL state", () => {
  it("returns defaults for an empty query", () => {
    expect(decodeState("")).toEqual(DEFAULT_STATE);
  });

  it("round-trips the default state", () => {
    expect(decodeState(encodeState(DEFAULT_STATE))).toEqual(DEFAULT_STATE);
  });

  it("round-trips a customized state", () => {
    const custom: State = {
      ...DEFAULT_STATE,
      mode: "force",
      deploy: "dual",
      lengthUnit: "mm",
      pressureUnit: "kPa",
      forceUnit: "N",
      diameter: 98,
      margin: 2,
      drogue: { length: 300, pressure: 100, pinCount: 3, pinForce: 142, friction: 20 },
      main: { length: 600, pressure: 120, pinCount: 4, pinForce: 220, friction: 30 },
    };
    expect(decodeState(encodeState(custom))).toEqual(custom);
  });

  it("falls back to defaults for unknown enum values", () => {
    const s = decodeState("mode=zzz&dep=qqq&lu=furlong");
    expect(s.mode).toBe(DEFAULT_STATE.mode);
    expect(s.deploy).toBe(DEFAULT_STATE.deploy);
    expect(s.lengthUnit).toBe(DEFAULT_STATE.lengthUnit);
  });

  it("merges partial input over defaults", () => {
    const s = decodeState("dia=6");
    expect(s.diameter).toBe(6);
    expect(s.drogue).toEqual(DEFAULT_STATE.drogue);
  });

  it("floors a sub-1 safety margin from a hand-edited link", () => {
    // A margin in (0,1) would scale required force down and under-size the charge.
    expect(decodeState("mode=f&mg=0.5").margin).toBe(1);
    expect(decodeState("mode=f&mg=-3").margin).toBe(1);
    expect(decodeState("mode=f&mg=2").margin).toBe(2);
  });
});
