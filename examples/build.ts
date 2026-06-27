/**
 * Bundles each example's buildScene() module together with shell.ts into a
 * single browser IIFE via esbuild's JS API, then writes the HTML page. Run
 * directly with `npx tsx examples/build.ts` — no package.json changes needed.
 */

import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";
import { writePage } from "./page.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const examples: { entry: string; out: string; title: string; description: string; w?: number; h?: number }[] = [
  {
    entry: "01-bento-grid.scene.ts",
    out: "01-bento-grid.html",
    title: "Responsive Bento Grid",
    description:
      "A fixed dashboard grid of weighted cells — one hero tile, four KPIs, a timeline strip. The grid keeps its proportions at every size; instead of growing the boxes, each tile shrinks its own text to fit its cell via shrinkToFit(), so nothing ever overflows or overlaps as you resize.",
    w: 900,
    h: 560,
  },
  {
    entry: "02-vector-connections.scene.ts",
    out: "02-vector-connections.html",
    title: "Branching Vector Connections",
    description:
      "A 1-source / 3-worker / 1-sink pipeline. Resize narrower than it is tall and the split flips from columns to rows; connect() picks facing edges from relative position alone, so the 6 curves stay correctly routed in both orientations. Card text grows its box via the engine's own auto-height, never overflowing.",
    w: 900,
    h: 520,
  },
  {
    entry: "03-absolute-to-responsive.scene.ts",
    out: "03-absolute-to-responsive.html",
    title: "Absolute PDF Spans, Made Responsive",
    description:
      "A PDF extract's absolute x/w spans are converted to percentage columns. Shrink the panel and the two-column body narrows while each paragraph rewraps into more and more lines — a live CSS-style column reflow driven by geometry derived once, up front.",
    w: 900,
    h: 480,
  },
  {
    entry: "04-dynamic-reflow-overflow.scene.ts",
    out: "04-dynamic-reflow-overflow.html",
    title: "Auto-Height, Overflow & Collision",
    description:
      "Top card has no height — it grows to contain its text at any width. Bottom card has a FIXED height; shrink the panel until the wrapped text can't fit and the engine reports a real OverflowSignal in a banner below. Two badges placed at the same coordinate get nudged apart by resolveCollisions.",
    w: 760,
    h: 560,
  },
];

async function main() {
  for (const ex of examples) {
    const result = await esbuild.build({
      entryPoints: [path.join(__dirname, ex.entry)],
      bundle: true,
      format: "iife",
      write: false,
      target: "es2020",
      logLevel: "warning",
    });
    const bundleJs = result.outputFiles[0].text;
    writePage({
      filename: ex.out,
      title: ex.title,
      description: ex.description,
      bundleJs,
      initialW: ex.w,
      initialH: ex.h,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
