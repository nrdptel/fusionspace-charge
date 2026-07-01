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
import { Disclosure } from "./ui";

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 sm:grid-cols-[9rem_1fr]">
      <dt className="font-mono text-zinc-700 dark:text-zinc-300">{term}</dt>
      <dd className="text-zinc-600 dark:text-zinc-400">{children}</dd>
    </div>
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
  const margin = Math.max(1, state.margin);
  const volumeFt3 = r.volume / IN3_PER_FT3;
  const pressurePsf = r.pressure * PSI_TO_PSF;
  const massLbm = r.mass / LBM_TO_G;

  return (
    <section id="methodology" className="mt-10 scroll-mt-8">
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
          <Row term={`·${LBM_TO_G}`}>
            pounds-mass → grams, the unit you actually weigh on a scale.
          </Row>
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
            {state.mode === "pressure" && margin > 1 && (
              <>
                {" "}
                (your {fmt(r.pressure / margin, 2)} psi target × {fmt(margin, 2)} safety
                margin)
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
          The honest levers are the ones already here, and they only add margin: the safety
          margin (it sizes the charge above your target pressure, or above the bare
          separation force), rounding up rather than down, and letting the ground test set
          the final number.
        </p>
      </Disclosure>

      <Disclosure summary="Redundant altimeters and the backup charge">
        <p>
          Most high-power flyers run two altimeters — a primary and a backup — each wired
          to its own ejection charge and its own e-match. The two fire independently: the
          backup is set to go a moment after the primary (apogee plus a short delay on the
          drogue, a lower altitude on the main), so if the primary altimeter, battery, or
          match fails, the backup still gets the airframe open.
        </p>
        <p>
          The backup charge is sized a little <em>larger</em> than the primary, not equal
          to it. The reason is the failure it&apos;s there for: if the primary already fired
          but didn&apos;t separate the airframe — a charge that was a touch light, a tight
          joint, shear pins that bound — the backup has to break free a section the first
          charge may have strained against. The widely-used convention, including NASA&apos;s
          Student Launch handbook, is to make the backup about <strong>20% larger</strong>{" "}
          (or at least ~0.5 g more, whichever is greater). Some flyers go larger; that&apos;s
          the dial in the controls above.
        </p>
        <p className="font-medium text-zinc-700 dark:text-zinc-300">
          Both charges still get ground-tested. The primary has to separate the airframe on
          its own, and so does the backup — fire each one on the bench and confirm a clean,
          energetic separation before you fly. Redundancy is a second chance, not a reason
          to skip the test.
        </p>
      </Disclosure>

      <Disclosure summary="References & sources">
        <p>
          Every value here comes from the high-power community&apos;s established references,
          not from anything invented for this tool. The primary ones:
        </p>
        <dl className="space-y-3">
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">
              The ideal-gas method, R and T
            </dt>
            <dd>
              The <span className="font-mono">m = (P·V)/(R·T)</span> method and the constants
              ({R_BP} ft·lbf/(lbm·°R), {T_BP} °R) are the values used across HPR ejection
              references — Ted Apke&apos;s ejection-charge method (ROL INFOcentral), and
              guides like HARA&apos;s{" "}
              <a
                href="http://hararocketry.org/hara/resources/how-to-size-ejection-charge/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                How to size ejection charges
              </a>
              .
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">
              Backup charge (+20% or 0.5 g)
            </dt>
            <dd>
              The &ldquo;20% larger, or at least 0.5 g, whichever is greater&rdquo; backup
              convention follows NASA&apos;s Student Launch handbook and common club practice.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">
              Altimeter vent ports
            </dt>
            <dd>
              The one-¼″-port-per-100-in³ rule (and its area form) comes from widely-used
              guidance such as{" "}
              <a
                href="https://www.vernk.com/AltimeterPortSizing.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                Vern Knowles&apos; port-sizing write-up
              </a>{" "}
              and the broader community. Your altimeter&apos;s own manual takes precedence.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Shear-pin forces</dt>
            <dd>
              The nylon-screw presets are widely-cited single-shear approximations that vary
              by supplier and fit — starting points to verify, not authority.
            </dd>
          </div>
        </dl>
        <p>
          These are references, not guarantees. The method is a model; the ground test is the
          measurement. Where a source and your own bench disagree, the bench wins.
        </p>
      </Disclosure>
    </section>
  );
}
