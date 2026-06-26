import { describe, it, expect } from "vitest";
import { wellCautions } from "./checks";
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
