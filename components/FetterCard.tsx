"use client";

import {
  FETTER_LINKS,
  FETTER_MIN_TYPICAL_G,
  FETTER_ALT_LIMIT_FT,
  FETTER_SCREWS,
  withinAltitudeEnvelope,
  type FetterResult,
} from "@/lib/fetter";
import type { FetterInput, State } from "@/lib/state";
import { fromLbf, fromPsi, in3ToCc, gToGrains, type LengthUnit } from "@/lib/units";
import { fmt, fmtMass, round } from "@/lib/format";
import { LARGE_CHARGE_G, wellCautions } from "@/lib/checks";
import { NumberField, Select, Chip } from "./ui";

const SCREW_OPTIONS = FETTER_SCREWS.map((s) => ({ value: s.label, label: s.label }));
const PACKING_PRESETS = [0.25, 0.5, 0.75, 1];
const ID_PRESETS: Record<LengthUnit, number[]> = {
  in: [1.5, 2.1, 3, 3.9, 6],
  mm: [38, 54, 75, 98, 152],
};

/**
 * The Fetter-model sizing card: a single parachute compartment, its inputs, and the sized
 * charge shown against the traditional ideal-gas result. The model is Tom Fetter's, credited
 * here at the mode with a link to the paper. Its output already carries the model's own 40%
 * safety factor, so — unlike the two ideal-gas modes — no separate margin is layered on top.
 */
export default function FetterCard({
  state,
  input,
  onChange,
  result,
  onPlanCharge,
}: {
  state: State;
  input: FetterInput;
  onChange: (patch: Partial<FetterInput>) => void;
  result: FetterResult;
  onPlanCharge?: (grams: number, estimate: number) => void;
}) {
  const lu = state.lengthUnit;
  const fu = state.forceUnit;
  const pu = state.pressureUnit;
  const inEnvelope = withinAltitudeEnvelope(input.deployAlt);
  const mass = result.mass;
  const grains = gToGrains(mass);
  // The same diameter sanity check the ideal-gas wells get — a bore that reads like a mm/inch
  // mix-up or an outside diameter. Passing mass 0 asks only for the diameter cautions; the
  // large-charge caution is rendered separately below with the Fetter number.
  const dimCautions = wellCautions(
    state,
    { diameter: input.diameter, length: input.length, pressure: 0, pinCount: 0, pinForce: 0, friction: input.friction },
    { mass: 0 },
  );

  return (
    <div className="mt-5 flex flex-col rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">Parachute compartment</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Chute + recovery blanket</span>
      </div>

      {/* Attribution + envelope, at the mode itself — not a footer. */}
      <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 text-xs leading-relaxed text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
        <p>
          The <strong className="font-semibold">Fetter model</strong> is {FETTER_LINKS.author}&apos;s
          — derived from pressure-chamber and deployment-fixture testing to fix the traditional
          model&apos;s under-prediction of the powder a parachute needs.{" "}
          <a
            href={FETTER_LINKS.paper}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline decoration-indigo-400 underline-offset-2"
          >
            Read the paper
          </a>{" "}
          ·{" "}
          <a
            href={FETTER_LINKS.video}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline decoration-indigo-400 underline-offset-2"
          >
            NARCON-2025 talk
          </a>
          .
        </p>
        <p className="mt-1.5 text-indigo-800/80 dark:text-indigo-300/80">
          It assumes a chute protector / recovery blanket and does not model a piston (a piston
          needs less powder). Its sea-level altitude envelope is checked below.
        </p>
      </div>

      {/* Inputs */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <NumberField
            label="Inner diameter"
            value={input.diameter}
            onChange={(diameter) => onChange({ diameter })}
            unit={lu}
            step={lu === "mm" ? 1 : 0.1}
            hint="Body-tube ID — the bore the gas pressurizes."
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {ID_PRESETS[lu].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ diameter: v })}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 transition hover:border-indigo-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {v} {lu}
              </button>
            ))}
          </div>
        </div>
        <NumberField
          label="Compartment length"
          value={input.length}
          onChange={(length) => onChange({ length })}
          unit={lu}
          step={lu === "mm" ? 5 : 0.5}
          hint="Length of the parachute section the charge pressurizes."
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Select<FetterInput["screw"]>
            label="Shear screw"
            value={input.screw}
            onChange={(screw) => onChange({ screw })}
            options={SCREW_OPTIONS}
            hint={`Shear force follows from the nylon shear strength and the screw's minor diameter${
              input.pinCount === 0 ? " (ignored — no screws)" : ""
            }.`}
          />
        </div>
        <NumberField
          label="Number of screws"
          value={input.pinCount}
          onChange={(pinCount) => onChange({ pinCount })}
          unit="screws"
          step={1}
          hint="Across the joint. Set to 0 for a friction-only deployment."
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <NumberField
            label="Parachute packing factor"
            value={input.packing}
            // Clamp to the physical range [0,1] on entry, so a stray "3" can't render as
            // "3.00 packing" in the report while the absorption term quietly clamps to 1.
            onChange={(packing) => onChange({ packing: Math.min(1, Math.max(0, packing)) })}
            unit="0–1"
            step={0.05}
            min={0}
            hint="Fraction of the tube the chute + protector + shock cord fill. More packing absorbs more energy, so it needs more powder."
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {PACKING_PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ packing: v })}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 transition hover:border-indigo-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {v === 1 ? "Full" : v}
              </button>
            ))}
          </div>
        </div>
        <NumberField
          label="Nosecone friction"
          value={input.friction}
          onChange={(friction) => onChange({ friction })}
          unit={fu}
          step={1}
          placeholder="0"
          hint="Nose/coupler friction beyond the screws, if you account for it."
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          label="Safety factor"
          value={round(input.safety * 100, 0)}
          onChange={(pct) => onChange({ safety: Math.max(0, pct) / 100 })}
          unit="%"
          step={5}
          min={0}
          hint="The model's own margin for an energetic deployment — Fetter's testing settled on 40%. This is built in; no separate multiplier is applied."
        />
      </div>

      {/* The altitude is not a sizing input — it never enters the math (the model is fixed at
          sea level). It's the model's validity gate: above the limit the model is withheld
          entirely. Setting it apart as an envelope check, rather than a knob among the inputs,
          keeps it from reading like something that changes the charge. */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Model envelope
          </span>
          <span
            className={
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
              (inEnvelope
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400")
            }
          >
            {inEnvelope ? "✓ within envelope" : "✗ out of envelope"}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Sea-level model, valid below ~{fmt(FETTER_ALT_LIMIT_FT / 1000, 0)}k ft. This is a
          validity check, not a sizing input — it doesn&apos;t change the charge; above the limit
          the model is withheld entirely.
        </p>
        <div className="mt-3 max-w-[13rem]">
          <NumberField
            label="Deployment altitude"
            value={input.deployAlt}
            onChange={(deployAlt) => onChange({ deployAlt })}
            unit="ft"
            step={1000}
            min={0}
            placeholder="0"
            hint="Where the charge fires — a drogue at apogee, a main down low. Leave at sea level (0) unless you deploy high."
          />
        </div>
      </div>

      {/* Diameter sanity — a likely unit or outside-diameter mix-up, flagged like the ideal-gas
          wells. Shown regardless of the envelope, since it's about the input, not the charge. */}
      {dimCautions.length > 0 && (
        <div role="alert" className="mt-3 space-y-1.5">
          {dimCautions.map((c) => (
            <p
              key={c.id}
              className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400"
            >
              <span aria-hidden className="mt-px shrink-0">⚠</span>
              <span>{c.message}</span>
            </p>
          ))}
        </div>
      )}

      {/* Result — or, outside the envelope, a redirect instead of a number. */}
      {!inEnvelope ? (
        <div
          role="alert"
          className="mt-5 flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-900 dark:text-amber-200"
        >
          <p>
            <strong className="font-semibold">Outside the Fetter model&apos;s envelope.</strong>{" "}
            At {fmt(input.deployAlt, 0)} ft the model no longer applies — black powder stops
            burning completely as the air thins, and the model assumes sea level.
          </p>
          <p>
            Size this deployment with the{" "}
            <a href="#calculator" className="font-medium underline underline-offset-2">
              target-pressure or separation-force modes
            </a>{" "}
            instead, add a longer charge canister for the thin air, and — as always —
            ground-test in full flight configuration before you fly.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <div aria-live="polite" className="flex items-baseline gap-2">
              <span
                data-testid="fetter-mass"
                className="font-mono text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50"
              >
                {fmtMass(mass)}
              </span>
              <span className="text-lg text-zinc-500 dark:text-zinc-400">g</span>
              {mass > 0 && (
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  · {fmt(grains, 1)} gr
                </span>
              )}
              <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                Fetter model
              </span>
            </div>

            {/* Traditional vs Fetter, with the ratio — the whole reason the mode exists. */}
            {mass > 0 && result.traditionalMass > 0 && (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-indigo-200/70 pt-3 text-sm dark:border-indigo-500/20">
                <span className="text-zinc-600 dark:text-zinc-300">
                  Traditional ideal-gas, same pressure:
                </span>
                <span
                  data-testid="fetter-traditional"
                  className="font-mono font-semibold tabular-nums text-zinc-700 dark:text-zinc-200"
                >
                  {fmtMass(result.traditionalMass)} g
                </span>
                <span
                  data-testid="fetter-ratio"
                  className="ml-auto rounded-full border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-indigo-800 dark:text-indigo-200"
                >
                  Fetter is {fmt(result.ratio, 2)}×
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Chip
                label="Volume"
                value={`${fmt(result.volumeIn3, 1)} in³ · ${fmt(in3ToCc(result.volumeIn3), 0)} cc`}
              />
              <Chip
                label="Pressure"
                value={`${fmt(fromPsi(result.pressurePsi, pu), 1)} ${pu}`}
              />
              <Chip label="Force" value={`${fmt(fromLbf(result.forceLbf, fu), 0)} ${fu}`} />
              <Chip label="Chute absorption" value={`${fmt(result.absorption * 100, 0)}%`} />
            </div>
          </div>

          {/* Point-of-output safety: this is a starting recommendation, never a verdict. */}
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            A <strong className="font-medium text-zinc-700 dark:text-zinc-300">starting recommendation</strong>,
            with the model&apos;s margin already included — not a number to fly unverified.{" "}
            <a href="#ground-test" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Ground-test with the chute, recovery blanket, and shock cord in flight configuration ↓
            </a>
          </p>

          {mass > 0 && mass < FETTER_MIN_TYPICAL_G && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400"
            >
              <span aria-hidden className="mt-px shrink-0">⚠</span>
              <span>
                {fmtMass(mass)} g is a very small charge — an 18 mm motor&apos;s own ejection charge
                is roughly 0.5 g, so packing less than that is often too little to light reliably.
              </span>
            </p>
          )}
          {mass > LARGE_CHARGE_G && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400"
            >
              <span aria-hidden className="mt-px shrink-0">⚠</span>
              <span>
                {fmt(mass, 1)} g is a large ejection charge — double-check the diameter, length,
                screws, and units.
              </span>
            </p>
          )}

          {mass > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Ground-test plan
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Bench-test around the estimate until separation is clean and energetic. Tap a step
                to start a log entry below.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { label: "Low −20%", grams: round(mass * 0.8, 2) },
                  { label: "Estimate", grams: round(mass, 2) },
                  { label: "High +20%", grams: round(mass * 1.2, 2) },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => onPlanCharge?.(s.grams, mass)}
                    title={`Log a ${s.grams} g test`}
                    className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-left transition hover:border-indigo-400 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-500/60"
                  >
                    <span className="block text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                      {s.label}
                    </span>
                    <span className="block font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                      {fmtMass(s.grams)} g
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
