/**
 * Example 02: Drawing Vector Connections & Arrows
 * 
 * Demonstrates one of Boxwood's biggest advantages: exposing absolute coordinates
 * so that you can easily route SVG paths, connection lines, and arrows between elements.
 * 
 * We lay out a 3-step horizontal workflow pipeline, resolve their box locations,
 * and calculate curved SVG Bezier paths starting from the right-edge of each node card
 * and ending at the left-edge of the next node.
 */

import { resolveLayout, LNode } from "../index.js";
import { exportHtml } from "./visualizer.js";

// 1. Define a 3-step pipeline flow using horizontal columns split
const pipelineLayout: LNode = {
  id: "pipeline-root",
  style: { padding: 40 },
  split: {
    cols: 3, // 3 columns of equal width
    gap: 80, // Large gap to leave room for connection lines/arrows
  },
  children: [
    { id: "node-step-1", style: { w: "100%", h: 100 } },
    { id: "node-step-2", style: { w: "100%", h: 100 } },
    { id: "node-step-3", style: { w: "100%", h: 100 } },
  ],
};

// 2. Resolve layout on a 1920x1080 canvas
const viewport = { x: 0, y: 0, w: 1920, h: 1080 };
const result = resolveLayout(pipelineLayout, viewport);

// 3. Helper function to generate an SVG cubic Bezier curve connecting two boxes
interface Point { x: number; y: number; }

function getCardEdgeConnection(
  fromBox: { x: number; y: number; w: number; h: number },
  toBox: { x: number; y: number; w: number; h: number }
): { pathString: string; start: Point; end: Point } {
  // Start connection at the middle-right of the source box
  const start: Point = {
    x: fromBox.x + fromBox.w,
    y: fromBox.y + fromBox.h / 2
  };

  // End connection at the middle-left of the destination box
  const end: Point = {
    x: toBox.x,
    y: toBox.y + toBox.h / 2
  };

  // Compute control points for a smooth S-curve (cubic Bezier)
  const controlOffset = (end.x - start.x) * 0.4;
  const cp1x = start.x + controlOffset;
  const cp1y = start.y;
  const cp2x = end.x - controlOffset;
  const cp2y = end.y;

  const pathString = `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;

  return { pathString, start, end };
}

// 4. Trace and output the connections
console.log("=== CALCULATING VECTOR CONNECTION PATHS FOR SVG ===");

let connectionSvgString = "";

for (let i = 0; i < result.boxes.length - 1; i++) {
  const currentResolved = result.boxes[i];
  const nextResolved = result.boxes[i + 1];

  // Skip the root wrapper node box itself
  if (currentResolved.node.id === "pipeline-root" || nextResolved.node.id === "pipeline-root") {
    continue;
  }

  const connection = getCardEdgeConnection(currentResolved.box, nextResolved.box);

  console.log(`\nConnection [${currentResolved.node.id}] ────► [${nextResolved.node.id}]:`);
  console.log(`  Source Exit:      (${Math.round(connection.start.x)}, ${Math.round(connection.start.y)})`);
  console.log(`  Dest Entrance:    (${Math.round(connection.end.x)}, ${Math.round(connection.end.y)})`);
  console.log(`  Render SVG Path:  <path d="${connection.pathString}" stroke="gold" strokeWidth="3" fill="none" />`);

  // Accumulate SVG path tags for the visualizer
  connectionSvgString += `
    <path d="${connection.pathString}" stroke="#F5A623" stroke-width="3" fill="none" stroke-dasharray="8,8" />
    <circle cx="${connection.start.x}" cy="${connection.start.y}" r="5" fill="#F5A623" />
    <circle cx="${connection.end.x}" cy="${connection.end.y}" r="5" fill="#F5A623" />
  `;
}

// 5. Export HTML preview for visualization
exportHtml(result.boxes, "02-vector-connections.html", 1920, 1080, connectionSvgString);
