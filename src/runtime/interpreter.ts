import type { Device } from '../devices/Device';
import type { Amount, DriveConfig, Expr, Program, SensorRead, Stmt, Thread } from '../ir/types';
import { sleep, Stopped } from './sleep';

export type Value = number | string | boolean;

export interface RuntimeOptions {
  drive: DriveConfig;
  /** Called when a block starts (`on`) and finishes (`!on`) executing. */
  onHighlight?: (blockId: string, on: boolean) => void;
  /** Called whenever `running` changes. */
  onRunningChange?: (running: boolean) => void;
}

/** How often conditions are re-checked while waiting. */
const POLL_MS = 20;

/**
 * Executes a Program against a Device.
 *
 * Each thread is an async function. Starting the program launches every
 * `start` thread; button presses and broadcasts launch their threads
 * (restarting one that is already running, like Scratch). The program ends
 * when no thread is running and nothing can start a new one, or on stop().
 */
export class Runtime {
  readonly variables = new Map<string, Value>();
  private abort = new AbortController();
  private active = new Map<string, AbortController>();
  private program: Program | null = null;
  private unsubscribeButton: (() => void) | null = null;
  private finish: (() => void) | null = null;
  private _running = false;
  /** When the timer block last read 0 (program start or reset). */
  private timerStart = 0;

  constructor(
    private readonly device: Device,
    private readonly opts: RuntimeOptions,
  ) {}

  get running() {
    return this._running;
  }

  run(program: Program): Promise<void> {
    this.stop();
    this.program = program;
    this.abort = new AbortController();
    this.variables.clear();
    for (const name of program.variables) this.variables.set(name, 0);
    this.timerStart = Date.now();
    this.setRunning(true);

    const done = new Promise<void>((resolve) => (this.finish = resolve));

    if (program.threads.some((t) => t.trigger.k === 'button')) {
      this.unsubscribeButton = this.device.onButtonPress((b) =>
        this.trigger((t) => t.k === 'button' && t.button === b),
      );
    }
    this.trigger((t) => t.k === 'start');
    this.checkFinished();
    return done;
  }

  stop() {
    if (!this._running) return;
    this.abort.abort();
    for (const c of this.active.values()) c.abort();
    this.active.clear();
    this.unsubscribeButton?.();
    this.unsubscribeButton = null;
    this.device.halt();
    this.setRunning(false);
    this.finish?.();
    this.finish = null;
  }

  private setRunning(running: boolean) {
    if (this._running === running) return;
    this._running = running;
    this.opts.onRunningChange?.(running);
  }

  private trigger(match: (t: Thread['trigger']) => boolean) {
    for (const t of this.program?.threads ?? []) {
      if (match(t.trigger)) this.startThread(t);
    }
  }

  private startThread(thread: Thread) {
    this.active.get(thread.id)?.abort();
    const ctrl = new AbortController();
    const onProgramAbort = () => ctrl.abort();
    this.abort.signal.addEventListener('abort', onProgramAbort, { once: true });
    this.active.set(thread.id, ctrl);

    void this.execBlock(thread.body, ctrl.signal)
      .catch((e) => {
        if (!(e instanceof Stopped)) console.error('[MATRIXblock runtime]', e);
      })
      .finally(() => {
        this.abort.signal.removeEventListener('abort', onProgramAbort);
        if (this.active.get(thread.id) === ctrl) this.active.delete(thread.id);
        this.checkFinished();
      });
  }

  private checkFinished() {
    if (!this._running || this.active.size > 0) return;
    // A program with button hats keeps waiting for presses until stopped.
    if (this.unsubscribeButton) return;
    this.stop();
  }

  // ---- statements ----

  private async execBlock(stmts: Stmt[], signal: AbortSignal) {
    for (const s of stmts) {
      if (signal.aborted) throw new Stopped();
      this.opts.onHighlight?.(s.id, true);
      try {
        await this.exec(s, signal);
      } finally {
        this.opts.onHighlight?.(s.id, false);
      }
    }
  }

  private async exec(s: Stmt, signal: AbortSignal): Promise<void> {
    const d = this.device;
    const n = (e: Expr) => toNumber(this.eval(e));
    switch (s.op) {
      case 'motorRun':
        if (s.limit) {
          const { amount, unit } = this.limit(s.limit);
          await d.motorRunFor(s.port, n(s.speed), amount, unit, signal);
        } else {
          d.motorRun(s.port, n(s.speed));
        }
        return;
      case 'motorStop':
        return d.motorStop(s.port, s.mode);
      case 'motorResetAngle':
        return d.motorResetAngle(s.port);
      case 'moveSteer': {
        const [l, r] = steering(n(s.steer), n(s.speed));
        return this.drive(l, r, s.limit, signal);
      }
      case 'moveTank':
        return this.drive(n(s.left), n(s.right), s.limit, signal);
      case 'moveStop':
        d.motorStop(this.opts.drive.left, s.mode);
        d.motorStop(this.opts.drive.right, s.mode);
        return;
      case 'servo':
        return d.servoSet(s.port, n(s.angle));
      case 'led':
        return d.ledSet(s.target, s.color);
      case 'beep':
        return d.beep(n(s.note), n(s.secs), signal);
      case 'wait':
        return sleep(n(s.secs) * 1000, signal);
      case 'waitUntil':
        while (!toBool(this.eval(s.cond))) await sleep(POLL_MS, signal);
        return;
      case 'repeat': {
        const times = Math.floor(n(s.times));
        for (let i = 0; i < times; i++) await this.loopBody(s.body, signal);
        return;
      }
      case 'forever':
        for (;;) await this.loopBody(s.body, signal);
      case 'repeatUntil':
        while (!toBool(this.eval(s.cond))) await this.loopBody(s.body, signal);
        return;
      case 'if':
        if (toBool(this.eval(s.cond))) await this.execBlock(s.then, signal);
        else if (s.else) await this.execBlock(s.else, signal);
        return;
      case 'setVar':
        this.variables.set(s.name, this.eval(s.value));
        return;
      case 'changeVar':
        this.variables.set(s.name, toNumber(this.variables.get(s.name) ?? 0) + n(s.by));
        return;
      case 'broadcast':
        this.trigger((t) => t.k === 'message' && t.msg === s.msg);
        return;
      case 'resetTimer':
        this.timerStart = Date.now();
        return;
      case 'stopAll':
        this.stop();
        throw new Stopped();
    }
  }

  /** Run a loop body, yielding so an empty or instant loop can't freeze the page. */
  private async loopBody(body: Stmt[], signal: AbortSignal) {
    await this.execBlock(body, signal);
    await sleep(0, signal);
  }

  private limit(l: Amount) {
    return { amount: toNumber(this.eval(l.amount)), unit: l.unit };
  }

  private async drive(left: number, right: number, limit: Amount | undefined, signal: AbortSignal) {
    const { left: lp, right: rp } = this.opts.drive;
    if (limit) {
      const { amount, unit } = this.limit(limit);
      await this.device.motorsRunFor({ [lp]: left, [rp]: right }, amount, unit, signal);
    } else {
      this.device.motorRun(lp, left);
      this.device.motorRun(rp, right);
    }
  }

  // ---- expressions ----

  eval(e: Expr): Value {
    switch (e.k) {
      case 'num':
      case 'str':
      case 'bool':
        return e.v;
      case 'var':
        return this.variables.get(e.name) ?? 0;
      case 'not':
        return !toBool(this.eval(e.a));
      case 'random': {
        const lo = Math.ceil(toNumber(this.eval(e.min)));
        const hi = Math.floor(toNumber(this.eval(e.max)));
        const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
        return a + Math.floor(Math.random() * (b - a + 1));
      }
      case 'sensor':
        return this.read(e.read);
      case 'bin':
        return binary(e.op, this.eval(e.a), this.eval(e.b));
    }
  }

  private read(r: SensorRead): Value {
    const d = this.device;
    switch (r.type) {
      case 'color':
        return d.readColor(r.port);
      case 'distance':
        return d.readDistance(r.port);
      case 'gesture':
        return d.readGesture(r.port);
      case 'ultrasonic':
        return d.readUltrasonic(r.port);
      case 'digital':
        return d.readDigital(r.port);
      case 'analog':
        return d.readAnalog(r.port);
      case 'battery':
        return d.readBattery();
      case 'timer':
        return Math.round((Date.now() - this.timerStart) / 10) / 100;
      case 'tilt':
        return d.readTilt(r.axis);
      case 'button':
        return d.readButton(r.button);
      case 'motorAngle':
        return Math.round(d.motorAngle(r.port));
    }
  }
}

/** EV3-style steering: 0 = straight, ±50 = pivot on one wheel, ±100 = spin. */
export function steering(steer: number, speed: number): [number, number] {
  const st = Math.max(-100, Math.min(100, steer));
  const inner = speed * (1 - Math.abs(st) / 50);
  return st >= 0 ? [speed, inner] : [inner, speed];
}

function toNumber(v: Value): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toBool(v: Value): boolean {
  if (typeof v === 'string') return v !== '' && v !== 'false' && v !== '0';
  return Boolean(v);
}

function binary(op: Extract<Expr, { k: 'bin' }>['op'], a: Value, b: Value): Value {
  switch (op) {
    case '+': return toNumber(a) + toNumber(b);
    case '-': return toNumber(a) - toNumber(b);
    case '*': return toNumber(a) * toNumber(b);
    case '/': return toNumber(b) === 0 ? 0 : toNumber(a) / toNumber(b);
    case '<': return toNumber(a) < toNumber(b);
    case '<=': return toNumber(a) <= toNumber(b);
    case '>': return toNumber(a) > toNumber(b);
    case '>=': return toNumber(a) >= toNumber(b);
    case '=': return equals(a, b);
    case '!=': return !equals(a, b);
    case 'and': return toBool(a) && toBool(b);
    case 'or': return toBool(a) || toBool(b);
  }
}

function equals(a: Value, b: Value): boolean {
  if (typeof a === 'string' || typeof b === 'string') {
    const na = Number(a);
    const nb = Number(b);
    if (a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  return toNumber(a) === toNumber(b);
}
