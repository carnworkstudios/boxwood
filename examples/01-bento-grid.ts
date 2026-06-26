/**
 * Example 01: Bento Grid Layout
 * 
 * Demonstrates a classic "Bento Box" dashboard grid layout:
 * - A large main card taking up 60% of the width on the left.
 * - Two smaller cards stacked vertically (each 50% height) on the right taking up 40% width.
 * - Shows how the layout automatically recalculates responsive box coordinates for both
 *   landscape (desktop) and portrait (mobile) viewports.
 */

import { resolveLayout, LNode } from "../index.js";
import { exportHtml } from "./visualizer.js";

// 1. Define the Bento Grid using Boxwood's Box-Split grammar
const bentoLayout: LNode = {
  id: "bento-root",
  style: {
    padding: 24, // 24px outer margin padding
  },
  // Split columns: 60% left column, 40% right column
  split: {
    cols: ["60%", "40%"],
    gap: 16, // 16px horizontal spacing between columns
  },
  children: [
    // Left column: Main feature card
    {
      id: "main-feature-card",
      style: { w: "100%", h: "100%" },
    },
    // Right column: Stacked sub-cards
    {
      id: "right-stack-container",
      style: { w: "100%", h: "100%" },
      // Split rows: 2 equal-height rows
      split: {
        rows: 2,
        gap: 16, // 16px vertical spacing between cards
      },
      children: [
        { id: "sub-card-top", style: { w: "100%", h: "100%" } },
        { id: "sub-card-bottom", style: { w: "100%", h: "100%" } },
      ],
    },
  ],
};

// 2. Resolve for Desktop Viewport (Landscape 16:9)
console.log("=== RESOLVING FOR DESKTOP VIEWPORT (1920x1080) ===");
const desktopViewport = { x: 0, y: 0, w: 1920, h: 1080 };
const desktopResult = resolveLayout(bentoLayout, desktopViewport);

desktopResult.boxes.forEach((node) => {
  if (node.node.id) {
    const { x, y, w, h } = node.box;
    console.log(`[${node.node.id}]:`);
    console.log(`  Position:  (${Math.round(x)}, ${Math.round(y)})`);
    console.log(`  Dimension: ${Math.round(w)}px x ${Math.round(h)}px\n`);
  }
});

// 3. Resolve for Mobile Viewport (Portrait 9:16)
console.log("\n=== RESOLVING FOR MOBILE VIEWPORT (1080x1920) ===");
const mobileViewport = { x: 0, y: 0, w: 1080, h: 1920 };

// Mutate layout dynamically for portrait viewports:
// On small or vertical screens, stacked rows look much better than narrow columns.
const adaptiveBentoLayout = { ...bentoLayout };
adaptiveBentoLayout.split = {
  rows: ["60%", "40%"], // Swap column split for a 60/40 row split
  gap: 16,
};

const mobileResult = resolveLayout(adaptiveBentoLayout, mobileViewport);

mobileResult.boxes.forEach((node) => {
  if (node.node.id) {
    const { x, y, w, h } = node.box;
    console.log(`[${node.node.id}]:`);
    console.log(`  Position:  (${Math.round(x)}, ${Math.round(y)})`);
    console.log(`  Dimension: ${Math.round(w)}px x ${Math.round(h)}px\n`);
  }
});

// 4. Export HTML previews for visualization
exportHtml(desktopResult.boxes, "01-bento-grid-desktop.html", 1920, 1080);
exportHtml(mobileResult.boxes, "01-bento-grid-mobile.html", 1080, 1920);
