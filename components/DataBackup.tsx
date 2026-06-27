"use client";

import { useRef } from "react";
import { buildBackup, readBackup, mergeById } from "@/lib/backup";

const KEYS = {
  rockets: "charge.rockets",
  testlog: "charge.testlog",
  theme: "charge.theme",
} as const;

function readArray(key: string): { id?: unknown }[] {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Back up and restore everything that lives only in this browser — saved rockets, the
 * ground-test log, and the theme — as one JSON file. The log can already export itself, but
 * saved rockets had no backup, so a cleared cache or a new device would lose them. Restore
 * merges (by id), so it combines with whatever's already here rather than clobbering it.
 */
export default function DataBackup() {
  const fileRef = useRef<HTMLInputElement>(null);

  const backUp = () => {
    const data = buildBackup({
      rockets: readArray(KEYS.rockets),
      testlog: readArray(KEYS.testlog),
      theme: localStorage.getItem(KEYS.theme),
      exportedAt: new Date().toISOString(),
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "charge-backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const restore = async (file: File) => {
    const parsed = readBackup(await file.text());
    if (!parsed) {
      alert("Couldn't read that file — expected a Charge backup (.json).");
      return;
    }
    try {
      localStorage.setItem(
        KEYS.rockets,
        JSON.stringify(mergeById(readArray(KEYS.rockets), parsed.rockets as { id?: unknown }[])),
      );
      localStorage.setItem(
        KEYS.testlog,
        JSON.stringify(mergeById(readArray(KEYS.testlog), parsed.testlog as { id?: unknown }[])),
      );
      if (parsed.theme) localStorage.setItem(KEYS.theme, parsed.theme);
    } catch {
      alert("Restore failed — this browser's storage may be full or unavailable.");
      return;
    }
    // Reload so the saved-rockets and log components re-read the merged data. The current
    // calculation is in the URL, so it survives the reload.
    window.location.reload();
  };

  return (
    <section className="mt-16 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Your data
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Your saved rockets and ground-test log live in this browser only. Back them up so a
        cleared cache or a new device doesn&apos;t lose them — one file holds everything, and
        restoring merges it with whatever&apos;s already here.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          onClick={backUp}
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Back up all (.json)
        </button>
        <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
          ·
        </span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Restore…
        </button>
      </div>
      <input
        ref={fileRef}
        id="restore-file"
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow re-restoring the same file
          if (file) restore(file);
        }}
      />
    </section>
  );
}
