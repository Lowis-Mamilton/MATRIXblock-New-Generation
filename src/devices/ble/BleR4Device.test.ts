import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BleR4Device, FirmwareMismatch, HEARTBEAT_MS, NO_DISTANCE_CM, type BoardLink } from './BleR4Device';
import { CMD, MSG, PROTOCOL_VERSION, decode, encode } from './protocol';
import { Stopped } from '../../runtime/sleep';
import { Runtime } from '../../runtime/interpreter';

/** A pretend R4 on the other end of the link. */
class FakeBoard implements BoardLink {
  name = 'MXR4-TEST';
  sent: Uint8Array[] = [];
  protocol = PROTOCOL_VERSION;
  /** Answer MOTOR_RUN_DEG with DONE after this many ms (null = never). */
  doneAfter: number | null = 100;
  private onMsg: (d: DataView) => void = () => {};
  private onGone: () => void = () => {};

  async send(frame: Uint8Array) {
    this.sent.push(frame);
    if (frame[0] === CMD.HELLO) this.reply([MSG.INFO, 0, this.protocol, 1, 0, 0]);
    if (frame[0] === CMD.MOTOR_RUN_DEG && this.doneAfter !== null) {
      setTimeout(() => this.reply([MSG.DONE, 0, frame[1]]), this.doneAfter);
    }
  }
  onMessage(cb: (d: DataView) => void) {
    this.onMsg = cb;
  }
  onDisconnect(cb: () => void) {
    this.onGone = cb;
  }
  disconnect() {
    this.onGone();
  }
  reply(bytes: number[]) {
    this.onMsg(new DataView(Uint8Array.from(bytes).buffer));
  }
  motors(angles: number[], buttons = 0, busy = 0) {
    const b = new DataView(new ArrayBuffer(20));
    b.setUint8(0, MSG.T_MOTORS);
    angles.forEach((a, i) => b.setInt32(2 + i * 4, a, true));
    b.setUint8(18, busy);
    b.setUint8(19, buttons);
    this.onMsg(b);
  }
  ports(readings: [kind: number, value: number][]) {
    const b = new DataView(new ArrayBuffer(14));
    b.setUint8(0, MSG.T_PORTS);
    readings.forEach(([k, v], i) => {
      b.setUint8(2 + i * 3, k);
      b.setUint16(3 + i * 3, v, true);
    });
    this.onMsg(b);
  }
  of(cmd: number) {
    return this.sent.filter((f) => f[0] === cmd);
  }
}

let board: FakeBoard;
let dev: BleR4Device;

beforeEach(async () => {
  vi.useFakeTimers();
  board = new FakeBoard();
  dev = new BleR4Device(board);
  await dev.handshake();
});

afterEach(() => {
  dev.disconnect();
  vi.useRealTimers();
});

describe('protocol', () => {
  it('encodes commands as compact little-endian frames', () => {
    expect([...encode.motorRunDeg(7, 'M3', -50, 720)]).toEqual([CMD.MOTOR_RUN_DEG, 7, 3, 0xce, 0xd0, 0x02, 0, 0]);
    expect([...encode.led(1, 'both', 'red')]).toEqual([CMD.LED, 1, 3, 255, 0, 0]);
    expect([...encode.tone(2, 440, 500)]).toEqual([CMD.TONE, 2, 0xb8, 0x01, 0xf4, 0x01]);
    for (const f of [encode.motorRunDeg(1, 'M1', 100, 1e9), encode.tone(1, 9e9, 9e9)]) expect(f.length).toBeLessThanOrEqual(20);
  });

  it('decodes IMU telemetry in hundredths of a degree', () => {
    const b = new DataView(new ArrayBuffer(9));
    b.setUint8(0, MSG.T_IMU);
    b.setInt16(2, -1234, true);
    b.setInt16(4, 500, true);
    b.setInt16(6, 17999, true);
    b.setUint8(8, 87);
    expect(decode(b)).toEqual({ type: 'imu', pitch: -12.34, roll: 5, yaw: 179.99, battery: 87 });
  });
});

describe('BleR4Device', () => {
  it('rejects firmware that speaks another protocol version', async () => {
    const old = new FakeBoard();
    old.protocol = PROTOCOL_VERSION + 1;
    await expect(new BleR4Device(old).handshake()).rejects.toBeInstanceOf(FirmwareMismatch);
  });

  it('sends a heartbeat while connected', async () => {
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 3 + 10);
    expect(board.of(CMD.HEARTBEAT).length).toBe(3);
  });

  it('runs motors by degrees on the board, splitting the distance by speed', async () => {
    const ctrl = new AbortController();
    let finished = false;
    void dev.motorsRunFor({ M1: 50, M2: -25 }, 2, 'rot', ctrl.signal).then(() => (finished = true));
    await vi.advanceTimersByTimeAsync(10);
    const frames = board.of(CMD.MOTOR_RUN_DEG).map((f) => new DataView(f.buffer));
    expect(frames.map((f) => [f.getUint8(2), f.getInt8(3), f.getUint32(4, true)])).toEqual([
      [1, 50, 720],
      [2, -25, 360],
    ]);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(finished).toBe(true);
  });

  it('stops the motor when a degree move is aborted', async () => {
    board.doneAfter = null;
    const ctrl = new AbortController();
    const run = dev.motorRunFor('M4', 40, 90, 'deg', ctrl.signal);
    await vi.advanceTimersByTimeAsync(10);
    ctrl.abort();
    await expect(run).rejects.toBeInstanceOf(Stopped);
    const stop = board.of(CMD.MOTOR_STOP).at(-1)!;
    expect([stop[2], stop[3]]).toEqual([4, 0]);
  });

  it('times second-based moves itself', async () => {
    const ctrl = new AbortController();
    const run = dev.motorRunFor('M2', 30, 1.5, 'sec', ctrl.signal);
    expect(board.of(CMD.MOTOR_RUN)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1500);
    await run;
    expect(board.of(CMD.MOTOR_STOP)).toHaveLength(1);
  });

  it('caches telemetry and reports button presses', () => {
    const pressed: string[] = [];
    dev.onButtonPress((b) => pressed.push(b));
    board.motors([10, -20, 30, 400], 0b10);
    board.motors([11, -20, 30, 400], 0b11);
    expect(dev.motorAngle('M4')).toBe(400);
    expect(dev.readButton('up')).toBe(true);
    expect(pressed).toEqual(['down', 'up']);

    board.ports([
      [1, 3],
      [2, 234],
      [0, 0],
      [0, 0],
    ]);
    expect(dev.readColor('I2C1')).toBe('red');
    expect(dev.readDistance('I2C2')).toBeCloseTo(23.4);
    expect(dev.readDistance('I2C3')).toBe(NO_DISTANCE_CM);
    expect(dev.snapshot().ports?.[0]).toEqual({ kind: 'color', color: 'red' });
  });

  it('ignores stale encoder telemetry right after a reset', async () => {
    board.motors([500, 0, 0, 0]);
    dev.motorResetAngle('M1');
    board.motors([500, 0, 0, 0]);
    expect(dev.motorAngle('M1')).toBe(0);
    await vi.advanceTimersByTimeAsync(300);
    board.motors([3, 0, 0, 0]);
    expect(dev.motorAngle('M1')).toBe(3);
  });

  it('drives the interpreter end to end', async () => {
    const rt = new Runtime(dev, { drive: { left: 'M1', right: 'M2' } });
    const done = rt.run({
      variables: [],
      threads: [
        {
          id: 'h',
          trigger: { k: 'start' },
          body: [
            {
              id: 'w',
              op: 'waitUntil',
              cond: { k: 'bin', op: '<', a: { k: 'sensor', read: { type: 'distance', port: 'I2C2' } }, b: { k: 'num', v: 10 } },
            },
            { id: 'l', op: 'led', target: '1', color: 'green' },
          ],
        },
      ],
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(board.of(CMD.LED)).toHaveLength(0);
    board.ports([
      [0, 0],
      [2, 55],
      [0, 0],
      [0, 0],
    ]);
    await vi.advanceTimersByTimeAsync(100);
    await done;
    expect([...board.of(CMD.LED)[0]].slice(2)).toEqual([1, 0, 255, 0]);
    expect(board.of(CMD.HALT)).toHaveLength(1);
  });
});
