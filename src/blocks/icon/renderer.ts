/**
 * Horizontal (left-to-right) renderer for Icon Blocks.
 *
 * Blockly's stock renderers assume statements stack top-to-bottom. Instead of
 * bending their row-based RenderInfo/Drawer pipeline, this renderer takes over
 * `render()` completely: it lays out fields, draws the outline, and places the
 * previous / next / statement connections on the left / right edges so that
 * Blockly's own connection logic chains blocks sideways.
 *
 * Shapes:
 *   regular  ┌────────┐      loop  ┌──────────────────┐
 *           ◁│  icon  │▷           │head│  inner…  │cap│▷
 *            └────────┘           ◁│    │          │   │
 *                                   └────┘          └───┘
 * Every block shares a "line": the y of its left/right connections. Regular
 * blocks hang below the line; loops rise above it by ARM + their inner ascent.
 */
import * as Blockly from 'blockly/core';

export const ICON = {
  BASE: 72,
  PAD: 8,
  NOTCH_Y: 26,
  NOTCH_H: 20,
  NOTCH_D: 8,
  R: 10,
  HAT_R: 28,
  ARM: 14,
  CAP: 18,
  EMPTY: 56,
  FIELD_GAP: 4,
};

/** Vertical extent of a block relative to its connection line. */
interface Extent {
  width: number;
  ascent: number;
  descent: number;
}

type IconBlock = Blockly.BlockSvg & { mbAscent?: number };

export function ascentOf(block: Blockly.BlockSvg): number {
  return (block as IconBlock).mbAscent ?? 0;
}

/** Size of a horizontal chain starting at `first` (blocks must be rendered). */
export function chainExtent(first: Blockly.BlockSvg | null): Extent | null {
  if (!first) return null;
  let width = 0;
  let ascent = 0;
  let descent = 0;
  for (let b: Blockly.BlockSvg | null = first; b; b = b.getNextBlock()) {
    const a = ascentOf(b);
    width += b.width;
    ascent = Math.max(ascent, a);
    descent = Math.max(descent, b.height - a);
  }
  return { width, ascent, descent };
}

const { NOTCH_Y, NOTCH_H, NOTCH_D, R } = ICON;

/** Tab sticking out to the right, drawn while travelling down. */
const tabDown = `l ${NOTCH_D},4 v ${NOTCH_H - 8} l ${-NOTCH_D},4`;
/** Matching indentation on the left edge, drawn while travelling up. */
const indentUp = `l ${NOTCH_D},-4 v ${-(NOTCH_H - 8)} l ${-NOTCH_D},-4`;

/** Highlight shape used for keyboard focus on a previous/next connection. */
const CONNECTION_HIGHLIGHT = `m 0,${NOTCH_Y - 6} v 6 ${tabDown} v 6`;

interface Row {
  fields: Blockly.Field[];
  width: number;
  height: number;
}

function measureRows(block: Blockly.BlockSvg): Row[] {
  const rows: Row[] = [];
  for (const input of block.inputList) {
    if (!input.isVisible()) continue;
    const fields = input.fieldRow.filter((f) => f.isVisible());
    if (!fields.length) continue;
    let width = 0;
    let height = 0;
    for (const f of fields) {
      const size = f.getSize();
      width += size.width;
      height = Math.max(height, size.height);
    }
    width += ICON.FIELD_GAP * (fields.length - 1);
    rows.push({ fields, width, height });
  }
  return rows;
}

function layoutRows(rows: Row[], x0: number, x1: number, y0: number, y1: number) {
  const totalH =
    rows.reduce((s, r) => s + r.height, 0) + ICON.FIELD_GAP * Math.max(0, rows.length - 1);
  let y = y0 + (y1 - y0 - totalH) / 2;
  for (const row of rows) {
    let x = x0 + (x1 - x0 - row.width) / 2;
    for (const f of row.fields) {
      const size = f.getSize();
      const fy = y + (row.height - size.height) / 2;
      f.getSvgRoot()?.setAttribute('transform', `translate(${x},${fy})`);
      x += size.width + ICON.FIELD_GAP;
    }
    y += row.height + ICON.FIELD_GAP;
  }
  return totalH;
}

export function renderIconBlock(block: Blockly.BlockSvg) {
  const rows = measureRows(block);
  const contentW = Math.max(0, ...rows.map((r) => r.width));
  const contentH =
    rows.reduce((s, r) => s + r.height, 0) + ICON.FIELD_GAP * Math.max(0, rows.length - 1);

  const hasPrev = !!block.previousConnection;
  const hasNext = !!block.nextConnection;
  const leftInset = hasPrev ? NOTCH_D : 0;
  const headW = Math.max(ICON.BASE, contentW + 2 * ICON.PAD + leftInset);
  const bodyH = Math.max(ICON.BASE, contentH + 2 * ICON.PAD);

  const stmt = block.inputList.find(
    (i) => i.type === Blockly.inputs.inputTypes.STATEMENT && i.isVisible(),
  );

  let width: number;
  let height: number;
  let line: number;
  let path: string;

  const leftR = hasPrev ? R : ICON.HAT_R;
  // A loop's right cap is too narrow for the big end-of-program rounding.
  const rightR = hasNext || stmt ? R : ICON.HAT_R;

  if (!stmt) {
    width = headW;
    height = bodyH;
    line = 0;
    path = outline({ width, height, line, hasPrev, hasNext, leftR, rightR });
    layoutRows(rows, leftInset, width, 0, height);
  } else {
    const inner = chainExtent(
      (stmt.connection?.targetBlock() as Blockly.BlockSvg | null) ?? null,
    ) ?? { width: ICON.EMPTY, ascent: 0, descent: ICON.BASE };
    line = ICON.ARM + inner.ascent;
    height = line + Math.max(bodyH, inner.descent);
    width = headW + inner.width + ICON.CAP;
    path = outline({
      width,
      height,
      line,
      hasPrev,
      hasNext,
      leftR,
      rightR,
      inner: { x0: headW, x1: width - ICON.CAP },
    });
    layoutRows(rows, leftInset, headW, line, height);
    (stmt.connection as Blockly.RenderedConnection | null)?.setOffsetInBlock(headW, line);
  }

  block.previousConnection?.setOffsetInBlock(0, line);
  block.nextConnection?.setOffsetInBlock(width, line);

  block.pathObject.setPath(path);
  block.height = height;
  block.width = width;
  block.childlessWidth = width;
  (block as IconBlock).mbAscent = line;

  updateConnectionHighlights(block);
}

interface OutlineSpec {
  width: number;
  height: number;
  line: number;
  hasPrev: boolean;
  hasNext: boolean;
  leftR: number;
  rightR: number;
  inner?: { x0: number; x1: number };
}

function outline(s: OutlineSpec): string {
  const { width: W, height: H, line, leftR, rightR } = s;
  const p: string[] = [];
  p.push(`M ${leftR},0`);
  p.push(`H ${W - rightR}`);
  p.push(`a ${rightR},${rightR} 0 0 1 ${rightR},${rightR}`);
  if (s.hasNext) {
    p.push(`V ${line + NOTCH_Y}`, tabDown);
  }
  p.push(`V ${H - rightR}`);
  p.push(`a ${rightR},${rightR} 0 0 1 ${-rightR},${rightR}`);
  if (s.inner) {
    // Under the arch: up the cap's inner edge, along the arm, down the head.
    p.push(`H ${s.inner.x1}`, `V ${ICON.ARM}`, `H ${s.inner.x0}`);
    p.push(`V ${line + NOTCH_Y}`, tabDown, `V ${H}`);
  }
  p.push(`H ${leftR}`);
  p.push(`a ${leftR},${leftR} 0 0 1 ${-leftR},${-leftR}`);
  if (s.hasPrev) {
    p.push(`V ${line + NOTCH_Y + NOTCH_H}`, indentUp);
  }
  p.push(`V ${leftR}`);
  p.push(`a ${leftR},${leftR} 0 0 1 ${leftR},${-leftR}`);
  p.push('z');
  return p.join(' ');
}

function updateConnectionHighlights(block: Blockly.BlockSvg) {
  const conns = [
    block.previousConnection,
    block.nextConnection,
    ...block.inputList
      .filter((i) => i.type === Blockly.inputs.inputTypes.STATEMENT)
      .map((i) => i.connection as Blockly.RenderedConnection | null),
  ].filter((c): c is Blockly.RenderedConnection => !!c);
  for (const conn of conns) {
    const svg = block.pathObject.addConnectionHighlight?.(
      conn,
      CONNECTION_HIGHLIGHT,
      conn.getOffsetInBlock(),
      false,
    );
    if (svg) {
      conn.setAriaRole(svg);
      svg.classList.toggle('blocklyHighlightedConnectionPathVisible', conn.isHighlighted());
    }
  }
}

export class IconRenderer extends Blockly.blockRendering.Renderer {
  override render(block: Blockly.BlockSvg) {
    renderIconBlock(block);
  }
}

/**
 * Block mixin: report the size of the horizontal chain this block heads,
 * instead of Blockly's vertical-stack assumption. Used for workspace bounds,
 * flyout layout and block placement.
 */
export const horizontalSizeMixin = {
  getHeightWidth(this: Blockly.BlockSvg) {
    const ext = chainExtent(this)!;
    return { width: ext.width, height: ext.ascent + ext.descent };
  },
};

export const ICON_RENDERER = 'mb_icon';
Blockly.blockRendering.register(ICON_RENDERER, IconRenderer);
