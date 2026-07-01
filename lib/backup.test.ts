import { describe, it, expect } from "vitest";
import { buildBackup, readBackup, mergeById, BACKUP_VERSION, MAX_IMPORT_ITEMS } from "./backup";

describe("import size cap", () => {
  it("caps each list so a pathologically large file can't freeze the tab", () => {
    const huge = Array.from({ length: MAX_IMPORT_ITEMS + 500 }, (_, i) => ({ id: `r${i}` }));
    const r = readBackup(JSON.stringify({ rockets: huge, testlog: huge }));
    expect(r?.rockets.length).toBe(MAX_IMPORT_ITEMS);
    expect(r?.testlog.length).toBe(MAX_IMPORT_ITEMS);
  });
});

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

  it("drops non-object junk from the arrays (a corrupted backup restores the good items)", () => {
    const r = readBackup(
      JSON.stringify({ rockets: [1, "x", null, { id: "ok" }], testlog: [null, { id: "t" }] }),
    );
    expect(r).toEqual({ rockets: [{ id: "ok" }], testlog: [{ id: "t" }], theme: null });
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

  it("skips null / non-object items instead of throwing (one bad entry can't abort a restore)", () => {
    expect(
      mergeById<{ id?: string }>([], [null as never, 1 as never, { id: "a" }]),
    ).toEqual([{ id: "a" }]);
  });

  it("dedupes duplicate ids WITHIN the incoming list, not just against existing", () => {
    const merged = mergeById<{ id?: string; v: number }>(
      [],
      [{ id: "a", v: 1 }, { id: "a", v: 2 }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].v).toBe(1); // first occurrence wins
  });
});
