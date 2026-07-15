// A small labeled diagram of the dual-deploy recovery sequence, so a beginner can see what
// the two charges this calculator sizes actually do in flight: the drogue charge opens the
// airframe at apogee for a fast, stable descent, then the main charge deploys the main
// parachute down low for a gentle landing. Collapsed by default; reads as reference, not
// decoration. Theme-aware via Tailwind stroke/fill utilities.
//
// The Fetter mode titles its two cards "Drogue/Main compartment" rather than "well", so pass
// `fetter` to point this prose at the cards by the name they actually carry above it.
export default function DeploySequence({ fetter = false }: { fetter?: boolean }) {
  const section = fetter ? "compartment" : "well";
  return (
    <details className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <summary className="cursor-pointer select-none font-medium text-zinc-700 dark:text-zinc-300">
        How dual deployment works
      </summary>
      <div className="mt-3 space-y-4 text-zinc-600 dark:text-zinc-400">
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
          <svg
            viewBox="0 0 460 200"
            role="img"
            aria-label="Dual-deploy flight: the drogue charge fires at apogee for a fast, stable descent, then the main charge fires down low to deploy the main parachute for a gentle landing."
            className="mx-auto h-auto w-full max-w-xl"
            fontSize="11"
          >
            {/* Ground */}
            <line x1="20" y1="178" x2="448" y2="178" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth="1.5" />
            <text x="24" y="193" className="fill-zinc-500 dark:fill-zinc-400">ground / pad</text>

            {/* Flight path: ascent to apogee, drogue (fast) descent, main (slow) descent */}
            <path d="M40,178 Q120,32 205,40" fill="none" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="2" />
            <path d="M205,40 Q258,82 305,120" fill="none" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="2" />
            <path d="M305,120 Q338,150 366,177" fill="none" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="2" />

            {/* Apogee — drogue event */}
            <circle cx="205" cy="40" r="4.5" className="fill-indigo-500" />
            <line x1="205" y1="35" x2="205" y2="20" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth="1" />
            <text x="205" y="16" textAnchor="middle" className="fill-zinc-600 dark:fill-zinc-300">
              Apogee — drogue charge fires
            </text>

            {/* Main event */}
            <circle cx="305" cy="120" r="4.5" className="fill-indigo-500" />
            <line x1="305" y1="120" x2="305" y2="178" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth="1" strokeDasharray="3 3" />
            <text x="317" y="114" className="fill-zinc-600 dark:fill-zinc-300">
              Main charge fires
            </text>
            <text x="317" y="128" className="fill-zinc-500 dark:fill-zinc-500">
              (~500–1000 ft)
            </text>

            {/* Phase captions */}
            <text x="236" y="66" className="fill-zinc-500 dark:fill-zinc-500">drogue: fast, stable</text>
            <text x="338" y="158" className="fill-zinc-500 dark:fill-zinc-500">main: slow</text>
          </svg>
        </div>

        <dl className="space-y-3">
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Drogue charge (apogee)</dt>
            <dd>
              Fires at the top of the flight to split the airframe and release a small drogue
              chute. The rocket comes down fast but stable — not drifting for miles, not
              falling flat. This is the drogue {section} above.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Main charge (low altitude)</dt>
            <dd>
              Fires a few hundred to ~1,000 ft up to deploy the main parachute for a gentle
              landing. Late, so the rocket doesn&apos;t drift far under the big chute. This is
              the main {section} above.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Why two charges</dt>
            <dd>
              Each event is its own charge in its own section, sized independently — usually
              the same tube diameter but very different pressurized lengths, which is why the
              two {section}s can come out to different masses.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Pin the main joint</dt>
            <dd>
              Most flyers hold the main joint with shear pins (and often the drogue too).
              Friction alone can let the main pull out early under drogue-descent drag — a{" "}
              <span className="font-medium">drag separation</span> — deploying the big chute at
              high speed and shredding it. That&apos;s why the main defaults to more pins than
              the drogue here.
            </dd>
          </div>
        </dl>
      </div>
    </details>
  );
}
