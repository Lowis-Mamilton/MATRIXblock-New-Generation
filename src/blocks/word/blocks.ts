/**
 * Word Block definitions (vertical, Scratch-like, for older students).
 * Text comes from Blockly.Msg (%{BKY_...}) so it follows the UI language;
 * operators and variables reuse Blockly's built-in blocks.
 */
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { ANALOG_PORTS, DIGITAL_PORTS, GESTURES, I2C_PORTS, LED_COLORS, MOTOR_PORTS, SENSOR_COLORS, SERVO_PORTS } from '../../ir/types';

const msg = (key: string) => `%{BKY_${key}}`;
const dropdown = (name: string, options: [string, string][]) => ({ type: 'field_dropdown', name, options });
const value = (name: string, check?: string) => ({ type: 'input_value', name, ...(check ? { check } : {}) });
const statement = (name: string) => ({ type: 'input_statement', name });

const motorPort = dropdown('PORT', MOTOR_PORTS.map((p) => [p, p]));
const servoPort = dropdown('PORT', SERVO_PORTS.map((p) => [p, p]));
const i2cPort = (initial: number) => {
  // Rotate the list so the dropdown's first (default) option is `initial`.
  const ports = [...I2C_PORTS.slice(initial), ...I2C_PORTS.slice(0, initial)];
  return dropdown('PORT', ports.map((p) => [p, p]));
};
const digitalPort = dropdown('PORT', DIGITAL_PORTS.map((p) => [p, p]));
const analogPort = dropdown('PORT', ANALOG_PORTS.map((p) => [p, p]));
const gesture = dropdown(
  'GESTURE',
  GESTURES.filter((g) => g !== 'none').map((g) => [msg(`MB_G_${g.toUpperCase()}`), g]),
);
const button = dropdown('BTN', [
  [msg('MB_BTN_UP'), 'up'],
  [msg('MB_BTN_DOWN'), 'down'],
]);
const ledTarget = dropdown('WHICH', [
  [msg('MB_LED_BOTH'), 'both'],
  [msg('MB_LED_1'), '1'],
  [msg('MB_LED_2'), '2'],
]);
const unit = dropdown('UNIT', [
  [msg('MB_UNIT_SEC'), 'sec'],
  [msg('MB_UNIT_ROT'), 'rot'],
  [msg('MB_UNIT_DEG'), 'deg'],
]);
const stopMode = dropdown('MODE', [
  [msg('MB_BRAKE'), 'brake'],
  [msg('MB_COAST'), 'coast'],
]);
const colourName = (c: string) => msg(`MB_C_${c.toUpperCase()}`);
const ledColour = dropdown('COLOR', LED_COLORS.map((c) => [colourName(c), c]));
const sensorColour = dropdown(
  'COLOR',
  SENSOR_COLORS.filter((c) => c !== 'none').map((c) => [colourName(c), c]),
);
const NOTE_NAMES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'];
const NOTE_MIDI = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84];
const note = dropdown('NOTE', NOTE_NAMES.map((n, i) => [n, String(NOTE_MIDI[i])]));

const tip = (type: string) => msg(`MB_TIP_${type.toUpperCase()}`);

const stmt = (type: string, style: string, message0: string, args0: object[] = [], extra: object = {}) => ({
  type,
  tooltip: tip(type),
  style,
  message0,
  args0,
  previousStatement: null,
  nextStatement: null,
  inputsInline: true,
  ...extra,
});
const hat = (type: string, message0: string, args0: object[] = []) => ({
  type,
  tooltip: tip(type),
  style: 'events_hat',
  message0,
  args0,
  nextStatement: null,
});
const reporter = (type: string, style: string, message0: string, output: string, args0: object[] = []) => ({
  type,
  tooltip: tip(type),
  style,
  message0,
  args0,
  output,
});

Blockly.common.defineBlocksWithJsonArray([
  // ---- events ----
  hat('w_when_start', msg('MB_WHEN_START')),
  hat('w_when_button', msg('MB_WHEN_BUTTON'), [button]),
  hat('w_when_message', msg('MB_WHEN_MESSAGE'), [{ type: 'field_input', name: 'MSG', text: 'message1' }]),
  stmt('w_broadcast', 'events_blocks', msg('MB_BROADCAST'), [{ type: 'field_input', name: 'MSG', text: 'message1' }]),

  // ---- movement ----
  stmt('w_move_steer', 'movement_blocks', msg('MB_MOVE_STEER'), [value('STEER', 'Number'), value('SPEED', 'Number'), value('AMOUNT', 'Number'), unit]),
  stmt('w_move_steer_start', 'movement_blocks', msg('MB_MOVE_STEER_START'), [value('STEER', 'Number'), value('SPEED', 'Number')]),
  stmt('w_move_tank', 'movement_blocks', msg('MB_MOVE_TANK'), [value('LEFT', 'Number'), value('RIGHT', 'Number'), value('AMOUNT', 'Number'), unit]),
  stmt('w_move_tank_start', 'movement_blocks', msg('MB_MOVE_TANK_START'), [value('LEFT', 'Number'), value('RIGHT', 'Number')]),
  stmt('w_move_stop', 'movement_blocks', msg('MB_MOVE_STOP'), [stopMode]),

  // ---- motors ----
  stmt('w_motor_run_for', 'motors_blocks', msg('MB_MOTOR_RUN_FOR'), [motorPort, value('SPEED', 'Number'), value('AMOUNT', 'Number'), unit]),
  stmt('w_motor_start', 'motors_blocks', msg('MB_MOTOR_START'), [motorPort, value('SPEED', 'Number')]),
  stmt('w_motor_stop', 'motors_blocks', msg('MB_MOTOR_STOP'), [motorPort, stopMode]),
  stmt('w_motor_reset', 'motors_blocks', msg('MB_MOTOR_RESET'), [motorPort]),
  reporter('w_motor_angle', 'motors_blocks', msg('MB_MOTOR_ANGLE'), 'Number', [motorPort]),
  stmt('w_servo', 'motors_blocks', msg('MB_SERVO'), [servoPort, value('ANGLE', 'Number')]),

  // ---- sensors ----
  reporter('w_color', 'sensors_blocks', msg('MB_COLOR'), 'String', [i2cPort(0)]),
  reporter('w_color_is', 'sensors_blocks', msg('MB_COLOR_IS'), 'Boolean', [i2cPort(0), sensorColour]),
  reporter('w_distance', 'sensors_blocks', msg('MB_DISTANCE'), 'Number', [i2cPort(1)]),
  reporter('w_ultrasonic', 'sensors_blocks', msg('MB_ULTRASONIC'), 'Number', [digitalPort]),
  reporter('w_analog', 'sensors_blocks', msg('MB_ANALOG'), 'Number', [analogPort]),
  reporter('w_digital', 'sensors_blocks', msg('MB_DIGITAL'), 'Boolean', [digitalPort]),
  reporter('w_gesture_is', 'sensors_blocks', msg('MB_GESTURE_IS'), 'Boolean', [i2cPort(2), gesture]),
  reporter('w_tilt', 'sensors_blocks', msg('MB_TILT'), 'Number', [
    dropdown('AXIS', [
      [msg('MB_AXIS_PITCH'), 'pitch'],
      [msg('MB_AXIS_ROLL'), 'roll'],
      [msg('MB_AXIS_YAW'), 'yaw'],
    ]),
  ]),
  reporter('w_button', 'sensors_blocks', msg('MB_BUTTON'), 'Boolean', [button]),
  reporter('w_timer', 'sensors_blocks', msg('MB_TIMER'), 'Number'),
  stmt('w_timer_reset', 'sensors_blocks', msg('MB_TIMER_RESET')),
  reporter('w_battery', 'sensors_blocks', msg('MB_BATTERY'), 'Number'),

  // ---- light & sound ----
  stmt('w_led', 'looks_blocks', msg('MB_LED'), [ledTarget, ledColour]),
  stmt('w_beep', 'looks_blocks', msg('MB_BEEP'), [note, value('SECS', 'Number')]),

  // ---- control ----
  stmt('w_wait', 'control_blocks', msg('MB_WAIT'), [value('SECS', 'Number')]),
  stmt('w_wait_until', 'control_blocks', msg('MB_WAIT_UNTIL'), [value('COND', 'Boolean')]),
  stmt('w_repeat', 'control_blocks', msg('MB_REPEAT'), [value('TIMES', 'Number')], {
    message1: '%1',
    args1: [statement('DO')],
  }),
  {
    ...stmt('w_forever', 'control_blocks', msg('MB_FOREVER'), [], { message1: '%1', args1: [statement('DO')] }),
    nextStatement: undefined,
  },
  stmt('w_repeat_until', 'control_blocks', msg('MB_REPEAT_UNTIL'), [value('COND', 'Boolean')], {
    message1: '%1',
    args1: [statement('DO')],
  }),
  stmt('w_if', 'control_blocks', msg('MB_IF'), [value('COND', 'Boolean')], {
    message1: '%1',
    args1: [statement('DO')],
  }),
  stmt('w_if_else', 'control_blocks', msg('MB_IF'), [value('COND', 'Boolean')], {
    message1: '%1',
    args1: [statement('DO')],
    message2: msg('MB_ELSE'),
    message3: '%1',
    args3: [statement('ELSE')],
  }),
  { ...stmt('w_stop_all', 'control_blocks', msg('MB_STOP_ALL')), nextStatement: undefined },
]);

const num = (v: number) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });

type ToolboxBlock = { kind: 'block'; type: string; inputs?: Record<string, unknown>; fields?: Record<string, unknown> };
const b = (type: string, inputs?: Record<string, unknown>, fields?: Record<string, unknown>): ToolboxBlock => ({
  kind: 'block',
  type,
  ...(inputs ? { inputs } : {}),
  ...(fields ? { fields } : {}),
});

/** Category contents in display order; the variables category is dynamic. */
export const WORD_TOOLBOX: { category: string; contents: ToolboxBlock[] | 'VARIABLE' }[] = [
  {
    category: 'events',
    contents: [b('w_when_start'), b('w_when_button'), b('w_when_message'), b('w_broadcast')],
  },
  {
    category: 'movement',
    contents: [
      b('w_move_steer', { STEER: num(0), SPEED: num(50), AMOUNT: num(1) }),
      b('w_move_tank', { LEFT: num(50), RIGHT: num(50), AMOUNT: num(1) }),
      b('w_move_steer_start', { STEER: num(0), SPEED: num(50) }),
      b('w_move_tank_start', { LEFT: num(50), RIGHT: num(50) }),
      b('w_move_stop'),
    ],
  },
  {
    category: 'motors',
    contents: [
      b('w_motor_run_for', { SPEED: num(50), AMOUNT: num(1) }),
      b('w_motor_start', { SPEED: num(50) }),
      b('w_motor_stop'),
      b('w_motor_reset'),
      b('w_motor_angle'),
      b('w_servo', { ANGLE: num(90) }),
    ],
  },
  {
    category: 'sensors',
    contents: [
      b('w_color_is'),
      b('w_color'),
      b('w_distance'),
      b('w_ultrasonic'),
      b('w_analog'),
      b('w_digital'),
      b('w_gesture_is'),
      b('w_tilt'),
      b('w_button'),
      b('w_timer'),
      b('w_timer_reset'),
      b('w_battery'),
    ],
  },
  {
    category: 'looks',
    contents: [b('w_led'), b('w_beep', { SECS: num(0.5) })],
  },
  {
    category: 'control',
    contents: [
      b('w_wait', { SECS: num(1) }),
      b('w_wait_until'),
      b('w_repeat', { TIMES: num(4) }),
      b('w_forever'),
      b('w_repeat_until'),
      b('w_if'),
      b('w_if_else'),
      b('w_stop_all'),
    ],
  },
  {
    category: 'operators',
    contents: [
      b('math_number', undefined, { NUM: 0 }),
      b('math_arithmetic', { A: num(1), B: num(1) }),
      b('math_random_int', { FROM: num(1), TO: num(10) }),
      b('logic_compare', { A: num(0), B: num(0) }),
      b('logic_operation'),
      b('logic_negate'),
      b('logic_boolean'),
    ],
  },
  { category: 'variables', contents: 'VARIABLE' },
];
