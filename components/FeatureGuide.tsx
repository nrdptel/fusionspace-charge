// A tasteful, collapsed "what's in here" panel near the top of the page. It gives a
// first-time visitor the whole tool at a glance — the four-step loop it's built around and
// every feature grouped by what it's for — without burying the calculator under a wall of
// marketing. Each group is a jump-link to its section's anchor, so it doubles as a table of
// contents. No client JS: it's a native <details> plus in-page anchors.

const STEPS: { n: number; label: string; note: string; href: string }[] = [
  {
    n: 1,
    label: "Size",
    note: "Enter the airframe and how it's held; get a charge.",
    href: "#calculator",
  },
  {
    n: 2,
    label: "Ground-test",
    note: "Bench-test up the ladder until separation is clean.",
    href: "#ground-test",
  },
  {
    n: 3,
    label: "Validate",
    note: "Two clean tests at one charge make it flight-ready.",
    href: "#ground-test",
  },
  {
    n: 4,
    label: "Take it to the field",
    note: "Bench mode, a printable card, or a cert report.",
    href: "#field",
  },
];

const GROUPS: { id: string; title: string; blurb: string; points: string[] }[] = [
  {
    id: "calculator",
    title: "Size the charge",
    blurb: "The core calculator — how much black powder to separate your airframe.",
    points: [
      "Size by target pressure or by separation force (shear pins + friction)",
      "Or the Fetter model — the research-backed method for parachute deployment, shown against the traditional result with the ratio",
      "Single or dual deploy, with a diameter and length per bay",
      "Redundant-altimeter backup charge (+20%, or +0.5 g, whichever is larger)",
      "Safety margin, field-elevation advisory, unit toggles, size & pin presets",
      "Save rockets, and share any setup as a link",
    ],
  },
  {
    id: "ground-test",
    title: "Test & validate",
    blurb: "Close the loop between the estimate and what actually separates clean.",
    points: [
      "Log ground tests per airframe, with outcome and notes",
      "Calibrates to your results and suggests the next charge to try",
      "Marks a charge “validated” once two clean tests agree",
      "Proven-charge callout, with a guard if the setup later drifts",
    ],
  },
  {
    id: "field",
    title: "Take it to the field",
    blurb: "What you need at the pad, and the paperwork for after.",
    points: [
      "Bench mode — a high-contrast, big-number pad view",
      "Build & ground-test card (HTML, PDF, or copy as text)",
      "Recovery report for a cert package or build thread (HTML / PDF)",
    ],
  },
  {
    id: "methodology",
    title: "Understand the math",
    blurb: "Nothing here is fudged — the whole calculation is shown.",
    points: [
      "The ideal-gas formula, its constants, and a worked example",
      "The Fetter deployment model, its constants, and the traditional-vs-Fetter comparison",
      "The assumptions, and why there's no efficiency fudge factor",
      "Cited references and sources",
    ],
  },
  {
    id: "vent",
    title: "Altimeter vent ports",
    blurb: "A companion tool for the av-bay, not the charge wells.",
    points: [
      "Sizes static sampling ports by the standard rule of thumb",
      "Suggests the nearest drill bit, and shows the area math",
    ],
  },
  {
    id: "data",
    title: "Your data & install",
    blurb: "It's yours, it stays in your browser, and it works offline.",
    points: [
      "Back up and restore everything as one file",
      "Installable as an app; works with no connection",
    ],
  },
];

export default function FeatureGuide() {
  return (
    <details className="group mt-8 rounded-xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <summary className="flex cursor-pointer select-none flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            What&apos;s in here
          </span>
          <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:inline">
            Size &rarr; Ground-test &rarr; Validate &rarr; Take it to the field
          </span>
        </span>
        <span className="text-xs text-zinc-500 transition group-open:hidden dark:text-zinc-400">
          Show the full tour &darr;
        </span>
        <span className="hidden text-xs text-zinc-500 group-open:inline dark:text-zinc-400">
          Hide &uarr;
        </span>
      </summary>

      <div className="border-t border-zinc-200 px-5 py-5 dark:border-zinc-800">
        {/* The loop the whole tool is built around. */}
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n}>
              <a
                href={s.href}
                className="flex h-full gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition hover:border-indigo-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-indigo-500/60"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {s.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {s.note}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>

        {/* Every feature, grouped by what it's for; each card jumps to its section. */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="block rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-indigo-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-indigo-500/60"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {g.title}
                </span>
                <span aria-hidden className="text-indigo-500 dark:text-indigo-400">
                  &rarr;
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {g.blurb}
              </p>
              <ul className="mt-2 space-y-1">
                {g.points.map((p, i) => (
                  <li
                    key={i}
                    className="flex gap-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300"
                  >
                    <span aria-hidden className="mt-px shrink-0 text-indigo-400">
                      &middot;
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </a>
          ))}
        </div>

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          New to ejection charges? Start at the top and work down &mdash; the page follows the
          same order: size, test, then take it to the field.
        </p>
      </div>
    </details>
  );
}
