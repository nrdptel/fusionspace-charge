// A small labeled schematic so beginners measure the right things: the inner
// diameter is the tube's bore (not the outside), and the pressurized length runs
// from the charge's bulkhead to the separation joint — not the whole airframe.
// Collapsed by default and paired with definitions, so it reads as reference, not
// decoration. Theme-aware via Tailwind stroke/fill utilities.
export default function MeasureGuide() {
  return (
    <details className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <summary className="cursor-pointer select-none font-medium text-zinc-700 dark:text-zinc-300">
        What am I measuring?
      </summary>
      <div className="mt-3 space-y-4 text-zinc-600 dark:text-zinc-400">
        <svg
          viewBox="0 0 440 210"
          role="img"
          aria-label="Airframe section: the inner diameter is the tube's inside bore; the pressurized length runs from the charge's bulkhead to the separation joint."
          className="h-auto w-full max-w-md"
          fontSize="11"
        >
          <defs>
            <marker
              id="mg-arrow"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" className="fill-zinc-400 dark:fill-zinc-500" />
            </marker>
          </defs>

          {/* Pressurized bay (bulkhead → joint) */}
          <rect x="165" y="60" width="165" height="70" className="fill-indigo-500/10" />
          {/* Airframe tube */}
          <rect
            x="70"
            y="60"
            width="300"
            height="70"
            rx="10"
            fill="none"
            className="stroke-zinc-400 dark:stroke-zinc-600"
            strokeWidth="2"
          />
          {/* Bulkhead */}
          <line
            x1="165"
            y1="60"
            x2="165"
            y2="130"
            className="stroke-zinc-500 dark:stroke-zinc-400"
            strokeWidth="4"
          />
          {/* Charge well */}
          <rect x="170" y="88" width="14" height="14" rx="2" className="fill-indigo-500" />
          {/* Separation joint */}
          <line
            x1="330"
            y1="54"
            x2="330"
            y2="136"
            className="stroke-zinc-400 dark:stroke-zinc-500"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* Inner-diameter dimension */}
          <line
            x1="52"
            y1="60"
            x2="52"
            y2="130"
            className="stroke-zinc-400 dark:stroke-zinc-500"
            strokeWidth="1.5"
            markerStart="url(#mg-arrow)"
            markerEnd="url(#mg-arrow)"
          />
          <text x="46" y="99" textAnchor="end" className="fill-zinc-600 dark:fill-zinc-400">
            ID
          </text>

          {/* Pressurized-length dimension */}
          <line
            x1="165"
            y1="152"
            x2="330"
            y2="152"
            className="stroke-zinc-400 dark:stroke-zinc-500"
            strokeWidth="1.5"
            markerStart="url(#mg-arrow)"
            markerEnd="url(#mg-arrow)"
          />
          <text x="247" y="170" textAnchor="middle" className="fill-zinc-600 dark:fill-zinc-400">
            pressurized length
          </text>

          {/* Callout labels */}
          <line x1="165" y1="48" x2="165" y2="58" className="stroke-zinc-300 dark:stroke-zinc-700" />
          <text x="160" y="44" textAnchor="middle" className="fill-zinc-600 dark:fill-zinc-400">
            bulkhead + charge well
          </text>
          <line x1="330" y1="48" x2="330" y2="54" className="stroke-zinc-300 dark:stroke-zinc-700" />
          <text x="330" y="44" textAnchor="middle" className="fill-zinc-600 dark:fill-zinc-400">
            separation joint
          </text>
        </svg>

        <dl className="space-y-2">
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Inner diameter (ID)</dt>
            <dd>The tube&apos;s inside bore — what the gas actually fills. Not the outside diameter.</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Pressurized length</dt>
            <dd>
              From the charge&apos;s bulkhead to the separation joint — the bay the gas
              pressurizes. Not the whole airframe; measure the section that actually splits.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Bulkhead &amp; charge well</dt>
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
