"use client";

import { useMemo, useState } from "react";
import Calculator from "./Calculator";
import VentPorts from "./VentPorts";
import GroundTestLog from "./GroundTestLog";
import { summarizeFor, type TestEntry } from "@/lib/testlog";

/** A charge weight sent from a well's ground-test plan to the log. The nonce makes
 *  each pick a distinct value so re-picking the same weight still re-triggers. */
export interface PendingCharge {
  value: number;
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

  const planCharge = (value: number) =>
    setPendingCharge((p) => ({ value, nonce: (p?.nonce ?? 0) + 1 }));

  // Close the loop: when the active airframe has clean ground tests logged, hand the
  // calculator its proven charge so it can point past the estimate to what actually worked.
  const testedSummary = useMemo(() => {
    if (!activeRocket) return null;
    const s = summarizeFor(logEntries, activeRocket);
    return s.lastClean ? { name: activeRocket, ...s } : null;
  }, [activeRocket, logEntries]);

  return (
    <>
      <Calculator
        onActiveRocketChange={setActiveRocket}
        onPlanCharge={planCharge}
        testedSummary={testedSummary}
      />
      <VentPorts />
      <GroundTestLog
        defaultLabel={activeRocket}
        pendingCharge={pendingCharge}
        onEntriesChange={setLogEntries}
      />
    </>
  );
}
