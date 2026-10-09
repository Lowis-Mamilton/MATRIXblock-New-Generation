import * as Blockly from 'blockly/core';
import * as En from 'blockly/msg/en';
Blockly.setLocale(En as unknown as Record<string, string>);
import '../blocks/icon/renderer';
import { horizontalSizeMixin, ICON_RENDERER } from '../blocks/icon/renderer';
import { IconConnectionPreviewer } from '../blocks/icon/previewer';
import { GLYPHS, type GlyphName } from '../blocks/icon/glyphs';

const nums = Array.from({ length: 10 }, (_, i) => [String(i + 1), String(i + 1)] as [string, string]);

function def(type: string, glyph: GlyphName, colour: string, opts: { prev?: boolean; next?: boolean; stmt?: boolean; num?: boolean }) {
  Blockly.Blocks[type] = {
    ...horizontalSizeMixin,
    init(this: Blockly.BlockSvg) {
      const row = this.appendDummyInput().appendField(new Blockly.FieldImage(GLYPHS[glyph], 40, 40, '*'));
      if (opts.num) this.appendDummyInput().appendField(new Blockly.FieldDropdown(nums), 'N');
      void row;
      if (opts.stmt) this.appendStatementInput('DO');
      if (opts.prev !== false) this.setPreviousStatement(true);
      if (opts.next !== false) this.setNextStatement(true);
      this.setColour(colour);
    },
  };
}

def('s_start', 'start', '#E8A33D', { prev: false });
def('s_fwd', 'forward', '#2E5690', { num: true });
def('s_left', 'left', '#2E5690', { num: true });
def('s_led', 'led', '#8E5BC9', {});
def('s_repeat', 'repeat', '#E07A2F', { stmt: true, num: true });
def('s_forever', 'forever', '#E07A2F', { stmt: true, next: false });

const ws = Blockly.inject(document.getElementById('root')!, {
  renderer: ICON_RENDERER,
  horizontalLayout: true,
  toolboxPosition: 'end',
  trashcan: true,
  zoom: { controls: true, wheel: true, startScale: 1 },
  plugins: { connectionPreviewer: IconConnectionPreviewer },
  toolbox: {
    kind: 'flyoutToolbox',
    contents: ['s_start', 's_fwd', 's_left', 's_led', 's_repeat', 's_forever'].map((type) => ({ kind: 'block', type })),
  },
});

Blockly.serialization.workspaces.load(
  {
    blocks: {
      blocks: [
        {
          type: 's_start', x: 40, y: 60,
          next: { block: { type: 's_fwd', next: { block: { type: 's_repeat',
            inputs: { DO: { block: { type: 's_left', next: { block: { type: 's_led' } } } } },
            next: { block: { type: 's_led' } } } } } },
        },
      ],
    },
  },
  ws,
);
(window as unknown as { ws: Blockly.WorkspaceSvg }).ws = ws;
