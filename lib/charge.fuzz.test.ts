import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { sizeByPressure, sizeByForce } from "./charge";

// Golden regression fixture for the ideal-gas modes (target pressure and separation force),
// mirroring lib/fetter.fuzz — cases spanning the input domain with area/volume/pressure/mass
// computed by an independent m=(P·V)/(R·T) reference. charge.test.ts pins a few named worked
// examples; this locks the whole surface (boreArea, cylinderVolume, pressureFromForce,
// blackPowderMass) so a changed constant or conversion factor fails a test. Columns:
//   pressure: [diameterIn, lengthIn, pressurePsi, area, volume, pressure, mass]
//   force:    [diameterIn, lengthIn, forceLbf,    area, volume, pressure, mass]
const fixture: { pressure: number[][]; force: number[][] } = JSON.parse(
  readFileSync(new URL("./charge.fuzz.json", import.meta.url), "utf8"),
);

const close = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 + 1e-6 * Math.max(Math.abs(a), Math.abs(b));

describe("Ideal-gas ejection-charge math — golden cases across the input domain", () => {
  it(`sizeByPressure reproduces the reference on all ${fixture.pressure.length} cases`, () => {
    const fails: unknown[] = [];
    for (const [D, L, P, area, volume, pressure, mass] of fixture.pressure) {
      const r = sizeByPressure({ diameterIn: D, lengthIn: L, pressurePsi: P });
      if (!close(r.area, area) || !close(r.volume, volume) || !close(r.pressure, pressure) || !close(r.mass, mass))
        fails.push({ in: [D, L, P], got: r, ref: { area, volume, pressure, mass } });
    }
    if (fails.length) console.log("PRESSURE FAILS:", JSON.stringify(fails.slice(0, 8), null, 2));
    expect(fails).toEqual([]);
  });

  it(`sizeByForce reproduces the reference on all ${fixture.force.length} cases`, () => {
    const fails: unknown[] = [];
    for (const [D, L, F, area, volume, pressure, mass] of fixture.force) {
      const r = sizeByForce({ diameterIn: D, lengthIn: L, forceLbf: F });
      if (!close(r.area, area) || !close(r.volume, volume) || !close(r.pressure, pressure) || !close(r.mass, mass))
        fails.push({ in: [D, L, F], got: r, ref: { area, volume, pressure, mass } });
    }
    if (fails.length) console.log("FORCE FAILS:", JSON.stringify(fails.slice(0, 8), null, 2));
    expect(fails).toEqual([]);
  });
});
