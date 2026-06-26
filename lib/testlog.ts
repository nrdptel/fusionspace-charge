/**
 * Ground-test log model, plus the read side the calculator uses to close the loop
 * between the estimate and what you actually proved on the bench. The log component owns
 * writing to storage; this holds the shared types and a pure summary so the calculator
 * can surface a tested charge without duplicating the parsing or the matching rule.
 */

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
