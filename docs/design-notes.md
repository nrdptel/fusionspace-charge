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
