/**
 * Compile a serialized Blockly workspace (Icon or Word mode) into a Program.
 *
 * Working from the JSON produced by `Blockly.serialization.workspaces.save`
 * keeps the compiler free of Blockly and the DOM, so it is unit-testable and
 * can also compile saved project files directly.
 */
import type {
  Amount,
  AmountUnit,
  BinOp,
  ButtonId,
  Expr,
  I2cPort,
  LedColor,
  LedTarget,
  MotorPort,
  Program,
  SensorConfig,
  ServoPort,
  StopMode,
  Stmt,
  Thread,
  TiltAxis,
  Trigger,
} from './types';

export interface SBlock {
  type: string;
  id: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: SBlock; shadow?: SBlock }>;
  next?: { block?: SBlock };
  enabled?: boolean;
}

export interface SWorkspace {
  blocks?: { blocks?: SBlock[] };
  variables?: { name: string; id: string }[];
}

/** Icon-mode speed presets (percent). */
export const ICON_SPEEDS = { slow: 30, medium: 60, fast: 100 } as const;
export type IconSpeed = keyof typeof ICON_SPEEDS;

/** Icon-mode "near" threshold for the distance sensor, in cm. */
export const NEAR_CM = 10;

/** Icon-mode note length in seconds. */
export const ICON_NOTE_SECS = 0.5;

export const DEFAULT_SENSORS: SensorConfig = { color: 'I2C1', distance: 'I2C2' };

class Ctx {
  private varNames = new Map<string, string>();

  constructor(ws: SWorkspace) {
    for (const v of ws.variables ?? []) this.varNames.set(v.id, v.name);
  }

  varName(field: unknown): string {
    if (field && typeof field === 'object' && 'id' in field) {
      const id = String((field as { id: unknown }).id);
      return this.varNames.get(id) ?? ((field as { name?: string }).name ?? id);
    }
    return String(field ?? '');
  }

  get variables() {
    return [...new Set(this.varNames.values())];
  }
}

const num = (v: number): Expr => ({ k: 'num', v });
const str = (b: SBlock, name: string) => String(b.fields?.[name] ?? '');
const field = <T extends string>(b: SBlock, name: string) => str(b, name) as T;
const fnum = (b: SBlock, name: string) => Number(b.fields?.[name] ?? 0);
const child = (b: SBlock, input: string) => b.inputs?.[input]?.block ?? b.inputs?.[input]?.shadow;

const button = (b: SBlock): ButtonId => (str(b, 'BTN') === 'down' ? 'down' : 'up');
const ledTarget = (b: SBlock): LedTarget => (field<LedTarget>(b, 'WHICH') || 'both');

const TRIGGERS: Record<string, (b: SBlock) => Trigger> = {
  w_when_start: () => ({ k: 'start' }),
  w_when_button: (b) => ({ k: 'button', button: button(b) }),
  w_when_message: (b) => ({ k: 'message', msg: str(b, 'MSG') }),
  i_start: () => ({ k: 'start' }),
  i_when_button: (b) => ({ k: 'button', button: button(b) }),
};

type StmtCompiler = (b: SBlock, c: Compiler) => Omit<Stmt, 'id'>;

const iconSpeed = (b: SBlock) => ICON_SPEEDS[field<IconSpeed>(b, 'SPEED')] ?? ICON_SPEEDS.medium;
const secs = (b: SBlock): Amount => ({ amount: num(fnum(b, 'SECS')), unit: 'sec' });

const STATEMENTS: Record<string, StmtCompiler> = {
  // ---- Word: movement ----
  w_move_steer: (b, c) => ({ op: 'moveSteer', steer: c.expr(b, 'STEER'), speed: c.expr(b, 'SPEED'), limit: c.amount(b) }),
  w_move_steer_start: (b, c) => ({ op: 'moveSteer', steer: c.expr(b, 'STEER'), speed: c.expr(b, 'SPEED') }),
  w_move_tank: (b, c) => ({ op: 'moveTank', left: c.expr(b, 'LEFT'), right: c.expr(b, 'RIGHT'), limit: c.amount(b) }),
  w_move_tank_start: (b, c) => ({ op: 'moveTank', left: c.expr(b, 'LEFT'), right: c.expr(b, 'RIGHT') }),
  w_move_stop: (b) => ({ op: 'moveStop', mode: field<StopMode>(b, 'MODE') }),
  // ---- Word: motors ----
  w_motor_run_for: (b, c) => ({ op: 'motorRun', port: field<MotorPort>(b, 'PORT'), speed: c.expr(b, 'SPEED'), limit: c.amount(b) }),
  w_motor_start: (b, c) => ({ op: 'motorRun', port: field<MotorPort>(b, 'PORT'), speed: c.expr(b, 'SPEED') }),
  w_motor_stop: (b) => ({ op: 'motorStop', port: field<MotorPort>(b, 'PORT'), mode: field<StopMode>(b, 'MODE') }),
  w_motor_reset: (b) => ({ op: 'motorResetAngle', port: field<MotorPort>(b, 'PORT') }),
  w_servo: (b, c) => ({ op: 'servo', port: field<ServoPort>(b, 'PORT'), angle: c.expr(b, 'ANGLE') }),
  // ---- Word: light & sound ----
  w_led: (b) => ({ op: 'led', target: ledTarget(b), color: field<LedColor>(b, 'COLOR') }),
  w_beep: (b, c) => ({ op: 'beep', note: num(fnum(b, 'NOTE')), secs: c.expr(b, 'SECS') }),
  // ---- Word: control ----
  w_wait: (b, c) => ({ op: 'wait', secs: c.expr(b, 'SECS') }),
  w_wait_until: (b, c) => ({ op: 'waitUntil', cond: c.expr(b, 'COND', false) }),
  w_repeat: (b, c) => ({ op: 'repeat', times: c.expr(b, 'TIMES'), body: c.stack(b, 'DO') }),
  w_forever: (b, c) => ({ op: 'forever', body: c.stack(b, 'DO') }),
  w_repeat_until: (b, c) => ({ op: 'repeatUntil', cond: c.expr(b, 'COND', false), body: c.stack(b, 'DO') }),
  w_if: (b, c) => ({ op: 'if', cond: c.expr(b, 'COND', false), then: c.stack(b, 'DO') }),
  w_if_else: (b, c) => ({ op: 'if', cond: c.expr(b, 'COND', false), then: c.stack(b, 'DO'), else: c.stack(b, 'ELSE') }),
  w_stop_all: () => ({ op: 'stopAll' }),
  w_broadcast: (b) => ({ op: 'broadcast', msg: str(b, 'MSG') }),
  // ---- Word: variables (Blockly built-ins) ----
  variables_set: (b, c) => ({ op: 'setVar', name: c.ctx.varName(b.fields?.VAR), value: c.expr(b, 'VALUE') }),
  math_change: (b, c) => ({ op: 'changeVar', name: c.ctx.varName(b.fields?.VAR), by: c.expr(b, 'DELTA') }),

  // ---- Icon ----
  i_move: (b) => {
    const s = iconSpeed(b);
    const dir = str(b, 'DIR');
    const [steer, speed] =
      dir === 'backward' ? [0, -s] : dir === 'left' ? [-100, s] : dir === 'right' ? [100, s] : [0, s];
    return { op: 'moveSteer', steer: num(steer), speed: num(speed), limit: secs(b) };
  },
  i_stop: () => ({ op: 'moveStop', mode: 'brake' }),
  i_motor: (b) => ({
    op: 'motorRun',
    port: field<MotorPort>(b, 'PORT'),
    speed: num(iconSpeed(b) * (str(b, 'DIR') === 'ccw' ? -1 : 1)),
    limit: secs(b),
  }),
  i_servo: (b) => ({ op: 'servo', port: field<ServoPort>(b, 'PORT'), angle: num(fnum(b, 'ANGLE')) }),
  i_wait: (b) => ({ op: 'wait', secs: num(fnum(b, 'SECS')) }),
  i_wait_sensor: (b, c) => ({ op: 'waitUntil', cond: iconCondition(str(b, 'COND'), c.sensors) }),
  i_repeat: (b, c) => ({ op: 'repeat', times: num(fnum(b, 'TIMES')), body: c.stack(b, 'DO') }),
  i_forever: (b, c) => ({ op: 'forever', body: c.stack(b, 'DO') }),
  i_led: (b) => ({ op: 'led', target: ledTarget(b), color: field<LedColor>(b, 'COLOR') }),
  i_sound: (b) => ({ op: 'beep', note: num(fnum(b, 'NOTE')), secs: num(ICON_NOTE_SECS) }),
};

/** Icon "wait until" choices: `up` / `down` button, `near`, or a colour name. */
export function iconCondition(cond: string, sensors: SensorConfig): Expr {
  if (cond === 'up' || cond === 'down') return { k: 'sensor', read: { type: 'button', button: cond } };
  if (cond === 'near') {
    return { k: 'bin', op: '<', a: { k: 'sensor', read: { type: 'distance', port: sensors.distance } }, b: num(NEAR_CM) };
  }
  return {
    k: 'bin',
    op: '=',
    a: { k: 'sensor', read: { type: 'color', port: sensors.color } },
    b: { k: 'str', v: cond },
  };
}

const ARITH: Record<string, BinOp> = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' };
const COMPARE: Record<string, BinOp> = { EQ: '=', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };

type ExprCompiler = (b: SBlock, c: Compiler) => Expr;

const EXPRESSIONS: Record<string, ExprCompiler> = {
  math_number: (b) => num(fnum(b, 'NUM')),
  logic_boolean: (b) => ({ k: 'bool', v: str(b, 'BOOL') === 'TRUE' }),
  math_arithmetic: (b, c) => ({ k: 'bin', op: ARITH[str(b, 'OP')] ?? '+', a: c.expr(b, 'A'), b: c.expr(b, 'B') }),
  logic_compare: (b, c) => ({ k: 'bin', op: COMPARE[str(b, 'OP')] ?? '=', a: c.expr(b, 'A'), b: c.expr(b, 'B') }),
  logic_operation: (b, c) => ({
    k: 'bin',
    op: str(b, 'OP') === 'OR' ? 'or' : 'and',
    a: c.expr(b, 'A', false),
    b: c.expr(b, 'B', false),
  }),
  logic_negate: (b, c) => ({ k: 'not', a: c.expr(b, 'BOOL', false) }),
  math_random_int: (b, c) => ({ k: 'random', min: c.expr(b, 'FROM'), max: c.expr(b, 'TO') }),
  variables_get: (b, c) => ({ k: 'var', name: c.ctx.varName(b.fields?.VAR) }),
  w_color: (b) => ({ k: 'sensor', read: { type: 'color', port: field<I2cPort>(b, 'PORT') } }),
  w_color_is: (b) => ({
    k: 'bin',
    op: '=',
    a: { k: 'sensor', read: { type: 'color', port: field<I2cPort>(b, 'PORT') } },
    b: { k: 'str', v: str(b, 'COLOR') },
  }),
  w_distance: (b) => ({ k: 'sensor', read: { type: 'distance', port: field<I2cPort>(b, 'PORT') } }),
  w_tilt: (b) => ({ k: 'sensor', read: { type: 'tilt', axis: field<TiltAxis>(b, 'AXIS') } }),
  w_button: (b) => ({ k: 'sensor', read: { type: 'button', button: button(b) } }),
  w_motor_angle: (b) => ({ k: 'sensor', read: { type: 'motorAngle', port: field<MotorPort>(b, 'PORT') } }),
};

export class CompileError extends Error {
  constructor(
    message: string,
    readonly blockId: string,
  ) {
    super(message);
  }
}

class Compiler {
  constructor(
    readonly ctx: Ctx,
    readonly sensors: SensorConfig,
  ) {}

  /** Compile the expression plugged into `input`; empty inputs default to 0 / false. */
  expr(b: SBlock, input: string, numeric = true): Expr {
    const target = child(b, input);
    if (!target) return numeric ? num(0) : { k: 'bool', v: false };
    const compile = EXPRESSIONS[target.type];
    if (!compile) throw new CompileError(`Unknown expression block: ${target.type}`, target.id);
    return compile(target, this);
  }

  amount(b: SBlock): Amount {
    return { amount: this.expr(b, 'AMOUNT'), unit: field<AmountUnit>(b, 'UNIT') || 'sec' };
  }

  stack(b: SBlock, input: string): Stmt[] {
    return this.chain(child(b, input) ?? null);
  }

  chain(first: SBlock | null): Stmt[] {
    const out: Stmt[] = [];
    for (let b: SBlock | undefined | null = first; b; b = b.next?.block) {
      if (b.enabled === false) continue;
      const compile = STATEMENTS[b.type];
      if (!compile) throw new CompileError(`Unknown statement block: ${b.type}`, b.id);
      out.push({ ...compile(b, this), id: b.id } as Stmt);
    }
    return out;
  }
}

export function compile(ws: SWorkspace, sensors: SensorConfig = DEFAULT_SENSORS): Program {
  const ctx = new Ctx(ws);
  const c = new Compiler(ctx, sensors);
  const threads: Thread[] = [];
  for (const top of ws.blocks?.blocks ?? []) {
    const trigger = TRIGGERS[top.type];
    // Stacks without a hat block never run.
    if (!trigger || top.enabled === false) continue;
    threads.push({ id: top.id, trigger: trigger(top), body: c.chain(top.next?.block ?? null) });
  }
  return { threads, variables: ctx.variables };
}

export const STATEMENT_TYPES = Object.keys(STATEMENTS);
export const EXPRESSION_TYPES = Object.keys(EXPRESSIONS);
export const TRIGGER_TYPES = Object.keys(TRIGGERS);
