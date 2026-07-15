/**
 * Whole-tool backup: saved rockets + the ground-test log + the theme, so a cleared cache or
 * a move to a new device doesn't lose a season's work. The log already exports itself, but
 * saved rockets had no backup at all — this closes that gap. The localStorage reads/writes
 * live in the component; these are the pure pieces (document shape, validation, merge).
 */

import { normalizeState, type State } from "./state";

export const BACKUP_VERSION = 1;

/** Upper bound on items pulled from an imported file, per list. Far above any real flyer's
 *  handful of airframes or season of tests, but low enough that a pathologically large or
 *  hand-crafted file can't freeze the tab or blow the localStorage quota on restore. */
export const MAX_IMPORT_ITEMS = 5000;

export interface BackupFile {
  tool: "charge";
  type: "backup";
  version: number;
  exportedAt: string;
  rockets: unknown[];
  testlog: unknown[];
  theme: string | null;
}

export interface SavedRocket {
  id: string;
  name: string;
  state: State;
}

/**
 * Normalize a raw array (from localStorage, a cross-tab write, or a restore) into valid
 * SavedRockets: drop non-objects, mint a stable id where missing, and rebuild each state through
 * `normalizeState` so a null, an older-schema entry, or a hand-edited store can't reach the render
 * — or the load-click `structuredClone` — and throw. Without this a single corrupt entry crashes
 * the whole tool, and the route error boundary re-reads the same store on reload: an unrecoverable
 * loop. Nameless entries are unusable, so they're dropped. Pure; `genId` mints an id when needed.
 */
export function sanitizeRockets(raw: unknown[], genId: () => string): SavedRocket[] {
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .slice(0, MAX_IMPORT_ITEMS)
    .map((x) => ({
      id: typeof x.id === "string" && x.id ? x.id : genId(),
      name: typeof x.name === "string" ? x.name.trim() : "",
      state: normalizeState(x.state),
    }))
    .filter((r) => r.name.length > 0);
}

export function buildBackup(parts: {
  rockets: unknown[];
  testlog: unknown[];
  theme: string | null;
  exportedAt: string;
}): BackupFile {
  return {
    tool: "charge",
    type: "backup",
    version: BACKUP_VERSION,
    exportedAt: parts.exportedAt,
    rockets: parts.rockets,
    testlog: parts.testlog,
    theme: parts.theme,
  };
}

export interface RestoredBackup {
  rockets: unknown[];
  testlog: unknown[];
  theme: string | null;
}

/** Validate a backup file's text and pull out its parts; null if it isn't a Charge backup. */
export function readBackup(text: string): RestoredBackup | null {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch {
    return null;
  }
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  // Drop non-object items up front: a hand-edited or partially-corrupted backup can carry a
  // stray null/number/string, which has no business in the saved-rockets or log arrays.
  const asObjects = (v: unknown[]) =>
    v.filter((x) => !!x && typeof x === "object").slice(0, MAX_IMPORT_ITEMS);
  const rockets = Array.isArray(o.rockets) ? asObjects(o.rockets) : null;
  const testlog = Array.isArray(o.testlog) ? asObjects(o.testlog) : null;
  // Must carry at least one of our arrays, so a random JSON file is rejected.
  if (rockets === null && testlog === null) return null;
  const theme = typeof o.theme === "string" ? o.theme : null;
  return { rockets: rockets ?? [], testlog: testlog ?? [], theme };
}

/** Merge incoming items into existing, skipping any whose id already exists — non-destructive,
 *  so restoring onto a device that already has data combines rather than clobbers. Malformed
 *  (null / non-object) items are skipped rather than throwing, and duplicate ids are collapsed
 *  across BOTH lists, so one bad entry can't abort a whole restore or double-write an id. */
export function mergeById<T extends { id?: unknown }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set<unknown>();
  const out: T[] = [];
  for (const item of [...existing, ...incoming]) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { id?: unknown }).id;
    if (id != null) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(item);
  }
  return out;
}
