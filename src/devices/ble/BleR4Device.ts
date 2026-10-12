/**
 * A real MATRIX Mini R4 driven over BLE (tethered mode).
 *
 * Commands go out as protocol frames; the board streams telemetry that is
 * cached here so sensor reads never wait on the radio. Movements measured in
 * degrees/rotations run on the board and finish with a DONE frame; timed
 * movements are timed here.
 *
 * D ports read as digital inputs until a program asks one for an ultrasonic
 * distance; from then on the board measures with an ultrasonic sensor there.
 */
import type { BoardSnapshot, ObservableDevice } from '../Device';
import { ANALOG_PORTS, DIGITAL_PORTS, MOTOR_PORTS, SERVO_PORTS, I2C_PORTS } from '../../ir/types';
import type {
  AmountUnit,
  AnalogPort,
  ButtonId,
  DigitalPort,
  I2cPort,
  LedColor,
  LedTarget,
  MotorPort,
  ServoPort,
  StopMode,
  TiltAxis,
} from '../../ir/types';
import { sleep, Stopped } from '../../runtime/sleep';
import { decode, encode, midiToHz, PROTOCOL_VERSION, type BoardMessage, type PortReading } from './protocol';

/** A connection that carries protocol frames (Web Bluetooth, or a fake in tests). */
export interface BoardLink {
  readonly name: string;
  send(frame: Uint8Array): Promise<void>;
  onMessage(cb: (data: DataView) => void): void;
  onDisconnect(cb: () => void): void;
  disconnect(): void;
}

export const HEARTBEAT_MS = 300;
const HELLO_TIMEOUT_MS = 3000;
/** Ignore stale encoder telemetry this long after resetting a motor. */
const RESET_SETTLE_MS = 200;
/** Distance reported when no distance sensor is plugged in (never "near"). */
export const NO_DISTANCE_CM = 999;
/** Battery reported before the board's first IMU telemetry. */
const UNKNOWN_BATTERY = 100;

export class FirmwareMismatch extends Error {
  constructor(readonly firmware: string, readonly protocol: number) {
    super(`firmware ${firmware} speaks protocol ${protocol}, expected ${PROTOCOL_VERSION}`);
  }
}

export class BleR4Device implements ObservableDevice {
  firmware = '';
  private seq = 0;
  private done = new Map<number, () => void>();
  private infoWaiter: ((m: Extract<BoardMessage, { type: 'info' }>) => void) | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private lastSentAt = 0;
  private listeners = new Set<() => void>();
  private buttonListeners = new Set<(b: ButtonId) => void>();
  private disconnectListeners = new Set<() => void>();
  private resetAt: Partial<Record<MotorPort, number>> = {};
  private ultrasonicPorts: DigitalPort[] = [];
  private state: BoardSnapshot = {
    motors: Object.fromEntries(MOTOR_PORTS.map((p) => [p, { speed: 0, angle: 0 }])) as BoardSnapshot['motors'],
    servos: Object.fromEntries(SERVO_PORTS.map((p) => [p, 90])) as BoardSnapshot['servos'],
    leds: ['off', 'off'],
    note: null,
    sensors: {
      color: 'none',
      distance: NO_DISTANCE_CM,
      gesture: 'none',
      ultrasonic: NO_DISTANCE_CM,
      digital: false,
      analog: 0,
      tilt: { pitch: 0, roll: 0, yaw: 0 },
      buttons: { up: false, down: false },
    },
    ports: I2C_PORTS.map(() => ({ kind: 'none' as const })),
    io: {
      digital: DIGITAL_PORTS.map(() => false),
      ultrasonic: DIGITAL_PORTS.map(() => null),
      analog: ANALOG_PORTS.map(() => 0),
    },
    battery: undefined,
  };

  constructor(private readonly link: BoardLink) {
    link.onMessage((data) => this.receive(decode(data)));
    link.onDisconnect(() => {
      this.stopHeartbeat();
      for (const resolve of this.done.values()) resolve();
      this.done.clear();
      for (const cb of this.disconnectListeners) cb();
    });
  }

  get name() {
    return this.link.name;
  }

  /** Say hello, check the protocol version and start the heartbeat. */
  async handshake(): Promise<void> {
    const info = await new Promise<Extract<BoardMessage, { type: 'info' }>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no answer from board')), HELLO_TIMEOUT_MS);
      this.infoWaiter = (m) => {
        clearTimeout(timer);
        resolve(m);
      };
      void this.send(encode.hello(this.nextSeq()));
    });
    this.firmware = info.firmware;
    if (info.protocol !== PROTOCOL_VERSION) throw new FirmwareMismatch(info.firmware, info.protocol);
    // Chrome throttles timers in background or occluded tabs (down to ~1/s),
    // which would trip the board's watchdog, so telemetry arrivals also
    // trigger heartbeats (Bluetooth events are not throttled).
    this.heartbeat = setInterval(() => this.keepAlive(), HEARTBEAT_MS);
  }

  onDisconnect(cb: () => void) {
    this.disconnectListeners.add(cb);
    return () => this.disconnectListeners.delete(cb);
  }

  disconnect() {
    this.stopHeartbeat();
    this.link.disconnect();
  }

  // ---- observation ----

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  snapshot(): BoardSnapshot {
    return structuredClone(this.state);
  }

  private changed() {
    for (const cb of this.listeners) cb();
  }

  // ---- Device ----

  motorRun(port: MotorPort, speed: number) {
    this.state.motors[port].speed = speed;
    void this.send(encode.motorRun(this.nextSeq(), port, speed));
    this.changed();
  }

  async motorRunFor(port: MotorPort, speed: number, amount: number, unit: AmountUnit, signal: AbortSignal) {
    await this.motorsRunFor({ [port]: speed }, amount, unit, signal);
  }

  async motorsRunFor(speeds: Partial<Record<MotorPort, number>>, amount: number, unit: AmountUnit, signal: AbortSignal) {
    const entries = Object.entries(speeds) as [MotorPort, number][];
    if (unit === 'sec') {
      for (const [p, s] of entries) this.motorRun(p, s);
      try {
        await sleep(amount * 1000, signal);
      } finally {
        for (const [p] of entries) this.motorStop(p, 'brake');
      }
      return;
    }
    const degrees = unit === 'rot' ? amount * 360 : amount;
    const sign = degrees < 0 ? -1 : 1;
    const fastest = Math.max(0, ...entries.map(([, s]) => Math.abs(s)));
    if (fastest === 0 || degrees === 0) return;
    // Share the distance out by speed so every motor finishes together.
    const waits = entries.map(([p, s]) => {
      const share = (Math.abs(degrees) * Math.abs(s)) / fastest;
      this.state.motors[p].speed = s * sign;
      return this.request(encode.motorRunDeg(this.nextSeq(), p, s * sign, share));
    });
    this.changed();
    try {
      await abortable(Promise.all(waits), signal);
    } catch (e) {
      for (const [p] of entries) this.motorStop(p, 'brake');
      throw e;
    }
    for (const [p] of entries) this.state.motors[p].speed = 0;
    this.changed();
  }

  motorStop(port: MotorPort, mode: StopMode) {
    this.state.motors[port].speed = 0;
    void this.send(encode.motorStop(this.nextSeq(), port, mode));
    this.changed();
  }

  motorAngle(port: MotorPort) {
    return this.state.motors[port].angle;
  }

  motorResetAngle(port: MotorPort) {
    this.state.motors[port].angle = 0;
    this.resetAt[port] = Date.now();
    void this.send(encode.motorReset(this.nextSeq(), port));
    this.changed();
  }

  servoSet(port: ServoPort, angle: number) {
    this.state.servos[port] = Math.max(0, Math.min(180, angle));
    void this.send(encode.servo(this.nextSeq(), port, angle));
    this.changed();
  }

  ledSet(target: LedTarget, color: LedColor) {
    if (target !== '2') this.state.leds[0] = color;
    if (target !== '1') this.state.leds[1] = color;
    void this.send(encode.led(this.nextSeq(), target, color));
    this.changed();
  }

  async beep(note: number, secs: number, signal: AbortSignal) {
    this.state.note = note;
    this.changed();
    void this.send(encode.tone(this.nextSeq(), midiToHz(note), secs * 1000));
    try {
      await sleep(secs * 1000, signal);
    } catch (e) {
      void this.send(encode.noTone(this.nextSeq()));
      throw e;
    } finally {
      this.state.note = null;
      this.changed();
    }
  }

  readColor(port: I2cPort) {
    const r = this.port(port);
    return r.kind === 'color' ? (r.color ?? 'none') : 'none';
  }

  readDistance(port: I2cPort) {
    const r = this.port(port);
    return r.kind === 'distance' ? (r.cm ?? NO_DISTANCE_CM) : NO_DISTANCE_CM;
  }

  readGesture(port: I2cPort) {
    const r = this.port(port);
    return r.kind === 'gesture' ? (r.gesture ?? 'none') : 'none';
  }

  readUltrasonic(port: DigitalPort) {
    this.useUltrasonic(port, true);
    return this.state.io!.ultrasonic[DIGITAL_PORTS.indexOf(port)] ?? NO_DISTANCE_CM;
  }

  readDigital(port: DigitalPort) {
    this.useUltrasonic(port, false);
    return this.state.io!.digital[DIGITAL_PORTS.indexOf(port)];
  }

  readAnalog(port: AnalogPort) {
    return this.state.io!.analog[ANALOG_PORTS.indexOf(port)];
  }

  readBattery() {
    return this.state.battery ?? UNKNOWN_BATTERY;
  }

  readTilt(axis: TiltAxis) {
    return this.state.sensors.tilt[axis];
  }

  readButton(button: ButtonId) {
    return this.state.sensors.buttons[button];
  }

  onButtonPress(cb: (button: ButtonId) => void) {
    this.buttonListeners.add(cb);
    return () => this.buttonListeners.delete(cb);
  }

  halt() {
    for (const p of MOTOR_PORTS) this.state.motors[p].speed = 0;
    this.state.note = null;
    for (const resolve of this.done.values()) resolve();
    this.done.clear();
    void this.send(encode.halt(this.nextSeq()));
    this.changed();
  }

  // ---- link ----

  private port(port: I2cPort): PortReading {
    return (this.state.ports?.[I2C_PORTS.indexOf(port)] ?? { kind: 'none' }) as PortReading;
  }

  /** Switch a D port between ultrasonic and digital input; the last read decides. */
  private useUltrasonic(port: DigitalPort, on: boolean) {
    if (this.ultrasonicPorts.includes(port) === on) return;
    this.ultrasonicPorts = on ? [...this.ultrasonicPorts, port] : this.ultrasonicPorts.filter((p) => p !== port);
    void this.send(encode.ioMode(this.nextSeq(), this.ultrasonicPorts));
  }

  private nextSeq() {
    this.seq = (this.seq % 255) + 1; // 1..255; 0 is for frames nobody answers
    return this.seq;
  }

  private keepAlive() {
    if (this.heartbeat && Date.now() - this.lastSentAt >= HEARTBEAT_MS) void this.send(encode.heartbeat(0));
  }

  private send(frame: Uint8Array) {
    this.lastSentAt = Date.now();
    return this.link.send(frame).catch(() => {
      /* a lost frame surfaces as a disconnect */
    });
  }

  /** Send a frame that the board acknowledges with DONE. */
  private request(frame: Uint8Array): Promise<void> {
    const seq = frame[1];
    return new Promise((resolve) => {
      this.done.set(seq, resolve);
      void this.send(frame);
    });
  }

  private receive(m: BoardMessage) {
    this.keepAlive();
    switch (m.type) {
      case 'motors': {
        const now = Date.now();
        MOTOR_PORTS.forEach((p, i) => {
          if (now - (this.resetAt[p] ?? 0) > RESET_SETTLE_MS) this.state.motors[p].angle = m.angles[i];
        });
        const before = this.state.sensors.buttons;
        this.state.sensors.buttons = m.buttons;
        for (const b of ['up', 'down'] as const) {
          if (!before[b] && m.buttons[b]) for (const cb of this.buttonListeners) cb(b);
        }
        break;
      }
      case 'imu':
        this.state.sensors.tilt = { pitch: m.pitch, roll: m.roll, yaw: m.yaw };
        this.state.battery = m.battery;
        break;
      case 'ports': {
        this.state.ports = m.ports;
        const color = m.ports.find((r) => r.kind === 'color');
        const distance = m.ports.find((r) => r.kind === 'distance');
        const gesture = m.ports.find((r) => r.kind === 'gesture');
        this.state.sensors.color = color?.color ?? 'none';
        this.state.sensors.distance = distance?.cm ?? NO_DISTANCE_CM;
        this.state.sensors.gesture = gesture?.gesture ?? 'none';
        break;
      }
      case 'io': {
        const { digital, analog } = m;
        // null = this port is not measuring; no echo while measuring reads as far away.
        const ultrasonic = DIGITAL_PORTS.map((p, i) =>
          this.ultrasonicPorts.includes(p) ? (m.ultrasonic[i] ?? NO_DISTANCE_CM) : null,
        );
        this.state.io = { digital, ultrasonic, analog };
        this.state.sensors.digital = digital[0];
        this.state.sensors.analog = analog[0];
        this.state.sensors.ultrasonic = ultrasonic.find((cm) => cm !== null) ?? NO_DISTANCE_CM;
        break;
      }
      case 'done':
        this.done.get(m.seq)?.();
        this.done.delete(m.seq);
        return;
      case 'info':
        this.infoWaiter?.(m);
        this.infoWaiter = null;
        return;
      case 'unknown':
        return;
    }
    this.changed();
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }
}

function abortable<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Stopped());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new Stopped());
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}
