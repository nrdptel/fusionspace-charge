import { describe, it, expect } from "vitest";
import { largeChargeCaution, wellCautions } from "./checks";
import { DEFAULT_STATE, type WellInput } from "./state";

const well = (patch: Partial<WellInput> = {}): WellInput => ({
  ...DEFAULT_STATE.drogue,
  ...patch,
});

describe("input sanity cautions", () => {
  it("stays quiet for ordinary inputs", () => {
    const c = wellCautions(DEFAULT_STATE, well(), { mass: 1.2 });
    expect(c).toEqual([]);
  });

  it("flags a diameter that's likely mm typed into an inches field", () => {
    const c = wellCautions(
      { mode: "force", lengthUnit: "in", pressureUnit: "psi" },
      well({ diameter: 98 }),
      { mass: 1 },
    );
    expect(c.map((x) => x.id)).toContain("dia-big");
  });

  it("flags a diameter that's likely inches typed into a mm field", () => {
    const c = wellCautions(
      { mode: "force", lengthUnit: "mm", pressureUnit: "psi" },
      well({ diameter: 4 }),
      { mass: 1 },
    );
    expect(c.map((x) => x.id)).toContain("dia-small");
  });

  it("does not flag a legitimately large metric airframe", () => {
    const c = wellCautions(
      { mode: "force", lengthUnit: "mm", pressureUnit: "psi" },
      well({ diameter: 102 }),
      { mass: 1 },
    );
    expect(c.map((x) => x.id)).not.toContain("dia-small");
  });

  it("flags a target pressure below the usual band, in pressure mode", () => {
    const c = wellCautions(
      { mode: "pressure", lengthUnit: "in", pressureUnit: "psi" },
      well({ pressure: 3 }),
      { mass: 1 },
    );
    expect(c.map((x) => x.id)).toContain("p-low");
  });

  it("flags a target pressure above the usual band, in pressure mode", () => {
    const c = wellCautions(
      { mode: "pressure", lengthUnit: "in", pressureUnit: "psi" },
      well({ pressure: 30 }),
      { mass: 1 },
    );
    expect(c.map((x) => x.id)).toContain("p-high");
  });

  it("ignores the pressure band in force mode", () => {
    const c = wellCautions(
      { mode: "force", lengthUnit: "in", pressureUnit: "psi" },
      well({ pressure: 30 }),
      { mass: 1 },
    );
    expect(c.map((x) => x.id)).not.toContain("p-high");
  });

  it("flags an unusually large charge regardless of mode", () => {
    const c = wellCautions(DEFAULT_STATE, well(), { mass: 42 });
    expect(c.map((x) => x.id)).toContain("mass-big");
  });
});

describe("largeChargeCaution — one message shared by every mode", () => {
  it("stays silent at or below the threshold", () => {
    expect(largeChargeCaution(20)).toBeNull();
    expect(largeChargeCaution(1.2)).toBeNull();
  });

  it("fires above the threshold and names the inputs to re-check", () => {
    const c = largeChargeCaution(42);
    expect(c?.id).toBe("mass-big");
    expect(c?.message).toContain("42 g is a large ejection charge");
    expect(c?.message).toContain("diameter, length, and units");
  });

  it("adds shear screws to the input list for the Fetter card", () => {
    expect(largeChargeCaution(42, { screws: true })?.message).toContain(
      "diameter, length, screws, and units",
    );
  });

  it("matches the caution wellCautions emits, so the two can't drift", () => {
    const viaWell = wellCautions(DEFAULT_STATE, well(), { mass: 42 }).find((x) => x.id === "mass-big");
    expect(viaWell?.message).toBe(largeChargeCaution(42)?.message);
  });
});
