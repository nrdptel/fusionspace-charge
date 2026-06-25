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

## Development

Static site built with Next.js and Tailwind, exported to plain HTML/CSS/JS and hosted on
Cloudflare Pages. Everything runs in the browser; there is no backend.

```
npm install
npm run dev      # local dev server
npm run build    # static export to ./out
```

## Disclaimer

Personal, non-commercial project — not affiliated with any rocketry vendor or
manufacturer. Built for the hobby rocketry community.
