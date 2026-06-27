/**
 * Writes a generated example page to disk.
 *
 * build.ts bundles a *.scene.ts together with shell.ts into one browser IIFE
 * (`bundleJs`), then calls writePage() to wrap it in the HTML chrome — header,
 * preset buttons, the resizable #stage, and a script tag that calls
 * mountScene(). The scene module is expected to call mountScene() itself when
 * loaded (see the bottom of each *.scene.ts), so all this file owns is markup.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface PageOpts {
  filename: string;
  title: string;
  description: string;
  bundleJs: string;
  initialW?: number;
  initialH?: number;
}

export function writePage(opts: PageOpts): void {
  const { filename, title, description, bundleJs } = opts;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Boxwood — ${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=JetBrains+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
<style>
  :root {
    --paper:#F0EDE8; --ivory:#FAF9F7; --carbon:#141414; --ink:#1E1E1E;
    --fog:#888888; --line:#DAD3C7; --amber:#C98A2E; --amber-pure:#E8A44A;
    --mono:'JetBrains Mono', ui-monospace, monospace;
    --body:'DM Sans', system-ui, sans-serif;
    --display:'Playfair Display', Georgia, serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--paper); color: var(--carbon);
    font-family: var(--body); font-weight: 300;
    padding: 40px 28px 56px; display: flex; flex-direction: column; align-items: center; gap: 18px;
  }
  header { max-width: 720px; width: 100%; }
  .eyebrow {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--amber); display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
  }
  .eyebrow::after { content: ""; flex: 1; height: 1px; background: var(--line); }
  h1 {
    font-family: var(--display); font-weight: 700; color: var(--carbon);
    font-size: clamp(24px, 4vw, 34px); letter-spacing: -0.01em; line-height: 1.1; margin: 0 0 10px;
  }
  header p { color: #5a5a52; margin: 0; font-size: 14px; line-height: 1.65; max-width: 640px; }
  .controls { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .controls button {
    background: transparent; color: var(--fog); border: 1px solid var(--line);
    border-radius: 2px; padding: 7px 13px; font-size: 11px; letter-spacing: 0.06em;
    text-transform: uppercase; font-family: var(--mono); cursor: pointer;
    display: inline-flex; align-items: center; gap: 7px; transition: all .18s;
  }
  .controls button:hover { color: var(--carbon); border-color: #C7BFB0; }
  .controls button i { font-size: 12px; }
  #readout {
    color: var(--fog); font-size: 11px; letter-spacing: 0.04em; font-family: var(--mono);
  }
  #stage {
    position: relative; background: var(--ivory);
    border: 1px solid var(--line); border-radius: 5px;
    box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset, 0 18px 40px -24px rgba(20,20,20,0.35);
    overflow: hidden;
  }
  #stage svg {
    display: block;
    background:
      repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(20,20,20,0.035) 24px),
      repeating-linear-gradient(90deg, transparent, transparent 23px, rgba(20,20,20,0.035) 24px);
  }
  #handle {
    position: absolute; right: 4px; bottom: 4px; width: 22px; height: 22px; cursor: nwse-resize;
    color: var(--amber); display: grid; place-items: center; font-size: 11px;
    user-select: none; touch-action: none; opacity: 0.7; transition: opacity .15s;
  }
  #handle:hover { opacity: 1; }
</style>
</head>
<body>
<header>
  <div class="eyebrow">Boxwood · Layout Engine</div>
  <h1>${esc(title)}</h1>
  <p>${esc(description)}</p>
</header>
<div class="controls">
  <button data-w="900" data-h="540"><i class="fa-solid fa-desktop"></i> Wide</button>
  <button data-w="620" data-h="560"><i class="fa-solid fa-tablet-screen-button"></i> Medium</button>
  <button data-w="380" data-h="640"><i class="fa-solid fa-mobile-screen-button"></i> Narrow</button>
</div>
<div id="readout"></div>
<div id="stage"><div id="handle"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></div></div>
<script>
${bundleJs}
</script>
</body>
</html>`;

  const outPath = path.join(__dirname, filename);
  fs.writeFileSync(outPath, html, "utf8");
  console.log(`✓ wrote ${path.relative(process.cwd(), outPath)}`);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
