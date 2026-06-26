/**
 * Example 03: Converting Absolute PDF Spans to Responsive Layouts
 * 
 * When extracting data from PDFs (e.g. using pdfjs-dist), elements are returned
 * as absolute-positioned spans. If you resize the screen, they overlap.
 * 
 * This example shows how to:
 * 1. Take a raw list of absolute coordinate spans.
 * 2. Identify the logical rows/columns based on spatial alignment.
 * 3. Convert them into a percentage-based, relative Boxwood layout tree.
 * 4. Resolve the layout to make them fully responsive.
 */

import { resolveLayout, LNode } from "../index.js";
import { exportHtml } from "./visualizer.js";

// 1. Raw absolute coordinate elements extracted from a PDF page (original width: 1000px)
const PDF_WIDTH = 1000;

interface PdfSpan {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const extractedSpans: PdfSpan[] = [
  // Two header cards placed side-by-side in the PDF
  { id: "span-a", text: "Left Column Concept", x: 50, y: 150, w: 400, h: 60 },
  { id: "span-b", text: "Right Column Annotation", x: 550, y: 150, w: 400, h: 60 },
];

console.log("=== STEP 1: CONVERTING STATIC PDF SPANS TO RELATIVE Boxwood MODEL ===");

// 2. Build the children array by dividing coordinates by the original PDF width
const responsiveChildren: LNode[] = extractedSpans.map((span) => {
  const relWidth = `${(span.w / PDF_WIDTH) * 100}%`;
  
  return {
    id: span.id,
    style: {
      w: "100%", // let split box determine column sizing
      padding: 12,
    },
  };
});

// Since the spans are at the same Y (150) and separated horizontally,
// we wrap them in a horizontal columns split node
const responsiveLayoutTree: LNode = {
  id: "responsive-wrapper",
  style: { padding: 30 },
  split: {
    // Left column is 40% (400/1000), right is 40% (400/1000), gap is 10% (100/1000)
    cols: ["40%", "40%"],
    gap: "10%",
  },
  children: responsiveChildren,
};

console.log("Responsive LNode Tree Built successfully!");

// 3. Resolve the layout for a wide landscape screen (1920px)
console.log("\n=== STEP 2: RESOLVED ON WIDE VIEWPORT (1920px) ===");
const wideResult = resolveLayout(responsiveLayoutTree, { x: 0, y: 0, w: 1920, h: 1080 });
wideResult.boxes.forEach((box) => {
  if (box.node.id !== "responsive-wrapper") {
    console.log(`[${box.node.id}]: x=${Math.round(box.box.x)}, y=${Math.round(box.box.y)}, w=${Math.round(box.box.w)}px`);
  }
});

// 4. Resolve the layout for a mobile viewport (480px)
console.log("\n=== STEP 3: RESOLVED ON MOBILE VIEWPORT (480px) ===");
const mobileResult = resolveLayout(responsiveLayoutTree, { x: 0, y: 0, w: 480, h: 800 });
mobileResult.boxes.forEach((box) => {
  if (box.node.id !== "responsive-wrapper") {
    console.log(`[${box.node.id}]: x=${Math.round(box.box.x)}, y=${Math.round(box.box.y)}, w=${Math.round(box.box.w)}px`);
  }
});

// 5. Export HTML previews for visualization
exportHtml(wideResult.boxes, "03-responsive-wide.html", 1920, 1080);
exportHtml(mobileResult.boxes, "03-responsive-mobile.html", 480, 800);
