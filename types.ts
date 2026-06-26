export interface LBox {
  x: number; y: number; w: number; h: number;
}

export type Sides = number | { top?: number; right?: number; bottom?: number; left?: number };

export type Len = number | `${number}%` | "auto";

export type Pos = { x?: Len; y?: Len } | "center";

export type Split =
  | { rows: number | Len[]; gap?: Len; pad?: Sides }
  | { cols: number | Len[]; gap?: Len; pad?: Sides }
  | { grid: [cols: number, rows: number]; gap?: Len; pad?: Sides }
  | { zones: Record<string, LBox> };

export interface LStyle {
  margin?: Sides;
  padding?: Sides;
  w?: Len;
  h?: Len;
  pos?: Pos;
}

export interface LNode {
  id?: string;
  style: LStyle;
  measure?: (avail: LBox) => { w: number; h: number; ascent: number; descent: number; lines: string[] };
  children?: LNode[];
  split?: Split;
}

export interface TextLayout {
  lines: string[];
  fontSize: number;
  ascent: number;
  descent: number;
}

export interface ResolvedLNode {
  node: LNode;
  box: LBox;
  contentFrame: LBox;
  textLayout?: TextLayout;
  children?: ResolvedLNode[];
  parent?: ResolvedLNode;
}

export type Measure = (
  text: string,
  style: { fontSize: number; fontWeight?: number; fontFamily?: string },
  maxW: number,
) => { lines: string[]; w: number; h: number; ascent: number; descent: number };

export interface OverflowSignal {
  path: string;
  box: LBox;
  fontSize: number;
  text: string;
}

export interface LayoutResult {
  root: ResolvedLNode;
  boxes: ResolvedLNode[];
  overflow: OverflowSignal[];
}
