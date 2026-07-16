import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found — Charge",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      {/* loading="lazy" keeps React from hoisting a `<link rel="preload" as="image">` for this
          decorative mark into the <head> of EVERY prerendered route (not-found is part of every
          page's tree). Without it, every page fetched this 36 KB SVG on load and Chrome warned
          "preloaded but not used" — the image is only ever painted on this 404 page. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/fusion-space-mark.svg"
        alt=""
        aria-hidden
        width={880}
        height={815}
        loading="lazy"
        className="h-10 w-auto opacity-80"
      />
      <p className="mt-6 font-mono text-sm text-indigo-600 dark:text-indigo-400">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Page not found
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        That page doesn&apos;t exist. Head back to the calculator to size an ejection
        charge.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
      >
        <span aria-hidden>←</span>
        Back to Charge
      </Link>
    </main>
  );
}
