import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Runtime } from './interpreter';
import { SimDevice } from '../devices/sim/SimDevice';
import type { Expr, Program, Stmt, Thread } from '../ir/types';

const num = (v: number): Expr => ({ k: 'num', v });
let nextId = 0;
const st = <T extends Omit<Stmt, 'id'>>(s: T) => ({ id: `b${nextId++}`, ...s }) as Stmt;
const thread = (body: Stmt[], trigger: Thread['trigger'] = { k: 'start' }): Thread => ({
  id: `h${nextId++}`,
  trigger,
  body,
});
const program = (...threads: Thread[]): Program => ({ threads, variables: ['x'] });

let device: SimDevice;
let rt: Runtime;
let highlights: string[];

beforeEach(() => {
  vi.useFakeTimers();
  device = new SimDevice();
  highlights = [];
  rt = new Runtime(device, {
    drive: { left: 'M1', right: 'M2' },
    onHighlight: (id, on) => on && highlights.push(id),
  });
});

afterEach(() => {
  rt.stop();
  vi.useRealTimers();
});

describe('Runtime', () => {
  it('runs a timed motor command and highlights it', async () => {
    const motor = st({ op: 'motorRun', port: 'M3', speed: num(50), limit: { amount: num(2), unit: 'sec' } });
    const done = rt.run(program(thread([motor])));
    await vi.advanceTimersByTimeAsync(1000);
    expect(device.snapshot().motors.M3.speed).toBe(50);
    expect(highlights).toContain(motor.id);
    await vi.advanceTimersByTimeAsync(1100);
    await done;
    expect(device.snapshot().motors.M3.speed).toBe(0);
    expect(rt.running).toBe(false);
  });

  it('runs several start threads at the same time', async () => {
    const a = thread([st({ op: 'motorRun', port: 'M1', speed: num(30), limit: { amount: num(1), unit: 'sec' } })]);
    const b = thread([st({ op: 'led', target: 'both', color: 'red' })]);
    void rt.run(program(a, b));
    await vi.advanceTimersByTimeAsync(10);
    const snap = device.snapshot();
    expect(snap.motors.M1.speed).toBe(30);
    expect(snap.leds).toEqual(['red', 'red']);
  });

  it('stop() ends a forever loop and halts the motors', async () => {
    const done = rt.run(
      program(thread([st({ op: 'motorRun', port: 'M1', speed: num(80) }), st({ op: 'forever', body: [st({ op: 'wait', secs: num(0.1) })] })])),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect(rt.running).toBe(true);
    rt.stop();
    await done;
    expect(rt.running).toBe(false);
    expect(device.snapshot().motors.M1.speed).toBe(0);
  });

  it('waitUntil blocks until the condition becomes true', async () => {
    const near: Expr = { k: 'bin', op: '<', a: { k: 'sensor', read: { type: 'distance', port: 'I2C1' } }, b: num(10) };
    void rt.run(program(thread([st({ op: 'waitUntil', cond: near }), st({ op: 'led', target: 'both', color: 'green' })])));
    await vi.advanceTimersByTimeAsync(300);
    expect(device.snapshot().leds[0]).toBe('off');
    device.setSensors({ distance: 5 });
    await vi.advanceTimersByTimeAsync(100);
    expect(device.snapshot().leds[0]).toBe('green');
  });

  it('only starts threads for the button that was pressed', async () => {
    void rt.run(
      program(
        thread([st({ op: 'led', target: '1', color: 'red' })], { k: 'button', button: 'up' }),
        thread([st({ op: 'led', target: '2', color: 'green' })], { k: 'button', button: 'down' }),
      ),
    );
    device.setSensors({ buttons: { down: true } });
    await vi.advanceTimersByTimeAsync(50);
    expect(device.snapshot().leds).toEqual(['off', 'green']);
  });

  it('starts button threads when the on-board button is pressed and keeps running', async () => {
    const done = rt.run(program(thread([st({ op: 'led', target: 'both', color: 'blue' })], { k: 'button', button: 'up' })));
    let finished = false;
    void done.then(() => (finished = true));
    await vi.advanceTimersByTimeAsync(100);
    expect(device.snapshot().leds[0]).toBe('off');
    device.setSensors({ buttons: { up: true } });
    await vi.advanceTimersByTimeAsync(100);
    expect(device.snapshot().leds[0]).toBe('blue');
    expect(finished).toBe(false);
  });

  it('broadcast starts the matching message threads', async () => {
    void rt.run(
      program(
        thread([st({ op: 'broadcast', msg: 'go' })]),
        thread([st({ op: 'led', target: 'both', color: 'purple' })], { k: 'message', msg: 'go' }),
        thread([st({ op: 'led', target: 'both', color: 'red' })], { k: 'message', msg: 'other' }),
      ),
    );
    await vi.advanceTimersByTimeAsync(50);
    expect(device.snapshot().leds[0]).toBe('purple');
  });

  it('evaluates variables, arithmetic and loops', async () => {
    const done = rt.run(
      program(
        thread([
          st({ op: 'setVar', name: 'x', value: num(1) }),
          st({ op: 'repeat', times: num(5), body: [st({ op: 'changeVar', name: 'x', by: num(2) })] }),
          st({ op: 'setVar', name: 'x', value: { k: 'bin', op: '*', a: { k: 'var', name: 'x' }, b: num(10) } }),
        ]),
      ),
    );
    await vi.advanceTimersByTimeAsync(200);
    await done;
    expect(rt.variables.get('x')).toBe(110);
  });

  it('repeatUntil and if/else branch on sensors', async () => {
    const isRed: Expr = { k: 'bin', op: '=', a: { k: 'sensor', read: { type: 'color', port: 'I2C1' } }, b: { k: 'str', v: 'red' } };
    device.setSensors({ color: 'red' });
    const done = rt.run(
      program(
        thread([
          st({ op: 'if', cond: isRed, then: [st({ op: 'led', target: 'both', color: 'red' })], else: [st({ op: 'led', target: 'both', color: 'white' })] }),
          st({
            op: 'repeatUntil',
            cond: { k: 'sensor', read: { type: 'button', button: 'up' } },
            body: [st({ op: 'changeVar', name: 'x', by: num(1) })],
          }),
        ]),
      ),
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(device.snapshot().leds[0]).toBe('red');
    device.setSensors({ buttons: { up: true } });
    await vi.advanceTimersByTimeAsync(100);
    await done;
    expect(rt.variables.get('x')).toBeGreaterThan(0);
  });

  it('moveSteer maps steering to left/right wheel speeds', async () => {
    void rt.run(program(thread([st({ op: 'moveSteer', steer: num(0), speed: num(40) }), st({ op: 'wait', secs: num(1) })])));
    await vi.advanceTimersByTimeAsync(10);
    expect(device.snapshot().motors.M1.speed).toBe(40);
    expect(device.snapshot().motors.M2.speed).toBe(40);

    rt.stop();
    void rt.run(program(thread([st({ op: 'moveSteer', steer: num(100), speed: num(40) }), st({ op: 'wait', secs: num(1) })])));
    await vi.advanceTimersByTimeAsync(10);
    expect(device.snapshot().motors.M1.speed).toBe(40);
    expect(device.snapshot().motors.M2.speed).toBe(-40);

    rt.stop();
    void rt.run(program(thread([st({ op: 'moveSteer', steer: num(-50), speed: num(40) }), st({ op: 'wait', secs: num(1) })])));
    await vi.advanceTimersByTimeAsync(10);
    expect(device.snapshot().motors.M1.speed).toBe(0);
    expect(device.snapshot().motors.M2.speed).toBe(40);
  });

  it('runs a motor by degrees for the right amount of time', async () => {
    // 50% of 760 deg/s = 380 deg/s, so 360 degrees takes about 0.95 s.
    const done = rt.run(
      program(thread([st({ op: 'motorRun', port: 'M4', speed: num(50), limit: { amount: num(360), unit: 'deg' } })])),
    );
    await vi.advanceTimersByTimeAsync(900);
    expect(device.snapshot().motors.M4.speed).toBe(50);
    await vi.advanceTimersByTimeAsync(200);
    await done;
    expect(device.snapshot().motors.M4.speed).toBe(0);
    expect(Math.round(device.motorAngle('M4'))).toBe(360);
  });

  it('reads the new sensors from the device', async () => {
    device.setSensors({ ultrasonic: 42, analog: 700, digital: true, battery: 63 });
    expect(rt.eval({ k: 'sensor', read: { type: 'ultrasonic', port: 'D1' } })).toBe(42);
    expect(rt.eval({ k: 'sensor', read: { type: 'analog', port: 'A2' } })).toBe(700);
    expect(rt.eval({ k: 'sensor', read: { type: 'digital', port: 'D4' } })).toBe(true);
    expect(rt.eval({ k: 'sensor', read: { type: 'battery' } })).toBe(63);
  });

  it('holds a gesture for a second, then reads none', async () => {
    const gesture: Expr = { k: 'sensor', read: { type: 'gesture', port: 'I2C1' } };
    device.setSensors({ gesture: 'left' });
    await vi.advanceTimersByTimeAsync(900);
    expect(rt.eval(gesture)).toBe('left');
    await vi.advanceTimersByTimeAsync(200);
    expect(rt.eval(gesture)).toBe('none');
  });

  it('counts seconds since the start or the last timer reset', async () => {
    const timer: Expr = { k: 'sensor', read: { type: 'timer' } };
    void rt.run(
      program(
        thread([
          st({ op: 'wait', secs: num(1.5) }),
          st({ op: 'setVar', name: 'x', value: timer }),
          st({ op: 'resetTimer' }),
          st({ op: 'wait', secs: num(10) }),
        ]),
      ),
    );
    await vi.advanceTimersByTimeAsync(1600);
    expect(rt.variables.get('x')).toBe(1.5);
    // Reset at 1.5 s; now 1.85 s.
    await vi.advanceTimersByTimeAsync(250);
    expect(rt.eval(timer)).toBe(0.35);
  });

  it('stopAll ends every thread', async () => {
    const done = rt.run(
      program(
        thread([st({ op: 'forever', body: [st({ op: 'wait', secs: num(0.05) })] })]),
        thread([st({ op: 'wait', secs: num(0.2) }), st({ op: 'stopAll' })]),
      ),
    );
    await vi.advanceTimersByTimeAsync(400);
    await done;
    expect(rt.running).toBe(false);
  });
});
