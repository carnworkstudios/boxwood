// examples/visualizer.ts
// A simple HTML utility to write out SVG rectangles showing resolved layout coordinates.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ResolvedLNode } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function exportHtml(
  boxes: ResolvedLNode[],
  filename: string,
  width: number,
  height: number,
  svgContent: string = ""
) {
  let boxRects = "";
  boxes.forEach((node) => {
    // Containers (split parents) are structural, not drawable content — skip
    // them so only leaf cards render, exactly like the production renderer
    // skips `isContainer` nodes in SvgVisualRenderer.tsx.
    if (node.node.children && node.node.children.length > 0) {
      return;
    }

    const { x, y, w, h } = node.box;

    // Pick nice colors representing themes
    let strokeColor = "#505068";
    let fillColor = "rgba(80, 80, 104, 0.15)";
    if (node.node.id && (node.node.id.includes("main") || node.node.id.includes("dynamic") || node.node.id.includes("hero"))) {
      strokeColor = "#F5A623"; // Gold/Amber
      fillColor = "rgba(245, 166, 35, 0.12)";
    } else if (node.node.id && (node.node.id.includes("sub") || node.node.id.includes("bottom") || node.node.id.includes("sink"))) {
      strokeColor = "#ec4899"; // Pink
      fillColor = "rgba(236, 72, 153, 0.12)";
    } else if (node.node.id && (node.node.id.includes("step") || node.node.id.includes("worker") || node.node.id.includes("kpi"))) {
      strokeColor = "#4ADE80"; // Green
      fillColor = "rgba(74, 222, 128, 0.12)";
    } else if (node.node.id && (node.node.id.includes("span") || node.node.id.includes("source") || node.node.id.includes("body"))) {
      strokeColor = "#38bdf8"; // Light Blue
      fillColor = "rgba(56, 189, 248, 0.12)";
    }

    let textLines = "";
    let textBlockHeight = 0;
    if (node.textLayout && node.textLayout.lines.length > 0) {
      const fontSize = 13;
      const lineHeight = fontSize * 1.4;
      textBlockHeight = node.textLayout.lines.length * lineHeight;
      textLines = node.textLayout.lines
        .map((line, idx) => `<tspan x="${x + 16}" dy="${idx === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
        .join("");
    }

    boxRects += `
      <!-- Card: ${node.node.id || "Anonymous"} -->
      <g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" />
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
        <text x="${x + 16}" y="${y + 22}" fill="${strokeColor}" font-family="monospace" font-size="11" font-weight="bold">${node.node.id || "card"} — ${Math.round(w)}x${Math.round(h)}px</text>
        ${textLines ? `<text x="${x + 16}" y="${y + 44}" fill="#e2e8f0" font-family="sans-serif" font-size="13">${textLines}</text>` : ""}
      </g>
    `;
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Boxwood Layout View - ${filename}</title>
  <style>
    body {
      background-color: #0c0c14;
      color: #e2e8f0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    h1 {
      color: #38bdf8;
      font-size: 24px;
      margin-bottom: 8px;
    }
    p {
      color: #8a8a9a;
      margin-bottom: 24px;
      font-size: 14px;
    }
    .canvas-container {
      background: radial-gradient(circle at center, #141424 0%, #0e0e16 100%);
      border: 1px solid #2d2d3d;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      padding: 10px;
      overflow: auto;
    }
    svg {
      display: block;
      background: repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(255,255,255,0.03) 20px),
                  repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(255,255,255,0.03) 20px);
    }
  </style>
</head>
<body>
  <h1>Boxwood Layout Solver Preview</h1>
  <p>Previewing resolved boxes for <strong>${filename}</strong> (${width}px x ${height}px)</p>
  <div class="canvas-container">
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <!-- Grid Background -->
      <rect width="100%" height="100%" fill="none" />

      <!-- Resolved Elements -->
      ${boxRects}

      <!-- Custom Connections & Arrows -->
      ${svgContent}
    </svg>
  </div>
</body>
</html>`;

  const outputPath = path.join(__dirname, filename);
  fs.writeFileSync(outputPath, html, "utf8");
  console.log(`\n🎉 Visual preview generated at: ${outputPath}`);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
