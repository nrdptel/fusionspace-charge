import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fetterCharge } from "./fetter";

// Golden regression fixture: 220 cases spanning the input domain — [diameterIn, lengthIn,
// screwMinorIn, pinCount, frictionLbf, packing, safety, mass_g, pressure_psi, traditional_g] —
// with the last three computed by an independent reference that reproduces the paper's Table
// 16-1 bit-for-bit (see fetter.test.ts for the paper-anchored worked cases). This guards the
// closed form, a large and easy-to-break expression, against a transcription drift that the
// handful of worked examples wouldn't catch: any edit to fetterCharge that changes an output
// off the fixture points fails here. Regenerate the JSON only from a paper-reproducing reference.
const fixture: { cases: number[][] } = JSON.parse(
  readFileSync(new URL("./fetter.fuzz.json", import.meta.url), "utf8"),
);

// A real transcription bug diverges by orders of magnitude; float evaluation-order differences
// between the two implementations are ~1e-15 relative, so this tolerance is tight but safe.
const close = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 + 1e-6 * Math.max(Math.abs(a), Math.abs(b));

describe("Fetter closed form — golden cases across the input domain", () => {
  it(`reproduces the reference on all ${fixture.cases.length} cases (mass, pressure, traditional)`, () => {
    const fails: unknown[] = [];
    for (const [D, L, mi, n, fr, pk, sf, mass, psi, trad] of fixture.cases) {
      const r = fetterCharge({
        diameterIn: D, lengthIn: L, screwMinorIn: mi, pinCount: n, frictionLbf: fr, packing: pk, safety: sf,
      });
      if (!Number.isFinite(r.mass) || r.mass < 0)
        fails.push({ in: [D, L, mi, n, fr, pk, sf], got: r.mass, why: "nan/negative" });
      else if (!close(r.mass, mass) || !close(r.pressurePsi, psi) || !close(r.traditionalMass, trad))
        fails.push({ in: [D, L, mi, n, fr, pk, sf], tsMass: r.mass, refMass: mass, tsP: r.pressurePsi, refP: psi, tsTrad: r.traditionalMass, refTrad: trad });
    }
    if (fails.length) console.log("FAILS:", JSON.stringify(fails.slice(0, 8), null, 2));
    expect(fails).toEqual([]);
  });
});
