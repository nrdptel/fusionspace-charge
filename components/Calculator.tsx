"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_STATE,
  SHEAR_PIN_PRESETS,
  decodeState,
  encodeState,
  normalizeState,
  type Deploy,
  type FetterInput,
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
import {
  sizeByForce,
  sizeByPressure,
  IN3_PER_FT3,
  LBM_TO_G,
  PSI_TO_PSF,
  R_BP,
  T_BP,
  type WellResult,
} from "@/lib/charge";
import {
  fetterCharge,
  screwMinorIn,
  withinAltitudeEnvelope,
  FETTER_LINKS,
  type FetterResult,
} from "@/lib/fetter";
import { wellCautions } from "@/lib/checks";
import { calibrationFromEntries, type TestEntry } from "@/lib/testlog";
import { buildReportHtml, type ReportData } from "@/lib/report";
import { buildCardHtml, type PrintPlan } from "@/lib/card";
import { fmt, fmtMass, round } from "@/lib/format";
import { Chip, NumberField, Segmented } from "./ui";
import FetterCard from "./FetterCard";
import Methodology from "./Methodology";
import SavedRockets from "./SavedRockets";
import MeasureGuide from "./MeasureGuide";
import DeploySequence from "./DeploySequence";
import BenchMode, { type BenchWell } from "./BenchMode";

// Client-only export helpers. "HTML" downloads the self-contained document; "PDF" renders
// it in a hidden, same-origin iframe and invokes the browser's print → Save as PDF (no
// popup, no dependency, prints just the document rather than the whole app).
function downloadHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printHtml(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
  });
  document.body.appendChild(iframe);
  const cw = iframe.contentWindow;
  if (!cw) {
    iframe.remove();
    return;
  }
  cw.document.open();
  cw.document.write(html);
  cw.document.close();
  // Let inline styles apply, then print; the doc is dependency-free so a short tick is enough.
  window.setTimeout(() => {
    cw.focus();
    cw.print();
    window.setTimeout(() => iframe.remove(), 1000);
  }, 250);
}

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "plan";

const todayISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const EXPORT_BTN =
  "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

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

// A backup altimeter's charge is sized above the primary so it can still separate an
// airframe the primary already strained against but didn't free. The convention (widely
// cited via NASA's Student Launch handbook) is the larger of +20% or +0.5 g — the absolute
// floor is what matters for small charges, where 20% is only a fraction of a gram. The
// percentage never goes below 0%; a backup smaller than the primary defeats the point.
const BACKUP_MIN_G = 0.5;
const backupPctClamped = (backupPct: number): number =>
  Math.max(0, Number.isFinite(backupPct) ? backupPct : 0);
const backupMass = (primaryMass: number, backupPct: number): number => {
  if (!(primaryMass > 0)) return 0;
  const byPercent = primaryMass * (1 + backupPctClamped(backupPct) / 100);
  return Math.max(byPercent, primaryMass + BACKUP_MIN_G);
};
// Whether the +0.5 g floor (not the percentage) is what sets the backup, so the label can
// name the rule that actually applies instead of quoting a percentage that doesn't.
const backupFloorBinds = (primaryMass: number, backupPct: number): boolean =>
  primaryMass > 0 &&
  primaryMass + BACKUP_MIN_G > primaryMass * (1 + backupPctClamped(backupPct) / 100);

// Common nominal HPR airframe inner diameters, per unit, as quick-set chips (paired so a
// unit switch lands on the matching size: 1.5"≈38 mm, 2.1"≈54, 3"≈75, 3.9"≈98, 6"≈152).
// These are starting points — actual tube ID varies by brand, so the field still rules.
const ID_PRESETS: Record<LengthUnit, number[]> = {
  in: [1.5, 2.1, 3, 3.9, 6],
  mm: [38, 54, 75, 98, 152],
};

function computeWell(s: State, w: WellInput): Computed {
  const diameterIn = nn(toInches(w.diameter, s.lengthUnit));
  const lengthIn = nn(toInches(w.length, s.lengthUnit));
  if (s.mode === "pressure") {
    const targetPsi = nn(toPsi(w.pressure, s.pressureUnit));
    // The margin sizes the charge so an *ideal* well would reach target × margin. A real
    // well loses gas and heat, so the extra powder is what lets it still hit your target.
    // The entered target stays your honest design pressure; this only raises the charge.
    const effectivePsi = targetPsi * clampMargin(s.margin);
    return {
      result: sizeByPressure({ diameterIn, lengthIn, pressurePsi: effectivePsi }),
      requiredForceLbf: 0,
    };
  }
  // Pins are discrete: round to a whole count so a live-typed "2.7" sizes the charge for the
  // same number the report prints (fmt(pinCount, 0)) — matching the coercion decodeState does.
  const pinsLbf = Math.round(nn(w.pinCount)) * nn(toLbf(w.pinForce, s.forceUnit));
  const frictionLbf = nn(toLbf(w.friction, s.forceUnit));
  const requiredForceLbf = (pinsLbf + frictionLbf) * clampMargin(s.margin);
  return {
    result: sizeByForce({ diameterIn, lengthIn, forceLbf: requiredForceLbf }),
    requiredForceLbf,
  };
}

// Size the Fetter compartment, converting the entered values to the model's canonical units
// (inches, lbf). The Fetter safety factor is the model's own margin, so — unlike computeWell —
// no `state.margin` multiplier is applied here; layering one on a model that already runs 1–4×
// hot is exactly the double-count the mode must avoid.
function computeFetter(s: State, f: FetterInput): FetterResult {
  return fetterCharge({
    diameterIn: nn(toInches(f.diameter, s.lengthUnit)),
    lengthIn: nn(toInches(f.length, s.lengthUnit)),
    screwMinorIn: screwMinorIn(f.screw),
    pinCount: f.pinCount,
    frictionLbf: nn(toLbf(f.friction, s.forceUnit)),
    packing: f.packing,
    safety: f.safety,
  });
}

export default function Calculator({
  onActiveRocketChange,
  onPlanCharge,
  testedSummary,
  airframeName,
  airframeTests,
  children,
}: {
  onActiveRocketChange?: (name: string) => void;
  onPlanCharge?: (grams: number, estimate: number) => void;
  /** The active airframe's proven charge, if it has clean ground tests logged. */
  testedSummary?: {
    name: string;
    cleanCount: number;
    lastClean?: TestEntry;
    /** Drift baseline: the estimate the most-recent estimate-carrying clean was planned from. */
    driftEstimate?: number;
    validated?: { charge: number; count: number };
    /** A recent no-separation/partial at or above the proven charge — that charge shouldn't be
     *  trusted until re-tested, so the "proven" assertions are gated and a warning is shown. */
    retest?: { charge: number; outcome: "none" | "partial" } | null;
  } | null;
  /** The active saved rocket's name, used to title the printable card and report. */
  airframeName?: string;
  /** The active airframe's logged tests, included in the downloadable recovery report. */
  airframeTests?: TestEntry[];
  /** The ground-test log, rendered between the sized charge and the field/export panel so
   *  the page reads in loop order: size → ground-test → take it to the field. */
  children?: React.ReactNode;
}) {
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [planCopied, setPlanCopied] = useState(false);
  const [benchOpen, setBenchOpen] = useState(false);
  // Spoken to assistive tech when a bench-mode step queues a charge into the log below —
  // otherwise closing the dialog just returns focus to the trigger with no sign anything happened.
  const [benchAnnounce, setBenchAnnounce] = useState("");
  // The inline ground-test ladder pre-fills a field far down the page and scrolls to it — silent
  // to a screen reader (focus doesn't move, the scroll isn't announced). Mirror Bench mode's
  // confirmation through the shared status region so a non-sighted user knows it worked.
  const planCharge = (grams: number, estimate: number) => {
    onPlanCharge?.(grams, estimate);
    setBenchAnnounce(`Queued ${fmtMass(grams)} g in the ground-test log below.`);
    setTimeout(() => setBenchAnnounce(""), 3000);
  };
  // Native share sheet, where the browser supports it (mostly mobile). Detected after mount
  // so the buttons only appear when usable; otherwise the copy/download paths stand in.
  const [canShare, setCanShare] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  // Load state from the URL on mount.
  useEffect(() => {
    setState(decodeState(window.location.search));
    setHydrated(true);
  }, []);

  // Detect native-share support (client-only; navigator is absent during SSR).
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    try {
      const probe = new File(["x"], "x.txt", { type: "text/plain" });
      setCanShareFiles(!!navigator.canShare && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShareFiles(false);
    }
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
      // Both Fetter compartments' diameter and length are lengths too — convert them so a unit
      // switch in Fetter mode (single or dual) leaves the physical geometry (and the charge)
      // unchanged.
      fetter: {
        ...s.fetter,
        diameter: conv(s.fetter.diameter),
        length: conv(s.fetter.length),
      },
      fetterMain: {
        ...s.fetterMain,
        diameter: conv(s.fetterMain.diameter),
        length: conv(s.fetterMain.length),
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
      // Both Fetter compartments' nosecone friction is a force too — convert it so a unit
      // switch in Fetter mode doesn't silently change the friction (and the charge).
      fetter: { ...s.fetter, friction: conv(s.fetter.friction) },
      fetterMain: { ...s.fetterMain, friction: conv(s.fetterMain.friction) },
    }));
  };

  const drogue = useMemo(() => computeWell(state, state.drogue), [state]);
  const main = useMemo(() => computeWell(state, state.main), [state]);
  const fetterDrogueRes = useMemo(() => computeFetter(state, state.fetter), [state]);
  const fetterMainRes = useMemo(() => computeFetter(state, state.fetterMain), [state]);
  const isFetter = state.mode === "fetter";

  // A Fetter result adapted into the same shape the wells use, so the field card, bench view,
  // and recovery report can carry it with the existing plumbing.
  const toComputed = (r: FetterResult): Computed => ({
    result: { area: r.areaIn2, volume: r.volumeIn3, pressure: r.pressurePsi, mass: r.mass },
    requiredForceLbf: r.forceLbf,
  });

  // The Fetter compartments, parallel to `wells`: one in single deploy, drogue + main in dual.
  // Each carries its own input, result, and altitude-envelope check — the drogue fires at
  // apogee (which can exceed the envelope) while the main deploys low.
  type FetterWell = {
    key: "fetter" | "fetterMain";
    title: string;
    sub: string;
    input: FetterInput;
    result: FetterResult;
  };
  const fetterWells: FetterWell[] =
    state.deploy === "dual"
      ? [
          { key: "fetter", title: "Drogue compartment", sub: "Apogee — separates the airframe", input: state.fetter, result: fetterDrogueRes },
          { key: "fetterMain", title: "Main compartment", sub: "Lower — deploys the main", input: state.fetterMain, result: fetterMainRes },
        ]
      : [{ key: "fetter", title: "Parachute compartment", sub: "Chute + recovery blanket", input: state.fetter, result: fetterDrogueRes }];
  const fetterInEnvelope = (w: FetterWell) => withinAltitudeEnvelope(w.input.deployAlt);
  // Every Fetter compartment is out of the altitude envelope — so the whole plan is empty for
  // an envelope reason, not for want of inputs (drives the card/bench/copy empty note).
  const fetterAllOutOfEnvelope = isFetter && fetterWells.every((w) => !fetterInEnvelope(w));
  // The compartment the methodology walks through — a real, in-envelope one where possible, so
  // in dual deploy the worked comparison matches a charge the tool actually sized (not the
  // drogue when only the main is in envelope). Falls back to the first compartment.
  const fetterExample =
    fetterWells.find((w) => w.result.mass > 0 && fetterInEnvelope(w)) ?? fetterWells[0];

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked; the URL bar already holds the shareable link */
    }
  };

  // Push the configured calculation into the OS share sheet (Messages, mail, a club chat).
  const shareLink = async () => {
    try {
      await navigator.share({
        title: "Charge — ejection charge plan",
        text: "My ejection charge plan",
        url: window.location.href,
      });
    } catch {
      /* the user dismissed the sheet, or it's unsupported — no-op */
    }
  };

  // Share a generated document (card or report) as a file, where the browser allows it.
  const shareFile = async (html: string, filename: string) => {
    try {
      const file = new File([html], filename, { type: "text/html" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      }
    } catch {
      /* dismissed or unsupported — no-op */
    }
  };

  const wells: { key: "drogue" | "main"; title: string; sub: string; data: Computed }[] =
    state.deploy === "dual"
      ? [
          { key: "drogue", title: "Drogue well", sub: "Apogee — separates the airframe", data: drogue },
          { key: "main", title: "Main well", sub: "Lower — deploys the main", data: main },
        ]
      : [{ key: "drogue", title: "Ejection charge", sub: "Separates the airframe", data: drogue }];

  // The well the on-screen methodology walks through: the first that carries a real charge, so a
  // dual setup with an empty drogue but a filled main doesn't show an all-zero derivation. Mirrors
  // the recovery report's example selection; falls back to the drogue when nothing is sized.
  const methodWell = wells.find((w) => w.data.result.mass > 0) ?? wells[wells.length - 1];

  // The headline charge, and whether it's a single compartment mapping cleanly to one logged
  // test. Single deploy (either mode) drives the drift guard; dual is left alone.
  const primary = isFetter ? toComputed(fetterDrogueRes) : drogue;
  const singleCompartment = state.deploy === "single";

  // A normalized view of the sized charges the field artifacts consume, so the printable card
  // and bench view work the same in Fetter mode as in the ideal-gas modes. A charge outside its
  // altitude envelope is withheld — the card must not print a number the on-screen guard is
  // suppressing. The backup follows the same +20% / +0.5 g redundant-altimeter convention as the
  // ideal-gas modes: it's a second altimeter's charge, not extra margin on the model.
  const ladder = (mass: number) => [
    { label: "Low −20%", grams: round(mass * 0.8, 2) },
    { label: "Estimate", grams: round(mass, 2) },
    { label: "High +20%", grams: round(mass * 1.2, 2) },
  ];
  const artWells: { title: string; idText: string; lenText: string; mass: number; backup?: number }[] =
    isFetter
      ? fetterWells
          .filter((w) => w.result.mass > 0 && fetterInEnvelope(w))
          .map((w) => ({
            title: w.title,
            idText: `${fmt(w.input.diameter, 3)} ${state.lengthUnit}`,
            lenText: `${fmt(w.input.length, 2)} ${state.lengthUnit}`,
            mass: w.result.mass,
            backup: state.redundant ? backupMass(w.result.mass, state.backupPct) : undefined,
          }))
      : wells
          .filter(({ data }) => data.result.mass > 0)
          .map(({ key, title, data }) => ({
            title,
            idText: `${fmt(state[key].diameter, 3)} ${state.lengthUnit}`,
            lenText: `${fmt(state[key].length, 2)} ${state.lengthUnit}`,
            mass: data.result.mass,
            backup: state.redundant ? backupMass(data.result.mass, state.backupPct) : undefined,
          }));

  // Setup-drift guard: a proven/validated charge is only proven for the geometry it was
  // tested at. The clean test recorded the model estimate it was planned from; if the
  // current configuration would now size very differently, the airframe likely changed —
  // so the "proven" charge shouldn't be trusted until re-tested. Single-compartment only,
  // where the one charge maps unambiguously to the logged test; dual is left alone.
  // Drift baseline: the most-recent estimate-carrying clean, not strictly the last clean — a
  // hand-logged (estimate-less) most-recent clean otherwise silently disables drift protection.
  const driftFrom =
    singleCompartment ? testedSummary?.driftEstimate : undefined;
  // In Fetter mode a charge outside the altitude envelope is withheld on screen, so the drift
  // guard mustn't compare against that suppressed number (it would warn off a value the card
  // isn't even showing).
  const primaryWithheld = isFetter && !withinAltitudeEnvelope(state.fetter.deployAlt);
  const drift =
    driftFrom && driftFrom > 0 && primary.result.mass > 0 && !primaryWithheld &&
    Math.abs(primary.result.mass / driftFrom - 1) > 0.15
      ? { now: primary.result.mass, then: driftFrom }
      : null;
  // A recent bench failure at or above the proven charge (from the log, geometry-independent) is,
  // like drift, a reason not to assert "fly the charge you tested". Both gate the proven line in
  // the carried artifacts and add an on-screen warning.
  const retest = testedSummary?.retest ?? null;
  const provenUntrusted = Boolean(drift) || Boolean(retest);

  // The plan for the printable build & ground-test card. Only wells with a real charge
  // are included; each gets the ground-test ladder as rows to fill in at the bench.
  const modeMeta = isFetter
    ? `Fetter model · ${state.deploy === "dual" ? "dual deploy" : "parachute deployment"}`
    : `${state.deploy === "dual" ? "Dual deploy" : "Single deploy"} · sized by ${
        state.mode === "force" ? "separation force" : "target pressure"
      }`;
  // Fetter mode never has "a target pressure or separation force" to enter, so when it sizes no
  // charge the carried artifacts (card, copy text, report) must not fall back to the ideal-gas
  // "enter a pressure or force" copy. Two empty cases: every compartment is outside the altitude
  // envelope, or the geometry just isn't filled in yet — each gets its own mode-appropriate note.
  const emptyNote = isFetter
    ? fetterAllOutOfEnvelope
      ? "Outside the Fetter model's envelope (~20,000 ft and up), the model doesn't apply. Size this with the target-pressure or separation-force modes, and ground-test in flight configuration."
      : "No compartment is sized yet. Enter an inner diameter and a compartment length for at least one parachute compartment."
    : undefined;
  const printPlan: PrintPlan = {
    title: airframeName?.trim() || "Ejection charge plan",
    meta: modeMeta,
    emptyNote,
    // Match the mode's vocabulary and the recovery report — Fetter compartments are measured by
    // "compartment length", the ideal-gas wells by "pressurized length".
    lengthLabel: isFetter ? "Compartment length" : "Pressurized length",
    // A proven charge is only printed as "proven" when the setup hasn't drifted from what
    // was tested — otherwise the card would tell the builder to fly a charge the on-screen
    // guard is warning them not to trust until re-tested.
    tested: testedSummary?.lastClean && !provenUntrusted
      ? `${fmtMass(testedSummary.lastClean.charge)} g — ${testedSummary.name} (${testedSummary.lastClean.date})`
      : undefined,
    wells: artWells.map((w) => ({
      title: w.title,
      idText: w.idText,
      lenText: w.lenText,
      estimate: fmtMass(w.mass),
      backup: w.backup !== undefined ? fmtMass(w.backup) : undefined,
      steps: [
        ...ladder(w.mass).map((s) => ({ label: s.label.toLowerCase(), grams: fmtMass(s.grams) })),
        ...(w.backup !== undefined
          ? [{ label: backupFloorBinds(w.mass, state.backupPct) ? "backup +0.5 g" : "backup", grams: fmtMass(w.backup) }]
          : []),
      ],
    })),
  };

  // Data for the high-contrast bench view: each charge, big, with the ladder as large tap
  // targets (the backup step carries no estimate, like elsewhere).
  const benchWells: BenchWell[] = artWells.map((w) => ({
    title: w.title,
    primary: fmtMass(w.mass),
    backup: w.backup !== undefined ? fmtMass(w.backup) : undefined,
    steps: [
      ...ladder(w.mass).map((s) => ({ label: s.label, grams: s.grams, estimate: w.mass })),
      ...(w.backup !== undefined
        ? [{ label: "Backup", grams: round(w.backup, 2), estimate: 0 }]
        : []),
    ],
  }));
  // Gated like the printed card: on a drifted setup — or when a later bench test failed at or
  // above the proven charge — the bench view mustn't tell the user at the pad to "fly the charge
  // you tested" when the on-screen guard says otherwise.
  const benchProven =
    provenUntrusted
      ? null
      : testedSummary?.validated
        ? { label: "Validated", charge: fmtMass(testedSummary.validated.charge) }
        : testedSummary?.lastClean
          ? { label: "Proven", charge: fmtMass(testedSummary.lastClean.charge) }
          : null;

  // A plain-text version of the same plan, for pasting into phone notes, a flight log, or a
  // club chat — the portable sibling of the printable card. Proven line follows printPlan.tested,
  // which is already drift-gated, so a drifted setup won't paste a stale "Proven" charge either.
  const copyPlan = async () => {
    const lines = [`Ejection charge plan — ${printPlan.title}`, printPlan.meta];
    if (printPlan.tested) lines.push(`Proven: ${printPlan.tested}`);
    if (printPlan.wells.length === 0)
      lines.push(
        "",
        printPlan.emptyNote ??
          "No charge sized yet — enter a diameter and length (and a pressure or force) for a well.",
      );
    for (const w of printPlan.wells) {
      lines.push("");
      lines.push(`${w.title} — ID ${w.idText}, length ${w.lenText}`);
      lines.push(`  Estimate ${w.estimate} g${w.backup ? `, backup ${w.backup} g` : ""}`);
      lines.push(`  Ladder: ${w.steps.map((s) => `${s.label} ${s.grams} g`).join(" / ")}`);
    }
    lines.push("");
    lines.push(
      "Theoretical starting estimates — always ground-test before flight. charge.fusionspace.co",
    );
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setPlanCopied(true);
      setTimeout(() => setPlanCopied(false), 1800);
    } catch {
      /* clipboard may be blocked */
    }
  };

  // The documentation half of the tool: the data for a recovery report (config + sizing
  // rationale with the formula + logged ground-test results) for a cert package or a build
  // writeup. The export buttons render it to HTML (download) or PDF (print).
  const reportData = (): ReportData => {
    const lu = state.lengthUnit;
    const pu = state.pressureUnit;
    const fu = state.forceUnit;

    const summary: [string, string][] = [
      ["Deployment", state.deploy === "dual" ? "Dual (drogue + main)" : "Single"],
      [
        "Sized by",
        isFetter
          ? `Fetter model (${state.deploy === "dual" ? "dual deploy" : "parachute deployment"})`
          : state.mode === "force"
            ? "Separation force"
            : "Target pressure",
      ],
    ];
    if (isFetter) {
      // Each compartment carries its own safety factor; state it globally only when they agree,
      // otherwise point to the per-compartment rows (each block lists its own).
      const safeties = fetterWells.map((w) => w.input.safety);
      const allSame = safeties.every((s) => s === safeties[0]);
      summary.push([
        "Safety factor",
        allSame
          ? `${fmt(safeties[0] * 100, 0)}% (the model's own margin — no separate multiplier)`
          : "per compartment below (the model's own margin — no separate multiplier)",
      ]);
    } else if (state.mode === "force") summary.push(["Safety margin", `${fmt(state.margin, 2)}×`]);
    else if (state.margin > 1)
      summary.push(["Safety margin", `${fmt(state.margin, 2)}× (sized above target)`]);
    if (state.redundant)
      summary.push([
        "Redundant altimeters",
        `yes — backup +${fmt(backupPctClamped(state.backupPct), 0)}% (min +${BACKUP_MIN_G} g)`,
      ]);
    if (!isFetter && state.elevation > 0) summary.push(["Field elevation", `${fmt(state.elevation, 0)} ft`]);
    if (isFetter)
      for (const w of fetterWells)
        if (w.input.deployAlt > 0)
          summary.push([
            state.deploy === "dual"
              ? `Deployment altitude — ${w.title.replace(" compartment", "").toLowerCase()}`
              : "Deployment altitude",
            `${fmt(w.input.deployAlt, 0)} ft — ${fetterInEnvelope(w) ? "within" : "outside"} the model's sea-level envelope`,
          ]);
    summary.push(["Units", `${lu} · ${state.mode === "force" || isFetter ? fu : pu}`]);

    // A Fetter report carries each in-envelope compartment (with its own rows); the ideal-gas
    // modes map over their sized wells as before.
    const wellBlocks: { title: string; rows: [string, string][] }[] = isFetter
      ? fetterWells
          .filter((w) => w.result.mass > 0 && fetterInEnvelope(w))
          .map((w) => {
            const r = w.result;
            const rows: [string, string][] = [
              ["Inner diameter", `${fmt(w.input.diameter, 3)} ${lu}`],
              ["Compartment length", `${fmt(w.input.length, 2)} ${lu}`],
              [
                "Shear screws",
                w.input.pinCount > 0
                  ? `${fmt(w.input.pinCount, 0)} × ${w.input.screw} (nylon)`
                  : "none (friction only)",
              ],
              ...(w.input.friction > 0
                ? ([["Nosecone friction", `${fmt(w.input.friction, 1)} ${fu}`]] as [string, string][])
                : []),
              ["Parachute packing factor", `${fmt(w.input.packing, 2)} (chute absorption ${fmt(r.absorption * 100, 0)}%)`],
              ["Safety factor", `${fmt(w.input.safety * 100, 0)}% (built into the charge)`],
              ["Required pressure", `${fmt(fromPsi(r.pressurePsi, pu), 1)} ${pu}`],
              ["Required force", `${fmt(fromLbf(r.forceLbf, fu), 0)} ${fu}`],
              ["Charge (Fetter)", `${fmtMass(r.mass)} g`],
              ...(state.redundant
                ? ([["Backup charge", `${fmtMass(backupMass(r.mass, state.backupPct))} g — for the second altimeter`]] as [string, string][])
                : []),
              [
                "Traditional ideal-gas (same pressure)",
                `${fmtMass(r.traditionalMass)} g — Fetter is ${fmt(r.ratio, 2)}× the traditional charge`,
              ],
              ["Volume", `${fmt(r.volumeIn3, 1)} in³ · ${fmt(in3ToCc(r.volumeIn3), 0)} cc`],
            ];
            return { title: w.title, rows };
          })
      : wells.filter(({ data }) => data.result.mass > 0).map(({ key, title, data }) => {
          const w = state[key];
          const res = data.result;
          const rws: [string, string][] = [
            ["Inner diameter", `${fmt(w.diameter, 3)} ${lu}`],
            ["Pressurized length", `${fmt(w.length, 2)} ${lu}`],
          ];
          if (state.mode === "pressure") rws.push(["Target pressure", `${fmt(w.pressure, 1)} ${pu}`]);
          else {
            rws.push(["Shear pins", `${fmt(w.pinCount, 0)} × ${fmt(w.pinForce, 1)} ${fu}`]);
            if (w.friction > 0) rws.push(["Friction / extra hold", `${fmt(w.friction, 1)} ${fu}`]);
            rws.push([
              "Required separation force",
              `${fmt(fromLbf(data.requiredForceLbf, fu), 0)} ${fu}`,
            ]);
          }
          rws.push(["Charge (estimate)", `${fmtMass(res.mass)} g`]);
          if (state.redundant)
            rws.push(["Backup charge", `${fmtMass(backupMass(res.mass, state.backupPct))} g`]);
          rws.push(["Sized pressure", `${fmt(fromPsi(res.pressure, pu), 1)} ${pu}`]);
          rws.push(["Volume", `${fmt(res.volume, 1)} in³ · ${fmt(in3ToCc(res.volume), 0)} cc`]);
          return { title, rows: rws };
        });

    let method: string[];
    if (isFetter) {
      // Derive the worked comparison from a compartment that actually carries an in-envelope
      // charge. If none does (all out of envelope, or no geometry), the "how it was sized"
      // section must explain that rather than recite a number the guard is withholding.
      const ex = fetterWells.find((w) => w.result.mass > 0 && fetterInEnvelope(w));
      if (!ex) {
        method = [
          "Fetter model — black powder for parachute deployment.",
          "",
          "No compartment is sized. Either enter a compartment's geometry, or — if the deployment",
          "is outside the model's envelope (a sea-level model, not for ~20,000 ft and up) — size it",
          "with the target-pressure or separation-force modes and ground-test in flight configuration.",
        ];
      } else {
        const r = ex.result;
        const label = state.deploy === "dual" ? ` — ${ex.title.toLowerCase()}` : "";
        method = [
          `Fetter model — black powder for parachute deployment.${label}`,
          "",
          "Rather than sizing powder from a target pressure alone, the model solves an energy and",
          "pressure balance for the compartment: the combustion energy of the powder, minus the",
          "share the parachute protector absorbs, heats the trapped air and combustion gas and",
          "builds the pressure needed to shear the pins (plus friction) with an energetic margin.",
          "",
          `  Parachute absorption  A_H = 0.951 · (1 − e^(−4.491 · Pf))   at Pf = ${fmt(ex.input.packing, 2)} → ${fmt(r.absorption * 100, 0)}%`,
          `  Required pressure     ${fmt(r.pressurePsi, 2)} psi     Required force ${fmt(r.forceLbf, 0)} lbf`,
          `  Safety factor         ${fmt(ex.input.safety * 100, 0)}% (built in — no separate multiplier)`,
          "",
          `  Fetter charge         ${fmtMass(r.mass)} g`,
          `  Traditional ideal-gas ${fmtMass(r.traditionalMass)} g at the same pressure and volume`,
          `  Model delta           ${fmt(r.ratio, 2)}× (Fetter vs. traditional at the same pressure)`,
          "",
          "The model is Tom Fetter's; see the references below. It assumes a chute protector /",
          "recovery blanket, does not model a piston, and is a sea-level model (not for deployment",
          "near or above 20,000 ft).",
        ];
      }
    } else {
      // Derive the worked example from a well that actually carries a charge — the same wells
      // the report shows. Otherwise a dual setup with an empty drogue but a filled main would
      // print a fully zeroed "drogue well" derivation for a well that isn't even in the report.
      const example = wells.find(({ data }) => data.result.mass > 0) ?? wells[wells.length - 1];
      const r = example.data.result;
      const exampleLabel = state.deploy === "dual" ? `${example.key} well` : "ejection well";
      method = [
        "m = (P · V) / (R · T)",
        `R = ${R_BP} ft·lbf/(lbm·°R)    T = ${T_BP} °R    psi → lbf/ft² ×${PSI_TO_PSF}    lbm → g ×${LBM_TO_G}`,
        "",
        `Worked example — ${exampleLabel}:`,
        `  V = ${fmt(r.volume, 2)} in³ = ${fmt(r.volume / IN3_PER_FT3, 5)} ft³`,
        `  P = ${fmt(r.pressure, 2)} psi × ${PSI_TO_PSF} = ${fmt(r.pressure * PSI_TO_PSF, 1)} lbf/ft²`,
        `  m = (${fmt(r.pressure * PSI_TO_PSF, 1)} × ${fmt(r.volume / IN3_PER_FT3, 5)}) / (${R_BP} × ${T_BP})`,
        `    = ${fmt(r.mass / LBM_TO_G, 6)} lbm × ${LBM_TO_G} = ${fmtMass(r.mass)} g`,
      ];
    }

    const OUT: Record<string, string> = {
      clean: "Clean",
      partial: "Partial",
      none: "No separation",
    };
    const sorted = [...(airframeTests ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    const tests = sorted.map((e) => [
      e.date,
      `${fmtMass(e.charge)} g`,
      OUT[e.outcome] ?? e.outcome,
      e.estimate && e.estimate > 0 ? `${fmt(e.charge / e.estimate, 2)}×` : "—",
      e.notes || "",
    ]);

    let testsNote: string;
    if (sorted.length === 0) {
      testsNote = airframeName?.trim()
        ? `No ground tests logged for ${airframeName} yet — size, then bench-test before flight.`
        : "No ground tests logged yet. Save a setup as a named airframe and log its bench tests to attach them here.";
    } else {
      const parts: string[] = [];
      // Gate the proven/validated assertion the same way the card and bench view do, so the cert
      // document never states a proven charge the rest of the tool is warning about. A later bench
      // failure at or above the proven charge takes precedence over drift — an actual no-separation
      // is a stronger signal than a geometry change.
      if (retest)
        parts.push(
          `A later bench test at ${fmtMass(retest.charge)} g did not fully separate — the proven charge above it can't be relied on until it's re-tested.`,
        );
      else if (drift)
        parts.push(
          `Setup has changed since the last clean test — it now sizes to ${fmtMass(drift.now)} g versus ${fmtMass(drift.then)} g when proven. Re-test before relying on the logged charge.`,
        );
      else if (testedSummary?.validated)
        parts.push(
          `Validated — ${testedSummary.validated.count} clean separations at ${fmtMass(testedSummary.validated.charge)} g.`,
        );
      else if (testedSummary?.lastClean)
        parts.push(
          `Most recent clean separation: ${fmtMass(testedSummary.lastClean.charge)} g (${testedSummary.lastClean.date}). Not yet validated — needs two clean tests at one charge.`,
        );
      else parts.push("No clean separation logged yet.");
      const cal = calibrationFromEntries(sorted);
      if (cal)
        parts.push(
          `Across ${cal.count} clean tests, charges ran ${fmt(cal.mean, 2)}× the model (range ${fmt(cal.min, 2)}–${fmt(cal.max, 2)}×).`,
        );
      testsNote = parts.join(" ");
    }

    return {
      title: airframeName?.trim() || "Ejection charge plan",
      generatedAt: todayISO(),
      summary,
      wells: wellBlocks,
      method,
      testsHeader: ["Date", "Charge", "Result", "vs model", "Notes"],
      tests,
      testsNote,
      // Mode-appropriate copy when no compartment/well is sized (Fetter has no pressure/force to
      // "enter"); undefined in the ideal-gas modes keeps the report's own default fallback.
      emptyNote,
      references: [
        ...(isFetter
          ? [
              {
                label: "Fetter parachute-deployment model",
                detail: `The Fetter model is Tom Fetter's — "Using Black Powder for Parachute Deployment" (Rev 1.2, NARCON-2025). The math here is a clean-room reimplementation that reproduces the paper's deployment-test results; the number carries the model's own safety factor, so no extra margin is added.`,
                url: FETTER_LINKS.paper,
              },
            ]
          : []),
        {
          label: "Ideal-gas method, R and T",
          detail: `m = (P·V)/(R·T) with R = ${R_BP} ft·lbf/(lbm·°R) and T = ${T_BP} °R — the values used across HPR ejection references (Ted Apke's ejection-charge method, ROL INFOcentral; HARA's "How to size ejection charges").`,
          url: "http://hararocketry.org/hara/resources/how-to-size-ejection-charge/",
        },
        {
          label: "Backup charge (+20% or 0.5 g)",
          detail:
            'The "20% larger, or at least 0.5 g, whichever is greater" backup convention follows NASA\'s Student Launch handbook and common club practice.',
        },
        {
          label: "Altimeter vent ports",
          detail:
            "The one-quarter-inch-port-per-100-in³ rule and its area form come from widely-used guidance such as Vern Knowles' port-sizing write-up and the broader community; your altimeter's own manual takes precedence.",
          url: "https://www.vernk.com/AltimeterPortSizing.htm",
        },
        {
          label: "Shear-pin forces",
          detail:
            "The nylon-screw presets are widely-cited single-shear approximations that vary by supplier and fit — starting points to verify, not authority.",
        },
      ],
    };
  };

  // Filenames for the downloadable exports, keyed off the airframe name.
  const slug = slugify(airframeName?.trim() || "plan");

  return (
    <>
      <div id="calculator" className="mt-10 scroll-mt-8 md:mt-14">
      {/* Heading for screen-reader heading-navigation parity with the sibling tool sections
          (Test & validate, Vent ports, …), which each carry a visible h2. The calculator's
          visible title is the page h1, so this one is visually hidden. */}
      <h2 className="sr-only">Ejection charge calculator</h2>
      <div className="mb-5">
        <SavedRockets
          current={state}
          // Normalize on load: a setup saved before a field existed gets sane defaults for
          // the new fields, and a corrupt/tampered store (e.g. a null well) is rebuilt into
          // a valid State rather than reaching the compute path and crashing the render.
          onLoad={(s) => setState(normalizeState(s))}
          onActivate={onActiveRocketChange}
        />
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
          {/* Deployment (single/dual) and redundant altimeters apply in every mode — the Fetter
              model sizes each parachute-deployment event, so a dual-deploy rocket has two Fetter
              compartments and a backup charge just as the ideal-gas modes do. */}
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
          <ControlGroup label="Altimeters">
            <Segmented<"single" | "redundant">
              ariaLabel="Altimeter configuration"
              value={state.redundant ? "redundant" : "single"}
              onChange={(v) => update({ redundant: v === "redundant" })}
              options={[
                { value: "single", label: "Single" },
                { value: "redundant", label: "Redundant" },
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
                { value: "fetter", label: "Fetter model" },
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

        {/* The safety margin and field-elevation advisory are ideal-gas-mode controls; in Fetter
            mode the model's own safety factor and the per-bay deployment-altitude envelope live in
            the compartment card instead. The backup uplift applies in both modes when redundant. */}
        {!isFetter && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Safety margin"
              value={state.margin}
              onChange={(margin) => update({ margin })}
              unit="×"
              step={0.1}
              min={1}
              hint={
                state.mode === "force"
                  ? "Multiplier on the required separation force, applied to both wells. 1.5 = +50% over the bare minimum."
                  : "Sizes the charge above your target pressure so a leaky real well still reaches it. 1.5 = enough powder for an ideal well to hit 1.5× your target."
              }
            />
            {state.redundant && (
              <NumberField
                label="Backup charge uplift"
                value={state.backupPct}
                onChange={(backupPct) => update({ backupPct })}
                unit="%"
                step={5}
                min={0}
                hint="How much larger the backup altimeter's charge is than the primary. The common convention is +20%."
              />
            )}
            <NumberField
              label="Field elevation"
              value={state.elevation}
              onChange={(elevation) => update({ elevation })}
              unit="ft"
              step={500}
              min={0}
              placeholder="0"
              hint="Optional. Flags thinner-air effects up high; it doesn't change the estimate — you can't trim a charge for altitude."
            />
          </div>
        )}
        {isFetter && state.redundant && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Backup charge uplift"
              value={state.backupPct}
              onChange={(backupPct) => update({ backupPct })}
              unit="%"
              step={5}
              min={0}
              hint="How much larger the second altimeter's charge is than the primary. The common convention is +20%. This is redundancy, not extra model margin — ground-test both."
            />
          </div>
        )}
      </div>

      <MeasureGuide fetter={isFetter} />
      {state.deploy === "dual" && <DeploySequence fetter={isFetter} />}

      {/* Attribution, once at the mode — not a footer, and not repeated per compartment. */}
      {isFetter && (
        <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm leading-relaxed text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
          <p>
            The <strong className="font-semibold">Fetter model</strong> is {FETTER_LINKS.author}&apos;s —
            derived from pressure-chamber and deployment-fixture testing to fix the traditional
            model&apos;s under-prediction of the powder a parachute needs.{" "}
            <a href={FETTER_LINKS.paper} target="_blank" rel="noopener noreferrer" className="font-medium underline decoration-indigo-400 underline-offset-2">
              Read the paper
            </a>{" "}
            ·{" "}
            <a href={FETTER_LINKS.video} target="_blank" rel="noopener noreferrer" className="font-medium underline decoration-indigo-400 underline-offset-2">
              NARCON-2025 talk
            </a>
            .
          </p>
          <p className="mt-1.5 text-indigo-800/80 dark:text-indigo-300/80">
            It assumes a chute protector / recovery blanket and does not model a piston (a piston
            needs less powder).{" "}
            {state.deploy === "dual"
              ? "In dual deploy it sizes the drogue and main compartments independently, each with its own sea-level envelope check below."
              : "Its sea-level altitude envelope is checked below."}
          </p>
        </div>
      )}

      {/* Wells + results — the ideal-gas wells, or the Fetter compartment(s). */}
      {isFetter ? (
        <div
          className={
            "mt-5 grid grid-cols-1 gap-5 " +
            (state.deploy === "dual" ? "lg:grid-cols-2" : "")
          }
        >
          {fetterWells.map((w) => (
            <FetterCard
              key={w.key}
              title={w.title}
              sub={w.sub}
              state={state}
              input={w.input}
              onChange={(patch) => setState((s) => ({ ...s, [w.key]: { ...s[w.key], ...patch } }))}
              result={w.result}
              backup={state.redundant ? backupMass(w.result.mass, state.backupPct) : undefined}
              backupLabel={
                state.redundant
                  ? backupFloorBinds(w.result.mass, state.backupPct)
                    ? `+${BACKUP_MIN_G} g`
                    : `+${round(backupPctClamped(state.backupPct), 0)}%`
                  : undefined
              }
              onPlanCharge={planCharge}
            />
          ))}
        </div>
      ) : (
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
              onPlanCharge={planCharge}
            />
          ))}
        </div>
      )}

      {testedSummary?.lastClean && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm leading-relaxed text-emerald-800 dark:text-emerald-300">
          <span aria-hidden className="mt-0.5 shrink-0 text-base">
            ✓
          </span>
          <div className="min-w-0">
            <p>
              <strong className="font-semibold">
                You&apos;ve proven {testedSummary.name}.
              </strong>
              {testedSummary.validated && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 align-middle text-[11px] font-semibold">
                  ✓ Validated · {fmtMass(testedSummary.validated.charge)} g ×{" "}
                  {testedSummary.validated.count}
                </span>
              )}{" "}
              Its most recent clean separation was{" "}
              <span className="font-mono font-semibold tabular-nums">
                {fmtMass(testedSummary.lastClean.charge)} g
              </span>{" "}
              on {testedSummary.lastClean.date}
              {testedSummary.cleanCount > 1 && ` (${testedSummary.cleanCount} clean tests logged)`}.{" "}
              {provenUntrusted
                ? "Re-test before you rely on it — see the note below."
                : "Fly the charge you tested — the estimate below is only a starting point."}
            </p>
            {drift && (
              <p
                role="alert"
                className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400"
              >
                <span aria-hidden className="mt-px shrink-0">
                  ⚠
                </span>
                <span>
                  This setup now sizes to{" "}
                  <span className="font-mono tabular-nums">{fmtMass(drift.now)} g</span>, but the
                  airframe was proven at a setup that sized to{" "}
                  <span className="font-mono tabular-nums">{fmtMass(drift.then)} g</span>. If you
                  changed the tube, length, or pins, re-test before trusting the proven charge.
                </span>
              </p>
            )}
            {retest && (
              <p
                role="alert"
                className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400"
              >
                <span aria-hidden className="mt-px shrink-0">
                  ⚠
                </span>
                <span>
                  A later bench test at{" "}
                  <span className="font-mono tabular-nums">{fmtMass(retest.charge)} g</span>{" "}
                  {retest.outcome === "none" ? "didn't separate" : "only partially separated"} — at
                  or above this charge. Don&apos;t trust the proven charge until you re-test; the
                  ground-test coach below picks up where to go next.
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      {!isFetter && (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          These are theoretical starting estimates from the ideal-gas method below — a
          baseline to take to the bench, not a number to trust unverified.{" "}
          <a href="#ground-test" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            Ground-test and record what actually works ↓
          </a>
        </p>
      )}

      {!isFetter && state.elevation >= 3000 && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400"
        >
          <span aria-hidden className="mt-px shrink-0">
            ⛰
          </span>
          <span>
            At {fmt(state.elevation, 0)} ft field elevation the air is thinner and black powder
            burns a little less efficiently, so a real well can reach less pressure than down low.{" "}
            {state.elevation >= 6000 ? "Especially up here, " : ""}ground-test toward the high
            end of the ladder — this is a heads-up, not a number to trim (you can&apos;t derate
            your way to a smaller charge safely). What matters most is your deployment altitude:
            a charge fired near or above ~20,000 ft loses far more — black powder stops burning
            completely up there — which is why the Fetter mode refuses to size that thin.
          </span>
        </p>
      )}

      </div>

      {/* The ground-test log, handed in by ChargeApp as children. It renders right after the
          sized charge so the page reads in loop order — size → ground-test → take it to the
          field — while keeping its own pendingCharge / entries wiring in the parent. */}
      {children}

      {/* Take it to the field — every share / pad / export action in one place, so the
          calculation flows straight into something you can carry to the pad or file after.
          Sits after the log: the field card and report read best once tests are logged. */}
      <section
        id="field"
        className="mt-8 scroll-mt-8 rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-base font-semibold tracking-tight">Take it to the field</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">share · pad · export</span>
        </div>
        <p className="mt-1.5 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
          Open a high-contrast pad view, print a build &amp; ground-test card, or save a full
          recovery report for a cert package — and share the live setup as a link.
        </p>

        {/* Primary actions: the pad view and the shareable link. */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setBenchOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Bench mode
          </button>
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            {copied ? "Link copied" : "Copy share link"}
          </button>
          {canShare && (
            <button
              type="button"
              onClick={shareLink}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              Share
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setState(DEFAULT_STATE);
              onActiveRocketChange?.("");
            }}
            className="ml-auto text-sm font-medium text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Reset
          </button>
        </div>

        {/* The copy buttons only flip their own label on success, which a screen reader
            doesn't re-announce for a focused button. This off-screen live region speaks the
            confirmation so a non-sighted user knows the copy worked. */}
        <p className="sr-only" role="status" aria-live="polite">
          {copied
            ? "Share link copied to clipboard."
            : planCopied
              ? "Plan text copied to clipboard."
              : benchAnnounce}
        </p>

        {/* Exports — each artifact offered as HTML (download) or PDF (print → Save as PDF). */}
        <div className="mt-4 space-y-2.5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-[9rem] text-zinc-500 dark:text-zinc-400">Build &amp; ground-test card</span>
            <button type="button" aria-label="Download card as HTML" onClick={() => downloadHtml(buildCardHtml(printPlan, todayISO()), `charge-card-${slug}.html`)} className={EXPORT_BTN}>
              HTML
            </button>
            <button type="button" aria-label="Print card to PDF" onClick={() => printHtml(buildCardHtml(printPlan, todayISO()))} className={EXPORT_BTN}>
              PDF
            </button>
            <button type="button" onClick={copyPlan} className={EXPORT_BTN}>
              {planCopied ? "Copied" : "Copy text"}
            </button>
            {canShareFiles && (
              <button type="button" aria-label="Share card" onClick={() => shareFile(buildCardHtml(printPlan, todayISO()), `charge-card-${slug}.html`)} className={EXPORT_BTN}>
                Share
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-[9rem] text-zinc-500 dark:text-zinc-400">Recovery report</span>
            <button type="button" aria-label="Download report as HTML" onClick={() => downloadHtml(buildReportHtml(reportData()), `charge-report-${slug}.html`)} className={EXPORT_BTN}>
              HTML
            </button>
            <button type="button" aria-label="Print report to PDF" onClick={() => printHtml(buildReportHtml(reportData()))} className={EXPORT_BTN}>
              PDF
            </button>
            {canShareFiles && (
              <button type="button" aria-label="Share report" onClick={() => shareFile(buildReportHtml(reportData()), `charge-report-${slug}.html`)} className={EXPORT_BTN}>
                Share
              </button>
            )}
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              full write-up for a cert package or build thread
            </span>
          </div>
        </div>
      </section>

      <Methodology
        state={state}
        // The worked example walks the first well that actually carries a charge (same choice the
        // report makes), so a dual setup with an empty drogue but a filled main doesn't derive a
        // zeroed drogue. Falls back to the drogue when nothing is sized yet.
        well={methodWell.data}
        wellLabel={state.deploy === "dual" ? methodWell.key : "ejection"}
        fetter={fetterExample.result}
        fetterInput={fetterExample.input}
        fetterLabel={state.deploy === "dual" ? fetterExample.title : ""}
      />
      {benchOpen && (
        <BenchMode
          wells={benchWells}
          proven={benchProven}
          emptyNote={emptyNote}
          onPlan={(grams, estimate) => {
            onPlanCharge?.(grams, estimate);
            setBenchOpen(false);
            setBenchAnnounce(`Queued ${fmtMass(grams)} g in the ground-test log below.`);
            setTimeout(() => setBenchAnnounce(""), 3000);
          }}
          onClose={() => setBenchOpen(false)}
        />
      )}
    </>
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
  onPlanCharge?: (grams: number, estimate: number) => void;
}) {
  const { result, requiredForceLbf } = computed;
  const backup = backupMass(result.mass, state.backupPct);
  const backupLabel = backupFloorBinds(result.mass, state.backupPct)
    ? `+${BACKUP_MIN_G} g`
    : `+${round(backupPctClamped(state.backupPct), 0)}%`;
  const cautions = wellCautions(state, well, { mass: result.mass, pressurePsi: result.pressure });
  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{sub}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <NumberField
            label="Inner diameter"
            value={well.diameter}
            onChange={(diameter) => onChange({ diameter })}
            unit={state.lengthUnit}
            step={state.lengthUnit === "mm" ? 1 : 0.1}
            hint="Tube ID — the bore the gas pressurizes."
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {ID_PRESETS[state.lengthUnit].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ diameter: v })}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600 transition hover:border-indigo-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {v} {state.lengthUnit}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Common nominal airframe sizes — measure your own tube&apos;s ID.
          </p>
        </div>
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
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600 transition hover:border-indigo-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
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
        {/* aria-live wraps the primary AND backup charge rows so a screen reader announces both
            on each input change — the backup is a separate charge the flyer weighs and tests on
            its own — but not the derived chips below, which would make the announcement verbose. */}
        <div aria-live="polite" className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span
              data-testid="mass"
              className="font-mono text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50"
            >
              {fmtMass(result.mass)}
            </span>
            <span className="text-lg text-zinc-500 dark:text-zinc-400">g</span>
            <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
              {state.redundant ? "primary charge" : "black powder"}
            </span>
          </div>
          {state.redundant && result.mass > 0 && (
            <div className="flex items-baseline gap-2 border-t border-indigo-200/70 pt-3 dark:border-indigo-500/20">
              <span
                data-testid="backup-mass"
                className="font-mono text-xl font-semibold tracking-tight text-zinc-700 tabular-nums dark:text-zinc-200"
              >
                {fmtMass(backup)}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">g</span>
              <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                backup charge ({backupLabel})
              </span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Chip
            label="Volume"
            value={`${fmt(result.volume, 1)} in³ · ${fmt(in3ToCc(result.volume), 0)} cc`}
          />
          <Chip
            label={state.mode === "pressure" && state.margin > 1 ? "Pressure (target → sized)" : "Pressure"}
            value={
              state.mode === "pressure" && state.margin > 1
                ? `${fmt(well.pressure, 1)} → ${fmt(fromPsi(result.pressure, state.pressureUnit), 1)} ${state.pressureUnit}`
                : `${fmt(fromPsi(result.pressure, state.pressureUnit), 1)} ${state.pressureUnit}`
            }
          />
          {state.mode === "force" && (
            <Chip
              label="Force"
              value={`${fmt(fromLbf(requiredForceLbf, state.forceUnit), 0)} ${state.forceUnit}`}
            />
          )}
        </div>
      </div>

      {cautions.length > 0 && (
        <div role="alert" className="mt-3 space-y-1.5">
          {cautions.map((c) => (
            <p
              key={c.id}
              className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400"
            >
              <span aria-hidden className="mt-px shrink-0">
                ⚠
              </span>
              <span>{c.message}</span>
            </p>
          ))}
        </div>
      )}

      {result.mass > 0 && (
        <div className="mt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Ground-test plan
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Bench-test from the low charge up until separation is clean and energetic.
            Tap a step to start a log entry below.
            {state.redundant && " Test the backup charge too — it fires on its own if the primary doesn't."}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              // estimate = the model baseline this step calibrates against; the backup step
              // is intentionally inflated for redundancy, so it carries none (estimate 0).
              { label: "Low −20%", grams: round(result.mass * 0.8, 2), estimate: result.mass },
              { label: "Estimate", grams: round(result.mass, 2), estimate: result.mass },
              { label: "High +20%", grams: round(result.mass * 1.2, 2), estimate: result.mass },
              ...(state.redundant
                ? [{ label: `Backup ${backupLabel}`, grams: round(backup, 2), estimate: 0 }]
                : []),
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => onPlanCharge?.(s.grams, s.estimate)}
                title={`Log a ${s.grams} g test`}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-left transition hover:border-indigo-400 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-500/60"
              >
                <span className="block text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
    </div>
  );
}
