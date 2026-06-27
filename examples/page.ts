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
<style>
  :root { --bg:#0c0c14; --panel:#141424; --line:#2d2d3d; --text:#e2e8f0; --muted:#8a8a9a; --accent:#38bdf8; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    padding: 32px; display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  header { text-align: center; max-width: 760px; }
  h1 { color: var(--accent); margin: 0 0 6px; font-size: 22px; letter-spacing: -0.4px; }
  header p { color: var(--muted); margin: 0; font-size: 14px; line-height: 1.55; }
  .controls { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .controls button {
    background: var(--panel); color: var(--text); border: 1px solid var(--line);
    border-radius: 8px; padding: 7px 14px; font-size: 13px; cursor: pointer;
    transition: border-color .15s, color .15s;
  }
  .controls button:hover { border-color: var(--accent); color: var(--accent); }
  #readout { color: var(--muted); font-size: 13px; font-family: ui-monospace, monospace; }
  #stage {
    position: relative; background: radial-gradient(circle at center, #141424 0%, #0e0e16 100%);
    border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 24px 50px rgba(0,0,0,.55); overflow: hidden;
  }
  #stage svg {
    display: block;
    background:
      repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(255,255,255,.03) 20px),
      repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(255,255,255,.03) 20px);
  }
  #handle {
    position: absolute; right: 0; bottom: 0; width: 26px; height: 26px; cursor: nwse-resize;
    color: var(--accent); display: grid; place-items: center; font-size: 14px;
    user-select: none; touch-action: none;
  }
</style>
</head>
<body>
<header>
  <h1>${esc(title)}</h1>
  <p>${esc(description)}</p>
</header>
<div class="controls">
  <button data-w="900" data-h="540">🖥️ Wide</button>
  <button data-w="620" data-h="560">💻 Medium</button>
  <button data-w="380" data-h="640">📱 Narrow</button>
</div>
<div id="readout"></div>
<div id="stage"><div id="handle">◢</div></div>
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
