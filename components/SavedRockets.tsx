"use client";

import { useEffect, useRef, useState } from "react";
import type { State } from "@/lib/state";
import { sanitizeRockets, type SavedRocket } from "@/lib/backup";

const STORAGE_KEY = "charge.rockets";

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  }
}

/** Save and reload named calculator setups — a flyer's handful of airframes, so the
 *  tube diameter and section lengths don't have to be re-entered each visit. Stored
 *  in this browser only (like the Motor Finder's "My Rockets"). */
export default function SavedRockets({
  current,
  onLoad,
  onActivate,
}: {
  current: State;
  onLoad: (state: State) => void;
  /** Notified with a rocket's name when it becomes active (saved or loaded), so
   *  the ground-test log can default its airframe field to it. */
  onActivate?: (name: string) => void;
}) {
  const [rockets, setRockets] = useState<SavedRocket[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saveError, setSaveError] = useState(false);
  // The exact string last read from / written to storage — guards the persist effect from
  // re-writing another tab's value and lets the cross-tab sync tell an external change from us.
  const lastPersisted = useRef<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // When the inline name form closes (save/cancel/Escape), the whole cluster unmounts and
  // focus would fall to <body>. Return it to the trigger so a keyboard user keeps their place.
  const refocusTrigger = useRef(false);
  // Index of a just-deleted chip, so focus can move to a neighbouring delete button instead
  // of falling to <body> — otherwise deleting several in a row dumps a keyboard user each time.
  const focusAfterDelete = useRef<number | null>(null);

  useEffect(() => {
    const idx = focusAfterDelete.current;
    if (idx == null) return;
    focusAfterDelete.current = null;
    const btns = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-delete]");
    if (btns && btns.length > 0) btns[Math.min(idx, btns.length - 1)].focus();
    else triggerRef.current?.focus();
  }, [rockets]);

  useEffect(() => {
    if (!adding && refocusTrigger.current) {
      refocusTrigger.current = false;
      triggerRef.current?.focus();
    }
  }, [adding]);

  const closeForm = () => {
    refocusTrigger.current = true;
    setAdding(false);
    setName("");
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      lastPersisted.current = raw;
      const parsed = raw ? JSON.parse(raw) : null;
      // Sanitize, not just Array-check: a null or an older/hand-edited entry would otherwise be
      // dereferenced in the render (or the load-click clone) and crash the whole tool into the
      // route error boundary, which reloads into the same store — an unrecoverable loop.
      if (Array.isArray(parsed)) setRockets(sanitizeRockets(parsed, newId));
    } catch {
      /* ignore malformed storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const serialized = JSON.stringify(rockets);
    // Skip a no-op write — notably when this update came from another tab (synced below), so
    // the two tabs don't ping-pong storage events.
    if (serialized === lastPersisted.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
      lastPersisted.current = serialized;
      setSaveError(false);
    } catch {
      // Storage full or blocked: the chip appears but nothing was persisted. Flag it so a
      // save that silently won't survive a reload doesn't look like it worked.
      setSaveError(true);
    }
  }, [rockets, loaded]);

  // Keep multiple open tabs in sync: adopt another tab's write instead of clobbering it with
  // this tab's stale list on the next save.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue === lastPersisted.current) return;
      lastPersisted.current = e.newValue;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        if (Array.isArray(parsed)) setRockets(sanitizeRockets(parsed, newId));
      } catch {
        /* ignore a malformed write from another tab */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Reuse an existing setup of the same name instead of silently creating a duplicate chip
    // (two identical-looking entries that load different geometry). Reusing its id keeps the
    // ground-test log's history — matched by name — pointing at one airframe.
    const existing = rockets.find((x) => x.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing && !confirm(`A saved setup named "${existing.name}" already exists. Replace it?`))
      return;
    const snapshot: SavedRocket = {
      id: existing?.id ?? newId(),
      name: trimmed,
      state: JSON.parse(JSON.stringify(current)),
    };
    setRockets((r) => (existing ? r.map((x) => (x.id === existing.id ? snapshot : x)) : [...r, snapshot]));
    onActivate?.(trimmed);
    setName("");
    refocusTrigger.current = true;
    setAdding(false);
  };

  const remove = (id: string) => {
    // A whole airframe config (tube, sections, pins) with no undo, and the × sits flush against
    // the load button — confirm before destroying it.
    const target = rockets.find((x) => x.id === id);
    if (target && !confirm(`Delete the saved setup "${target.name}"? This can't be undone.`)) return;
    focusAfterDelete.current = rockets.findIndex((x) => x.id === id);
    setRockets((r) => r.filter((x) => x.id !== id));
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Saved rockets
        </h2>
        {adding ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              autoFocus
              value={name}
              placeholder="Name this setup"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") closeForm();
              }}
              className="w-44 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none transition placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-400"
            />
            <button
              type="button"
              onClick={save}
              disabled={!name.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400"
          >
            <span aria-hidden>+</span> Save current setup
          </button>
        )}
      </div>

      {saveError && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
        >
          <span aria-hidden className="mt-px shrink-0">
            ⚠
          </span>
          <span>
            Couldn&apos;t save to this device — storage may be full or blocked. This setup
            won&apos;t survive a reload.
          </span>
        </p>
      )}

      {rockets.length > 0 ? (
        <ul ref={listRef} className="mt-3 flex flex-wrap gap-2">
          {rockets.map((r) => (
            <li
              key={r.id}
              className="inline-flex items-center overflow-hidden rounded-full border border-zinc-300 bg-zinc-50 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <button
                type="button"
                onClick={() => {
                  onLoad(JSON.parse(JSON.stringify(r.state)));
                  onActivate?.(r.name);
                }}
                title={`Load "${r.name}"`}
                className="py-1.5 pl-3 pr-2 font-medium text-zinc-700 transition hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-400"
              >
                {r.name}
              </button>
              <button
                type="button"
                data-delete
                onClick={() => remove(r.id)}
                aria-label={`Delete ${r.name}`}
                className="px-2.5 py-1.5 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !adding && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Save a setup to reload your airframe&apos;s tube, sections, and pins in one
            click. Stored in this browser.
          </p>
        )
      )}
    </div>
  );
}
