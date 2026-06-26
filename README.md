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
  presets for common nylon screws) plus friction and a safety margin.
- **Single and dual-deploy**: separate drogue and main wells.
- Units that convert in place — diameter and length in **mm or in**, pressure in
  **psi or kPa**, force in **lbf or N**. Black powder is always reported in grams.
- The full formula, every constant, and a worked example using your own inputs, so the
  number is never a black box.
- A **ground-test log** kept in your browser, because the charge that actually separated
  the airframe on the bench is the one worth flying.
- Inputs live in the URL, so a configured calculation is a link you can share or bookmark.
- Installable, and works **offline** once loaded — launches happen where there's no signal.

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
