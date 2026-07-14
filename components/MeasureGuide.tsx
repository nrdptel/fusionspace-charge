// A small labeled schematic so beginners measure the right things: the inner
// diameter is the tube's bore (not the outside), and the pressurized length runs
// from the charge's bulkhead to the separation joint — not the whole airframe.
// Collapsed by default and paired with definitions, so it reads as reference, not
// decoration. Theme-aware via Tailwind stroke/fill utilities.
//
// The Fetter mode names the same dimension "compartment length" on its input card, so
// pass `fetter` to keep the diagram's vocabulary in step with the card above it rather
// than mixing "well" and "compartment" copy on one screen.
export default function MeasureGuide({ fetter = false }: { fetter?: boolean }) {
  const lengthLabel = fetter ? "compartment length" : "pressurized length";
  return (
    <details className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <summary className="cursor-pointer select-none font-medium text-zinc-700 dark:text-zinc-300">
        What am I measuring?
      </summary>
      <div className="mt-3 space-y-4 text-zinc-600 dark:text-zinc-400">
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
        <svg
          viewBox="60 22 340 192"
          role="img"
          aria-label={`Airframe section: the inner diameter is measured across the tube's inside bore; the ${lengthLabel} runs from the charge's bulkhead to the separation joint.`}
          className="mx-auto h-auto w-full max-w-md"
          fontSize="11"
        >
          <defs>
            <marker
              id="mg-arrow"
              viewBox="0 0 10 10"
              refX="9.5"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" className="fill-zinc-500 dark:fill-zinc-400" />
            </marker>
          </defs>

          {/* Pressurized bay (bulkhead → joint), within the bore */}
          <rect x="170" y="69" width="148" height="74" className="fill-indigo-500/10" />
          {/* Tube walls (top & bottom) — the bore is the gap between them, which is
              what the inner-diameter dimension measures */}
          <rect x="80" y="62" width="300" height="7" rx="3" className="fill-zinc-300 dark:fill-zinc-700" />
          <rect x="80" y="143" width="300" height="7" rx="3" className="fill-zinc-300 dark:fill-zinc-700" />
          {/* Bulkhead (spans the bore, between the walls) */}
          <line
            x1="170"
            y1="69"
            x2="170"
            y2="143"
            className="stroke-zinc-500 dark:stroke-zinc-400"
            strokeWidth="5"
          />
          {/* Charge well, on the bulkhead face, centered on the bore */}
          <rect x="174" y="97" width="16" height="18" rx="3" className="fill-indigo-500" />
          {/* Separation joint — crosses both walls to show where the airframe splits */}
          <line
            x1="318"
            y1="60"
            x2="318"
            y2="152"
            className="stroke-zinc-400 dark:stroke-zinc-500"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* Inner-diameter dimension — spans the bore between the inner wall faces,
              so it reads as the inside, not the outside */}
          <line
            x1="120"
            y1="69"
            x2="120"
            y2="143"
            className="stroke-zinc-500 dark:stroke-zinc-400"
            strokeWidth="1.25"
            markerStart="url(#mg-arrow)"
            markerEnd="url(#mg-arrow)"
          />
          <text x="131" y="110" className="fill-zinc-600 dark:fill-zinc-400">
            ID
          </text>

          {/* Pressurized-length dimension, with witness lines down from the
              bulkhead and the joint so it spans exactly that bay */}
          <line x1="170" y1="150" x2="170" y2="184" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth="1" />
          <line x1="318" y1="150" x2="318" y2="184" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth="1" />
          <line
            x1="170"
            y1="180"
            x2="318"
            y2="180"
            className="stroke-zinc-500 dark:stroke-zinc-400"
            strokeWidth="1.25"
            markerStart="url(#mg-arrow)"
            markerEnd="url(#mg-arrow)"
          />
          <text x="244" y="200" textAnchor="middle" className="fill-zinc-600 dark:fill-zinc-400">
            {lengthLabel}
          </text>

          {/* Top callouts with leader lines to the feature */}
          <line x1="170" y1="46" x2="170" y2="62" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth="1" />
          <text x="170" y="42" textAnchor="middle" className="fill-zinc-600 dark:fill-zinc-400">
            bulkhead + charge{fetter ? "" : " well"}
          </text>
          <line x1="318" y1="46" x2="318" y2="60" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth="1" />
          <text x="318" y="42" textAnchor="middle" className="fill-zinc-600 dark:fill-zinc-400">
            separation joint
          </text>
        </svg>
        </div>

        <dl className="space-y-3">
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Inner diameter (ID)</dt>
            <dd>The tube&apos;s inside bore — what the gas actually fills. Not the outside diameter.</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">
              {fetter ? "Compartment length" : "Pressurized length"}
            </dt>
            <dd>
              From the charge&apos;s bulkhead to the separation joint — the bay the gas
              pressurizes. Not the whole airframe; measure the section that actually splits.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">
              {fetter ? "Bulkhead & charge" : "Bulkhead & charge well"}
            </dt>
            <dd>The sealed plate the charge sits on; the gas pushes against it to separate the joint.</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Separation joint</dt>
            <dd>Where the airframe comes apart — held by the shear pins and friction until pressure builds.</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}
