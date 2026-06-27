/**
 * Whole-tool backup: saved rockets + the ground-test log + the theme, so a cleared cache or
 * a move to a new device doesn't lose a season's work. The log already exports itself, but
 * saved rockets had no backup at all — this closes that gap. The localStorage reads/writes
 * live in the component; these are the pure pieces (document shape, validation, merge).
 */

export const BACKUP_VERSION = 1;

export interface BackupFile {
  tool: "charge";
  type: "backup";
  version: number;
  exportedAt: string;
  rockets: unknown[];
  testlog: unknown[];
  theme: string | null;
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
  const rockets = Array.isArray(o.rockets) ? o.rockets : null;
  const testlog = Array.isArray(o.testlog) ? o.testlog : null;
  // Must carry at least one of our arrays, so a random JSON file is rejected.
  if (rockets === null && testlog === null) return null;
  const theme = typeof o.theme === "string" ? o.theme : null;
  return { rockets: rockets ?? [], testlog: testlog ?? [], theme };
}

/** Merge incoming items into existing, skipping any whose id already exists — non-destructive,
 *  so restoring onto a device that already has data combines rather than clobbers. */
export function mergeById<T extends { id?: unknown }>(existing: T[], incoming: T[]): T[] {
  const ids = new Set(existing.map((e) => e.id).filter((x) => x != null));
  return [...existing, ...incoming.filter((i) => i.id == null || !ids.has(i.id))];
}
