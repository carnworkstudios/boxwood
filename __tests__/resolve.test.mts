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

// ════════════════════════════════════════════════════════════════════════════
//  TWO-PASS FLOW CONTRACT  — these describe the target behavior of the
//  bottom-up-measure / top-down-layout resolver. Auto-height children inside a
//  split GROW to their text and push siblings; only an explicit fixed height
//  stays fixed and emits an OverflowSignal.
// ════════════════════════════════════════════════════════════════════════════

// ── 8. Auto rows: a tall text block pushes its sibling DOWN (true flow) ──
{
  const root: LNode = {
    style: {},
    split: { rows: ["auto", "auto"], gap: 10 },
    children: [
      // wraps to several lines at this width
      textBox("This is a long paragraph that will wrap into multiple lines and needs real vertical space", 24),
      { id: "below", ...textBox("Below", 24) },
    ],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 400, h: 600 }, { measure });
  const top = result.boxes[1].box;
  const below = result.boxes.find((b) => b.node.id === "below")!.box;
  // The sibling must start at or after the bottom of the grown top box (+ gap).
  assert(
    below.y >= top.y + top.h - 0.5,
    `sibling pushed below grown box: below.y=${below.y} should be ≥ top.y+top.h=${top.y + top.h}`,
  );
  assert(top.h > 40, `top box grew to its wrapped text, got h=${top.h}`);
  console.log("  8/12 Auto rows push siblings down: ok");
}

// ── 9. Content-based auto-height bubbles up to the ANCESTOR ──
{
  // Outer container has no height; its single auto-row child wraps a lot of
  // text. The container's own resolved height must reflect that grown content.
  const root: LNode = {
    style: { padding: 10 },
    children: [
      {
        id: "grower",
        ...textBox("Word ".repeat(60).trim(), 20),
      },
    ],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 300, h: 2000 }, { measure });
  const grower = result.boxes.find((b) => b.node.id === "grower")!;
  const single = measure("Word ".repeat(60).trim(), { fontSize: 20 }, 300 - 20 - 8);
  assert(
    grower.box.h > 100,
    `deeply-wrapped text produced a tall box, got h=${grower.box.h}`,
  );
  assert(single.lines.length > 5, `sanity: text actually wrapped a lot (${single.lines.length} lines)`);
  console.log("  9/12 Auto-height bubbles to ancestor: ok");
}

// ── 10. Fixed-height child still emits an OverflowSignal (and does NOT grow) ──
{
  const root: LNode = {
    style: {},
    split: { rows: ["auto", 60] },
    children: [
      { id: "auto-top", ...textBox("Top", 20) },
      {
        id: "fixed",
        style: { padding: 4, h: 60 },
        measure: (avail: LBox) =>
          measure("A long sentence that cannot possibly fit inside a sixty pixel tall fixed box at all", { fontSize: 20 }, avail.w),
      },
    ],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 300, h: 600 }, { measure });
  const fixed = result.boxes.find((b) => b.node.id === "fixed")!;
  assert(approx(fixed.box.h, 60, 1), `fixed box stays 60px, got ${fixed.box.h}`);
  assert(result.overflow.length >= 1, "fixed box that can't fit its text emits an OverflowSignal");
  assert(
    result.overflow.some((o) => o.path && o.path.length > 0),
    `OverflowSignal carries a non-empty path, got ${JSON.stringify(result.overflow.map((o) => o.path))}`,
  );
  console.log("  10/12 Fixed height overflows with path: ok");
}

// ── 11. Collision default ON: overlapping absolute badges get separated ──
{
  const root: LNode = {
    style: {},
    children: [
      { id: "a", style: { w: 60, h: 30, pos: { x: 100, y: 100 } } },
      { id: "b", style: { w: 60, h: 30, pos: { x: 100, y: 100 } } },
    ],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 600, h: 600 }, { measure });
  const a = result.boxes.find((n) => n.node.id === "a")!.box;
  const b = result.boxes.find((n) => n.node.id === "b")!.box;
  const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  assert(!overlap, "default collision separates the two badges");
  console.log("  11/12 Collision ON by default: ok");
}

// ── 12. Collision opt-out: { collide: false } leaves overlap intact ──
{
  const root: LNode = {
    style: {},
    children: [
      { id: "a", style: { w: 60, h: 30, pos: { x: 100, y: 100 } } },
      { id: "b", style: { w: 60, h: 30, pos: { x: 100, y: 100 } } },
    ],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 600, h: 600 }, { measure, collide: false });
  const a = result.boxes.find((n) => n.node.id === "a")!.box;
  const b = result.boxes.find((n) => n.node.id === "b")!.box;
  assert(approx(a.x, b.x) && approx(a.y, b.y), "with collide:false the boxes keep their intended overlap");
  console.log("  12/12 Collision opt-out honored: ok");
}

// ── 13. Deep nesting: a CONTAINER's height reflects its tall inner text, and
//        its sibling is placed below the real bottom (not the guessed one). ──
{
  const root: LNode = {
    style: {},
    split: { rows: ["auto", "auto"], gap: 10 },
    children: [
      {
        id: "container",
        style: {},
        children: [
          textBox("This nested paragraph wraps into many many lines of content that should make its container tall", 20),
        ],
      },
      { id: "sib", ...textBox("Sibling", 20) },
    ],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 300, h: 600 }, { measure });
  const container = result.boxes.find((b) => b.node.id === "container")!.box;
  const inner = result.boxes.find((b) => b.parent?.node.id === "container")!.box;
  const sib = result.boxes.find((b) => b.node.id === "sib")!.box;
  // The container must be at least as tall as the text it contains...
  assert(
    container.h >= inner.h - 0.5,
    `container height covers its inner text: container.h=${container.h}, inner.h=${inner.h}`,
  );
  // ...and the sibling must sit below the container's REAL bottom.
  assert(
    sib.y >= container.y + container.h - 0.5,
    `sibling below real container bottom: sib.y=${sib.y}, bottom=${container.y + container.h}`,
  );
  console.log("  13/14 Deep-nested container height + sibling flow: ok");
}

// ── 14. Auto text inside a COLS slot grows to content (no silent clipping) ──
{
  const tall = "A tall column of text that wraps into a lot of lines and needs much more vertical room than a short slot";
  const root: LNode = {
    style: {},
    split: { cols: ["50%", "50%"], gap: 10 },
    children: [
      {
        id: "left",
        style: { padding: 4 },
        measure: (avail: LBox) => measure(tall, { fontSize: 18 }, avail.w),
      },
      { id: "right", ...textBox("short", 18) },
    ],
  };
  const result = resolveLayout(root, { x: 0, y: 0, w: 300, h: 400 }, { measure });
  const left = result.boxes.find((b) => b.node.id === "left")!;
  const wrapped = measure(tall, { fontSize: 18 }, left.contentFrame.w);
  // The column's content frame should be tall enough for the wrapped text
  // rather than silently clipping it inside the slot.
  assert(
    left.contentFrame.h >= wrapped.h - 0.5,
    `auto col grows to its text: contentFrame.h=${left.contentFrame.h}, needs ${wrapped.h}`,
  );
  console.log("  14/14 Auto text in cols slot grows: ok");
}

console.log("\n✅ All layout engine tests passed.");
