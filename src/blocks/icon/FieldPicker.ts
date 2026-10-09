/**
 * Tap-to-pick field for Icon Blocks.
 *
 * On the block it shows a compact badge (glyph, colour swatch and/or short
 * text). Tapping opens a grid of large choices so young students never type.
 * With `big: true` the field *is* the block's main 40×40 icon (e.g. the
 * direction of a move block) and has no badge.
 */
import * as Blockly from 'blockly/core';
import { GLYPHS, type GlyphName } from './glyphs';

export interface PickerOption {
  value: string;
  glyph?: GlyphName;
  swatch?: string;
  /** Literal text, or a Blockly.Msg key when `msg` is set. */
  text?: string;
  msg?: string;
}

export interface PickerConfig {
  options: PickerOption[];
  big?: boolean;
  columns?: number;
}

const BADGE_H = 24;
const BADGE_GLYPH = 18;
const BIG = 40;
const PAD = 5;
const FONT = { size: 13, weight: '600', family: 'Montserrat, "Noto Sans TC", sans-serif' };

const label = (o: PickerOption) => (o.msg ? Blockly.Msg[o.msg] ?? o.msg : o.text ?? '');

export class FieldPicker extends Blockly.Field {
  override SERIALIZABLE = true;
  private readonly cfg: PickerConfig;
  private bg: SVGRectElement | null = null;
  private img: SVGImageElement | null = null;
  private swatchEl: SVGRectElement | null = null;
  private txt: SVGTextElement | null = null;

  constructor(cfg: PickerConfig, value?: string) {
    super(value ?? cfg.options[0].value);
    this.cfg = cfg;
  }

  get options() {
    return this.cfg.options;
  }

  private current(): PickerOption {
    return this.cfg.options.find((o) => o.value === this.getValue()) ?? this.cfg.options[0];
  }

  protected override doClassValidation_(v?: unknown): string | null {
    const s = String(v);
    // `this.cfg` is unset while the base constructor sets the initial value.
    if (!this.cfg) return s;
    return this.cfg.options.some((o) => o.value === s) ? s : null;
  }

  protected override initView() {
    const g = this.fieldGroup_!;
    g.classList.add('mbPicker');
    const { createSvgElement } = Blockly.utils.dom;
    const { Svg } = Blockly.utils;
    if (!this.cfg.big) {
      this.bg = createSvgElement(Svg.RECT, { class: 'mbPickerBadge', rx: 7, ry: 7, height: BADGE_H }, g);
      // Inline style: Blockly's stylesheet paints rects inside editable fields white.
      Object.assign(this.bg.style, { fill: '#000', fillOpacity: '0.22', stroke: 'none' });
    }
    this.swatchEl = createSvgElement(Svg.RECT, { class: 'mbPickerSwatch', rx: 5, ry: 5 }, g);
    this.img = createSvgElement(Svg.IMAGE, {}, g);
    this.txt = createSvgElement(Svg.TEXT, { class: 'mbPickerText' }, g);
    this.clickTarget_ = g;
  }

  protected override render_() {
    const o = this.current();
    const big = !!this.cfg.big;
    const text = label(o);
    let x = big ? 0 : PAD;
    const h = big ? BIG : BADGE_H;

    const show = (el: SVGElement | null, on: boolean) => el?.setAttribute('display', on ? 'inline' : 'none');

    show(this.swatchEl, !!o.swatch);
    if (o.swatch && this.swatchEl) {
      const sw = big ? BIG : 18;
      this.swatchEl.setAttribute('x', String(x));
      this.swatchEl.setAttribute('y', String((h - sw) / 2));
      this.swatchEl.setAttribute('width', String(sw));
      this.swatchEl.setAttribute('height', String(sw));
      this.swatchEl.style.fill = o.swatch;
      x += sw + (text ? 4 : 0);
    }

    show(this.img, !!o.glyph);
    if (o.glyph && this.img) {
      const gs = big ? BIG : BADGE_GLYPH;
      this.img.setAttribute('href', GLYPHS[o.glyph]);
      this.img.setAttribute('x', String(x));
      this.img.setAttribute('y', String((h - gs) / 2));
      this.img.setAttribute('width', String(gs));
      this.img.setAttribute('height', String(gs));
      x += gs + (text ? 3 : 0);
    }

    show(this.txt, !!text);
    if (text && this.txt) {
      this.txt.textContent = text;
      const w = Blockly.utils.dom.getFastTextWidth(this.txt, FONT.size, FONT.weight, FONT.family);
      this.txt.setAttribute('x', String(x));
      this.txt.setAttribute('y', String(h / 2));
      x += w;
    }

    const width = big ? Math.max(BIG, x) : x + PAD;
    this.bg?.setAttribute('width', String(width));
    this.size_ = new Blockly.utils.Size(width, h);
  }

  protected override showEditor_() {
    const block = this.getSourceBlock() as Blockly.BlockSvg | null;
    if (!block) return;
    const div = Blockly.DropDownDiv;
    div.clearContent();
    const grid = document.createElement('div');
    grid.className = 'mbPickerGrid';
    grid.style.gridTemplateColumns = `repeat(${this.cfg.columns ?? Math.min(4, this.cfg.options.length)}, auto)`;
    const colour = block.getColour();
    for (const o of this.cfg.options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mbPickerChoice' + (o.value === this.getValue() ? ' selected' : '');
      btn.style.background = colour;
      btn.setAttribute('aria-label', label(o) || o.value);
      if (o.swatch) {
        const sw = document.createElement('span');
        sw.className = 'mbPickerChoiceSwatch';
        sw.style.background = o.swatch;
        btn.appendChild(sw);
      }
      if (o.glyph) {
        const im = document.createElement('img');
        im.src = GLYPHS[o.glyph];
        im.alt = '';
        btn.appendChild(im);
      }
      const text = label(o);
      if (text) {
        const t = document.createElement('span');
        t.textContent = text;
        btn.appendChild(t);
      }
      btn.addEventListener('click', () => {
        this.setValue(o.value);
        div.hideIfOwner(this);
      });
      grid.appendChild(btn);
    }
    div.getContentDiv().appendChild(grid);
    div.setColour('#ffffff', '#cbd5e3');
    div.showPositionedByField(this);
  }
}
