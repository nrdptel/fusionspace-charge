"use client";

import { useState } from "react";
import Calculator from "./Calculator";
import GroundTestLog from "./GroundTestLog";

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

  const planCharge = (value: number) =>
    setPendingCharge((p) => ({ value, nonce: (p?.nonce ?? 0) + 1 }));

  return (
    <>
      <Calculator onActiveRocketChange={setActiveRocket} onPlanCharge={planCharge} />
      <GroundTestLog defaultLabel={activeRocket} pendingCharge={pendingCharge} />
    </>
  );
}
