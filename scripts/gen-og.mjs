// Regenerates public/og.png — the 1200×630 social share card.
//
// Run locally to refresh the card (it's committed as a static asset, not built in
// CI): `node scripts/gen-og.mjs`. Set PW_EXECUTABLE_PATH to point Playwright at a
// pre-installed Chromium in sandboxed environments; otherwise it uses the default.
//
// The design matches the Fusion Space landing card (fusionspace.co): the brand mark
// over the product name, a tagline, and the domain in mono, centered on the dark
// background with the indigo radial glow. Rendered with Chromium (via Playwright)
// because it renders the gradient mark and the radial glow faithfully.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mark = await readFile(resolve(root, "public/brand/fusion-space-mark.svg"), "utf8");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1200px;height:630px}
  .card{width:1200px;height:630px;position:relative;background:#09090b;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Helvetica Neue',Helvetica,Arial,'Liberation Sans',sans-serif}
  .glow{position:absolute;inset:0;background:radial-gradient(58% 58% at 50% 32%,
    rgba(99,102,241,.24),rgba(99,102,241,0))}
  .col{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center}
  .mark{width:140px;height:140px}
  .mark svg{width:140px;height:140px}
  .name{font-size:104px;font-weight:700;letter-spacing:-.02em;color:#fafafa;margin-top:22px;line-height:1}
  .tag{font-size:40px;font-weight:600;color:#e4e4e7;margin-top:34px}
  .dom{font-family:'DejaVu Sans Mono','Liberation Mono',monospace;font-size:26px;color:#818cf8;margin-top:30px}
</style></head><body>
  <div class="card">
    <div class="glow"></div>
    <div class="col">
      <div class="mark">${mark}</div>
      <div class="name">Charge</div>
      <div class="tag">Black-powder ejection-charge calculator</div>
      <div class="dom">charge.fusionspace.co</div>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.PW_EXECUTABLE_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(150);
const buf = await page.locator(".card").screenshot();
await writeFile(resolve(root, "public/og.png"), buf);
await browser.close();
console.log("gen-og: wrote public/og.png");
