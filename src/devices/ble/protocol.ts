/**
 * Web ↔ MATRIX Mini R4 BLE protocol (see docs/adr/0003-ble-protocol.md).
 * One frame per BLE write / notification, at most 20 bytes:
 * `[type:u8][seq:u8][payload…]`, little-endian.
 */
import type { ButtonId, LedColor, LedTarget, MotorPort, SensorColor, ServoPort, StopMode } from '../../ir/types';

export const PROTOCOL_VERSION = 1;
export const MAX_FRAME = 20;

export const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // web → board
export const NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // board → web
export const NAME_PREFIX = 'MXR4-';

export const CMD = {
  HELLO: 0x01,
  HEARTBEAT: 0x02,
  MOTOR_RUN: 0x10,
  MOTOR_RUN_DEG: 0x11,
  MOTOR_STOP: 0x13,
  MOTOR_RESET: 0x14,
  SERVO: 0x20,
  LED: 0x21,
  TONE: 0x22,
  NO_TONE: 0x23,
  HALT: 0x2f,
} as const;

export const MSG = {
  T_MOTORS: 0x80,
  T_IMU: 0x81,
  T_PORTS: 0x82,
  DONE: 0x90,
  INFO: 0x91,
} as const;

/** Sensor colour codes on the wire, in IR `SENSOR_COLORS` order. */
export const COLOR_CODES: SensorColor[] = ['none', 'black', 'white', 'red', 'yellow', 'green', 'blue'];

/** What the board found on an I2C port. */
export type PortKind = 'none' | 'color' | 'distance';
const PORT_KINDS: PortKind[] = ['none', 'color', 'distance'];

/** Pure RGB for the on-board LEDs (the swatch colours are tuned for screens). */
export const LED_RGB: Record<LedColor, [number, number, number]> = {
  off: [0, 0, 0],
  red: [255, 0, 0],
  orange: [255, 80, 0],
  yellow: [255, 180, 0],
  green: [0, 255, 0],
  cyan: [0, 200, 255],
  blue: [0, 0, 255],
  purple: [160, 0, 255],
  white: [255, 255, 255],
};

const portNum = (port: MotorPort | ServoPort) => Number(port.replace(/\D/g, ''));
const clampI8 = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));

function frame(type: number, seq: number, ...payload: number[]): Uint8Array {
  return Uint8Array.from([type, seq & 0xff, ...payload]);
}

function u16(v: number): number[] {
  const n = Math.max(0, Math.min(0xffff, Math.round(v)));
  return [n & 0xff, n >> 8];
}

function u32(v: number): number[] {
  const n = Math.max(0, Math.min(0xffffffff, Math.round(v)));
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

const i8 = (v: number) => clampI8(v) & 0xff;

export const encode = {
  hello: (seq: number) => frame(CMD.HELLO, seq),
  heartbeat: (seq: number) => frame(CMD.HEARTBEAT, seq),
  motorRun: (seq: number, port: MotorPort, speed: number) => frame(CMD.MOTOR_RUN, seq, portNum(port), i8(speed)),
  motorRunDeg: (seq: number, port: MotorPort, speed: number, degrees: number) =>
    frame(CMD.MOTOR_RUN_DEG, seq, portNum(port), i8(speed), ...u32(degrees)),
  motorStop: (seq: number, port: MotorPort, mode: StopMode) =>
    frame(CMD.MOTOR_STOP, seq, portNum(port), mode === 'coast' ? 1 : 0),
  motorReset: (seq: number, port: MotorPort) => frame(CMD.MOTOR_RESET, seq, portNum(port)),
  servo: (seq: number, port: ServoPort, angle: number) =>
    frame(CMD.SERVO, seq, portNum(port), Math.max(0, Math.min(180, Math.round(angle)))),
  led: (seq: number, target: LedTarget, color: LedColor) =>
    frame(CMD.LED, seq, target === 'both' ? 3 : Number(target), ...LED_RGB[color]),
  tone: (seq: number, freq: number, ms: number) => frame(CMD.TONE, seq, ...u16(freq), ...u16(ms)),
  noTone: (seq: number) => frame(CMD.NO_TONE, seq),
  halt: (seq: number) => frame(CMD.HALT, seq),
};

export interface PortReading {
  kind: PortKind;
  /** Colour sensor: the colour seen; distance sensor: centimetres. */
  color?: SensorColor;
  cm?: number;
}

export type BoardMessage =
  | { type: 'motors'; angles: [number, number, number, number]; busy: number; buttons: Record<ButtonId, boolean> }
  | { type: 'imu'; pitch: number; roll: number; yaw: number; battery: number }
  | { type: 'ports'; ports: [PortReading, PortReading, PortReading, PortReading] }
  | { type: 'done'; seq: number }
  | { type: 'info'; protocol: number; firmware: string }
  | { type: 'unknown'; code: number };

export function decode(data: DataView): BoardMessage {
  const type = data.getUint8(0);
  switch (type) {
    case MSG.T_MOTORS: {
      const angles = [0, 1, 2, 3].map((i) => data.getInt32(2 + i * 4, true)) as [number, number, number, number];
      const buttons = data.getUint8(19);
      return {
        type: 'motors',
        angles,
        busy: data.getUint8(18),
        buttons: { up: (buttons & 1) !== 0, down: (buttons & 2) !== 0 },
      };
    }
    case MSG.T_IMU:
      return {
        type: 'imu',
        pitch: data.getInt16(2, true) / 100,
        roll: data.getInt16(4, true) / 100,
        yaw: data.getInt16(6, true) / 100,
        battery: data.getUint8(8),
      };
    case MSG.T_PORTS: {
      const ports = [0, 1, 2, 3].map((i): PortReading => {
        const kind = PORT_KINDS[data.getUint8(2 + i * 3)] ?? 'none';
        const value = data.getUint16(3 + i * 3, true);
        if (kind === 'color') return { kind, color: COLOR_CODES[value] ?? 'none' };
        if (kind === 'distance') return { kind, cm: value / 10 };
        return { kind };
      }) as [PortReading, PortReading, PortReading, PortReading];
      return { type: 'ports', ports };
    }
    case MSG.DONE:
      return { type: 'done', seq: data.getUint8(2) };
    case MSG.INFO:
      return {
        type: 'info',
        protocol: data.getUint8(2),
        firmware: `${data.getUint8(3)}.${data.getUint8(4)}.${data.getUint8(5)}`,
      };
    default:
      return { type: 'unknown', code: type };
  }
}

/** MIDI note number → buzzer frequency in Hz. */
export const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);
