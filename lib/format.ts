/** Small display helpers. The aim is honest precision — never more digits than the
 *  input or the method justify. */

/** Round to a fixed number of decimals and drop trailing zeros. */
export function round(n: number, decimals = 2): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Format a number with up to `decimals` places, trimming trailing zeros. */
export function fmt(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "—";
  return round(n, decimals).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
  });
}

/** Black-powder mass, always grams, to 0.01 g. */
export function fmtMass(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return "—";
  return grams.toFixed(2);
}

/** Parse a user-entered number, tolerating empty/garbage as 0. */
export function num(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}
