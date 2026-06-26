/**
 * Example 04: Text Reflow, Auto-Height, and Overflow Detection
 * 
 * Demonstrates Boxwood's dynamic text wrapping, height calculation,
 * and overflow signalling capability.
 * 
 * We set up a vertical stack layout:
 * - Card 1: A text block container with variable content.
 * - Card 2: A card below it.
 * 
 * When we resolve the layout:
 * 1. The engine calculates how many lines the text wraps into based on the resolved column width.
 * 2. It sets Card 1's height dynamically based on the text.
 * 3. It shifts Card 2 down to prevent collision.
 * 4. If the text height exceeds a maximum limit, it emits a structured `OverflowSignal`.
 */

import { resolveLayout, LNode } from "../index.js";
import { exportHtml } from "./visualizer.js";

// 1. Text measurement mock function (calculates wrapping height based on box width)
function mockTextMeasure(text: string, fontSize: number) {
  return (availBox: { w: number }) => {
    const charsPerLine = Math.floor(availBox.w / (fontSize * 0.6));
    const words = text.split(" ");
    
    let lineCount = 1;
    let currentLineLength = 0;
    const lines: string[] = [];
    let currentLine: string[] = [];

    words.forEach((word) => {
      if (currentLineLength + word.length + 1 > charsPerLine) {
        lines.push(currentLine.join(" "));
        currentLine = [word];
        lineCount++;
        currentLineLength = word.length;
      } else {
        currentLine.push(word);
        currentLineLength += word.length + 1;
      }
    });
    if (currentLine.length > 0) {
      lines.push(currentLine.join(" "));
    }

    const lineHeight = fontSize * 1.35;
    const totalHeight = lineCount * lineHeight;

    return {
      w: availBox.w,
      h: totalHeight,
      ascent: fontSize * 0.8,
      descent: fontSize * 0.2,
      lines,
    };
  };
}

const longSpeech = "Every commit in Git is an immutable snapshot of your files. But it also contains a metadata pointer to its parent commit. This simple pointer structure forms a Directed Acyclic Graph.";

// 2. Define layout tree. Root is split vertically into a text card (auto-height) and a static card below it.
const layoutTree: LNode = {
  id: "vertical-stack-root",
  style: { padding: 30 },
  split: {
    rows: ["auto", 120], // Row 1 grows dynamically, Row 2 is exactly 120px tall
    gap: 20,
  },
  children: [
    // Dynamic text card
    {
      id: "card-dynamic-text",
      style: { w: "100%", padding: 16 },
      measure: mockTextMeasure(longSpeech, 20), // Font size 20
    },
    // Static card below it
    {
      id: "card-bottom-content",
      style: { w: "100%" },
    },
  ],
};

// 3. Resolve layout on a Wide Desktop (width: 1200px)
console.log("=== RESOLVING FOR WIDE DISPLAY (Width: 1200px) ===");
const wideResult = resolveLayout(layoutTree, { x: 0, y: 0, w: 1200, h: 800 });

const textCardWide = wideResult.boxes.find(b => b.node.id === "card-dynamic-text");
const bottomCardWide = wideResult.boxes.find(b => b.node.id === "card-bottom-content");

if (textCardWide && bottomCardWide) {
  console.log(`[Card 1 (Text)]: height: ${Math.round(textCardWide.box.h)}px`);
  console.log(`[Card 2 (Bottom)]: y-position: ${Math.round(bottomCardWide.box.y)}px`);
  console.log(`Lines rendered:\n  ${textCardWide.textLayout?.lines.join("\n  ")}`);
}

// 4. Resolve layout on a Narrow Screen (width: 400px)
console.log("\n=== RESOLVING FOR NARROW DISPLAY (Width: 400px) ===");
const narrowResult = resolveLayout(layoutTree, { x: 0, y: 0, w: 400, h: 800 });

const textCardNarrow = narrowResult.boxes.find(b => b.node.id === "card-dynamic-text");
const bottomCardNarrow = narrowResult.boxes.find(b => b.node.id === "card-bottom-content");

if (textCardNarrow && bottomCardNarrow) {
  console.log(`[Card 1 (Text)]: height: ${Math.round(textCardNarrow.box.h)}px (Grew to fit wrapped lines!)`);
  console.log(`[Card 2 (Bottom)]: y-position: ${Math.round(bottomCardNarrow.box.y)}px (Shifted down to prevent collision!)`);
  console.log(`Lines rendered:\n  ${textCardNarrow.textLayout?.lines.join("\n  ")}`);
}

// 5. Export HTML previews for visualization
exportHtml(wideResult.boxes, "04-reflow-wide.html", 1200, 800);
exportHtml(narrowResult.boxes, "04-reflow-narrow.html", 400, 800);
