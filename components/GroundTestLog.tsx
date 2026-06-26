"use client";

import { useEffect, useRef, useState } from "react";
import { Segmented } from "./ui";
import { NumberField } from "./ui";

type Outcome = "clean" | "partial" | "none";

interface TestEntry {
  id: string;
  date: string; // yyyy-mm-dd
  label: string; // which well / airframe
  charge: number; // grams
  outcome: Outcome;
  notes: string;
}

const STORAGE_KEY = "charge.testlog";

const OUTCOME_LABEL: Record<Outcome, string> = {
  clean: "Clean",
  partial: "Partial",
  none: "No sep.",
};

const OUTCOME_STYLE: Record<Outcome, string> = {
  clean:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  partial:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  none: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  }
}

export default function GroundTestLog({
  defaultLabel = "",
  pendingCharge = null,
}: {
  /** The active saved rocket's name, used to pre-fill the airframe field so a
   *  test is recorded against the airframe being sized. */
  defaultLabel?: string;
  /** A charge weight picked from a well's ground-test plan; pre-fills the charge
   *  field and jumps here so the test is ready to record. */
  pendingCharge?: { value: number; nonce: number } | null;
}) {
  const [entries, setEntries] = useState<TestEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Draft form
  const [date, setDate] = useState(todayISO());
  const [label, setLabel] = useState("");
  const [charge, setCharge] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>("clean");
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // When a saved rocket becomes active, default the airframe field to its name
  // (still editable). Only fires on a real change, so it won't clobber typing.
  useEffect(() => {
    if (defaultLabel) setLabel(defaultLabel);
  }, [defaultLabel]);

  // When a charge is picked from a well's ground-test plan, drop it into the form
  // and bring the log into view so the test is ready to record. The nonce makes
  // every pick distinct, so re-picking the same weight still fires.
  useEffect(() => {
    if (!pendingCharge) return;
    setCharge(pendingCharge.value);
    document
      .getElementById("ground-test")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pendingCharge]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw));
    } catch {
      /* ignore malformed storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* storage may be full or unavailable */
    }
  }, [entries, loaded]);

  const add = () => {
    if (charge <= 0) return;
    const entry: TestEntry = {
      id: newId(),
      date: date || todayISO(),
      label: label.trim() || "—",
      charge,
      outcome,
      notes: notes.trim(),
    };
    setEntries((e) => [entry, ...e]);
    // reset the parts that change per test, keep date/label for fast repeat entries
    setCharge(0);
    setNotes("");
  };

  const remove = (id: string) => setEntries((e) => e.filter((x) => x.id !== id));

  const exportText = async () => {
    const lines = entries.map(
      (e) =>
        `${e.date}  ${e.charge} g  ${OUTCOME_LABEL[e.outcome]}  ${e.label}${
          e.notes ? `  — ${e.notes}` : ""
        }`,
    );
    const text = `Charge — ground-test log\n${lines.join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked */
    }
  };

  // Download the log as a JSON file so a season of test data survives a cleared
  // cache or a move to another device (there's no server to hold it).
  const exportJson = () => {
    const data = {
      tool: "charge",
      type: "ground-test-log",
      version: 1,
      exportedAt: new Date().toISOString(),
      entries,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "charge-ground-test-log.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Restore from an export, merging by id so importing on a second device
  // combines logs rather than clobbering them.
  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const incoming: unknown = Array.isArray(data) ? data : data?.entries;
      if (!Array.isArray(incoming)) throw new Error("no entries");
      const valid: TestEntry[] = incoming
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x): TestEntry => ({
          id: typeof x.id === "string" ? x.id : newId(),
          date: typeof x.date === "string" ? x.date : todayISO(),
          label: typeof x.label === "string" && x.label ? x.label : "—",
          charge: Number(x.charge) || 0,
          outcome:
            x.outcome === "partial" || x.outcome === "none" ? x.outcome : "clean",
          notes: typeof x.notes === "string" ? x.notes : "",
        }))
        // Same rule the add form enforces: a test has a real charge weight.
        .filter((e) => e.charge > 0);
      setEntries((cur) => {
        const seen = new Set(cur.map((c) => c.id));
        return [...valid.filter((v) => !seen.has(v.id)), ...cur];
      });
    } catch {
      alert("Couldn't read that file — expected a Charge ground-test log export.");
    }
  };

  return (
    <section id="ground-test" className="mt-16 scroll-mt-8">
      <div className="flex items-baseline justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold tracking-tight">Ground-test log</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {entries.length} {entries.length === 1 ? "test" : "tests"} · saved on this device
        </span>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        The charge that cleanly separated your airframe on the bench is the only number
        that counts. Record each test here so you fly what you proved, not what a formula
        guessed. Entries stay in this browser — nothing is uploaded.
      </p>

      {/* Add form */}
      <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:[color-scheme:dark]"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Well / airframe
            </span>
            <input
              type="text"
              value={label}
              placeholder="e.g. 4&quot; drogue"
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-600"
            />
          </label>
          <NumberField
            label="Charge tested"
            value={charge}
            onChange={setCharge}
            unit="g"
            step={0.1}
            placeholder="0.0"
          />
          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Result
            </span>
            <div className="mt-1.5">
              <Segmented<Outcome>
                ariaLabel="Test result"
                size="sm"
                value={outcome}
                onChange={setOutcome}
                options={[
                  { value: "clean", label: "Clean" },
                  { value: "partial", label: "Partial" },
                  { value: "none", label: "None" },
                ]}
              />
            </div>
          </div>
        </div>
        <label className="mt-4 block">
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notes
          </span>
          <input
            type="text"
            value={notes}
            placeholder="Powder, wadding, what you saw — pins sheared, gear thrown clear, etc."
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-600"
          />
        </label>
        <div className="mt-4">
          <button
            type="button"
            onClick={add}
            disabled={charge <= 0}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Log test
          </button>
        </div>
      </div>

      {/* Entries */}
      {entries.length > 0 && (
        <div className="mt-5">
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-4 bg-white px-4 py-3 dark:bg-zinc-900/40"
              >
                <span
                  className={
                    "mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                    OUTCOME_STYLE[e.outcome]
                  }
                >
                  {OUTCOME_LABEL[e.outcome]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {e.charge} g
                    </span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {e.label}
                    </span>
                    <span className="font-mono text-xs text-zinc-500 dark:text-zinc-500">
                      {e.date}
                    </span>
                  </div>
                  {e.notes && (
                    <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                      {e.notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  aria-label="Delete entry"
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {entries.length > 0 && (
          <>
            <button
              type="button"
              onClick={exportText}
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Copy log as text
            </button>
            <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
              ·
            </span>
            <button
              type="button"
              onClick={exportJson}
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Export (.json)
            </button>
            <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
              ·
            </span>
          </>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Import (.json)
        </button>
        {entries.length > 0 && (
          <>
            <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
              ·
            </span>
            <button
              type="button"
              onClick={() => {
                if (confirm("Clear the entire ground-test log on this device?"))
                  setEntries([]);
              }}
              className="font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Clear all
            </button>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // allow re-importing the same file
            if (file) importJson(file);
          }}
        />
      </div>
    </section>
  );
}
