"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface PlanStep {
  label: string;
  grams: string;
}

export interface PlanWell {
  title: string;
  idText: string;
  lenText: string;
  estimate: string;
  backup?: string;
  steps: PlanStep[];
}

export interface PrintPlan {
  title: string;
  meta: string;
  wells: PlanWell[];
  tested?: string;
}

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * A print-only one-page build & ground-test card: the charge plan to take to the bench or
 * the field, where there may be no signal (and often no phones at the pad). It's portalled
 * to <body> and hidden on screen; a print rule in globals.css shows only this on print.
 */
export default function PrintCard({ plan }: { plan: PrintPlan }) {
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState("");
  useEffect(() => {
    setMounted(true);
    setDate(todayISO());
  }, []);
  if (!mounted) return null;

  const card = (
    <div className="print-card-root hidden bg-white p-8 font-sans text-[12px] text-black">
      <div className="flex items-baseline justify-between border-b-2 border-black pb-2">
        <h1 className="text-xl font-bold tracking-tight">Ejection charge &amp; ground-test card</h1>
        <span className="text-[11px]">charge.fusionspace.co</span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-base font-semibold">{plan.title}</span>
        <span>{plan.meta}</span>
        <span className="ml-auto">
          Date: <span className="font-mono">{date || "__________"}</span>
        </span>
      </div>

      {plan.tested && (
        <p className="mt-2 border border-black px-3 py-1.5">
          <strong>Proven charge:</strong> {plan.tested}. Fly the charge you tested.
        </p>
      )}

      {plan.wells.map((w) => (
        <div key={w.title} className="mt-5 break-inside-avoid">
          <div className="flex flex-wrap items-baseline gap-x-4 border-b border-black pb-1">
            <span className="text-sm font-semibold">{w.title}</span>
            <span>Inner Ø {w.idText}</span>
            <span>Pressurized length {w.lenText}</span>
            <span>
              Estimate <span className="font-mono font-semibold">{w.estimate} g</span>
            </span>
            {w.backup && (
              <span>
                Backup <span className="font-mono font-semibold">{w.backup} g</span>
              </span>
            )}
          </div>
          <table className="mt-2 w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="w-28 border border-black px-2 py-1 font-semibold">Charge (g)</th>
                <th className="w-56 border border-black px-2 py-1 font-semibold">Result</th>
                <th className="border border-black px-2 py-1 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {w.steps.map((s) => (
                <tr key={s.label}>
                  <td className="border border-black px-2 py-1.5">
                    <span className="font-mono font-semibold">{s.grams}</span>{" "}
                    <span className="text-[10px]">{s.label}</span>
                  </td>
                  <td className="border border-black px-2 py-1.5 text-[11px]">
                    ☐ clean ☐ partial ☐ no sep.
                  </td>
                  <td className="border border-black px-2 py-1.5"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <p className="mt-5 border-t-2 border-black pt-2 text-[11px] leading-relaxed">
        <strong>These are theoretical starting estimates, not numbers to fly unverified.</strong>{" "}
        Bench-test from the low charge up until separation is clean and energetic; fly the
        charge you proved, not the one the formula guessed. Black powder is an explosive —
        sizing, handling, and use are your responsibility.
      </p>
    </div>
  );

  return createPortal(card, document.body);
}
