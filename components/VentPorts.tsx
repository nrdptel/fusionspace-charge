"use client";

import { useMemo, useState } from "react";
import { Chip, Disclosure, NumberField, Segmented } from "./ui";
import { fmt, round } from "@/lib/format";
import {
  fromInches,
  in3ToCc,
  toInches,
  type LengthUnit,
} from "@/lib/units";
import {
  nearestPortBit,
  sizeVentPorts,
  VENT_REF_DIAMETER_IN,
  VENT_REF_VOLUME_IN3,
} from "@/lib/vent";

// Self-contained helper: an altimeter's static ports are about the av-bay, not the
// charge wells, so it keeps its own small state rather than entangling the calculator's
// URL-synced model. The math lives in lib/vent.ts (pure, tested).
interface VentState {
  diameter: number;
  length: number;
  ports: number;
  lengthUnit: LengthUnit;
}

const DEFAULT: VentState = { diameter: 4, length: 6, ports: 3, lengthUnit: "in" };

export default function VentPorts() {
  const [state, setState] = useState<VentState>(DEFAULT);
  const update = (patch: Partial<VentState>) => setState((s) => ({ ...s, ...patch }));

  const setLengthUnit = (lu: LengthUnit) => {
    if (lu === state.lengthUnit) return;
    const conv = (v: number) => round(fromInches(toInches(v, state.lengthUnit), lu), 3);
    setState((s) => ({
      ...s,
      lengthUnit: lu,
      diameter: conv(s.diameter),
      length: conv(s.length),
    }));
  };

  const result = useMemo(() => {
    const diameterIn = toInches(state.diameter, state.lengthUnit);
    const lengthIn = toInches(state.length, state.lengthUnit);
    return sizeVentPorts({ diameterIn, lengthIn, ports: state.ports });
  }, [state]);

  // Per-port diameter shown in the active unit; inches get more decimals than mm.
  const portDiameter = fromInches(result.perPortDiameterIn, state.lengthUnit);
  const portDecimals = state.lengthUnit === "mm" ? 2 : 3;
  const bit = nearestPortBit(result.perPortDiameterIn);
  const hasResult = result.perPortDiameterIn > 0;

  return (
    <section className="mt-16">
      <div className="flex items-baseline justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold tracking-tight">Altimeter vent holes</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">static sampling ports</span>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        A barometric altimeter reads the air through small ports in its electronics bay.
        Too small and the bay lags the real altitude — a late or missed apogee event; too
        large and gusts and the rocket&apos;s slipstream add noise that can fire a charge at
        the wrong moment. This sizes them by the standard rule of thumb.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Inputs */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Ports
              </div>
              <Segmented<string>
                ariaLabel="Number of ports"
                value={String(state.ports)}
                onChange={(v) => update({ ports: Number(v) })}
                options={[
                  { value: "1", label: "1" },
                  { value: "3", label: "3" },
                  { value: "4", label: "4" },
                ]}
              />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Length
              </div>
              <Segmented<LengthUnit>
                ariaLabel="Length unit"
                size="sm"
                value={state.lengthUnit}
                onChange={setLengthUnit}
                options={[
                  { value: "in", label: "in" },
                  { value: "mm", label: "mm" },
                ]}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              label="Bay inner diameter"
              value={state.diameter}
              onChange={(diameter) => update({ diameter })}
              unit={state.lengthUnit}
              step={state.lengthUnit === "mm" ? 1 : 0.1}
              hint="Tube ID of the sealed altimeter bay."
            />
            <NumberField
              label="Bay length"
              value={state.length}
              onChange={(length) => update({ length })}
              unit={state.lengthUnit}
              step={state.lengthUnit === "mm" ? 5 : 0.5}
              hint="Length of the sealed compartment the ports vent."
            />
          </div>

          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Use 3–4 equal, evenly-spaced ports; a single port is fine for a small bay.
            Avoid exactly two — they can read unevenly in a crosswind.
          </p>
        </div>

        {/* Result */}
        <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex flex-col gap-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <div aria-live="polite" className="flex items-baseline gap-2">
              <span
                data-testid="port-diameter"
                className="font-mono text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50"
              >
                {hasResult ? fmt(portDiameter, portDecimals) : "—"}
              </span>
              <span className="text-lg text-zinc-500 dark:text-zinc-400">
                {state.lengthUnit}
              </span>
              <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                drill each of {Math.max(1, state.ports)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Chip
                label="Bay volume"
                value={`${fmt(result.bayVolumeIn3, 1)} in³ · ${fmt(in3ToCc(result.bayVolumeIn3), 0)} cc`}
              />
              <Chip label="Total vent area" value={`${fmt(result.totalAreaIn2, 3)} in²`} />
              {bit && (
                <Chip
                  label="Nearest bit"
                  value={`${bit.label} · ${fmt(fromInches(bit.in, "mm"), 1)} mm`}
                />
              )}
            </div>
          </div>

          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Round to a bit you have — close is fine. If anything, err small: an oversized
            port hurts more than a slightly undersized one. Then{" "}
            <strong className="font-medium text-zinc-700 dark:text-zinc-300">
              check your altimeter&apos;s manual
            </strong>{" "}
            — some specify their own port sizes, which win over any rule of thumb.
          </p>
        </div>
      </div>

      <Disclosure summary="Where this number comes from">
        <p>
          The high-power rule of thumb is one {VENT_REF_DIAMETER_IN}&Prime; port for every{" "}
          {VENT_REF_VOLUME_IN3} in³ of bay volume. Worked as an area so it splits cleanly
          across several holes:
        </p>
        <p className="rounded-md bg-white px-3 py-2 font-mono text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          d = 0.02216 · ID · √(L / N)
        </p>
        <p>
          where <span className="font-mono">ID</span> and <span className="font-mono">L</span>{" "}
          are the bay&apos;s inner diameter and length and{" "}
          <span className="font-mono">N</span> is the number of ports. The constant is just
          √(area of a {VENT_REF_DIAMETER_IN}&Prime; hole ÷ {VENT_REF_VOLUME_IN3} in³): the
          total vent area is <span className="font-mono">V · (A¼ / 100)</span>, divided
          among N equal ports, each <span className="font-mono">d = √(4A/π)</span>.
        </p>
        <p>
          It&apos;s a guideline, not a law — sources put the workable range at roughly half
          to double this area. Bigger isn&apos;t safer here: too much venting lets gusts and
          the slipstream reach the sensor. Keep the holes clean and burr-free, equally sized
          and evenly spaced around a smooth part of the airframe, away from fins, rail
          buttons, and steps that disturb the airflow.
        </p>
        <p className="font-medium text-zinc-700 dark:text-zinc-300">
          And if your altimeter&apos;s manual gives a port size, use that — it knows its own
          sensor better than any general rule.
        </p>
      </Disclosure>
    </section>
  );
}
