"use client";

import { useEffect, useState } from "react";
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

export default function GroundTestLog() {
  const [entries, setEntries] = useState<TestEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Draft form
  const [date, setDate] = useState(todayISO());
  const [label, setLabel] = useState("");
  const [charge, setCharge] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>("clean");
  const [notes, setNotes] = useState("");

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
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
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
              onClick={() => {
                if (confirm("Clear the entire ground-test log on this device?"))
                  setEntries([]);
              }}
              className="font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
