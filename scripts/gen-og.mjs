// Pre-generate the Open Graph / Twitter card PNG at build time.
//
// Charge is a static export (`output: "export"`), which forbids the dynamic
// next/og image route at request time — so we render the card to a static PNG
// here instead, at public/og/default.png, and point openGraph/twitter.images
// at it. This mirrors the HPR Motor Finder's scripts/gen-og.mjs so the two
// tools share one card template: same gradient, type scale, and the FusionSpace
// wordmark + domain lockup in the corner.
//
// Uses next/og's `ImageResponse` (Next's built-in OG renderer), imported via the
// explicit `next/og.js` specifier so it resolves from a plain node script. The
// layout is written with React.createElement to keep this a dependency-free .mjs.
//
// Runs in `prebuild`, before `next build`. Idempotent.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";
import { ImageResponse } from "next/og.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const ogDir = resolve(root, "public", "og");

const SIZE = { width: 1200, height: 630 };
const h = React.createElement;

// Shared chrome — identical to the Motor Finder card so the family reads as one.
const CARD_STYLE = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "80px",
  background: "linear-gradient(135deg, #09090b 0%, #18181b 100%)",
  color: "#fafafa",
  fontFamily: "sans-serif",
  position: "relative",
};

function footer(logoUri) {
  return h(
    "div",
    {
      style: {
        position: "absolute",
        bottom: 58,
        left: 80,
        display: "flex",
        alignItems: "center",
        gap: 18,
        opacity: 0.85,
      },
    },
    h("img", { src: logoUri, width: 233, height: 52, alt: "Fusion Space" }),
    h(
      "span",
      { style: { fontSize: 26, color: "#a1a1aa", letterSpacing: "0.04em" } },
      "charge.fusionspace.co",
    ),
  );
}

function defaultCard(logoUri) {
  return h(
    "div",
    { style: CARD_STYLE },
    h(
      "div",
      {
        style: {
          fontSize: 28,
          color: "#a1a1aa",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: 24,
        },
      },
      "High-power rocketry",
    ),
    h(
      "div",
      { style: { fontSize: 96, fontWeight: 700, lineHeight: 1.05, marginBottom: 32, letterSpacing: "-0.02em" } },
      "Charge",
    ),
    h(
      "div",
      { style: { fontSize: 36, color: "#d4d4d8", lineHeight: 1.3, maxWidth: 980 } },
      "Black-powder ejection-charge calculator — size a charge, ground-test it until it separates clean, then take a bench card or cert report to the field.",
    ),
    footer(logoUri),
  );
}

async function render(element) {
  const resp = new ImageResponse(element, { ...SIZE });
  return Buffer.from(await resp.arrayBuffer());
}

async function main() {
  // Extract the embedded wordmark data URI from lib/og-logo.ts (a .ts file, so
  // read + regex rather than import). Shared verbatim with the Motor Finder.
  const logoSrc = await readFile(resolve(root, "lib", "og-logo.ts"), "utf-8");
  const logoUri = logoSrc.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/)?.[0];
  if (!logoUri) throw new Error("gen-og: could not extract OG_LOGO_PNG from lib/og-logo.ts");

  await mkdir(ogDir, { recursive: true });
  await writeFile(resolve(ogDir, "default.png"), await render(defaultCard(logoUri)));
  console.log("gen-og: wrote public/og/default.png");
}

await main();
