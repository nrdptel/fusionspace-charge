"use client";

import {
  IN3_PER_FT3,
  LBM_TO_G,
  PSI_TO_PSF,
  R_BP,
  T_BP,
  type WellResult,
} from "@/lib/charge";
import { fmt } from "@/lib/format";
import type { State } from "@/lib/state";

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 sm:grid-cols-[9rem_1fr]">
      <dt className="font-mono text-zinc-700 dark:text-zinc-300">{term}</dt>
      <dd className="text-zinc-600 dark:text-zinc-400">{children}</dd>
    </div>
  );
}

function Disclosure({
  summary,
  defaultOpen = false,
  children,
}: {
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50"
    >
      <summary className="cursor-pointer select-none font-medium text-zinc-700 dark:text-zinc-300">
        {summary}
      </summary>
      <div className="mt-3 space-y-4 text-zinc-600 dark:text-zinc-400">{children}</div>
    </details>
  );
}

export default function Methodology({
  state,
  drogue,
}: {
  state: State;
  drogue: { result: WellResult; requiredForceLbf: number };
}) {
  const r = drogue.result;
  const volumeFt3 = r.volume / IN3_PER_FT3;
  const pressurePsf = r.pressure * PSI_TO_PSF;
  const massLbm = r.mass / LBM_TO_G;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">
        Where the numbers come from
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Nothing here is fudged or hand-tuned. Every result is the standard ideal-gas
        ejection-charge calculation, computed from the inputs above with published
        constants — all shown below so you can check the arithmetic yourself.
      </p>

      <Disclosure summary="The formula and constants" defaultOpen>
        <p>
          Black powder is sized so its combustion gas reaches a target pressure inside the
          pressurized volume, using the ideal-gas relation rearranged for mass:
        </p>
        <p className="rounded-md bg-white px-3 py-2 font-mono text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          m = (P · V) / (R · T)
        </p>
        <dl className="space-y-2">
          <Row term="P">
            Target pressure inside the section. Either entered directly, or derived from
            the separation force as P = F / A over the bore area A = π/4 · ID².
          </Row>
          <Row term="V">Pressurized volume, V = π/4 · ID² · length.</Row>
          <Row term={`R = ${R_BP}`}>
            Specific gas constant of black-powder combustion gas,{" "}
            {R_BP} ft·lbf/(lbm·°R) — the value used across HPR references.
          </Row>
          <Row term={`T = ${T_BP}`}>
            Combustion (flame) temperature, {T_BP} °R (≈ 1837 K).
          </Row>
          <Row term="·144">psi → lbf/ft², so pressure and volume share units.</Row>
          <Row term="·453.6">pounds-mass → grams, the unit you actually weigh on a scale.</Row>
        </dl>
      </Disclosure>

      <Disclosure summary={`Worked example — your ${state.deploy === "dual" ? "drogue" : "ejection"} well`}>
        <p>
          The same arithmetic the calculator just ran, with your current inputs (canonical
          units shown):
        </p>
        <dl className="space-y-2">
          <Row term="Volume">
            {fmt(r.volume, 2)} in³ = {fmt(volumeFt3, 5)} ft³
          </Row>
          <Row term="Pressure">
            {fmt(r.pressure, 2)} psi × 144 = {fmt(pressurePsf, 1)} lbf/ft²
            {state.mode === "force" && (
              <>
                {" "}
                (from {fmt(drogue.requiredForceLbf, 1)} lbf over{" "}
                {fmt(r.area, 2)} in²)
              </>
            )}
          </Row>
          <Row term="Mass">
            ({fmt(pressurePsf, 1)} × {fmt(volumeFt3, 5)}) / ({R_BP} × {T_BP}) ={" "}
            {fmt(massLbm, 6)} lbm
          </Row>
          <Row term="In grams">
            {fmt(massLbm, 6)} × {LBM_TO_G} = <strong>{fmt(r.mass, 2)} g</strong>
          </Row>
        </dl>
      </Disclosure>

      <Disclosure summary="Assumptions, and why this is only a starting point">
        <p>
          The ideal-gas method is a model, and a generous one. It assumes black powder
          burns completely and instantly, that all the heat goes into the gas (no loss to
          the bulkheads, wadding, or airframe walls), and that nothing leaks past the
          bulkhead, the shear path, or vent holes. Real wells violate every one of those:
          they lose heat and vent gas, so the pressure actually reached can be lower than
          the model predicts — meaning a real charge sometimes needs to be a little larger
          than this number, not smaller.
        </p>
        <p>
          It also doesn&apos;t know your particular powder, granulation, ignition, wadding,
          or how free your airframe really is to slide. Shear-pin forces vary by screw,
          supplier, and fit; friction is a guess until you feel it.
        </p>
        <p className="font-medium text-zinc-700 dark:text-zinc-300">
          So treat the result as a conservative place to begin, then ground-test: build the
          charge, fire it on the bench, and confirm it cleanly separates the airframe and
          throws the recovery gear before you ever fly it. Adjust from what you observe —
          the tested charge is the real answer, and the log below is where to keep it.
        </p>
      </Disclosure>

      <Disclosure summary="Why there's no efficiency factor">
        <p>
          A fair question, since the method is a simplification: shouldn&apos;t there be an
          efficiency or &ldquo;derating&rdquo; knob? Deliberately, no.
        </p>
        <p>
          The constants already carry the real chemistry. R and T here come from black
          powder&apos;s own combustion, not from an idealized pure gas — they&apos;re the
          values the high-power community uses for exactly this calculation. A separate
          efficiency multiplier on top would double-count and imply a precision the model
          doesn&apos;t have.
        </p>
        <p>
          And the real-world error runs one way. Heat lost to the bulkheads and airframe,
          gas that leaks past seals and vent holes, and powder that doesn&apos;t fully burn
          all push the same direction: real wells often need a little <em>more</em> than the
          formula says, not less — and black powder gets less efficient at high altitude. So
          the only thing a &ldquo;derate&rdquo; dial would invite is the one dangerous move,
          trimming the charge down until it doesn&apos;t separate.
        </p>
        <p className="font-medium text-zinc-700 dark:text-zinc-300">
          The honest levers are the ones already here, and they only add margin: pick your
          target pressure (or a safety factor on the separation force), round up rather than
          down, and let the ground test set the final number.
        </p>
      </Disclosure>
    </section>
  );
}
