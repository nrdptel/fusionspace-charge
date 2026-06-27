# Charge

A black-powder ejection-charge calculator for high-power rocketry, at
[charge.fusionspace.co](https://charge.fusionspace.co).

Tell it your tube inner diameter, the length of the pressurized section, and how hard
your airframe is to separate (target pressure, or shear pins plus friction), and it
gives you a starting black-powder mass in grams. It shows the full formula and every
constant it uses, and it keeps a log of your ground tests — because the charge that
actually separated your airframe on the ground is the only number that counts.

**This is a starting estimate, not gospel. Always ground-test a charge before you fly
it.** Black powder is an explosive; sizing, handling, and flying ejection charges is
your responsibility.

Part of [Fusion Space](https://fusionspace.co) — free, polished tools for high-power
rocketry. See also the [HPR Motor Finder](https://motor.fusionspace.co).

## What it does

- Size by **target pressure**, or by **separation force** — shear pins (with editable
  presets for common nylon screws) plus friction.
- A **safety margin** in either mode: it sizes the charge above the bare separation
  force, or above your target pressure so a leaky real well still reaches it.
- **Single and dual-deploy**: separate drogue and main wells.
- **Redundant altimeters**: size a backup charge alongside the primary — a little larger,
  following the common +20% convention — for the second altimeter most flyers carry.
- **Altimeter vent holes**: size the static sampling ports for your electronics bay by the
  standard one-¼″-port-per-100-in³ rule, split across the ports you plan to drill.
- Units that convert in place — diameter and length in **mm or in**, pressure in
  **psi or kPa**, force in **lbf or N**. Black powder is always reported in grams.
- The full formula, every constant, and a worked example using your own inputs, so the
  number is never a black box.
- **Sanity hints** that flag a likely input error — a unit mix-up, the outside diameter
  entered as the bore, a pressure outside the usual band — without ever changing the math.
- A **ground-test log** kept in your browser, because the charge that actually separated
  the airframe on the bench is the one worth flying.
- **Closes the loop**: once a saved airframe has a clean ground test logged, the calculator
  surfaces that proven charge above the estimate — so you fly what you validated.
- **Learns your calibration**: across the clean tests you log, it shows how much bigger your
  real charges run than the formula — your own correction, never an auto-applied trim.
- **Coaches the bench loop**: after each test it suggests what to pack next (step up after a
  failed or partial separation, repeat to confirm after a clean one), explains the **likely
  causes** when a test doesn't separate, and marks a charge **validated** once it's separated
  cleanly twice.
- **Build & ground-test card** — a one-page sheet with each well's charges and a grid to
  record results at the bench or the field. Export as **HTML**, **PDF**, or plain text.
- **Recovery report** — a write-up of the configuration, the sizing rationale with the
  formula, and your logged ground-test results, for a cert package or a build thread. Export
  as **HTML** or **PDF**. Both exports are self-contained (no dependencies) and work offline.
- A **dual-deploy sequence diagram** so beginners can see what each charge actually does in
  flight, common **tube-ID presets**, and a **field-elevation advisory** for thin-air launches.
- Inputs live in the URL, so a configured calculation is a link you can share or bookmark —
  via the OS **share sheet** on mobile, or a copied link anywhere.
- Installable, and works **offline** once loaded — launches happen where there's no signal.
- **Bench mode**: a full-screen, high-contrast, big-number view of the charges and test
  ladder for using your phone at the bench or the pad — bright sun, greasy hands. Tap a
  charge to start logging that test.

## How the math works

It's the standard ideal-gas ejection-charge method, `m = (P·V)/(R·T)`, with the gas
constant and flame temperature every HPR reference uses. The result is a theoretical
starting point, not a guarantee — the full derivation and its assumptions are laid out in
the app under "Where the numbers come from". The physics lives in `lib/charge.ts` as pure
functions with tests in `lib/charge.test.ts`.

## Development

Static site built with Next.js and Tailwind, exported to plain HTML/CSS/JS. Everything
runs in the browser; there is no backend.

```
npm install
npm run dev      # local dev server
npm run build    # static export to ./out
npm test         # run the unit tests
npm run lint     # lint
```

## Deployment

Hosted on Cloudflare Pages as a fully static site. Build command `npm run build`, output
directory `out`. No Functions, no server-side code.

## Disclaimer

Personal, non-commercial project — not affiliated with any rocketry vendor or
manufacturer. Built for the hobby rocketry community.
