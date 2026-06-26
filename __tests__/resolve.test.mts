import { resolveLayout } from "../index.js";
import type { LBox, LNode, Measure } from "../index.js";

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
}

function approx(a: number, b: number, tol: number = 0.5): boolean {
  return Math.abs(a - b) <= tol;
}

function makeMeasure(): Measure {
  return (
    text: string,
    _style: { fontSize: number },
    maxW: number,
  ) => {
    const charW = _style.fontSize * 0.55;
    const lineH = _style.fontSize * 1.2;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const trial = cur ? cur + " " + w : w;
      if (trial.length * charW <= maxW || !cur) {
        cur = trial;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return {
      lines,
      w: Math.min(maxW, ...lines.map(l => l.length * charW)),
      h: lines.length * lineH,
      ascent: _style.fontSize * 0.8,
      descent: _style.fontSize * 0.2,
    };
  };
}

const measure = makeMeasure();

function textBox(text: string, fontSize: number = 24): LNode {
  return {
    style: { padding: 4 },
    measure: (avail: LBox) => {
      return measure(text, { fontSize }, avail.w);
    },
  };
}

// ── 1. Single full-frame node ──
{
  const root: LNode = {
    style: {},
    children: [textBox("Hello world", 24)],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 1920, h: 1080 }, { measure });
  assert(result.boxes.length === 2, "should have 2 nodes (root + text)");
  assert(approx(result.boxes[0].box.w, 1920), "root w = 1920");
  assert(approx(result.boxes[0].box.h, 1080), "root h = 1080");
  assert(result.boxes[1].box.w > 0, "text box has width");
  assert(result.boxes[1].box.h > 0, "text box has height");
  console.log("  1/7 Single full-frame node: ok");
}

// ── 2. Col split: 30%/auto with gap ──
{
  const root: LNode = {
    style: {},
    split: { cols: ["30%", "auto"], gap: 20, pad: 10 },
    children: [
      textBox("Left panel content", 20),
      textBox("Right panel content with more text that wraps", 20),
    ],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 1920, h: 1080 }, { measure });
  assert(result.boxes.length === 3, "should have 3 nodes (root + 2 cols)");
  const rootBox = result.boxes[0].box;
  const col0Box = result.boxes[1].box;
  const col1Box = result.boxes[2].box;

  assert(approx(rootBox.w, 1920), "root w full");
  assert(approx(rootBox.h, 1080), "root h full");

  // 30% of 1920 - 2*padding (10 each side) = 576 - 20 = 556... wait
  // ContentFrame = 1920 - 20 = 1900
  // 30% of 1900 = 570
  // Then gap = 20
  // auto col = 1900 - 570 - 20 = 1310
  const innerW = 1920 - 20;  // pad 10 each side
  const expectedCol0 = 0.3 * innerW;
  const expectedCol1 = innerW - expectedCol0 - 20;
  assert(approx(col0Box.w, expectedCol0), `col0 w ≈ ${expectedCol0}, got ${col0Box.w}`);
  assert(approx(col1Box.w, expectedCol1, 1), `col1 w ≈ ${expectedCol1}, got ${col1Box.w}`);
  assert(col0Box.x < col1Box.x, "col0 left of col1");
  console.log("  2/7 Col split 30%/auto: ok");
}

// ── 3. Row split with auto rows (intrinsic height) ──
{
  const root: LNode = {
    style: {},
    split: { rows: ["auto", "auto"], gap: 10, pad: 5 },
    children: [
      textBox("Short", 24),
      textBox("A much longer text that will wrap into several lines of content", 24),
    ],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 800, h: 600 }, { measure });
  assert(result.boxes.length === 3, "root + 2 rows");
  const row0 = result.boxes[1].box;
  const row1 = result.boxes[2].box;
  assert(row0.h > 0, "auto row 0 has height");
  assert(row1.h > 0, "auto row 1 has height");
  assert(row0.x === row1.x, "both rows share x");
  assert(row0.w === row1.w, "both rows share w");
  console.log("  3/7 Row split auto: ok");
}

// ── 4. Grid split 2×2 ──
{
  const root: LNode = {
    style: {},
    split: { grid: [2, 2], gap: 10, pad: 5 },
    children: [
      textBox("TL", 20),
      textBox("TR", 20),
      textBox("BL", 20),
      textBox("BR", 20),
    ],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 400, h: 400 }, { measure });
  assert(result.boxes.length === 5, "root + 4 cells");
  const tl = result.boxes[1].box;
  const tr = result.boxes[2].box;
  const bl = result.boxes[3].box;
  const br = result.boxes[4].box;
  assert(tl.x < tr.x, "TL left of TR");
  assert(bl.x < br.x, "BL left of BR");
  assert(tl.y < bl.y, "TL above BL");
  assert(tr.y < br.y, "TR above BR");
  assert(approx(tl.w, tr.w, 1), "TL/TR same width");
  assert(approx(tl.h, bl.h, 1), "TL/BL same height");
  console.log("  4/7 Grid 2x2: ok");
}

// ── 5. Nested: outer cols → inner rows ──
{
  const root: LNode = {
    style: {},
    split: { cols: ["50%", "50%"], gap: 10, pad: 5 },
    children: [
      {
        style: {},
        split: { rows: ["auto", "auto"], gap: 5, pad: 3 },
        children: [
          textBox("Nested left A", 18),
          textBox("Nested left B", 18),
        ],
      },
      textBox("Right side content", 20),
    ],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 1000, h: 600 }, { measure });
  assert(result.boxes.length === 5, "root + col0 wrapper + A + B + col1 text = 5");
  // All boxes should have valid dimensions
  for (const b of result.boxes) {
    assert(b.box.w > 0, `box w > 0 at ${b.node.id ?? "anon"}`);
    assert(b.box.h > 0, `box h > 0 at ${b.node.id ?? "anon"}`);
  }
  console.log("  5/7 Nested cols→rows: ok");
}

// ── 6. Padding and margin ──
{
  const root: LNode = {
    style: { padding: 20 },
    children: [
      {
        id: "inner",
        style: { margin: 10 },
        children: [textBox("Margined text", 20)],
      },
    ],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 1920, h: 1080 }, { measure });
  const rootBox = result.boxes[0].box;
  const innerBox = result.boxes[1].box;
  // Root has padding=20 → contentFrame inset by 20
  // Inner has margin=10 → further inset
  assert(approx(rootBox.x, 0), "root.x = 0");
  assert(approx(innerBox.x, 30, 1), `inner.x = pad(20) + margin(10) = 30, got ${innerBox.x}`);
  assert(approx(innerBox.y, 30, 1), `inner.y = pad(20) + margin(10) = 30`);
  console.log("  6/7 Padding and margin: ok");
}

// ── 7. Text auto-height with measure ──
{
  const root: LNode = {
    style: { padding: 10 },
    children: [textBox("This is a test sentence that should wrap at some width", 24)],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 400, h: 1080 }, { measure });
  const textNode = result.boxes[1];
  assert(textNode.box.h > 0, `auto-height text has positive h, got ${textNode.box.h}`);
  assert(textNode.contentFrame.h > 0, "content frame height positive");
  console.log("  7/7 Text auto-height: ok");
}

console.log("\n✅ All layout engine tests passed.");
