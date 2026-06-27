/**
 * Ground-test log model, plus the read side the calculator uses to close the loop
 * between the estimate and what you actually proved on the bench. The log component owns
 * writing to storage; this holds the shared types and a pure summary so the calculator
 * can surface a tested charge without duplicating the parsing or the matching rule.
 */

import { round } from "./format";

export type Outcome = "clean" | "partial" | "none";

export interface TestEntry {
  id: string;
  date: string; // yyyy-mm-dd
  label: string; // which well / airframe
  charge: number; // grams
  outcome: Outcome;
  notes: string;
  /** The model's estimate (g) for this charge when it was planned from a ground-test
   *  ladder step — lets the tool learn how your real charges compare to the formula.
   *  Absent for manually-entered charges and for backup-charge tests. */
  estimate?: number;
}

export const TESTLOG_STORAGE_KEY = "charge.testlog";

export interface TestedSummary {
  /** How many clean, validated tests are recorded for this airframe. */
  cleanCount: number;
  /** The most recent clean test, if any — the charge worth flying. */
  lastClean?: TestEntry;
}

/**
 * Summarize the clean, validated tests recorded against a given airframe label. Matching
 * is case-insensitive on the trimmed label — the log's airframe field defaults to the
 * active saved rocket's name, so tests logged in the normal flow line up. Returns the most
 * recent clean test (latest date; ties resolved to the most recently added) and the count.
 */
export function summarizeFor(entries: TestEntry[], label: string): TestedSummary {
  const key = label.trim().toLowerCase();
  if (!key) return { cleanCount: 0 };
  const matches = entries.filter(
    (e) => e.outcome === "clean" && e.charge > 0 && e.label.trim().toLowerCase() === key,
  );
  if (matches.length === 0) return { cleanCount: 0 };
  // entries are stored newest-added first, so for equal dates matches[0] is the newest add.
  let lastClean = matches[0];
  for (const e of matches) if (e.date > lastClean.date) lastClean = e;
  return { cleanCount: matches.length, lastClean };
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
      counts.set(e.charge, (counts.get(e.charge) ?? 0) + 1);
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
 * single clean test suggests repeating the same charge to confirm it. Returns null once the
 * charge is validated (nothing left to chase) or when there's no history to go on. It only
 * ever steps up; it never proposes trimming a charge down.
 */
export function nextChargeSuggestion(entries: TestEntry[], label: string): NextCharge | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;
  if (validatedCharge(entries, label)) return null;
  // Most recently *added* test for this airframe (entries are stored newest-first).
  const latest = entries.find(
    (e) => e.charge > 0 && e.label.trim().toLowerCase() === key,
  );
  if (!latest) return null;
  if (latest.outcome === "none") {
    return { kind: "increase", fromCharge: latest.charge, fromOutcome: "none", suggested: round(latest.charge * 1.25, 2) };
  }
  if (latest.outcome === "partial") {
    return { kind: "increase", fromCharge: latest.charge, fromOutcome: "partial", suggested: round(latest.charge * 1.15, 2) };
  }
  return { kind: "confirm", fromCharge: latest.charge, fromOutcome: "clean", suggested: latest.charge };
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
      "Shear pins or screws too strong, or too many of them.",
      "Gas leaking past the bulkhead, or out the vent / sampling holes.",
      "Wadding packed too tight, smothering the charge.",
      "E-match didn't fully light the powder — poor contact, or too little BP packed around it.",
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

/**
 * How your real, clean charges have compared to the ideal-gas estimate, across every test
 * that was planned from a ladder step (so it has an estimate to compare against). Needs at
 * least two data points to mean anything. This is insight, never an auto-applied factor —
 * the honest use is "expect to test toward the high end", never "trim the charge down".
 */
export function calibrationFromEntries(entries: TestEntry[]): Calibration | null {
  const ratios = entries
    .filter((e) => e.outcome === "clean" && e.charge > 0 && (e.estimate ?? 0) > 0)
    .map((e) => e.charge / (e.estimate as number));
  if (ratios.length < 2) return null;
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return { count: ratios.length, mean, min: Math.min(...ratios), max: Math.max(...ratios) };
}
