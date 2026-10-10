import type { BoardSnapshot, ObservableDevice } from '../Device';
import { MAX_DEG_PER_SEC } from '../Device';
import { sleep } from '../../runtime/sleep';
import {
  MOTOR_PORTS,
  SERVO_PORTS,
  type AmountUnit,
  type ButtonId,
  type LedColor,
  type LedTarget,
  type MotorPort,
  type SensorColor,
  type ServoPort,
  type StopMode,
  type TiltAxis,
} from '../../ir/types';

/**
 * Simulated sensor values. The simulator has one colour and one distance
 * sensor that answer on every I2C port.
 */
export interface SimSensors {
  color: SensorColor;
  distance: number;
  tilt: Record<TiltAxis, number>;
  buttons: Record<ButtonId, boolean>;
}

export type SensorPatch = Partial<Pick<SimSensors, 'color' | 'distance'>> & {
  tilt?: Partial<SimSensors['tilt']>;
  buttons?: Partial<SimSensors['buttons']>;
};

export type SimSnapshot = BoardSnapshot;

interface Motor {
  speed: number;
  /** Angle at time `since`. */
  angle: number;
  since: number;
}

const record = <K extends string, V>(keys: readonly K[], make: () => V) =>
  Object.fromEntries(keys.map((k) => [k, make()])) as Record<K, V>;

/**
 * A virtual MATRIX Mini R4. Motor angles integrate speed over wall-clock time;
 * sensors are whatever the simulator panel sets them to.
 */
export class SimDevice implements ObservableDevice {
  private motors = record(MOTOR_PORTS, (): Motor => ({ speed: 0, angle: 0, since: Date.now() }));
  private servos = record(SERVO_PORTS, () => 90);
  private leds: [LedColor, LedColor] = ['off', 'off'];
  private note: number | null = null;
  private sensors: SimSensors = {
    color: 'none',
    distance: 100,
    tilt: { pitch: 0, roll: 0, yaw: 0 },
    buttons: { up: false, down: false },
  };
  private listeners = new Set<() => void>();
  private buttonListeners = new Set<(b: ButtonId) => void>();

  // ---- observation (simulator panel) ----

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private changed() {
    for (const cb of this.listeners) cb();
  }

  snapshot(): SimSnapshot {
    return {
      motors: Object.fromEntries(
        MOTOR_PORTS.map((p) => [p, { speed: this.motors[p].speed, angle: this.motorAngle(p) }]),
      ) as SimSnapshot['motors'],
      servos: { ...this.servos },
      leds: [...this.leds],
      note: this.note,
      sensors: { ...this.sensors, tilt: { ...this.sensors.tilt }, buttons: { ...this.sensors.buttons } },
    };
  }

  setSensors(patch: SensorPatch) {
    const before = this.sensors.buttons;
    this.sensors = {
      ...this.sensors,
      ...patch,
      tilt: { ...this.sensors.tilt, ...patch.tilt },
      buttons: { ...this.sensors.buttons, ...patch.buttons },
    };
    for (const b of ['up', 'down'] as const) {
      if (!before[b] && this.sensors.buttons[b]) for (const cb of this.buttonListeners) cb(b);
    }
    this.changed();
  }

  /** Put the board back to its power-on state (sensors are kept). */
  reset() {
    const now = Date.now();
    for (const p of MOTOR_PORTS) this.motors[p] = { speed: 0, angle: 0, since: now };
    for (const p of SERVO_PORTS) this.servos[p] = 90;
    this.leds = ['off', 'off'];
    this.note = null;
    this.changed();
  }

  // ---- Device ----

  motorRun(port: MotorPort, speed: number) {
    const m = this.motors[port];
    m.angle = this.motorAngle(port);
    m.since = Date.now();
    m.speed = clamp(speed, -100, 100);
    this.changed();
  }

  async motorRunFor(port: MotorPort, speed: number, amount: number, unit: AmountUnit, signal: AbortSignal) {
    await this.motorsRunFor({ [port]: speed }, amount, unit, signal);
  }

  async motorsRunFor(speeds: Partial<Record<MotorPort, number>>, amount: number, unit: AmountUnit, signal: AbortSignal) {
    // A negative distance means "the other way".
    const sign = unit !== 'sec' && amount < 0 ? -1 : 1;
    const entries = (Object.entries(speeds) as [MotorPort, number][]).map(
      ([p, s]) => [p, s * sign] as [MotorPort, number],
    );
    const fastest = Math.max(0, ...entries.map(([, s]) => Math.abs(clamp(s, -100, 100))));
    const ms = durationMs(fastest, amount, unit);
    for (const [p, s] of entries) this.motorRun(p, s);
    try {
      await sleep(ms, signal);
    } finally {
      for (const [p] of entries) this.motorStop(p, 'brake');
    }
  }

  motorStop(port: MotorPort, _mode: StopMode) {
    this.motorRun(port, 0);
  }

  motorAngle(port: MotorPort): number {
    const m = this.motors[port];
    return m.angle + (m.speed / 100) * MAX_DEG_PER_SEC * ((Date.now() - m.since) / 1000);
  }

  motorResetAngle(port: MotorPort) {
    this.motors[port] = { ...this.motors[port], angle: 0, since: Date.now() };
    this.changed();
  }

  servoSet(port: ServoPort, angle: number) {
    this.servos[port] = clamp(angle, 0, 180);
    this.changed();
  }

  ledSet(target: LedTarget, color: LedColor) {
    if (target !== '2') this.leds[0] = color;
    if (target !== '1') this.leds[1] = color;
    this.changed();
  }

  async beep(note: number, secs: number, signal: AbortSignal) {
    this.note = note;
    this.changed();
    try {
      await sleep(secs * 1000, signal);
    } finally {
      this.note = null;
      this.changed();
    }
  }

  readColor() {
    return this.sensors.color;
  }

  readDistance() {
    return this.sensors.distance;
  }

  readTilt(axis: TiltAxis) {
    return this.sensors.tilt[axis];
  }

  readButton(button: ButtonId) {
    return this.sensors.buttons[button];
  }

  onButtonPress(cb: (button: ButtonId) => void) {
    this.buttonListeners.add(cb);
    return () => this.buttonListeners.delete(cb);
  }

  halt() {
    for (const p of MOTOR_PORTS) this.motorRun(p, 0);
    this.note = null;
    this.changed();
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
}

/** How long a motor at `speed`% takes to cover `amount` of `unit`. */
export function durationMs(speed: number, amount: number, unit: AmountUnit): number {
  if (unit === 'sec') return Math.max(0, amount) * 1000;
  if (speed === 0) return 0;
  const degrees = unit === 'rot' ? amount * 360 : amount;
  return (Math.abs(degrees) / ((speed / 100) * MAX_DEG_PER_SEC)) * 1000;
}
