"use client";

import { useEffect, useRef, useState } from "react";
import { Segmented } from "./ui";
import { NumberField } from "./ui";
import {
  calibrationFromEntries,
  failureCauses,
  nextChargeSuggestion,
  sanitizeEntries,
  validatedCharge,
  TESTLOG_STORAGE_KEY,
  type Outcome,
  type TestEntry,
} from "@/lib/testlog";
import { fmt, fmtMass } from "@/lib/format";

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
  onEntriesChange,
}: {
  /** The active saved rocket's name, used to pre-fill the airframe field so a
   *  test is recorded against the airframe being sized. */
  defaultLabel?: string;
  /** A charge weight picked from a well's ground-test plan; pre-fills the charge
   *  field and jumps here so the test is ready to record. `estimate` is the model
   *  baseline (0 if none), captured with the entry for calibration. */
  pendingCharge?: { value: number; estimate: number; nonce: number } | null;
  /** Notifies the parent of the current entries so the calculator can surface a
   *  tested charge for the active airframe. */
  onEntriesChange?: (entries: TestEntry[]) => void;
}) {
  const [entries, setEntries] = useState<TestEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // The exact string last read from or written to storage. Guards the persist effect from
  // re-writing a value another tab just wrote (which would ping-pong storage events), and
  // lets the cross-tab sync below tell a real external change from our own echo.
  const lastPersisted = useRef<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Index of a just-deleted entry, so focus moves to a neighbouring Delete button (or the
  // heading when the last one goes) instead of falling to <body> on a repeated action.
  const focusAfterDelete = useRef<number | null>(null);

  // Draft form
  // Empty on the server; filled to today on mount. Initializing from todayISO() during render
  // would bake the *build* date into the static HTML — a hydration mismatch, and a stale date
  // shown in an offline shell opened days after the build. The client sets the real today below.
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [charge, setCharge] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>("clean");
  const [notes, setNotes] = useState("");
  // The model estimate the drafted charge was planned from (0 = none), carried onto the
  // entry so the tool can learn how real charges compare to the formula.
  const [draftEstimate, setDraftEstimate] = useState(0);
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
    setDraftEstimate(pendingCharge.estimate);
    // Honor a reduced-motion preference: jump instead of animating the scroll.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById("ground-test")
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [pendingCharge]);

  // Default the new-test date to today, client-side only (see the date state note above).
  useEffect(() => setDate(todayISO()), []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TESTLOG_STORAGE_KEY);
      lastPersisted.current = raw;
      const parsed = raw ? JSON.parse(raw) : null;
      // Sanitize, don't just Array-check: an old, partially-written, or hand-edited store can
      // hold a null or an entry missing fields, which the render then dereferences and throws on
      // — and the route error boundary would re-read the same store on reload, an unrecoverable
      // loop. Run it through the same validator the import/restore paths use.
      if (Array.isArray(parsed)) setEntries(sanitizeEntries(parsed, newId, todayISO()));
    } catch {
      /* ignore malformed storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const serialized = JSON.stringify(entries);
    // Skip the write when nothing actually changed — in particular when this update came from
    // another tab's write (synced in below), so the two tabs don't bounce writes back and forth.
    if (serialized === lastPersisted.current) return;
    try {
      localStorage.setItem(TESTLOG_STORAGE_KEY, serialized);
      lastPersisted.current = serialized;
      setSaveError(false);
    } catch {
      // Storage full or blocked (private mode, quota). Surface it — otherwise the entry
      // shows in the list and the counter ticks up, but nothing was written and a reload
      // would silently lose it. Self-clears once a later write succeeds.
      setSaveError(true);
    }
  }, [entries, loaded]);

  // Keep multiple open tabs in sync: when another tab writes the log, adopt its value instead
  // of letting this tab's stale in-memory copy overwrite it on the next edit (silent data loss).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TESTLOG_STORAGE_KEY || e.newValue === lastPersisted.current) return;
      lastPersisted.current = e.newValue;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        if (Array.isArray(parsed)) setEntries(sanitizeEntries(parsed, newId, todayISO()));
      } catch {
        /* ignore a malformed write from another tab */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Surface the entries to the parent (once loaded, and on every change) so the
  // calculator can show the airframe's tested charge alongside the estimate.
  useEffect(() => {
    if (loaded) onEntriesChange?.(entries);
  }, [entries, loaded, onEntriesChange]);

  const add = () => {
    if (charge <= 0) return;
    const entry: TestEntry = {
      id: newId(),
      date: date || todayISO(),
      label: label.trim() || "—",
      charge,
      outcome,
      notes: notes.trim(),
      ...(draftEstimate > 0 ? { estimate: draftEstimate } : {}),
    };
    setEntries((e) => [entry, ...e]);
    // reset the parts that change per test, keep date/label for fast repeat entries
    setCharge(0);
    setNotes("");
    setDraftEstimate(0);
  };

  const remove = (id: string) => {
    focusAfterDelete.current = entries.findIndex((x) => x.id === id);
    setEntries((e) => e.filter((x) => x.id !== id));
  };

  useEffect(() => {
    const idx = focusAfterDelete.current;
    if (idx == null) return;
    focusAfterDelete.current = null;
    const btns = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-delete]");
    if (btns && btns.length > 0) btns[Math.min(idx, btns.length - 1)].focus();
    else headingRef.current?.focus();
  }, [entries]);

  const exportText = async () => {
    const lines = entries.map(
      (e) =>
        `${e.date}  ${fmtMass(e.charge)} g  ${OUTCOME_LABEL[e.outcome]}  ${e.label}${
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
      // Same normalization + charge>0 rule as the add form and the whole-tool restore.
      const valid = sanitizeEntries(incoming, newId, todayISO());
      setEntries((cur) => {
        const seen = new Set(cur.map((c) => c.id));
        return [...valid.filter((v) => !seen.has(v.id)), ...cur];
      });
    } catch {
      alert("Couldn't read that file — expected a Charge ground-test log export.");
    }
  };

  const calibration = calibrationFromEntries(entries);
  // Bench coaching for the airframe currently in the form: a validated charge is
  // flight-ready; otherwise the last result drives what to pack next.
  const validated = validatedCharge(entries, label);
  const next = validated ? null : nextChargeSuggestion(entries, label);

  return (
    <section id="ground-test" className="mt-16 scroll-mt-8">
      <div className="flex items-baseline justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold tracking-tight outline-none">
          Ground-test log
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {entries.length} {entries.length === 1 ? "test" : "tests"} · saved on this device
        </span>
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
            Couldn&apos;t save to this device — storage may be full or blocked. Recent entries
            aren&apos;t stored and will be lost on reload. Export the log to keep them.
          </span>
        </p>
      )}

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        The charge that cleanly separated your airframe on the bench is the only number
        that counts. Record each test here so you fly what you proved, not what a formula
        guessed. Entries stay in this browser — nothing is uploaded.
      </p>

      {calibration && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm leading-relaxed text-indigo-900 dark:text-indigo-200">
          <span aria-hidden className="mt-0.5 shrink-0 text-base">
            📈
          </span>
          <p>
            <strong className="font-semibold">Your calibration.</strong> Across{" "}
            {calibration.count} clean tests planned from the calculator, your charges ran on
            average{" "}
            <span className="font-mono font-semibold tabular-nums">
              {fmt(calibration.mean, 2)}×
            </span>{" "}
            the model&apos;s estimate (range {fmt(calibration.min, 2)}–{fmt(calibration.max, 2)}×).
            That&apos;s your own data, not the formula&apos;s — expect to ground-test toward the
            higher end. It never trims the estimate down; testing larger is the safe direction.
          </p>
        </div>
      )}

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
              Section / airframe
            </span>
            <input
              type="text"
              value={label}
              placeholder="e.g. 4&quot; drogue"
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-400"
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
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-400"
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

      {/* Bench coach: what to pack next, or flight-ready */}
      {validated && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm leading-relaxed text-emerald-800 dark:text-emerald-300">
          <span aria-hidden className="mt-0.5 shrink-0 text-base">
            ✓
          </span>
          <p>
            <strong className="font-semibold">{label} is validated.</strong>{" "}
            {validated.count} clean separations at{" "}
            <span className="font-mono font-semibold tabular-nums">
              {fmtMass(validated.charge)} g
            </span>{" "}
            — flight-ready. Fly the charge you proved.
          </p>
        </div>
      )}
      {next && (
        <div className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm leading-relaxed text-indigo-900 dark:text-indigo-200">
          <div className="flex flex-wrap items-center gap-3">
            <span aria-hidden className="shrink-0 text-base">
              🎯
            </span>
            <p className="min-w-0 flex-1">
              {next.kind === "increase" ? (
                <>
                  Last test of {label}:{" "}
                  <span className="font-mono tabular-nums">{fmtMass(next.fromCharge)} g</span>,{" "}
                  {OUTCOME_LABEL[next.fromOutcome].toLowerCase()}. Step up — try{" "}
                  <span className="font-mono font-semibold tabular-nums">
                    {fmtMass(next.suggested)} g
                  </span>{" "}
                  next.
                </>
              ) : (
                <>
                  {label}&apos;s{" "}
                  <span className="font-mono tabular-nums">{fmtMass(next.fromCharge)} g</span>{" "}
                  test was clean. Repeat it once to confirm — then it&apos;s validated.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setCharge(next.suggested);
                setDraftEstimate(0);
              }}
              className="shrink-0 rounded-lg border border-indigo-400/60 bg-white/70 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-white dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
            >
              Use {fmtMass(next.suggested)} g
            </button>
          </div>
          {next.kind === "increase" && (
            <details className="mt-3 border-t border-indigo-500/20 pt-3">
              <summary className="cursor-pointer select-none font-medium">
                Why might it not have separated?
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {failureCauses(next.fromOutcome).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Entries */}
      {entries.length > 0 && (
        <div className="mt-5">
          <ul ref={listRef} className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
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
                      {fmtMass(e.charge)} g
                    </span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {e.label}
                    </span>
                    {e.estimate && e.estimate > 0 && (
                      <span
                        title={`Model estimate was ${e.estimate} g`}
                        className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400"
                      >
                        {fmt(e.charge / e.estimate, 2)}× est
                      </span>
                    )}
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
                  data-delete
                  onClick={() => remove(e.id)}
                  aria-label="Delete entry"
                  className="shrink-0 rounded-md px-2 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
