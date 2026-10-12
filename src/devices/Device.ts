import type {
  AmountUnit,
  AnalogPort,
  ButtonId,
  DigitalPort,
  Gesture,
  I2cPort,
  LedColor,
  LedTarget,
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
  ledSet(target: LedTarget, color: LedColor): void;
  /** Play a MIDI note for `secs` seconds. */
  beep(note: number, secs: number, signal: AbortSignal): Promise<void>;

  readColor(port: I2cPort): SensorColor;
  /** Laser distance in centimetres. */
  readDistance(port: I2cPort): number;
  /** The last gesture, for `GESTURE_HOLD_MS` after it happened; then `none`. */
  readGesture(port: I2cPort): Gesture;
  /** Ultrasonic distance in centimetres. */
  readUltrasonic(port: DigitalPort): number;
  /** Level of a digital port's signal pin (switch pressed, PIR triggered…). */
  readDigital(port: DigitalPort): boolean;
  /** Analog port reading, 0..1023. */
  readAnalog(port: AnalogPort): number;
  /** Battery charge in percent. */
  readBattery(): number;
  /** Tilt in degrees. */
  readTilt(axis: TiltAxis): number;
  readButton(button: ButtonId): boolean;

  /** Subscribe to on-board button presses; returns an unsubscribe function. */
  onButtonPress(cb: (button: ButtonId) => void): () => void;

  /** Stop all motors and sound (program ended or stopped). */
  halt(): void;
}

/** What the simulator panel shows about a board (simulated or real). */
export interface BoardSnapshot {
  motors: Record<MotorPort, { speed: number; angle: number }>;
  servos: Record<ServoPort, number>;
  leds: [LedColor, LedColor];
  /** MIDI note currently sounding, or null. */
  note: number | null;
  sensors: {
    color: SensorColor;
    distance: number;
    gesture: Gesture;
    ultrasonic: number;
    digital: boolean;
    analog: number;
    tilt: Record<TiltAxis, number>;
    buttons: Record<ButtonId, boolean>;
  };
  /** Real boards only: what each I2C port reports. */
  ports?: { kind: 'none' | 'color' | 'distance' | 'gesture'; color?: SensorColor; cm?: number; gesture?: Gesture }[];
  /** Real boards only: D1..D4 levels, ultrasonic cm (null when not measuring), A1..A3 readings. */
  io?: { digital: boolean[]; ultrasonic: (number | null)[]; analog: number[] };
  /** Battery percent; unknown until a real board reports it. */
  battery?: number;
}

/** A device the UI can watch. */
export interface ObservableDevice extends Device {
  subscribe(cb: () => void): () => void;
  snapshot(): BoardSnapshot;
}

/** How long a gesture keeps reading as seen (the sensor only reports it once). */
export const GESTURE_HOLD_MS = 1000;

/** Degrees per second a motor turns at 100% speed (measured on the R4 TT motor). */
export const MAX_DEG_PER_SEC = 760;
