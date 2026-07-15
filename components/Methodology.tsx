"use client";

import {
  IN3_PER_FT3,
  LBM_TO_G,
  PSI_TO_PSF,
  R_BP,
  T_BP,
  type WellResult,
} from "@/lib/charge";
import { FETTER, FETTER_LINKS, withinAltitudeEnvelope, type FetterResult } from "@/lib/fetter";
import { fmt, fmtMass } from "@/lib/format";
import type { FetterInput, State } from "@/lib/state";
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
  well,
  wellLabel,
  fetter,
  fetterInput,
  fetterLabel,
}: {
  state: State;
  /** The well the worked example walks through — the first one that actually carries a charge,
   *  so a dual setup with an empty drogue but a filled main doesn't print an all-zero derivation
   *  for a well that isn't even in the report. Matches the report's example selection. */
  well: { result: WellResult; requiredForceLbf: number };
  /** That well's name for the disclosure heading ("drogue" / "main" / "ejection"). */
  wellLabel: string;
  /** The Fetter compartment the methodology walks through (a real, in-envelope one when
   *  possible), its inputs, and — in dual deploy — its name ("Drogue/Main compartment"). */
  fetter: FetterResult;
  fetterInput: FetterInput;
  fetterLabel: string;
}) {
  if (state.mode === "fetter")
    return (
      <FetterMethodology state={state} fetter={fetter} input={fetterInput} label={fetterLabel} />
    );
  const r = well.result;
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

      <Disclosure summary={`Worked example — your ${wellLabel} well`}>
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
                (from {fmt(well.requiredForceLbf, 1)} lbf over{" "}
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
            {fmt(massLbm, 6)} × {LBM_TO_G} = <strong>{fmtMass(r.mass)} g</strong>
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
          the model predicts.
        </p>
        <p>
          One loss it leaves out entirely matters most for a parachute: the chute protector
          and packed recovery gear soak up a large share of the combustion energy before it
          can build pressure. That&apos;s the dominant real-world shortfall — it&apos;s why a
          packed deployment can need several times this number, and why the{" "}
          <a href="#calculator" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            Fetter mode
          </a>{" "}
          sizes higher. So treat this figure as a floor to test <em>up</em> from, not a
          conservative ceiling.
        </p>
        <p>
          It also doesn&apos;t know your particular powder, granulation, ignition, wadding,
          or how free your airframe really is to slide. Shear-pin forces vary by screw,
          supplier, and fit; friction is a guess until you feel it.
        </p>
        <p className="font-medium text-zinc-700 dark:text-zinc-300">
          So ground-test before you fly. Build the charge and fire it{" "}
          <strong>remotely — from behind cover, with the airframe restrained and pointed
          somewhere safe, wearing eye protection, and everyone clear</strong>: it&apos;s a
          live pyrotechnic charge. Confirm it cleanly separates the airframe and throws the
          recovery gear, then adjust from what you observe — the tested charge is the real
          answer, and the log below is where to keep it.
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

/** The "Where the numbers come from" panel for the Fetter model — the same transparency the
 *  ideal-gas modes get: the mechanism, every constant, a worked comparison, and the credit. */
function FetterMethodology({
  state,
  fetter,
  input,
  label,
}: {
  state: State;
  fetter: FetterResult;
  input: FetterInput;
  label: string;
}) {
  const f = input;
  // Outside the envelope the compartment card withholds the charge; the worked comparison below
  // must not print it either, or a confused user scrolls here and finds the number anyway. The
  // example is the same compartment the card sizes, so in dual deploy this tracks whichever bay
  // is in envelope rather than always the drogue.
  const outOfEnvelope = !withinAltitudeEnvelope(f.deployAlt);
  return (
    <section id="methodology" className="mt-10 scroll-mt-8">
      <h2 className="text-lg font-semibold tracking-tight">Where the numbers come from</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        This mode uses Tom Fetter&apos;s deployment model rather than the ideal-gas method. The
        model, its constants, and a worked comparison are all shown below so the number is never
        a black box — and, as always, the ground test is the real answer.
      </p>

      <Disclosure summary="The model, and why it needs more powder" defaultOpen>
        <p>
          The traditional ideal-gas method sizes powder from a target pressure and volume alone.
          Fetter&apos;s pressure-chamber and deployment-fixture testing showed that under-predicts
          the powder a parachute actually needs — often by 1–4× — because a Nomex chute protector
          or recovery blanket <em>absorbs</em> much of the combustion energy before it can
          pressurize the tube.
        </p>
        <p>
          So instead of pressure alone, the model solves an energy and pressure balance: the
          combustion energy of the powder, minus the fraction the protector absorbs, heats the air
          already in the compartment and the combustion gas, and builds the pressure needed to
          shear the pins (plus friction) with an energetic margin. The absorbed fraction grows with
          how full the tube is packed:
        </p>
        <p className="rounded-md bg-white px-3 py-2 font-mono text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          A_H = 0.951 · (1 − e^(−4.491 · Pf))
        </p>
        <p>
          where <span className="font-mono">Pf</span> is the packing factor (0 empty, 1 full). At
          your {fmt(f.packing, 2)} it absorbs {fmt(fetter.absorption * 100, 0)}% — the high-absorption
          curve is used throughout, the conservative choice, so the model doesn&apos;t under-size.
        </p>
        {fetter.ratio > 0 && fetter.ratio < 1 && (
          <p>
            The 1–4× figure is for a packed chute — the usual case. At your low packing the
            protector absorbs little, so the model here sizes <em>below</em> the traditional
            number ({fmt(fetter.ratio, 2)}×), not above it. That&apos;s expected for a sparse
            tube, and both numbers are shown so you can see it — but a real recovery bay is
            rarely this empty, so double-check the packing factor, and ground-test regardless.
          </p>
        )}
      </Disclosure>

      <Disclosure summary="The constants">
        <p>
          Every value the model uses, in the paper&apos;s USCS-native unit system, verified against
          the paper. The powder mass is the positive root of the resulting quadratic.
        </p>
        <dl className="space-y-2">
          <Row term="M_gas">Molar mass of the combustion gas, {FETTER.MBPcpgas} lb/mol.</Row>
          <Row term="M_air">Molar mass of air, {FETTER.Mair} lb/mol.</Row>
          <Row term="M_BP">Molar mass of black powder, {FETTER.MBP} lb/mol.</Row>
          <Row term={`Ru = ${FETTER.Ru}`}>
            Universal gas constant, (lb·ft²)/(s²·K·mol) — 8.314 J/(mol·K) in native units.
          </Row>
          <Row term={`cv_gas = ${FETTER.cvBPcp}`}>
            Specific heat of the combustion products, ft²/(s²·K).
          </Row>
          <Row term={`cv_air = ${FETTER.cvair}`}>Specific heat of air, ft²/(s²·K).</Row>
          <Row term="ΔH_BP">Delta enthalpy of black powder, {FETTER.deltaHBP} (lb·ft²)/(s²·mol).</Row>
          <Row term={`T_amb = ${FETTER.Tamb}`}>Ambient temperature (70 °F), K.</Row>
          <Row term={`P_atm = ${FETTER.Patm}`}>Sea-level ambient pressure (14.7 psi), lb/(ft·s²).</Row>
          <Row term="Nylon SS">Shear strength, {FETTER.nylonShearMinPsi} psi (min) — the shear force follows from this and the screw&apos;s minor diameter.</Row>
        </dl>
      </Disclosure>

      <Disclosure summary={`Worked comparison — ${label || "your compartment"}`}>
        {outOfEnvelope ? (
          <p>
            This deployment is outside the model&apos;s envelope (a sea-level model, not for
            deployment near or above 20,000 ft), so no charge is sized here. Size it with the
            target-pressure or separation-force modes, and ground-test in flight configuration.
          </p>
        ) : (
          <>
            <p>The current inputs, run through both models at the same required pressure:</p>
            <dl className="space-y-2">
              <Row term="Volume">
                {fmt(fetter.volumeIn3, 2)} in³
              </Row>
              <Row term="Absorption">
                {fmt(f.packing, 2)} packing → A_H = {fmt(fetter.absorption, 3)} ({fmt(fetter.absorption * 100, 0)}%)
              </Row>
              <Row term="Pressure">
                {fmt(fetter.pressurePsi, 2)} psi to shear the screws (+{fmt(f.safety * 100, 0)}% safety)
              </Row>
              <Row term="Traditional">
                ideal-gas at that pressure = {fmtMass(fetter.traditionalMass)} g
              </Row>
              <Row term="Fetter">
                <strong>{fmtMass(fetter.mass)} g</strong>
                {fetter.ratio > 0 && <> — {fmt(fetter.ratio, 2)}× the traditional charge</>}
              </Row>
            </dl>
            <p>
              Both numbers are shown side by side so you can see which model produced which, and
              why they differ: the gap is the powder the traditional model omits for the protector.
            </p>
          </>
        )}
      </Disclosure>

      <Disclosure summary="Why there's no extra safety margin">
        <p>
          The two ideal-gas modes carry a separate safety-margin multiplier. This one does not, on
          purpose. Fetter&apos;s{" "}
          <span className="font-mono">{fmt(f.safety * 100, 0)}%</span> safety factor <em>is</em> the
          model&apos;s margin — the extra powder his testing found was needed to go from just
          shearing the pins to an energetic deployment. Stacking Charge&apos;s own margin on top of
          a model that already runs 1–4× hot would double-count it, and an over-sized charge can
          tear an airframe apart as surely as an under-sized one fails to open it.
        </p>
        <p className="font-medium text-zinc-700 dark:text-zinc-300">
          So the number you see already includes the margin. Raise the safety factor if a large,
          heavy nosecone deploys sluggishly; otherwise leave it — and let the ground test set the
          final charge.
        </p>
      </Disclosure>

      {state.redundant && (
        <Disclosure summary="Redundant altimeters and the backup charge">
          <p>
            With two altimeters, each fires its own charge into the bay, and the backup is sized a
            little larger — the same +20% (or at least +0.5 g) convention the ideal-gas modes use.
            The reason isn&apos;t that the model needs more powder; it&apos;s redundancy: if the
            primary fires but doesn&apos;t free the airframe — a joint that bound, a charge a touch
            light — the backup has to break a section the first charge already strained against.
          </p>
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            So the backup is a separate charge for a separate altimeter, not extra margin stacked on
            the Fetter number. Ground-test both — each has to separate the airframe on its own.
          </p>
        </Disclosure>
      )}

      <Disclosure summary="Envelope & assumptions">
        <p>The model is fit to a specific set of conditions. Outside them, use the ideal-gas modes and a ground test:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>It <strong>assumes a chute protector / recovery blanket</strong> — that absorption is the whole point of the model.</li>
          <li>It <strong>does not model a piston.</strong> A piston generally needs less powder, so this over-estimates for one.</li>
          <li>It is a <strong>sea-level model</strong> and is not intended for high-altitude deployment (~20,000 ft and up), where black powder stops burning completely.</li>
        </ul>
      </Disclosure>

      <Disclosure summary="Credit & references">
        <p>
          The model is Tom Fetter&apos;s (NAR 15551). The math here is a clean-room reimplementation
          of his published equations that reproduces the paper&apos;s deployment-test results; his
          spreadsheet, prose, and layout are not copied.
        </p>
        <dl className="space-y-3">
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">The paper</dt>
            <dd>
              &ldquo;Using Black Powder for Parachute Deployment&rdquo; (Rev 1.2, prepared for
              NARCON-2025) —{" "}
              <a
                href={FETTER_LINKS.paper}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                read it on speedmotionrockets.com
              </a>
              .
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">The talk</dt>
            <dd>
              His{" "}
              <a
                href={FETTER_LINKS.video}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                NARCON-2025 presentation
              </a>{" "}
              on the @SpeedmotionRockets channel.
            </dd>
          </div>
        </dl>
        <p>
          The number is a starting recommendation, never a verdict. Ground-test in full flight
          configuration — chute, recovery blanket, and shock cord — and fly what you prove.
        </p>
      </Disclosure>
    </section>
  );
}
