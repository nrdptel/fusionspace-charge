# Contributing

Thanks for your interest! This is a personal hobby project, but issues and PRs
are welcome — especially corrections to the calculation, its constants, or the
assumptions, and anything that makes the numbers clearer or safer.

## Project layout

This is a single Next.js app, statically exported. There is no backend.

- `app/` — the page, layout, metadata, robots/sitemap, and error/not-found pages.
- `components/` — the calculator UI, theme toggle, header, footer.
- `lib/` — the physics (`charge.ts`), unit conversions, URL-state serialization,
  formatting, and the monthly observances. Pure functions, with tests alongside.
- `public/` — brand marks, icons, the OG image, and the Cloudflare `_headers`.

The math is deliberately isolated in `lib/charge.ts` so it can be read and
tested on its own — if you're proposing a change there, please bring a source.

## Setup

```bash
npm install
npm run dev   # http://localhost:3000
```

## Checks (run before opening a PR)

These mirror CI (`.github/workflows/test.yml`); all must pass.

```bash
npm run lint        # eslint
npm test            # vitest unit tests
npm run build       # also type-checks (CI gate; tsconfig has noUnusedLocals/Params)
npm run test:e2e    # Playwright (incl. an axe accessibility audit) — run after a build
```

## Conventions

- Match the surrounding code's style, naming, and comment density.
- Keep commits focused; describe the *why* in the message.
- Never present a computed figure as authoritative. Transparency about the method
  and a clear push toward ground-testing are core to this tool — keep them intact.
