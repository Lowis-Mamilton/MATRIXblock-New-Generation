/**
 * Intermediate representation shared by Icon and Word modes.
 *
 * Both block modes compile to this tree; the interpreter executes it against a
 * Device. Every statement carries the id of the block it came from so the
 * editor can highlight what is running.
 */

export const MOTOR_PORTS = ['M1', 'M2', 'M3', 'M4'] as const;
export const SERVO_PORTS = ['RC1', 'RC2', 'RC3', 'RC4'] as const;
export const LED_COLORS = ['off', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'white'] as const;
export const SENSOR_COLORS = ['none', 'black', 'white', 'red', 'yellow', 'green', 'blue'] as const;
export const TILT_AXES = ['pitch', 'roll', 'yaw'] as const;
export const I2C_PORTS = ['I2C1', 'I2C2', 'I2C3', 'I2C4'] as const;
export const BUTTONS = ['up', 'down'] as const;
/** Which of the two on-board RGB LEDs. */
export const LED_TARGETS = ['both', '1', '2'] as const;

export type MotorPort = (typeof MOTOR_PORTS)[number];
export type ServoPort = (typeof SERVO_PORTS)[number];
export type LedColor = (typeof LED_COLORS)[number];
export type SensorColor = (typeof SENSOR_COLORS)[number];
export type TiltAxis = (typeof TILT_AXES)[number];
export type I2cPort = (typeof I2C_PORTS)[number];
export type ButtonId = (typeof BUTTONS)[number];
export type LedTarget = (typeof LED_TARGETS)[number];

/** How long a movement lasts: seconds, motor degrees, or motor rotations. */
export type AmountUnit = 'sec' | 'deg' | 'rot';
export type StopMode = 'brake' | 'coast';

export type BinOp =
  | '+' | '-' | '*' | '/'
  | '<' | '<=' | '>' | '>=' | '=' | '!='
  | 'and' | 'or';

export type SensorRead =
  | { type: 'color'; port: I2cPort }
  | { type: 'distance'; port: I2cPort }
  | { type: 'tilt'; axis: TiltAxis }
  | { type: 'button'; button: ButtonId }
  | { type: 'motorAngle'; port: MotorPort };

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'var'; name: string }
  | { k: 'bin'; op: BinOp; a: Expr; b: Expr }
  | { k: 'not'; a: Expr }
  | { k: 'random'; min: Expr; max: Expr }
  | { k: 'sensor'; read: SensorRead };

/** A movement with an optional limit; without `amount` it just starts. */
export interface Amount {
  amount: Expr;
  unit: AmountUnit;
}

type S<T> = T & { id: string };

export type Stmt =
  | S<{ op: 'motorRun'; port: MotorPort; speed: Expr; limit?: Amount }>
  | S<{ op: 'motorStop'; port: MotorPort; mode: StopMode }>
  | S<{ op: 'motorResetAngle'; port: MotorPort }>
  | S<{ op: 'moveSteer'; steer: Expr; speed: Expr; limit?: Amount }>
  | S<{ op: 'moveTank'; left: Expr; right: Expr; limit?: Amount }>
  | S<{ op: 'moveStop'; mode: StopMode }>
  | S<{ op: 'servo'; port: ServoPort; angle: Expr }>
  | S<{ op: 'led'; target: LedTarget; color: LedColor }>
  | S<{ op: 'beep'; note: Expr; secs: Expr }>
  | S<{ op: 'wait'; secs: Expr }>
  | S<{ op: 'waitUntil'; cond: Expr }>
  | S<{ op: 'repeat'; times: Expr; body: Stmt[] }>
  | S<{ op: 'forever'; body: Stmt[] }>
  | S<{ op: 'repeatUntil'; cond: Expr; body: Stmt[] }>
  | S<{ op: 'if'; cond: Expr; then: Stmt[]; else?: Stmt[] }>
  | S<{ op: 'setVar'; name: string; value: Expr }>
  | S<{ op: 'changeVar'; name: string; by: Expr }>
  | S<{ op: 'broadcast'; msg: string }>
  | S<{ op: 'stopAll' }>;

export type StmtOp = Stmt['op'];

export type Trigger =
  | { k: 'start' }
  | { k: 'button'; button: ButtonId }
  | { k: 'message'; msg: string };

export interface Thread {
  /** Id of the hat block that starts this thread. */
  id: string;
  trigger: Trigger;
  body: Stmt[];
}

/** Which motors drive the robot's left and right wheels. */
export interface DriveConfig {
  left: MotorPort;
  right: MotorPort;
}

/** Where Icon-mode sensor blocks read from (Word blocks name their port). */
export interface SensorConfig {
  color: I2cPort;
  distance: I2cPort;
}

export interface Program {
  threads: Thread[];
  variables: string[];
}
