import { describe, it, expect } from "vitest";
import {
  DEFAULT_STATE,
  decodeState,
  encodeState,
  normalizeState,
  type State,
} from "./state";

describe("normalizeState (untrusted saved/imported state)", () => {
  it("passes a valid state through unchanged", () => {
    expect(normalizeState(DEFAULT_STATE)).toEqual(DEFAULT_STATE);
  });

  it("rebuilds a corrupt well instead of letting it reach the compute path", () => {
    // The crash case: a tampered/legacy store with a null well. A shallow merge would keep
    // null and blow up at computeWell(state.drogue); normalizeState restores the default well.
    const s = normalizeState({ ...DEFAULT_STATE, drogue: null, main: "oops" });
    expect(s.drogue).toEqual(DEFAULT_STATE.drogue);
    expect(s.main).toEqual(DEFAULT_STATE.main);
  });

  it("coerces string numbers and fills missing well fields from defaults", () => {
    const s = normalizeState({ drogue: { diameter: "3.9", length: "18" } });
    expect(s.drogue.diameter).toBe(3.9);
    expect(s.drogue.length).toBe(18);
    expect(s.drogue.pressure).toBe(DEFAULT_STATE.drogue.pressure);
  });

  it("rounds and floors pin count, and floors margin/backup/elevation", () => {
    const s = normalizeState({
      margin: 0.5,
      backupPct: -10,
      elevation: -100,
      drogue: { ...DEFAULT_STATE.drogue, pinCount: 2.7 },
    });
    expect(s.margin).toBe(1);
    expect(s.backupPct).toBe(0);
    expect(s.elevation).toBe(0);
    expect(s.drogue.pinCount).toBe(3);
  });

  it("falls back to defaults for bad enums and non-object input", () => {
    const s = normalizeState({ mode: "nonsense", deploy: 7, lengthUnit: "furlong" });
    expect(s.mode).toBe(DEFAULT_STATE.mode);
    expect(s.deploy).toBe(DEFAULT_STATE.deploy);
    expect(s.lengthUnit).toBe("in");
    expect(normalizeState(null)).toEqual(DEFAULT_STATE);
    expect(normalizeState("not an object")).toEqual(DEFAULT_STATE);
  });

  it("neutralizes non-finite numeric fields to their defaults", () => {
    const s = normalizeState({
      margin: Infinity,
      drogue: { ...DEFAULT_STATE.drogue, diameter: NaN },
    });
    expect(s.margin).toBe(DEFAULT_STATE.margin);
    expect(s.drogue.diameter).toBe(DEFAULT_STATE.drogue.diameter);
  });

  it("preserves non-default units on the saved-rocket / restore path", () => {
    // decodeState (URL) is metric-tested, but normalizeState is the path a saved rocket and a
    // backup restore go through. If a unit ternary regressed, a setup saved in mm/kPa/N would
    // silently reload as in/psi/lbf — the stored numbers reinterpreted as different units.
    const s = normalizeState({ ...DEFAULT_STATE, lengthUnit: "mm", pressureUnit: "kPa", forceUnit: "N" });
    expect(s.lengthUnit).toBe("mm");
    expect(s.pressureUnit).toBe("kPa");
    expect(s.forceUnit).toBe("N");
  });

  it("clamps Fetter compartment fields on the saved-rocket / backup-import path", () => {
    // normalizeState — not decodeState — is what a restored saved rocket and an imported backup go
    // through. Its Fetter clamps (packing [0,1], safety/deployAlt floor, discrete pins, screw
    // whitelist) were only ever exercised via the URL path; a regression here would silently
    // corrupt every restored Fetter setup with no failing test. Pin them.
    const s = normalizeState({
      ...DEFAULT_STATE,
      mode: "fetter",
      fetter: { ...DEFAULT_STATE.fetter, packing: 2, safety: -3, deployAlt: -500, pinCount: 2.7, screw: "bolt" },
    });
    expect(s.fetter.packing).toBe(1);
    expect(s.fetter.safety).toBe(0);
    expect(s.fetter.deployAlt).toBe(0);
    expect(s.fetter.pinCount).toBe(3);
    expect(s.fetter.screw).toBe(DEFAULT_STATE.fetter.screw);
  });

  it("rebuilds a corrupt or missing Fetter compartment from defaults", () => {
    // Mirrors the corrupt-well case: a tampered store with null/garbage Fetter compartments must
    // not reach computeFetter — normalizeState restores the defaults for both compartments.
    const s = normalizeState({ ...DEFAULT_STATE, mode: "fetter", fetter: null, fetterMain: "oops" });
    expect(s.fetter).toEqual(DEFAULT_STATE.fetter);
    expect(s.fetterMain).toEqual(DEFAULT_STATE.fetterMain);
  });

  it("coerces Fetter string numbers and fills missing fields from defaults", () => {
    const s = normalizeState({ mode: "fetter", fetter: { diameter: "4", length: "24" } });
    expect(s.fetter.diameter).toBe(4);
    expect(s.fetter.length).toBe(24);
    expect(s.fetter.packing).toBe(DEFAULT_STATE.fetter.packing);
    expect(s.fetter.screw).toBe(DEFAULT_STATE.fetter.screw);
  });
});

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

  it("round-trips and floors the field elevation", () => {
    expect(decodeState(encodeState({ ...DEFAULT_STATE, elevation: 5400 })).elevation).toBe(5400);
    expect(decodeState("el=-100").elevation).toBe(0);
  });
});

describe("URL state — hostile & edge input", () => {
  it("falls back to defaults for non-numeric, empty, or non-finite numeric params", () => {
    for (const q of ["ddia=abc", "ddia=", "ddia=Infinity", "ddia=1e999", "ddia=NaN", "ddia=%00"]) {
      expect(decodeState(q).drogue.diameter).toBe(DEFAULT_STATE.drogue.diameter);
    }
    expect(decodeState("mg=abc").margin).toBe(DEFAULT_STATE.margin);
    expect(decodeState("el=1e999").elevation).toBe(DEFAULT_STATE.elevation);
  });

  it("coerces pin count to a non-negative integer (pins are discrete)", () => {
    // A fractional/negative count from a hand-edited link would otherwise size the charge
    // for e.g. 2.7 pins while the exported report rounds it to '3'.
    expect(decodeState("mode=f&dn=2.7").drogue.pinCount).toBe(3);
    expect(decodeState("mode=f&dn=2.2").drogue.pinCount).toBe(2);
    expect(decodeState("mode=f&dn=-5").drogue.pinCount).toBe(0);
  });

  it("passes raw physical inputs through decode unchanged (clamped later at compute)", () => {
    // decode doesn't floor diameter/length/pressure/friction — nn() zeroes negatives at
    // computeWell, the safe direction. This pins the division of responsibility.
    expect(decodeState("ddia=-4").drogue.diameter).toBe(-4);
    expect(decodeState("dl=-12").drogue.length).toBe(-12);
  });

  it("does not hang or overflow on an absurdly long numeric param", () => {
    const s = decodeState("ddia=" + "9".repeat(500));
    expect(Number.isFinite(s.drogue.diameter)).toBe(true);
  });

  it("single deploy intentionally drops the main well on encode (documented asymmetry)", () => {
    const single: State = {
      ...DEFAULT_STATE,
      deploy: "single",
      main: { ...DEFAULT_STATE.main, diameter: 99 },
    };
    // The main is unused in single deploy, so it isn't encoded and comes back at default.
    expect(decodeState(encodeState(single)).main.diameter).toBe(DEFAULT_STATE.main.diameter);
  });
});

describe("URL state — Fetter mode", () => {
  it("round-trips a customized Fetter compartment", () => {
    const custom: State = {
      ...DEFAULT_STATE,
      mode: "fetter",
      fetter: {
        diameter: 4,
        length: 24,
        screw: "4-40",
        pinCount: 4,
        friction: 3,
        packing: 0.5,
        safety: 0.6,
        deployAlt: 8000,
      },
    };
    expect(decodeState(encodeState(custom))).toEqual(custom);
  });

  it("keeps the ideal-gas wells through a Fetter-mode round-trip (wells encode in every mode)", () => {
    // The wells are encoded unconditionally — unlike the Fetter params, which only encode in Fetter
    // mode — so a link shared while in Fetter mode still carries the force/pressure geometry, and
    // switching back to an ideal-gas mode doesn't find the wells reset to defaults.
    const custom: State = {
      ...DEFAULT_STATE,
      mode: "fetter",
      deploy: "dual",
      drogue: { diameter: 5.5, length: 20, pressure: 15, pinCount: 3, pinForce: 40, friction: 5 },
      main: { diameter: 6, length: 36, pressure: 18, pinCount: 4, pinForce: 50, friction: 8 },
    };
    const back = decodeState(encodeState(custom));
    expect(back.drogue).toEqual(custom.drogue);
    expect(back.main).toEqual(custom.main);
  });

  it("round-trips both Fetter compartments in dual deploy", () => {
    const custom: State = {
      ...DEFAULT_STATE,
      mode: "fetter",
      deploy: "dual",
      fetter: { ...DEFAULT_STATE.fetter, diameter: 3, length: 15, deployAlt: 12000 },
      fetterMain: { ...DEFAULT_STATE.fetterMain, diameter: 4, length: 30, screw: "6-32", pinCount: 3 },
    };
    expect(decodeState(encodeState(custom))).toEqual(custom);
  });

  it("drops the Fetter main compartment in single deploy (like the ideal-gas main well)", () => {
    const single: State = {
      ...DEFAULT_STATE,
      mode: "fetter",
      deploy: "single",
      fetterMain: { ...DEFAULT_STATE.fetterMain, diameter: 99 },
    };
    expect(encodeState(single)).not.toContain("xmdia");
    expect(decodeState(encodeState(single)).fetterMain.diameter).toBe(DEFAULT_STATE.fetterMain.diameter);
  });

  it("only encodes the Fetter compartment in Fetter mode (documented asymmetry)", () => {
    // Like the main well in single deploy, the Fetter params aren't written in force/pressure
    // mode — so existing shared links stay byte-for-byte identical.
    const force: State = { ...DEFAULT_STATE, mode: "force", fetter: { ...DEFAULT_STATE.fetter, diameter: 99 } };
    expect(encodeState(force)).not.toContain("xdia");
    expect(decodeState(encodeState(force)).fetter.diameter).toBe(DEFAULT_STATE.fetter.diameter);
  });

  it("decodes the fetter mode code and its compartment", () => {
    const s = decodeState("mode=x&xdia=6&xl=30&xsc=6-32&xn=3&xpk=0.75&xsf=0.4");
    expect(s.mode).toBe("fetter");
    expect(s.fetter.diameter).toBe(6);
    expect(s.fetter.screw).toBe("6-32");
    expect(s.fetter.pinCount).toBe(3);
    expect(s.fetter.packing).toBe(0.75);
  });

  it("clamps a hand-edited packing factor and safety, and rejects a bad screw", () => {
    expect(decodeState("mode=x&xpk=2").fetter.packing).toBe(1);
    expect(decodeState("mode=x&xpk=-1").fetter.packing).toBe(0);
    expect(decodeState("mode=x&xsf=-3").fetter.safety).toBe(0);
    expect(decodeState("mode=x&xsc=bolt").fetter.screw).toBe(DEFAULT_STATE.fetter.screw);
    // Pins are discrete, like the force-mode well.
    expect(decodeState("mode=x&xn=2.7").fetter.pinCount).toBe(3);
  });
});
