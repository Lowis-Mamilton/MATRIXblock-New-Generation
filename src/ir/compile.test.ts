import { describe, expect, it } from 'vitest';
import { compile, CompileError, type SBlock } from './compile';

const n = (v: number): { shadow: SBlock } => ({ shadow: { type: 'math_number', id: `n${v}`, fields: { NUM: v } } });
const chain = (...blocks: SBlock[]): SBlock => {
  for (let i = blocks.length - 2; i >= 0; i--) blocks[i] = { ...blocks[i], next: { block: blocks[i + 1] } };
  return blocks[0];
};

describe('compile (Word)', () => {
  it('turns hat stacks into threads and ignores loose stacks', () => {
    const prog = compile({
      blocks: {
        blocks: [
          chain({ type: 'w_when_start', id: 'h1' }, { type: 'w_led', id: 'a', fields: { COLOR: 'red' } }),
          { type: 'w_led', id: 'loose', fields: { COLOR: 'blue' } },
          { type: 'w_when_message', id: 'h2', fields: { MSG: 'go' } },
        ],
      },
    });
    expect(prog.threads).toEqual([
      { id: 'h1', trigger: { k: 'start' }, body: [{ id: 'a', op: 'led', target: 'both', color: 'red' }] },
      { id: 'h2', trigger: { k: 'message', msg: 'go' }, body: [] },
    ]);
  });

  it('compiles inputs, shadows, nested statements and variables', () => {
    const prog = compile({
      variables: [{ name: 'count', id: 'v1' }],
      blocks: {
        blocks: [
          chain(
            { type: 'w_when_start', id: 'h' },
            {
              type: 'w_repeat',
              id: 'r',
              inputs: {
                TIMES: n(3),
                DO: {
                  block: chain(
                    { type: 'math_change', id: 'c', fields: { VAR: { id: 'v1' } }, inputs: { DELTA: n(1) } },
                    {
                      type: 'w_motor_run_for',
                      id: 'm',
                      fields: { PORT: 'M2', UNIT: 'rot' },
                      inputs: {
                        SPEED: n(50),
                        AMOUNT: {
                          ...n(0),
                          block: {
                            type: 'math_arithmetic',
                            id: 'ar',
                            fields: { OP: 'MULTIPLY' },
                            inputs: { A: { block: { type: 'variables_get', id: 'g', fields: { VAR: { id: 'v1' } } } }, B: n(2) },
                          },
                        },
                      },
                    },
                  ),
                },
              },
            },
          ),
        ],
      },
    });
    expect(prog.variables).toEqual(['count']);
    const rep = prog.threads[0].body[0];
    expect(rep).toMatchObject({ op: 'repeat', times: { k: 'num', v: 3 } });
    if (rep.op !== 'repeat') throw new Error();
    expect(rep.body[0]).toEqual({ id: 'c', op: 'changeVar', name: 'count', by: { k: 'num', v: 1 } });
    expect(rep.body[1]).toEqual({
      id: 'm',
      op: 'motorRun',
      port: 'M2',
      speed: { k: 'num', v: 50 },
      limit: {
        unit: 'rot',
        amount: { k: 'bin', op: '*', a: { k: 'var', name: 'count' }, b: { k: 'num', v: 2 } },
      },
    });
  });

  it('defaults empty boolean inputs to false and skips disabled blocks', () => {
    const prog = compile({
      blocks: {
        blocks: [
          chain(
            { type: 'w_when_start', id: 'h' },
            { type: 'w_wait_until', id: 'w' },
            { type: 'w_led', id: 'off', enabled: false, fields: { COLOR: 'red' } },
          ),
        ],
      },
    });
    expect(prog.threads[0].body).toEqual([{ id: 'w', op: 'waitUntil', cond: { k: 'bool', v: false } }]);
  });

  it('reports unknown blocks with their id', () => {
    expect(() =>
      compile({ blocks: { blocks: [chain({ type: 'w_when_start', id: 'h' }, { type: 'nope', id: 'x' })] } }),
    ).toThrow(CompileError);
  });
});

describe('compile (Icon)', () => {
  it('compiles button hats and colour waits on the configured port', () => {
    const prog = compile(
      {
        blocks: {
          blocks: [
            chain({ type: 'i_when_button', id: 'h', fields: { BTN: 'down' } }, { type: 'i_wait_sensor', id: 'w', fields: { COND: 'red' } }),
          ],
        },
      },
      { color: 'I2C3', distance: 'I2C4' },
    );
    expect(prog.threads[0].trigger).toEqual({ k: 'button', button: 'down' });
    expect(prog.threads[0].body[0]).toEqual({
      id: 'w',
      op: 'waitUntil',
      cond: { k: 'bin', op: '=', a: { k: 'sensor', read: { type: 'color', port: 'I2C3' } }, b: { k: 'str', v: 'red' } },
    });
  });

  it('maps icon presets to concrete commands', () => {
    const prog = compile({
      blocks: {
        blocks: [
          chain(
            { type: 'i_start', id: 'h' },
            { type: 'i_move', id: 'f', fields: { DIR: 'left', SECS: 2, SPEED: 'fast' } },
            { type: 'i_motor', id: 'm', fields: { PORT: 'M3', DIR: 'ccw', SECS: 1, SPEED: 'slow' } },
            { type: 'i_wait_sensor', id: 'w', fields: { COND: 'near' } },
            { type: 'i_wait_sensor', id: 'w2', fields: { COND: 'down' } },
            {
              type: 'i_repeat',
              id: 'r',
              fields: { TIMES: 2 },
              inputs: { DO: { block: { type: 'i_led', id: 'l', fields: { WHICH: '2', COLOR: 'green' } } } },
            },
          ),
        ],
      },
    }, { color: 'I2C3', distance: 'I2C4' });
    expect(prog.threads[0].body).toEqual([
      { id: 'f', op: 'moveSteer', steer: { k: 'num', v: -100 }, speed: { k: 'num', v: 100 }, limit: { amount: { k: 'num', v: 2 }, unit: 'sec' } },
      { id: 'm', op: 'motorRun', port: 'M3', speed: { k: 'num', v: -30 }, limit: { amount: { k: 'num', v: 1 }, unit: 'sec' } },
      { id: 'w', op: 'waitUntil', cond: { k: 'bin', op: '<', a: { k: 'sensor', read: { type: 'distance', port: 'I2C4' } }, b: { k: 'num', v: 10 } } },
      { id: 'w2', op: 'waitUntil', cond: { k: 'sensor', read: { type: 'button', button: 'down' } } },
      { id: 'r', op: 'repeat', times: { k: 'num', v: 2 }, body: [{ id: 'l', op: 'led', target: '2', color: 'green' }] },
    ]);
  });
});
