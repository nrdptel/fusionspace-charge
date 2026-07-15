"use client";

import { useEffect, useRef, useState } from "react";
import { fmtMass } from "@/lib/format";

export interface BenchStep {
  label: string;
  grams: number;
  /** Model estimate this step calibrates against (0 = none, e.g. the backup step). */
  estimate: number;
}

export interface BenchWell {
  title: string;
  primary: string;
  backup?: string;
  steps: BenchStep[];
}

/**
 * A full-screen, high-contrast, large-type view for the moment the tool is actually used:
 * a phone propped on a workbench or at the pad, in bright sun, with greasy or gloved hands.
 * Just the charges, big, and the test ladder as large tap targets — tap one to start
 * logging that test. Everything else (the calculator, the methodology, the log form) is for
 * the desk; this is for the field.
 */
export default function BenchMode({
  wells,
  proven,
  emptyNote,
  onPlan,
  onClose,
}: {
  wells: BenchWell[];
  proven: { label: string; charge: string } | null;
  /** Shown in place of the default "enter an airframe" prompt when there are no charges for a
   *  reason other than empty inputs — e.g. a Fetter deployment outside the altitude envelope. */
  emptyNote?: string;
  onPlan: (grams: number, estimate: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Capture whatever opened the dialog on the first render — the lazy initializer runs during
  // render, before autoFocus moves focus to "Done" — so focus can be restored on close (2.4.3).
  const [opener] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    const focusable = () =>
      dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'button, [href], input, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute("disabled"))
        : [];

    // Escape closes; Tab is trapped so focus can't reach the (aria-modal-hidden) page behind.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !dialog?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog?.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    // Lock the page behind so a swipe doesn't scroll it under the overlay.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the trigger so keyboard flow resumes where it left off.
      opener?.focus?.();
    };
  }, [onClose, opener]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Bench mode"
      className="fixed inset-0 z-50 overflow-auto bg-zinc-950 text-white"
    >
      <div className="mx-auto max-w-2xl px-5 py-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Bench mode
          </span>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="rounded-lg border border-zinc-600 px-5 py-2.5 text-base font-semibold text-white transition active:bg-zinc-800"
          >
            Done
          </button>
        </div>

        {proven && (
          <div className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-lg text-emerald-300">
            <span className="font-semibold">✓ {proven.label}:</span>{" "}
            <span className="font-mono tabular-nums">{proven.charge} g</span> — fly the charge
            you proved.
          </div>
        )}

        {wells.length === 0 && (
          <p className="mt-8 text-lg text-zinc-400">
            {emptyNote ?? "Enter an airframe to see its charges here."}
          </p>
        )}

        {wells.map((w) => (
          <div key={w.title} className="mt-6 border-t border-zinc-800 pt-5">
            <div className="text-sm uppercase tracking-wide text-zinc-400">{w.title}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-6xl font-bold tabular-nums">{w.primary}</span>
              <span className="text-2xl text-zinc-400">g</span>
            </div>
            {w.backup && (
              <div className="mt-1 font-mono text-2xl tabular-nums text-zinc-300">
                backup {w.backup} g
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {w.steps.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => onPlan(s.grams, s.estimate)}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-left transition active:bg-zinc-800"
                >
                  <span className="block text-xs uppercase tracking-wide text-zinc-400">
                    {s.label}
                  </span>
                  <span className="block font-mono text-2xl font-semibold tabular-nums">
                    {fmtMass(s.grams)} g
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <p className="mt-7 text-sm leading-relaxed text-zinc-500">
          Tap a charge to start logging that test. A high-contrast view for the bench or the
          pad — your numbers, big and readable in the sun.
        </p>
      </div>
    </div>
  );
}
