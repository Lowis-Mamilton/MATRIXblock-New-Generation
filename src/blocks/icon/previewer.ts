/**
 * Connection previewer for Icon Blocks.
 *
 * Blockly's default InsertionMarkerPreviewer splices a ghost block into the
 * stack and shifts the following blocks *down* (it assumes vertical stacks).
 * For horizontal chains we instead draw a glowing vertical bar where the
 * dragged block will snap in.
 */
import * as Blockly from 'blockly/core';
import { ICON } from './renderer';

const BAR_W = 6;

export class IconConnectionPreviewer implements Blockly.IConnectionPreviewer {
  private bar: SVGElement | null = null;
  private replaced: Blockly.BlockSvg | null = null;

  constructor(private readonly dragged: Blockly.BlockSvg) {}

  previewReplacement(
    draggedConn: Blockly.RenderedConnection,
    staticConn: Blockly.RenderedConnection,
    replacedBlock: Blockly.BlockSvg,
  ) {
    this.previewConnection(draggedConn, staticConn);
    this.replaced = replacedBlock;
    replacedBlock.fadeForReplacement(true);
  }

  previewConnection(
    _draggedConn: Blockly.RenderedConnection,
    staticConn: Blockly.RenderedConnection,
  ) {
    this.hidePreview();
    const ws = this.dragged.workspace;
    this.bar = Blockly.utils.dom.createSvgElement(
      Blockly.utils.Svg.RECT,
      {
        class: 'mbIconDropBar',
        x: staticConn.x - BAR_W / 2,
        y: staticConn.y - 4,
        width: BAR_W,
        height: ICON.BASE + 8,
        rx: BAR_W / 2,
      },
      ws.getCanvas(),
    );
  }

  hidePreview() {
    this.bar?.remove();
    this.bar = null;
    this.replaced?.fadeForReplacement(false);
    this.replaced = null;
  }

  dispose() {
    this.hidePreview();
  }
}
