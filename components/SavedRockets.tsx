"use client";

import { useEffect, useState } from "react";
import type { State } from "@/lib/state";

interface SavedRocket {
  id: string;
  name: string;
  state: State;
}

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
}: {
  current: State;
  onLoad: (state: State) => void;
}) {
  const [rockets, setRockets] = useState<SavedRocket[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRockets(JSON.parse(raw));
    } catch {
      /* ignore malformed storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rockets));
    } catch {
      /* storage full/unavailable */
    }
  }, [rockets, loaded]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const snapshot: SavedRocket = {
      id: newId(),
      name: trimmed,
      state: JSON.parse(JSON.stringify(current)),
    };
    setRockets((r) => [...r, snapshot]);
    setName("");
    setAdding(false);
  };

  const remove = (id: string) => setRockets((r) => r.filter((x) => x.id !== id));

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Saved rockets
        </h2>
        {adding ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={name}
              placeholder="Name this setup"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") {
                  setAdding(false);
                  setName("");
                }
              }}
              className="w-44 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-600"
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
              onClick={() => {
                setAdding(false);
                setName("");
              }}
              className="rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400"
          >
            <span aria-hidden>+</span> Save current setup
          </button>
        )}
      </div>

      {rockets.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {rockets.map((r) => (
            <li
              key={r.id}
              className="inline-flex items-center overflow-hidden rounded-full border border-zinc-300 bg-zinc-50 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <button
                type="button"
                onClick={() => onLoad(JSON.parse(JSON.stringify(r.state)))}
                title={`Load "${r.name}"`}
                className="py-1 pl-3 pr-2 font-medium text-zinc-700 transition hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-400"
              >
                {r.name}
              </button>
              <button
                type="button"
                onClick={() => remove(r.id)}
                aria-label={`Delete ${r.name}`}
                className="px-2 py-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
