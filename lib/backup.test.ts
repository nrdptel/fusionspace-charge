import { describe, it, expect } from "vitest";
import { buildBackup, readBackup, mergeById, BACKUP_VERSION } from "./backup";

describe("backup file", () => {
  it("builds a tagged, versioned document", () => {
    const b = buildBackup({
      rockets: [{ id: "a" }],
      testlog: [{ id: "t" }],
      theme: "dark",
      exportedAt: "2026-06-27T00:00:00Z",
    });
    expect(b.tool).toBe("charge");
    expect(b.type).toBe("backup");
    expect(b.version).toBe(BACKUP_VERSION);
    expect(b.rockets).toHaveLength(1);
    expect(b.theme).toBe("dark");
  });

  it("round-trips through readBackup", () => {
    const json = JSON.stringify(
      buildBackup({ rockets: [{ id: "a" }], testlog: [], theme: null, exportedAt: "x" }),
    );
    const r = readBackup(json);
    expect(r).toEqual({ rockets: [{ id: "a" }], testlog: [], theme: null });
  });

  it("rejects non-backup or malformed input", () => {
    expect(readBackup("not json")).toBeNull();
    expect(readBackup("{}")).toBeNull();
    expect(readBackup(JSON.stringify({ rockets: "nope" }))).toBeNull();
  });

  it("accepts a file with just one of the arrays", () => {
    expect(readBackup(JSON.stringify({ testlog: [{ id: "t" }] }))).toEqual({
      rockets: [],
      testlog: [{ id: "t" }],
      theme: null,
    });
  });
});

describe("mergeById", () => {
  it("appends only items whose id isn't already present", () => {
    const merged = mergeById(
      [{ id: "a", v: 1 }],
      [{ id: "a", v: 2 }, { id: "b", v: 3 }],
    );
    expect(merged).toEqual([{ id: "a", v: 1 }, { id: "b", v: 3 }]);
  });

  it("keeps items without an id (can't dedup them)", () => {
    expect(mergeById<{ id?: string; v: number }>([], [{ v: 1 }, { v: 2 }])).toHaveLength(2);
  });
});
