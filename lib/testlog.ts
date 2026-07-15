/**
 * Ground-test log model, plus the read side the calculator uses to close the loop
 * between the estimate and what you actually proved on the bench. The log component owns
 * writing to storage; this holds the shared types and a pure summary so the calculator
 * can surface a tested charge without duplicating the parsing or the matching rule.
 */

import { round } from "./format";
import { MAX_IMPORT_ITEMS } from "./backup";

export type Outcome = "clean" | "partial" | "none";

export interface TestEntry {
  id: string;
  date: string; // yyyy-mm-dd
  label: string; // which section / airframe
  charge: number; // grams
  outcome: Outcome;
  notes: string;
  /** The model's estimate (g) for this charge when it was planned from a ground-test
   *  ladder step — lets the tool learn how your real charges compare to the formula.
   *  Absent for manually-entered charges and for backup-charge tests. */
  estimate?: number;
}

export const TESTLOG_STORAGE_KEY = "charge.testlog";

const OUTCOMES = new Set<Outcome>(["clean", "partial", "none"]);

/**
 * Whether a string is a real yyyy-mm-dd calendar date. The "most recent clean" charge — the
 * one the calculator surfaces as worth flying — is chosen by lexicographic date comparison,
 * so an imported entry with a garbage date ("9999-99-99", "tomorrow") would sort above every
 * real test and hijack that signal. Requiring a genuine ISO date keeps untrusted imports from
 * poisoning it. Checks both the shape and that the parts form a valid date (e.g. not month 99).
 */
function isIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [, y, mo, d] = m;
  const dt = new Date(`${s}T00:00:00Z`);
  return (
    !Number.isNaN(dt.getTime()) &&
    dt.getUTCFullYear() === Number(y) &&
    dt.getUTCMonth() + 1 === Number(mo) &&
    dt.getUTCDate() === Number(d)
  );
}

/**
 * Normalize a raw array (from a JSON import or a whole-tool restore) into valid TestEntries:
 * drop non-objects, coerce field types, require a real charge (> 0), and give every entry a
 * stable id. Shared by the log's import and the backup restore so both surfaces agree on what
 * a valid entry is — a restore must not be able to write an entry the import would reject
 * (a negative/NaN/missing charge that would otherwise render as "NaN g" and poison the log).
 * `genId` mints an id for an entry that has none; `today` backstops a missing date. Pure.
 */
export function sanitizeEntries(
  raw: unknown[],
  genId: () => string,
  today: string,
): TestEntry[] {
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    // Bound the import so a pathologically large file can't freeze the tab or blow quota.
    .slice(0, MAX_IMPORT_ITEMS)
    .map((x): TestEntry => {
      const rawId = x.id;
      // Keep a stable id across re-imports: reuse a string id, stringify a numeric one
      // (foreign files often use numeric ids), only mint a new id when there's none.
      const id =
        typeof rawId === "string" && rawId
          ? rawId
          : typeof rawId === "number" && Number.isFinite(rawId)
            ? String(rawId)
            : genId();
      // Coerce the charge once and require it finite. Number("1e999") and Number("Infinity")
      // overflow to Infinity, which would slip past a bare `> 0` filter, win same-date ties in
      // summarizeFor (Infinity beats every real charge), and surface as the "proven" charge —
      // rendered as "— g" by fmtMass, so it poisons the log invisibly. A non-finite or
      // non-positive charge falls to 0 and is dropped by the trailing filter.
      const charge = Number(x.charge);
      return {
        id,
        // Reject a future date too, not just a malformed one: "most recent clean" is chosen by
        // date order, so a fat-fingered 2062 (or a tampered file) would sort above every real
        // test and hijack the surfaced charge indefinitely. Backstop to today.
        date:
          typeof x.date === "string" && isIsoDate(x.date) && x.date <= today ? x.date : today,
        label: typeof x.label === "string" && x.label ? x.label : "—",
        charge: Number.isFinite(charge) ? charge : 0,
        outcome: OUTCOMES.has(x.outcome as Outcome) ? (x.outcome as Outcome) : "clean",
        notes: typeof x.notes === "string" ? x.notes : "",
        ...(typeof x.estimate === "number" && Number.isFinite(x.estimate) && x.estimate > 0
          ? { estimate: x.estimate }
          : {}),
      };
    })
    .filter((e) => e.charge > 0);
}

export interface TestedSummary {
  /** How many clean, validated tests are recorded for this airframe. */
  cleanCount: number;
  /** The most recent clean test, if any — the charge worth flying. */
  lastClean?: TestEntry;
  /** The estimate the most-recent estimate-carrying clean test was planned from — the drift
   *  baseline. Falls through to older cleans so a hand-logged (estimate-less) most-recent clean
   *  doesn't silently disable drift protection when the airframe has any ladder-planned clean. */
  driftEstimate?: number;
}

/**
 * Summarize the clean, validated tests recorded against a given airframe label. Matching
 * is case-insensitive on the trimmed label — the log's airframe field defaults to the
 * active saved rocket's name, so tests logged in the normal flow line up. Returns the most
 * recent clean test (latest date; same-date ties resolve to the larger charge, the safer one
 * to surface as "fly this") and the count.
 */
export function summarizeFor(entries: TestEntry[], label: string): TestedSummary {
  const key = label.trim().toLowerCase();
  if (!key) return { cleanCount: 0 };
  const matches = entries.filter(
    (e) => e.outcome === "clean" && e.charge > 0 && e.label.trim().toLowerCase() === key,
  );
  if (matches.length === 0) return { cleanCount: 0 };
  // Break same-date ties toward the larger charge — matching validatedCharge — so a tie never
  // surfaces the smaller charge (the under-size direction) as the one to fly.
  let lastClean = matches[0];
  let driftClean: TestEntry | undefined;
  for (const e of matches) {
    if (e.date > lastClean.date || (e.date === lastClean.date && e.charge > lastClean.charge))
      lastClean = e;
    // The drift baseline is the most-recent clean that actually carries an estimate.
    if ((e.estimate ?? 0) > 0 && (!driftClean || e.date > driftClean.date)) driftClean = e;
  }
  return { cleanCount: matches.length, lastClean, driftEstimate: driftClean?.estimate };
}

/** A charge an airframe has cleanly separated on at least twice — flight-validated. */
export interface ValidatedCharge {
  charge: number;
  count: number;
}

/**
 * The charge an airframe has proven repeatable: at least two clean separations at the same
 * weight. If several qualify, the most-tested wins (ties broken toward the larger charge,
 * the safer one to trust). This is what earns the "validated" badge.
 */
export function validatedCharge(entries: TestEntry[], label: string): ValidatedCharge | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;
  const counts = new Map<number, number>();
  for (const e of entries) {
    if (e.outcome === "clean" && e.charge > 0 && e.label.trim().toLowerCase() === key) {
      // Key on the charge at display precision (0.01 g): a charge picked from the ladder
      // (already rounded) and the same charge typed by hand (raw float) must count as the
      // same weight, or two "1.50 g" tests would never earn the validated badge.
      const c = round(e.charge, 2);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  let best: ValidatedCharge | null = null;
  for (const [charge, count] of counts) {
    if (count < 2) continue;
    if (!best || count > best.count || (count === best.count && charge > best.charge)) {
      best = { charge, count };
    }
  }
  return best;
}

export interface NextCharge {
  /** "increase" after a failed/partial test, "confirm" after a single clean one. */
  kind: "increase" | "confirm";
  fromCharge: number;
  fromOutcome: Outcome;
  suggested: number;
}

/**
 * What to pack next for an airframe, read from its most recent test — turning the log from a
 * record into a bench coach. No separation steps the charge up ~25%, a partial ~15%, and a
 * single clean test suggests repeating the same charge to confirm it. It only ever steps up;
 * it never proposes trimming a charge down.
 *
 * A confirmed-clean airframe that's already validated has nothing left to chase, so this is
 * silent — UNLESS the most recent test is a failure at or above the validated charge, which
 * re-opens coaching: a later no-separation means the "validated" charge can't be trusted, so
 * the coach must not stay quiet. A failure *below* the validated charge is an expected
 * too-little-powder result, not a reason to chase (and stepping up from it would only propose
 * a charge under the proven one), so that stays silent.
 */
export function nextChargeSuggestion(entries: TestEntry[], label: string): NextCharge | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;
  const matches = entries.filter((e) => e.charge > 0 && e.label.trim().toLowerCase() === key);
  if (matches.length === 0) return null;
  // The most recent test *by date* (ties resolve to the most recently added — matches[0]).
  let latest = matches[0];
  for (const e of matches) if (e.date > latest.date) latest = e;

  const validated = validatedCharge(entries, label);

  if (latest.outcome === "clean") {
    // A confirmed clean at the validated charge means there's nothing left to chase.
    if (validated) return null;
    return { kind: "confirm", fromCharge: latest.charge, fromOutcome: "clean", suggested: latest.charge };
  }

  // Latest test did not fully separate. A failure below an already-validated charge is expected
  // (too little powder) — don't chase it.
  if (validated && round(latest.charge, 2) < round(validated.charge, 2)) return null;

  const step = latest.outcome === "none" ? 1.25 : 1.15;
  return {
    kind: "increase",
    fromCharge: latest.charge,
    fromOutcome: latest.outcome,
    suggested: round(latest.charge * step, 2),
  };
}

/**
 * The usual causes of a failed bench test, matched to the symptom — so a "no separation" or
 * "partial" becomes a checklist to work through rather than a shrug. Ordered roughly most- to
 * least-common; charge size leads because it's the lever this tool sizes. Informational only.
 */
export function failureCauses(outcome: Outcome): string[] {
  if (outcome === "none")
    return [
      "Charge too small — step up and re-test.",
      "Charge not contained — a loose pile of powder flashes and vents instead of building pressure. Cap or tape the well and bury the e-match tip in the powder.",
      "Shear pins or screws too strong, or too many of them.",
      "E-match didn't fully light the powder — poor contact, or too little BP packed around it.",
      "Gas leaking past a poorly-sealed bulkhead or coupler, or out a vent hole in the pressurized bay (not the sealed av-bay's sampling ports).",
      "Wadding packed too tight, smothering the charge.",
    ];
  if (outcome === "partial")
    return [
      "Charge a touch light — a small step up often does it.",
      "Friction or binding in the coupler or nose cone.",
      "One shear pin didn't break.",
      "Some gas leaked before full pressure built.",
    ];
  return [];
}

export interface Calibration {
  /** Number of clean tests that carried a model estimate. */
  count: number;
  /** Average ratio of the charge that worked to the model's estimate. */
  mean: number;
  min: number;
  max: number;
}

/** Calibration ratios outside this band are treated as data-entry errors (a typo'd estimate — say
 *  0.2 for 2.0, a 10× ratio — rather than real signal) and dropped, so one bad row can't skew the
 *  "your charges run N× the model" advisory into wildly-oversized territory. A real clean charge
 *  runs within a few× its ideal-gas estimate. */
export const CALIBRATION_MIN_RATIO = 0.25;
export const CALIBRATION_MAX_RATIO = 6;

/**
 * How your real, clean charges have compared to the ideal-gas estimate, across every test
 * that was planned from a ladder step (so it has an estimate to compare against). Needs at
 * least two data points to mean anything. This is insight, never an auto-applied factor —
 * the honest use is "expect to test toward the high end", never "trim the charge down".
 */
export function calibrationFromEntries(entries: TestEntry[]): Calibration | null {
  const ratios = entries
    .filter((e) => e.outcome === "clean" && e.charge > 0 && (e.estimate ?? 0) > 0)
    .map((e) => e.charge / (e.estimate as number))
    // Drop implausible ratios (a typo'd tiny/huge estimate), which would otherwise steer the
    // advisory toward a grossly oversized charge — over-pressurization is its own hazard.
    .filter((r) => r >= CALIBRATION_MIN_RATIO && r <= CALIBRATION_MAX_RATIO);
  if (ratios.length < 2) return null;
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return { count: ratios.length, mean, min: Math.min(...ratios), max: Math.max(...ratios) };
}
