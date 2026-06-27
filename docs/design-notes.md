# Charge — design notes

This is my working read of how Fusion Space looks, reads, and is built, plus the plan
for Charge. It's written down so it can be corrected early rather than late. It is not
user-facing.

## 1. What Fusion Space is, as a design

Two sites to learn from: the hub (`fusionspace.co`) and the HPR Motor Finder
(`motor.fusionspace.co`). They're unmistakably the same hand. The throughline:

- **Quiet and precise.** No marketing gloss, no gradients-for-the-sake-of-it, no
  hero imagery beyond the brand mark. Dense where it needs to be (the Motor Finder is a
  data tool), generous with whitespace everywhere else. The polish is in restraint and
  consistency, not decoration.
- **Honest about data.** Both sites tell you where every number comes from and where it
  might be wrong. The Motor Finder has a literal "Where the numbers come from" section
  and repeats, in plain words, that scraped stock is best-effort and may be stale —
  "always confirm on the vendor's own page before buying." Transparency isn't a footer
  link; it's part of the product.
- **Plain voice.** Copy is direct and a little warm. "made to be genuinely useful at
  the bench." "Personal, non-commercial projects — not affiliated with any rocketry
  vendor or manufacturer." Short sentences. No exclamation, no hype, no AI-boilerplate
  cadence ("Let's dive in", "In today's fast-paced world"). Em dashes for asides.

### Visual system (measured from the shipped CSS, not guessed)

- **Stack on screen:** Tailwind CSS v4 with the stock palette, Geist Sans + Geist Mono.
- **Neutrals:** Tailwind `zinc`. Light: `bg-white text-zinc-900`. Dark:
  `bg-zinc-950 text-zinc-100`. Secondary text `zinc-600` / `zinc-400` (dark). Borders
  `zinc-200` / `zinc-800`. Subtle fills `zinc-50` / `zinc-900`.
- **Primary accent:** `indigo` (buttons `bg-indigo-600 hover:bg-indigo-500`, links
  `text-indigo-600` / `indigo-400`, focus rings, the soft `indigo-500/15` glow behind
  the hub hero). The brand mark itself is a violet→blue gradient (`#9bb0ff` family) that
  reads on both light and dark.
- **Success / "live" accent:** `emerald` (the "Live" pill: `border-emerald-500/30
  bg-emerald-500/10 text-emerald-700` / `emerald-400`, with a small filled dot).
- **Type scale:** page title `text-2xl`–`text-4xl font-semibold tracking-tight`;
  section headers `text-lg font-semibold tracking-tight`; body `text-sm`/`text-base
  leading-relaxed`; meta and badges `text-xs` / `text-[11px]`. Numbers and codes use
  Geist Mono (`font-mono`).
- **Shapes:** cards `rounded-xl border bg-white p-5 dark:bg-zinc-900/40`, hover lifts
  the border to `indigo-400`. Buttons/inputs `rounded-lg` / `rounded-md`. Pills
  `rounded-full`. Shadows are barely-there (`hover:shadow-sm`).
- **Layout:** centered column, `mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-10`.
  Header is wordmark on the left, theme toggle on the right.
- **Theme toggle:** three-state — System / Light / Dark — as a small bordered button
  (`Color theme: System. Click to change.`). Preference persists in `localStorage`
  under a per-tool key (`fusionspace.theme` on the hub, `hpr.theme` on the Motor
  Finder). A tiny inline script runs before paint to set the `dark`/`light` class on
  `<html>` and avoid a flash. `theme-color` meta is `#ffffff` light / `#09090b` dark.
- **Footer:** thin top border, `text-xs text-zinc-500`. A row of links (GitHub, sibling
  tools, data sources) separated by `·`, a "Built by [Fusion Space logo]" mark, and a
  plain non-affiliation + best-effort disclaimer paragraph.
- **Transparency sections** are `<details>` disclosures: summary
  `cursor-pointer select-none font-medium text-zinc-700`, body
  `space-y-4 text-zinc-600 dark:text-zinc-400`, often a `<dl>` breaking down each term.

### Engineering system (inferred from the build output)

- **Next.js (App Router, Turbopack) statically exported** (`output: 'export'`), Tailwind
  v4, Geist via `next/font`, TypeScript. PWA manifest, full OG/Twitter meta, JSON-LD
  org/website schema, SVG favicon + apple-touch-icon. Deployed to Cloudflare Pages.
- **State lives in the URL.** The Motor Finder puts every filter/sort/search in query
  params so a view is shareable and survives reload. Per-device preferences (theme,
  saved rockets) live in `localStorage`, namespaced per tool.
- **No per-visitor server work.** Even the Motor Finder ships its data as a static
  snapshot; the page filters client-side. That's the hard line that keeps everything on
  Pages' free tier — and Charge, being pure math, is the easiest possible case.

## 2. What Charge is, as a product

A black-powder ejection-charge calculator for high-power rocketry. You tell it your
tube, your pressurized section, and how hard the airframe is to pull apart; it tells you
a starting black-powder mass in grams. Then — and this is the point — you go ground-test
it, and Charge helps you record what actually worked.

### Information architecture (how the page is organized)

The product grew a lot of features, so the page is deliberately ordered as the one loop a
flyer actually walks through, and reads top to bottom in exactly that order:

1. **Size** — the calculator (`#calculator`): controls, wells, results, and the ground-test
   ladder, ending with a nudge to go test.
2. **Ground-test & validate** — the log (`#ground-test`), placed immediately after the sized
   charge so the loop is contiguous. (It's owned by `ChargeApp` but passed into `Calculator`
   as `children`, which renders it between the result and the export panel — this keeps the
   calculator's state self-contained while still putting the log in loop order, no lifting.)
3. **Take it to the field** — one consolidated panel (`#field`) gathering every share / pad /
   export action: bench mode, copy/share link, the build & ground-test card, and the recovery
   report. Previously these were two separate clusters; merging them, and placing them after
   the log, means the card and report read best once tests are logged.
4. **Understand** — the methodology (`#methodology`), the math behind the number; reference you
   consult anytime, so it sits below the active loop.
5. **Companion tool** — altimeter vent ports (`#vent`), after the loop behind a "Companion
   tool" divider so it reads as a separate second tool (it's about the av-bay, not the charge
   wells) rather than interrupting size→test, which is where it used to sit.
6. **Your data & install** (`#data`), then the footer.

The earlier pass left the export panel and methodology *above* the log, which contradicted the
"size → test → field" loop the overview advertises; this ordering fixes that so the page
matches what it promises.

Discoverability is handled by a collapsed **"What's in here"** overview (`FeatureGuide`) near
the top: the four-step loop as numbered cards, then every feature grouped by purpose with a
jump-link to each section — a tasteful table of contents that doesn't push the calculator down
the page. It's a native `<details>` with in-page anchors, so it needs no client JS and stays
accessible. The header subtitle and the JSON-LD/`featureList` were refreshed to describe the
full tool rather than just the base calculator.

### Social card & metadata

The Open Graph / Twitter card is rendered to `public/og/default.png` by `scripts/gen-og.mjs` in
`prebuild` (a static export can't render the dynamic `next/og` route at request time), so it's a
gitignored build artifact. It uses the **HPR Motor Finder's exact card template** — the family
standard — via the same `next/og`/Satori renderer, so the output matches pixel-for-pixel: the
sparkle mark over the product name, a one-line tagline, and the domain, centered on `#09090b`
with the soft indigo glow (`radial-gradient(56% 64% at 50% 31%, …)`). The mark is the shared
asset in `lib/og-mark.ts`, identical to the sibling's. Only three strings differ between tools
(name, tagline, domain); using the same renderer is what guarantees the format is truly identical
rather than merely similar.

The metadata in `app/layout.tsx` mirrors the Motor Finder's conventions: a
`NEXT_PUBLIC_SITE_URL`-overridable origin for fork deploys, `og:site_name` set to the tool's own
name (`"Charge"`, not the umbrella brand), and card image URLs resolved absolutely against
`metadataBase`. Charge keeps a few extras the single-page sibling layout doesn't need — an
explicit canonical, the PWA manifest, and icon links — since they help SEO and installability.
The title stays descriptive (`"Charge — HPR ejection-charge calculator"`) rather than the bare
tool name, because "Charge" alone is too generic to be a useful page title.

### The math (the standard HPR ideal-gas method)

Everyone uses the same calculation; Charge will show it in full.

    m = (P · V) / (R · T)

- `V` — volume of the pressurized section = `π/4 · ID² · L` (tube inner diameter `ID`,
  section length `L`).
- `P` — pressure we want the charge to build in that volume.
- `R` — specific gas constant of black-powder combustion gas, **22.16 ft·lbf/(lbm·°R)**.
- `T` — combustion (flame) temperature, **3307 °R** (≈ 1837 K).
- Worked in consistent units (`P` in psf = psi × 144, `V` in ft³) the result is in lbm;
  multiply by 453.592 for grams.

Two ways to choose `P`, i.e. two modes:

1. **By target pressure.** You pick a pressure (rule-of-thumb territory is ~8–15 psi for
   typical setups). Simplest; good when you already know the pressure you fly.
2. **By separation force.** You enter what actually holds the airframe together —
   number and size of shear pins (with editable presets for the common nylon screws),
   plus an allowance for nose/coupler friction, plus a safety margin. Charge converts
   required force to pressure (`P = F / A`, `A = π/4 · ID²`) and proceeds. More rigorous,
   and it makes the assumptions visible.

**Dual-deploy** is first-class: separate drogue (apogee) and main wells, each with its
own diameter, section length, and pins/force — usually the same tube with two very
different pressurized volumes, but the wells are independent so a different-diameter
payload and booster section are handled too. Single-deploy is just one well.

The default is **separation-force** mode (pins + friction + margin): it's the more
rigorous path and makes the holding force explicit. Target-pressure mode is one toggle
away for flyers who already fly a known pressure.

A **safety margin** applies in *both* modes, which took a little thought in pressure
mode. In force mode it simply multiplies the required separation force. In pressure mode
a naive multiply on the entered pressure would quietly redefine the user's target — they
typed 12 psi and the tool would act on 18. Instead the entered value stays the honest
*design target*, and the margin sizes the charge so an *ideal* well would reach
`target × margin`. Since real wells leak and lose heat (the same one-directional error
the methodology already leans on), that headroom is what lets a real well still reach the
target. The result shows both numbers — `target → sized` pressure — so nothing is hidden,
and the worked example spells out the multiply.

**Redundant altimeters** are the norm in high-power, so they're modelled directly. Set
the altimeter control to Redundant and each well reports a second, backup charge sized a
little above the primary — the larger of the dial's percentage (default +20%) or a +0.5 g
floor, the widely-cited NASA Student Launch convention. The floor is what matters for small
charges, where 20% is only a fraction of a gram; the label and the ground-test step name
whichever rule actually binds. The backup is deliberately larger, not equal: it exists for the case where
the primary fired but didn't free the airframe, so it has to break a joint the first
charge already strained against. Both charges still get their own ground test — the app
adds the backup to the ground-test ladder and says so in the methodology. It's a global
toggle (both wells share it) because the two altimeters fire every charge on the airframe,
not just one well's.

**Altimeter vent holes** are a natural companion: the same flyers, the same airframe, a
question they all hit. Barometric altimeters sample outside air through small static
ports; size them wrong and you get a late/missed apogee (too small) or gust-triggered
deploys (too large). It's a self-contained helper with its own little state (it's about
the av-bay, not the charge wells, so it doesn't entangle the URL-synced calculator), but
it reuses the same geometry inputs, units, voice, and the "show the derivation" habit. The
math (`lib/vent.ts`, pure + tested) is the area form of the standard rule — one ¼″ port
per 100 in³ — distributed over N equal ports: `d = 0.02216 · ID · √(L/N)`, where the
constant is just √(area of a ¼″ hole ÷ 100 in³). It deliberately stays a guideline with a
loud "your altimeter's manual wins" caveat, and notes that bigger is *not* safer here.
This widens the tool slightly past pure ejection charges, but it's the same job (getting
the recovery electronics to fire correctly), so it earns its place rather than being scope
creep.

**Sanity hints** sit on top of the inputs (`lib/checks.ts`, pure + tested). They never
touch the math — they just surface a quiet amber line when a value lands well outside what
hobby airframes use: a diameter that reads like mm typed into an inches field (or the
outside diameter), or a target pressure outside the usual ~8–15 psi band, or a charge far
larger than a few grams. The classic, and most dangerous, mistake on a tool like this is a
unit/OD mix-up that silently produces a plausible-looking number; a nudge at the screen is
cheap insurance. Thresholds are deliberately wide and the wording is always "check", never
"wrong", so a genuinely unusual build isn't nagged — and the defaults produce no hints at
all, so the tool isn't crying wolf out of the box.

### Honesty, carried further than usual

This number drives a real pyrotechnic event, so the transparency bar is higher than the
Motor Finder's, not lower:

- The formula and **every** constant (`R`, `T`, the 144 and 453.592 conversions) are
  shown, with the value and a one-line "why this number / where it's from."
- The result is framed as a **theoretical starting estimate**, never authoritative. The
  ideal-gas method assumes complete, instantaneous, adiabatic combustion with no
  leakage — real wells lose heat and vent, so the real requirement can differ. The
  honest framing: start here, then ground-test and adjust.
- **"Always ground-test before you fly it"** is a designed, prominent part of the page —
  not fine print — and it's wired to the next feature.

### The ground-test log (the validation loop)

A calculator that ends at a number is only half the job. The real number is the one that
cleanly separated your airframe on the ground. So Charge lets you log a test: the
charge you actually packed (grams), which well, the date, whether it separated cleanly,
and notes ("0.8 g, clean, pins sheared; 0.6 g didn't"). The log lives in `localStorage`
and can be exported/shared so it's not trapped on one device. The calculator and the log
sit together, closing the loop the disclaimer keeps pointing at.

The loop is closed *visibly*, not just structurally: once a saved airframe has a clean test
logged against it, the calculator shows that proven charge — most recent clean separation,
the weight, the date — in an emerald callout above the estimate, telling you in plain words
to fly what you tested. Matching is by the airframe's name (the log's label defaults to the
active saved rocket), and the summary is a pure, tested helper (`lib/testlog.ts`); it only
appears in the full save-a-rocket-then-test workflow, so it adds nothing for a one-off
calculation. It's the whole thesis of the tool made literal: the estimate starts you, the
test you logged is the answer.

### The exports: field card and recovery report

The tool's other half is *off the screen*. Launches happen at remote fields with no signal,
and many ranges keep phones away from the pad — but everyone runs on paper. Two documents
cover that, and each is offered as **HTML** (download a file) or **PDF** (print → Save as
PDF), plus the card also as **plain text** (for a phone note or club chat):

- the **build & ground-test card** — a one-page sheet of each well's charges (estimate,
  backup, the proven charge if there is one) and a fill-in grid to record each bench test;
- the **recovery report** — the documentation a cert flight (Tripoli/NAR L1–L3) or a build
  writeup wants (see below).

Both are built the same way: a **pure HTML generator** (`lib/card.ts`, `lib/report.ts`) turns
the data into one self-contained document (inline CSS, zero dependencies). "HTML" downloads
it as a file; "PDF" renders it into a hidden, same-origin `<iframe>` and calls the browser's
print — no popup, no library, and it prints just the document rather than the whole app. This
replaced an earlier print-only React card + `@media print` rule: one generator per artifact,
two output buttons each, is simpler and consistent. Every user-supplied string is escaped, so
a rocket name or a test note can't break — or inject into — the document.

### Bench mode (built for the physical context)

Every other view assumes a comfortable screen at a desk. The actual moment of use is a phone
propped on a workbench or at the pad — bright sun, greasy or gloved hands. "Bench mode" is a
full-screen, deliberately high-contrast (white-on-near-black) view with the charges set in
huge type and the test ladder as large tap targets, one block per well, plus the proven/
validated charge up top if there is one. Tapping a step hands that charge to the log and
drops you back to record the result. It's a reframe around *ergonomics* rather than features:
the print card covers "no phone"; this covers "phone, bad conditions." Escape or "Done"
closes it, and it locks the page scroll behind itself while open.

### The recovery report (documentation)

The field card answers "what do I do at the pad"; the report answers "how was this designed
and validated" — the documentation a cert flight (Tripoli/NAR L1–L3) or a build writeup
wants. It compiles what the tool already holds — the configuration, the sizing rationale
*with the actual formula, constants, and a worked example*, and the logged ground-test
results (with each test's ratio-to-model, plus validation and calibration). Same HTML/PDF
export path as the card.

### Learning from your own data (calibration)

The model is a starting point; your tests are the truth — so the tool *learns* the gap. When
a test is planned from a ground-test ladder step, the entry quietly records the model
estimate alongside the charge you packed. Across your clean tests it then reports your
average charge-to-estimate ratio ("your charges ran ~1.3× the model"), with each entry
tagged by its own ratio. It's framed as **insight, never an auto-applied factor**: it tells
you to expect to test toward the high end, and explicitly never trims the estimate down —
testing larger is the safe direction, and a learned multiplier that shrank a charge would be
the one dangerous move. Backup-charge tests are excluded (they're intentionally inflated),
and it needs two data points before it says anything. Pure, tested logic in `lib/testlog.ts`.

### The bench coach (guidance + validation)

The log doesn't just record the loop — it drives it. Reading the most recent test for the
airframe in the form, the tool suggests what to pack next: a no-separation steps the charge
up ~25%, a partial ~15%, and a single clean test suggests repeating the same charge to
confirm it; a "use it" button drops the suggestion straight into the form. It only ever
steps *up* — it never proposes a smaller charge, the one dangerous move. Once an airframe has
separated cleanly twice at the same charge it's marked **validated** (a badge in the log and
on the calculator's proven-charge callout), and the suggestions stop — there's nothing left
to chase. When a test fails or only partly separates, the coach also expands (collapsibly)
into the **likely causes**, symptom-matched — charge too small, pins too strong, a leak past
the bulkhead, tight wadding, a weak match — so a failed bench test becomes a checklist, not a
shrug. The cause lists are pure data (`failureCauses` in `lib/testlog.ts`), informational
only. Both are pure helpers in `lib/testlog.ts` (`nextChargeSuggestion`,
`validatedCharge`), so the rules are testable on their own. Together with the proven-charge
callout and the calibration insight, this is the estimate → test → *guide* → validate arc the
whole tool is built around, made fully literal.

### Trust & durability

- **Setup-drift guard** — a proven/validated charge is only proven for the geometry it was
  tested at, but the callout matches an airframe by *name*, so changing the tube or length
  could leave a stale "proven" claim showing. Each ladder-planned test records the model
  estimate it was planned at; if the current configuration would now size more than ~15%
  differently, the callout adds an amber "re-test before trusting this" note. Scoped to
  single-deploy, where the one well maps cleanly to the logged test; dual is left alone.
- **Back up & restore everything** — the log could export itself, but saved rockets had *no*
  backup at all, so a cleared cache lost the fleet. "Your data" writes rockets + log + theme
  to one JSON file and restores by **merging** (by id), so it combines rather than clobbers.
  Pure pieces (`lib/backup.ts`) are tested; the component does the localStorage IO and reloads
  so the other components re-read.
- **References & sources** — the methodology shows the math; a "References" disclosure now
  cites *where the values come from* (the ideal-gas method and R/T from Ted Apke's
  ejection-charge method and HARA's guide, the +20%/0.5 g backup from NASA Student Launch,
  the vent rule from Vern Knowles + community). Deepens the transparency the tool trades on,
  and gives the cert-documentation crowd something to cite.

### Smaller touches

- **Skip link** — a "Skip to the calculator" link is the first tab stop, hidden until focused.
  It jumps keyboard and screen-reader users past the header, theme/tip controls, and the
  overview straight to the tool (it targets `#calculator`, so the next Tab lands on the first
  control). Pairs with the existing indigo focus-visible ring (WCAG 2.4.1 / 2.4.7).
- **Private by default** — there is no backend, account, server, analytics, or tracking; saved
  rockets and the test log live in `localStorage`, the configuration rides in the URL, and the
  only third party is the optional Ko-fi tip *link* (no embedded script). The "Your data"
  section says this plainly, so a privacy-minded flyer doesn't have to infer it.
- **Native share** — where the browser supports the Web Share API (mostly mobile), a "Share"
  button pushes the configured link into the OS share sheet, and the card/report can be shared
  as a file where file-sharing is supported. Detected after mount and shown only when usable,
  so it never appears as a dead button; the copy-link and download paths stand in everywhere
  else.
- **Dual-deploy sequence diagram** — a labeled SVG (apogee → drogue, low altitude → main) in
  the measure-guide's house style, shown only for dual deploy, so a beginner can see what the
  two charges the calculator sizes actually do in flight. Education, not decoration.
- **Common tube-ID presets** — quick-set chips under the diameter field (38/54/75/98/152 mm,
  or the inch equivalents), mirroring the shear-pin presets. Starting points; the field still
  rules and the copy says to measure.
- **Field-elevation advisory** — an optional elevation input that, up high, notes black powder
  is a touch less efficient in thin air and to test toward the high end. Advisory only — it
  never changes the number, consistent with the no-derate stance. State floors at 0 and rides
  in the share URL like everything else.
- **Offline at the pad** — the whole point of the service worker: launches happen where there's
  no signal, so once loaded the calculator, saved rockets, and log keep working with none.
  Navigations are network-first with a cached-shell fallback; other same-origin GETs are
  stale-while-revalidate, so after a visit the SW cache holds the HTML shell *and* the JS/CSS/
  fonts as a durable layer (verified: offline, the app hydrates and computes, not just a static
  shell). The build's `_next/static` assets are also immutable-cached by the browser, so even a
  cold first-visit-then-offline launch works — both layers cover it. Covered by an e2e test that
  goes offline and asserts the calculator actually computes and stays reactive.
- **Installable** — a web app manifest (`standalone`, `id`/`scope` `/`, the dark theme/splash
  colors, and `any maskable` PNG icons so Android adaptive icons aren't letterboxed) plus the
  iOS `mobile-web-app-capable` / apple title / status-bar metadata, so "Add to Home Screen"
  launches full-screen with the right icon on every platform. `InstallHint` offers the one-tap
  `beforeinstallprompt` where supported and per-platform steps otherwise.
- **Update prompt** — an offline app can otherwise sit on a stale version forever, so the
  service worker no longer force-activates: a new build waits, and the page shows a small
  "new version available — Refresh" toast that calls `skipWaiting()` only when the user
  accepts (then reloads on `controllerchange`, guarded so the first-ever activation doesn't
  reload). First visits still activate immediately, so offline works straight away. Purely
  client-side — no server, no Functions.
- **Reduced motion** — the jump-to-log scroll honors `prefers-reduced-motion`, falling back to
  an instant jump instead of an animated one.

### Units

Flyers think in mixed units. Diameter and length in **mm or inches** (toggle, remembered);
pressure in **psi or kPa**; black powder always reported in **grams** (the universal
field unit, on a scale). Volume shown in both in³ and cc for sanity-checking. Sensible
significant figures, never false precision.

### State & sharing

Inputs live in the URL query string (mode, units, diameter, lengths, pressure/force
parameters), matching the Motor Finder — so a configured calculation is a shareable
link. Theme and the ground-test log live in `localStorage` under a `charge.*` namespace.

## 3. Technical plan

- **Match the family's stack.** Next.js App Router + static export, Tailwind v4, Geist,
  TypeScript — same as the hub and Motor Finder. The payoff is concrete: identical
  components, classes, fonts, theme behavior, and meta conventions, so Charge reads as
  the same hand without re-deriving anything. It static-exports to plain HTML/CSS/JS with
  zero server runtime, which satisfies the 100%-client-side constraint exactly.
- **One page.** `/` is the calculator. Methodology lives inline in `<details>`
  disclosures; the ground-test log sits below the result. No routing to speak of.
- **Pure functions for the physics**, unit-tested, kept separate from the UI so the math
  is auditable on its own — fitting for a tool whose credibility is the math.
- **Brand reuse.** The mark, wordmark, and combined logo (vector, no raster) are vendored
  under `public/brand/`; favicon under `public/icon.svg`. Header, footer, theme toggle,
  and meta mirror the hub.
- **Deploy:** Cloudflare Pages, project `fusionspace-charge`, static output, at
  `charge.fusionspace.co`. No Functions, no bindings.
- **Footer** carries: link back to the hub, link to the Motor Finder, a GitHub link, the
  non-affiliation line, and — specific to Charge — a safety line making ground-testing
  the headline, plus "not authoritative, your responsibility" framing.

### Decisions (resolved)

- **Scope of v1:** the full tool — both modes (pressure + force), dual-deploy, units,
  methodology disclosures, and the ground-test log.
- **Shear-pin presets:** editable values (2-56 / 4-40 / 6-32 nylon) with a visible
  "values vary — verify yours" note; nothing presented as authoritative.
- **Repo:** `nrdptel/fusionspace-charge`.
- **License:** MIT — mirroring the Motor Finder.
- **Deployment:** GitHub Actions → Cloudflare Pages (`cloudflare/wrangler-action`,
  `pages deploy out --project-name=fusionspace-charge --branch=main`), mirroring the
  Motor Finder. Production branch is `main`; a monthly scheduled run rebuilds so the
  awareness observance rolls over with the calendar. Secrets `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` are set in the repo, and the custom domain is configured on the
  Pages project — both one-time dashboard steps.
- **Awareness banners:** carried over verbatim from the Motor Finder (`lib/observances.ts`)
  — a thin top accent rule and a warm footer line for the month's observances.
- **Repo hygiene mirrored:** CONTRIBUTING, SECURITY, issue templates, `_headers`,
  `wrangler.toml`, and CI (lint, unit tests, build, Playwright e2e with an axe audit).

The one thing still genuinely worth your eye is the **physics assumptions** — R = 22.16
ft·lbf/(lbm·°R), T = 3307 °R, ideal-gas with no efficiency derating. These are the
standard HPR values, shown transparently in-app, but matching the family doesn't settle
whether you'd want a different T or an explicit derating knob.
