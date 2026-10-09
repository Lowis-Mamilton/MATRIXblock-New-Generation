/**
 * Icon Block definitions (horizontal, for younger students).
 * Every parameter is a FieldPicker with a small, fixed set of choices.
 */
import * as Blockly from 'blockly/core';
import { horizontalSizeMixin } from './renderer';
import { FieldPicker, type PickerConfig, type PickerOption } from './FieldPicker';
import { GLYPHS, type GlyphName } from './glyphs';
import { CATEGORY_COLOURS as C, SWATCHES } from '../shared/palette';
import { LED_COLORS, MOTOR_PORTS, SERVO_PORTS } from '../../ir/types';

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

export const PICKERS = {
  secs: { options: range(10).map((n) => ({ value: String(n), glyph: 'clock', text: String(n) })), columns: 5 },
  times: { options: range(10).map((n) => ({ value: String(n), glyph: 'times', text: String(n) })), columns: 5 },
  speed: {
    options: [
      { value: 'slow', glyph: 'speed1' },
      { value: 'medium', glyph: 'speed2' },
      { value: 'fast', glyph: 'speed3' },
    ],
  },
  motorPort: { options: MOTOR_PORTS.map((p) => ({ value: p, text: p })) },
  servoPort: { options: SERVO_PORTS.map((p) => ({ value: p, text: p })) },
  spin: { options: [{ value: 'cw', glyph: 'cw' }, { value: 'ccw', glyph: 'ccw' }] },
  angle: { options: [0, 45, 90, 135, 180].map((a) => ({ value: String(a), text: `${a}°` })), columns: 5 },
  led: {
    options: LED_COLORS.map((c) => ({ value: c, swatch: SWATCHES[c] })),
    columns: 5,
  },
  cond: {
    options: [
      { value: 'button', glyph: 'button' },
      { value: 'near', glyph: 'near' },
      ...['red', 'yellow', 'green', 'blue', 'black', 'white'].map((c) => ({ value: c, swatch: SWATCHES[c] })),
    ],
  },
  note: {
    options: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Do′'].map((t, i) => ({
      value: String([60, 62, 64, 65, 67, 69, 71, 72][i]),
      text: t,
    })),
  },
  direction: {
    big: true,
    options: [
      { value: 'forward', glyph: 'forward' },
      { value: 'backward', glyph: 'backward' },
      { value: 'left', glyph: 'left' },
      { value: 'right', glyph: 'right' },
    ],
  },
} satisfies Record<string, PickerConfig & { options: PickerOption[] }>;

interface IconDef {
  /** Main glyph, or a big picker field (name + picker) that acts as the glyph. */
  glyph: GlyphName | { name: string; picker: PickerConfig };
  colour: string;
  /** Badge fields, laid out two per row under the glyph. */
  fields?: [name: string, picker: PickerConfig, initial?: string][];
  hat?: boolean;
  end?: boolean;
  statement?: boolean;
}

function define(type: string, d: IconDef) {
  Blockly.Blocks[type] = {
    ...horizontalSizeMixin,
    init(this: Blockly.BlockSvg) {
      const head = this.appendDummyInput('GLYPH');
      if (typeof d.glyph === 'string') {
        head.appendField(new Blockly.FieldImage(GLYPHS[d.glyph], 40, 40, ''));
      } else {
        head.appendField(new FieldPicker(d.glyph.picker), d.glyph.name);
      }
      const fields = d.fields ?? [];
      for (let i = 0; i < fields.length; i += 2) {
        const row = this.appendDummyInput(`ROW${i / 2}`);
        for (const [name, picker, initial] of fields.slice(i, i + 2)) {
          row.appendField(new FieldPicker(picker, initial), name);
        }
      }
      if (d.statement) this.appendStatementInput('DO');
      if (!d.hat) this.setPreviousStatement(true);
      if (!d.end) this.setNextStatement(true);
      this.setColour(d.colour);
      this.setTooltip(() => Blockly.Msg[`MB_TIP_${type.toUpperCase()}`] ?? '');
    },
  };
}

define('i_start', { glyph: 'start', colour: C.events, hat: true });
define('i_when_button', { glyph: 'button', colour: C.events, hat: true });

define('i_move', {
  glyph: { name: 'DIR', picker: PICKERS.direction },
  colour: C.movement,
  fields: [
    ['SECS', PICKERS.secs, '1'],
    ['SPEED', PICKERS.speed, 'medium'],
  ],
});
define('i_stop', { glyph: 'stop', colour: C.movement });

define('i_motor', {
  glyph: 'motor',
  colour: C.motors,
  fields: [
    ['PORT', PICKERS.motorPort, 'M1'],
    ['DIR', PICKERS.spin, 'cw'],
    ['SECS', PICKERS.secs, '1'],
    ['SPEED', PICKERS.speed, 'medium'],
  ],
});
define('i_servo', {
  glyph: 'servo',
  colour: C.motors,
  fields: [
    ['PORT', PICKERS.servoPort, 'RC1'],
    ['ANGLE', PICKERS.angle, '90'],
  ],
});

define('i_wait', { glyph: 'wait', colour: C.control, fields: [['SECS', PICKERS.secs, '1']] });
define('i_wait_sensor', { glyph: 'waitSensor', colour: C.sensors, fields: [['COND', PICKERS.cond, 'button']] });
define('i_repeat', { glyph: 'repeat', colour: C.control, statement: true, fields: [['TIMES', PICKERS.times, '2']] });
define('i_forever', { glyph: 'forever', colour: C.control, statement: true, end: true });

define('i_led', { glyph: 'led', colour: C.looks, fields: [['COLOR', PICKERS.led, 'red']] });
define('i_sound', { glyph: 'note', colour: C.looks, fields: [['NOTE', PICKERS.note, '60']] });

/** Toolbox categories, in display order. `fields` pre-set a variant. */
export const ICON_TOOLBOX: { category: keyof typeof C; blocks: { type: string; fields?: Record<string, string> }[] }[] = [
  { category: 'events', blocks: [{ type: 'i_start' }, { type: 'i_when_button' }] },
  {
    category: 'movement',
    blocks: [
      ...['forward', 'backward', 'left', 'right'].map((dir) => ({ type: 'i_move', fields: { DIR: dir } })),
      { type: 'i_stop' },
    ],
  },
  { category: 'motors', blocks: [{ type: 'i_motor' }, { type: 'i_servo' }] },
  { category: 'sensors', blocks: [{ type: 'i_wait_sensor' }] },
  { category: 'control', blocks: [{ type: 'i_wait' }, { type: 'i_repeat' }, { type: 'i_forever' }] },
  { category: 'looks', blocks: [{ type: 'i_led' }, { type: 'i_sound' }] },
];
