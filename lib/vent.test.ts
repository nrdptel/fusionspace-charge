import { describe, it, expect } from "vitest";
import { sizeVentPorts, nearestPortBit, VENT_AREA_PER_IN3 } from "./vent";

describe("vent-port sizing", () => {
  it("sizes a single port to ~1/4\" for a ~100 in³ bay (the canonical rule)", () => {
    // 4" ID × 8" long ≈ 100 in³ → one 1/4" port.
    const r = sizeVentPorts({ diameterIn: 4, lengthIn: 8, ports: 1 });
    expect(r.bayVolumeIn3).toBeCloseTo(100.5, 1);
    expect(r.perPortDiameterIn).toBeCloseTo(0.25, 2);
  });

  it("splits the same bay into ~1/8\" ports when using four (the published example)", () => {
    const r = sizeVentPorts({ diameterIn: 4, lengthIn: 8, ports: 4 });
    expect(r.perPortDiameterIn).toBeCloseTo(0.125, 2);
  });

  it("matches the 2\" × 8\" example: one 1/8\" port for ~25 in³", () => {
    const r = sizeVentPorts({ diameterIn: 2, lengthIn: 8, ports: 1 });
    expect(r.bayVolumeIn3).toBeCloseTo(25.1, 1);
    expect(r.perPortDiameterIn).toBeCloseTo(0.125, 2);
  });

  it("conserves total area as ports are added", () => {
    const one = sizeVentPorts({ diameterIn: 4, lengthIn: 8, ports: 1 });
    const four = sizeVentPorts({ diameterIn: 4, lengthIn: 8, ports: 4 });
    expect(four.totalAreaIn2).toBeCloseTo(one.totalAreaIn2, 6);
    expect(four.perPortAreaIn2).toBeCloseTo(one.perPortAreaIn2 / 4, 6);
  });

  it("reproduces the DN = 0.02216 · DT · √(L/N) closed form", () => {
    const DT = 4, L = 6, N = 3;
    const r = sizeVentPorts({ diameterIn: DT, lengthIn: L, ports: N });
    expect(r.perPortDiameterIn).toBeCloseTo(0.02216 * DT * Math.sqrt(L / N), 4);
  });

  it("derives the area-per-volume constant from the 1/4\"/100 in³ rule", () => {
    expect(VENT_AREA_PER_IN3).toBeCloseTo((Math.PI / 4 * 0.25 * 0.25) / 100, 8);
  });

  it("falls back to a single port for zero or sub-one port counts", () => {
    const r = sizeVentPorts({ diameterIn: 4, lengthIn: 8, ports: 0 });
    expect(r.perPortDiameterIn).toBeCloseTo(0.25, 2);
  });

  it("returns no diameter for an empty bay", () => {
    expect(sizeVentPorts({ diameterIn: 0, lengthIn: 0, ports: 3 }).perPortDiameterIn).toBe(0);
  });

  it("suggests the nearest common drill bit", () => {
    expect(nearestPortBit(0.125)?.label).toBe('1/8"');
    expect(nearestPortBit(0.13)?.label).toBe('1/8"');
    expect(nearestPortBit(0.24)?.label).toBe('1/4"');
    expect(nearestPortBit(0)).toBeNull();
  });
});
