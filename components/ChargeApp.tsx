"use client";

import { useMemo, useState } from "react";
import Calculator from "./Calculator";
import VentPorts from "./VentPorts";
import GroundTestLog from "./GroundTestLog";
import { summarizeFor, validatedCharge, type TestEntry } from "@/lib/testlog";

/** A charge weight sent from a well's ground-test plan to the log. The nonce makes
 *  each pick a distinct value so re-picking the same weight still re-triggers. */
export interface PendingCharge {
  value: number;
  /** The model estimate (g) this charge was planned from, for calibration. 0 = none. */
  estimate: number;
  nonce: number;
}

/** Wires the calculator, saved rockets, and ground-test log into one tool:
 *  - loading/saving a rocket pre-fills the log's airframe field;
 *  - picking a charge from a well's ground-test plan pre-fills the log's charge
 *    field and jumps to it. */
export default function ChargeApp() {
  const [activeRocket, setActiveRocket] = useState("");
  const [pendingCharge, setPendingCharge] = useState<PendingCharge | null>(null);
  const [logEntries, setLogEntries] = useState<TestEntry[]>([]);

  const planCharge = (value: number, estimate: number) =>
    setPendingCharge((p) => ({ value, estimate, nonce: (p?.nonce ?? 0) + 1 }));

  // Close the loop: when the active airframe has clean ground tests logged, hand the
  // calculator its proven charge so it can point past the estimate to what actually worked.
  const testedSummary = useMemo(() => {
    if (!activeRocket) return null;
    const s = summarizeFor(logEntries, activeRocket);
    if (!s.lastClean) return null;
    return {
      name: activeRocket,
      ...s,
      validated: validatedCharge(logEntries, activeRocket) ?? undefined,
    };
  }, [activeRocket, logEntries]);

  // The active airframe's logged tests, for the downloadable recovery report.
  const airframeTests = useMemo(() => {
    const key = activeRocket.trim().toLowerCase();
    if (!key) return [];
    return logEntries.filter((e) => e.label.trim().toLowerCase() === key);
  }, [activeRocket, logEntries]);

  return (
    <>
      {/* Core loop, top to bottom: size the charge → ground-test and validate it → take it
          to the field. The log is passed as children so the calculator can place it right
          after the sized charge, ahead of the export/methodology sections. */}
      <Calculator
        onActiveRocketChange={setActiveRocket}
        onPlanCharge={planCharge}
        testedSummary={testedSummary}
        airframeName={activeRocket}
        airframeTests={airframeTests}
      >
        <GroundTestLog
          defaultLabel={activeRocket}
          pendingCharge={pendingCharge}
          onEntriesChange={setLogEntries}
        />
      </Calculator>
      {/* Companion tool — about the av-bay, not the charge wells. Sits after the loop so it
          reads as a separate second tool rather than interrupting size → test. */}
      <VentPorts />
    </>
  );
}
