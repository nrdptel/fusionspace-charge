"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_STATE,
  SHEAR_PIN_PRESETS,
  decodeState,
  encodeState,
  type Deploy,
  type Mode,
  type State,
  type WellInput,
} from "@/lib/state";
import {
  fromInches,
  fromLbf,
  fromPsi,
  in3ToCc,
  toInches,
  toLbf,
  toPsi,
  type ForceUnit,
  type LengthUnit,
  type PressureUnit,
} from "@/lib/units";
import { sizeByForce, sizeByPressure, type WellResult } from "@/lib/charge";
import { fmt, fmtMass, round } from "@/lib/format";
import { NumberField, Segmented } from "./ui";
import Methodology from "./Methodology";
import SavedRockets from "./SavedRockets";
import MeasureGuide from "./MeasureGuide";

interface Computed {
  result: WellResult;
  /** Total separation force used (force mode), lbf. */
  requiredForceLbf: number;
}

// Clamp physical inputs to be non-negative. A stray minus sign — most dangerously a
// negative friction in force mode — would otherwise *reduce* the required force and
// under-size the charge, the one error direction that matters for a pyro tool.
// Negatives are treated as 0 (which surfaces as "—" rather than a low number).
const nn = (x: number): number => (Number.isFinite(x) && x > 0 ? x : 0);

// The safety margin is a multiplier that must never be below 1 — a value in (0,1)
// would scale the required force *down* and under-size the charge. The input hints
// min=1, but a shared link, saved setup, or imported state can carry anything, so
// the floor is enforced here at the computation edge.
const clampMargin = (x: number): number => (Number.isFinite(x) ? Math.max(1, x) : 1);

function computeWell(s: State, w: WellInput): Computed {
  const diameterIn = nn(toInches(w.diameter, s.lengthUnit));
  const lengthIn = nn(toInches(w.length, s.lengthUnit));
  if (s.mode === "pressure") {
    const pressurePsi = nn(toPsi(w.pressure, s.pressureUnit));
    return {
      result: sizeByPressure({ diameterIn, lengthIn, pressurePsi }),
      requiredForceLbf: 0,
    };
  }
  const pinsLbf = nn(w.pinCount) * nn(toLbf(w.pinForce, s.forceUnit));
  const frictionLbf = nn(toLbf(w.friction, s.forceUnit));
  const requiredForceLbf = (pinsLbf + frictionLbf) * clampMargin(s.margin);
  return {
    result: sizeByForce({ diameterIn, lengthIn, forceLbf: requiredForceLbf }),
    requiredForceLbf,
  };
}

export default function Calculator({
  onActiveRocketChange,
  onPlanCharge,
}: {
  onActiveRocketChange?: (name: string) => void;
  onPlanCharge?: (grams: number) => void;
}) {
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load state from the URL on mount.
  useEffect(() => {
    setState(decodeState(window.location.search));
    setHydrated(true);
  }, []);

  // Keep the URL in sync so the configured calculation is a shareable link.
  useEffect(() => {
    if (!hydrated) return;
    const qs = encodeState(state);
    const url = `${window.location.pathname}?${qs}`;
    window.history.replaceState(null, "", url);
  }, [state, hydrated]);

  const update = (patch: Partial<State>) => setState((s) => ({ ...s, ...patch }));
  const updateWell = (key: "drogue" | "main", patch: Partial<WellInput>) =>
    setState((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  // Unit switches convert the stored values so the physical inputs don't change.
  const setLengthUnit = (lu: LengthUnit) => {
    if (lu === state.lengthUnit) return;
    const conv = (v: number) => round(fromInches(toInches(v, state.lengthUnit), lu), 3);
    setState((s) => ({
      ...s,
      lengthUnit: lu,
      drogue: {
        ...s.drogue,
        diameter: conv(s.drogue.diameter),
        length: conv(s.drogue.length),
      },
      main: {
        ...s.main,
        diameter: conv(s.main.diameter),
        length: conv(s.main.length),
      },
    }));
  };
  const setPressureUnit = (pu: PressureUnit) => {
    if (pu === state.pressureUnit) return;
    const conv = (v: number) => round(fromPsi(toPsi(v, state.pressureUnit), pu), 2);
    setState((s) => ({
      ...s,
      pressureUnit: pu,
      drogue: { ...s.drogue, pressure: conv(s.drogue.pressure) },
      main: { ...s.main, pressure: conv(s.main.pressure) },
    }));
  };
  const setForceUnit = (fu: ForceUnit) => {
    if (fu === state.forceUnit) return;
    const conv = (v: number) => round(fromLbf(toLbf(v, state.forceUnit), fu), 2);
    setState((s) => ({
      ...s,
      forceUnit: fu,
      drogue: { ...s.drogue, pinForce: conv(s.drogue.pinForce), friction: conv(s.drogue.friction) },
      main: { ...s.main, pinForce: conv(s.main.pinForce), friction: conv(s.main.friction) },
    }));
  };

  const drogue = useMemo(() => computeWell(state, state.drogue), [state]);
  const main = useMemo(() => computeWell(state, state.main), [state]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked; the URL bar already holds the shareable link */
    }
  };

  const wells: { key: "drogue" | "main"; title: string; sub: string; data: Computed }[] =
    state.deploy === "dual"
      ? [
          { key: "drogue", title: "Drogue well", sub: "Apogee — separates the airframe", data: drogue },
          { key: "main", title: "Main well", sub: "Lower — deploys the main", data: main },
        ]
      : [{ key: "drogue", title: "Ejection charge", sub: "Separates the airframe", data: drogue }];

  return (
    <div className="mt-10 md:mt-14">
      <div className="mb-5">
        <SavedRockets
          current={state}
          onLoad={setState}
          onActivate={onActiveRocketChange}
        />
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
          <ControlGroup label="Deployment">
            <Segmented<Deploy>
              ariaLabel="Deployment"
              value={state.deploy}
              onChange={(deploy) => update({ deploy })}
              options={[
                { value: "single", label: "Single" },
                { value: "dual", label: "Dual" },
              ]}
            />
          </ControlGroup>
          <ControlGroup label="Size by">
            <Segmented<Mode>
              ariaLabel="Sizing method"
              value={state.mode}
              onChange={(mode) => update({ mode })}
              options={[
                { value: "pressure", label: "Target pressure" },
                { value: "force", label: "Separation force" },
              ]}
            />
          </ControlGroup>
          <ControlGroup label="Length">
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
          </ControlGroup>
          {state.mode === "pressure" ? (
            <ControlGroup label="Pressure">
              <Segmented<PressureUnit>
                ariaLabel="Pressure unit"
                size="sm"
                value={state.pressureUnit}
                onChange={setPressureUnit}
                options={[
                  { value: "psi", label: "psi" },
                  { value: "kPa", label: "kPa" },
                ]}
              />
            </ControlGroup>
          ) : (
            <ControlGroup label="Force">
              <Segmented<ForceUnit>
                ariaLabel="Force unit"
                size="sm"
                value={state.forceUnit}
                onChange={setForceUnit}
                options={[
                  { value: "lbf", label: "lbf" },
                  { value: "N", label: "N" },
                ]}
              />
            </ControlGroup>
          )}
        </div>

        {state.mode === "force" && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Safety margin"
              value={state.margin}
              onChange={(margin) => update({ margin })}
              unit="×"
              step={0.1}
              min={1}
              hint="Multiplier on the required force, applied to both wells. 1.5 = +50% over the bare minimum."
            />
          </div>
        )}
      </div>

      <MeasureGuide />

      {/* Wells + results */}
      <div
        className={
          "mt-5 grid grid-cols-1 gap-5 " +
          (state.deploy === "dual" ? "lg:grid-cols-2" : "")
        }
      >
        {wells.map(({ key, title, sub, data }) => (
          <WellCard
            key={key}
            title={title}
            sub={sub}
            state={state}
            well={state[key]}
            onChange={(patch) => updateWell(key, patch)}
            computed={data}
            onPlanCharge={onPlanCharge}
          />
        ))}
      </div>

      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        These are theoretical starting estimates from the ideal-gas method below — a
        baseline to take to the bench, not a number to trust unverified.{" "}
        <a href="#ground-test" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
          Ground-test and record what actually works ↓
        </a>
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={share}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          {copied ? "Link copied" : "Copy share link"}
        </button>
        <button
          type="button"
          onClick={() => {
            setState(DEFAULT_STATE);
            onActiveRocketChange?.("");
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          Reset
        </button>
      </div>

      <Methodology state={state} drogue={drogue} />
    </div>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      {children}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
        {label}
      </div>
      <div className="font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
        {value}
      </div>
    </div>
  );
}

function WellCard({
  title,
  sub,
  state,
  well,
  onChange,
  computed,
  onPlanCharge,
}: {
  title: string;
  sub: string;
  state: State;
  well: WellInput;
  onChange: (patch: Partial<WellInput>) => void;
  computed: Computed;
  onPlanCharge?: (grams: number) => void;
}) {
  const { result, requiredForceLbf } = computed;
  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{sub}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          label="Inner diameter"
          value={well.diameter}
          onChange={(diameter) => onChange({ diameter })}
          unit={state.lengthUnit}
          step={state.lengthUnit === "mm" ? 1 : 0.1}
          hint="Tube ID — the bore the gas pressurizes."
        />
        <NumberField
          label="Pressurized length"
          value={well.length}
          onChange={(length) => onChange({ length })}
          unit={state.lengthUnit}
          step={state.lengthUnit === "mm" ? 5 : 0.5}
          hint="Length of the section the charge pressurizes."
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {state.mode === "pressure" ? (
          <NumberField
            label="Target pressure"
            value={well.pressure}
            onChange={(pressure) => onChange({ pressure })}
            unit={state.pressureUnit}
            step={state.pressureUnit === "kPa" ? 5 : 1}
            hint="Common rule of thumb is ~8–15 psi."
          />
        ) : (
          <NumberField
            label="Shear pins"
            value={well.pinCount}
            onChange={(pinCount) => onChange({ pinCount })}
            unit="pins"
            step={1}
            hint="Number of pins across the joint."
          />
        )}
      </div>

      {state.mode === "force" && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <NumberField
              label="Force per pin"
              value={well.pinForce}
              onChange={(pinForce) => onChange({ pinForce })}
              unit={state.forceUnit}
              step={1}
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {SHEAR_PIN_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onChange({ pinForce: round(fromLbf(p.lbf, state.forceUnit), 1) })}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 transition hover:border-indigo-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Presets are approximate single-shear values that vary by source — verify
              yours.
            </p>
          </div>
          <NumberField
            label="Friction / extra hold"
            value={well.friction}
            onChange={(friction) => onChange({ friction })}
            unit={state.forceUnit}
            step={1}
            placeholder="0"
            hint="Nose/coupler friction beyond the pins, if you account for it."
          />
        </div>
      )}

      {/* Result */}
      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
        {/* aria-live scoped to the headline mass so a screen reader announces the
            result, not the whole block of chips, on each input change. */}
        <div aria-live="polite" className="flex items-baseline gap-2">
          <span
            data-testid="mass"
            className="font-mono text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50"
          >
            {fmtMass(result.mass)}
          </span>
          <span className="text-lg text-zinc-500 dark:text-zinc-400">g</span>
          <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
            black powder
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Chip
            label="Volume"
            value={`${fmt(result.volume, 1)} in³ · ${fmt(in3ToCc(result.volume), 0)} cc`}
          />
          <Chip
            label="Pressure"
            value={`${fmt(fromPsi(result.pressure, state.pressureUnit), 1)} ${state.pressureUnit}`}
          />
          {state.mode === "force" && (
            <Chip
              label="Force"
              value={`${fmt(fromLbf(requiredForceLbf, state.forceUnit), 0)} ${state.forceUnit}`}
            />
          )}
        </div>
      </div>

      {result.mass > 0 && (
        <div className="mt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Ground-test plan
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Bench-test from the low charge up until separation is clean and energetic.
            Tap a step to start a log entry below.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: "Low −20%", factor: 0.8 },
              { label: "Estimate", factor: 1 },
              { label: "High +20%", factor: 1.2 },
            ].map((s) => {
              const grams = round(result.mass * s.factor, 2);
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => onPlanCharge?.(grams)}
                  title={`Log a ${grams} g test`}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-left transition hover:border-indigo-400 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-500/60"
                >
                  <span className="block text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                    {s.label}
                  </span>
                  <span className="block font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                    {fmtMass(grams)} g
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
