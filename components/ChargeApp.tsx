"use client";

import { useState } from "react";
import Calculator from "./Calculator";
import GroundTestLog from "./GroundTestLog";

/** Shares the active saved-rocket name between the calculator and the ground-test
 *  log: loading or saving a rocket pre-fills the log's airframe field, so a test
 *  is recorded against the airframe you're sizing for. */
export default function ChargeApp() {
  const [activeRocket, setActiveRocket] = useState("");
  return (
    <>
      <Calculator onActiveRocketChange={setActiveRocket} />
      <GroundTestLog defaultLabel={activeRocket} />
    </>
  );
}
