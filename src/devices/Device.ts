import type {
  AmountUnit,
  LedColor,
  MotorPort,
  SensorColor,
  ServoPort,
  StopMode,
  TiltAxis,
} from '../ir/types';

/**
 * Everything the interpreter can ask of a robot.
 *
 * Sensor reads are synchronous: a tethered device streams telemetry and keeps
 * the latest values cached, so reading never waits on the link. Timed actions
 * return promises and must settle early when `signal` aborts.
 */
export interface Device {
  /** Start a motor; speed is -100..100 percent. */
  motorRun(port: MotorPort, speed: number): void;
  /** Run a motor until a limit is reached, then brake. */
  motorRunFor(port: MotorPort, speed: number, amount: number, unit: AmountUnit, signal: AbortSignal): Promise<void>;
  /** Run several motors together until the fastest reaches the limit. */
  motorsRunFor(speeds: Partial<Record<MotorPort, number>>, amount: number, unit: AmountUnit, signal: AbortSignal): Promise<void>;
  motorStop(port: MotorPort, mode: StopMode): void;
  /** Encoder angle in degrees since the last reset. */
  motorAngle(port: MotorPort): number;
  motorResetAngle(port: MotorPort): void;

  /** Servo angle 0..180 degrees. */
  servoSet(port: ServoPort, angle: number): void;
  ledSet(color: LedColor): void;
  /** Play a MIDI note for `secs` seconds. */
  beep(note: number, secs: number, signal: AbortSignal): Promise<void>;

  readColor(): SensorColor;
  /** Distance in centimetres. */
  readDistance(): number;
  /** Tilt in degrees. */
  readTilt(axis: TiltAxis): number;
  readButton(): boolean;

  /** Subscribe to on-board button presses; returns an unsubscribe function. */
  onButtonPress(cb: () => void): () => void;

  /** Stop all motors and sound (program ended or stopped). */
  halt(): void;
}

/** Degrees per second a motor turns at 100% speed. */
export const MAX_DEG_PER_SEC = 720;
