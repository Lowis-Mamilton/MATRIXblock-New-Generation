/**
 * Starter projects offered when creating a new project. Workspaces are written
 * in Blockly's JSON serialization format.
 */
import type { BlockMode } from '../blocks/setup';
import type { SBlock, SWorkspace } from '../ir/compile';

export interface Example {
  id: string;
  mode: BlockMode;
  /** i18n keys under `examples.` for the title and description. */
  key: string;
  workspace: SWorkspace;
}

let n = 0;
const id = () => `ex${n++}`;

/** Chain blocks through their `next` connections. */
function chain(...blocks: SBlock[]): SBlock {
  for (let i = blocks.length - 2; i >= 0; i--) blocks[i] = { ...blocks[i], next: { block: blocks[i + 1] } };
  return blocks[0];
}
const at = (b: SBlock, x: number, y: number) => ({ ...b, x, y }) as SBlock;

// ---- Icon helpers ----
const icon = (type: string, fields: Record<string, string> = {}, body?: SBlock): SBlock => ({
  type,
  id: id(),
  fields,
  ...(body ? { inputs: { DO: { block: body } } } : {}),
});
const move = (DIR: string, SECS: string, SPEED = 'medium') => icon('i_move', { DIR, SECS, SPEED });
const led = (COLOR: string, WHICH = 'both') => icon('i_led', { WHICH, COLOR });

// ---- Word helpers ----
const num = (v: number) => ({ shadow: { type: 'math_number', id: id(), fields: { NUM: v } } });
const word = (
  type: string,
  fields: Record<string, unknown> = {},
  inputs: Record<string, { block?: SBlock; shadow?: SBlock }> = {},
): SBlock => ({ type, id: id(), fields, inputs });
const stack = (block: SBlock) => ({ block });

/**
 * Turn the robot on the spot by about 90°: with a 65 mm wheel and 114 mm
 * track each wheel turns 114 / 65 × 90 ≈ 158°.
 */
const turnRight = () =>
  word('w_move_tank', { UNIT: 'deg' }, { LEFT: num(30), RIGHT: num(-30), AMOUNT: num(158) });

export const EXAMPLES: Example[] = [
  {
    id: 'icon-dance',
    mode: 'icon',
    key: 'dance',
    workspace: {
      blocks: {
        blocks: [
          at(
            chain(
              icon('i_start'),
              led('purple'),
              icon(
                'i_repeat',
                { TIMES: '2' },
                chain(
                  move('forward', '1', 'fast'),
                  move('backward', '1', 'fast'),
                  led('green', '1'),
                  move('left', '1'),
                  icon('i_sound', { NOTE: '67' }),
                  led('blue', '2'),
                  move('right', '1'),
                ),
              ),
              icon('i_sound', { NOTE: '72' }),
              led('off'),
            ),
            40,
            60,
          ),
        ],
      },
    },
  },
  {
    id: 'icon-obstacle',
    mode: 'icon',
    key: 'obstacle',
    workspace: {
      blocks: {
        blocks: [
          at(chain(icon('i_start'), led('green'), move('forward', '10', 'slow')), 40, 60),
          at(
            chain(icon('i_start'), icon('i_wait_sensor', { COND: 'near' }), icon('i_stop'), led('red'), icon('i_sound', { NOTE: '60' })),
            40,
            220,
          ),
        ],
      },
    },
  },
  {
    id: 'icon-traffic',
    mode: 'icon',
    key: 'traffic',
    workspace: {
      blocks: {
        blocks: [
          at(
            chain(
              icon('i_start'),
              icon(
                'i_forever',
                {},
                chain(
                  icon('i_wait_sensor', { COND: 'green' }),
                  led('green'),
                  move('forward', '2'),
                  icon('i_wait_sensor', { COND: 'red' }),
                  led('red'),
                  icon('i_sound', { NOTE: '60' }),
                ),
              ),
            ),
            40,
            60,
          ),
        ],
      },
    },
  },
  {
    id: 'word-square',
    mode: 'word',
    key: 'square',
    workspace: {
      blocks: {
        blocks: [
          at(
            chain(
              word('w_when_start'),
              word(
                'w_repeat',
                {},
                {
                  TIMES: num(4),
                  DO: stack(
                    chain(
                      word('w_move_steer', { UNIT: 'rot' }, { STEER: num(0), SPEED: num(50), AMOUNT: num(2) }),
                      turnRight(),
                    ),
                  ),
                },
              ),
              word('w_led', { WHICH: 'both', COLOR: 'green' }),
            ),
            60,
            60,
          ),
        ],
      },
    },
  },
  {
    id: 'word-patrol',
    mode: 'word',
    key: 'patrol',
    workspace: {
      blocks: {
        blocks: [
          at(
            chain(
              word('w_when_start'),
              word(
                'w_forever',
                {},
                {
                  DO: stack(
                    chain(
                      word('w_led', { WHICH: 'both', COLOR: 'green' }),
                      word('w_move_steer_start', {}, { STEER: num(0), SPEED: num(40) }),
                      word(
                        'w_wait_until',
                        {},
                        {
                          COND: stack(
                            word(
                              'logic_compare',
                              { OP: 'LT' },
                              { A: stack(word('w_distance', { PORT: 'I2C2' })), B: num(15) },
                            ),
                          ),
                        },
                      ),
                      word('w_move_stop', { MODE: 'brake' }),
                      word('w_led', { WHICH: 'both', COLOR: 'red' }),
                      word('w_beep', { NOTE: '60' }, { SECS: num(0.3) }),
                      turnRight(),
                    ),
                  ),
                },
              ),
            ),
            60,
            60,
          ),
        ],
      },
    },
  },
  {
    id: 'word-counter',
    mode: 'word',
    key: 'counter',
    workspace: {
      variables: [{ name: 'count', id: 'count' }],
      blocks: {
        blocks: [
          at(
            chain(
              word('w_when_start'),
              word('variables_set', { VAR: { id: 'count' } }, { VALUE: num(0) }),
              word('w_led', { WHICH: 'both', COLOR: 'off' }),
            ),
            60,
            40,
          ),
          at(
            chain(
              word('w_when_button', { BTN: 'up' }),
              word('math_change', { VAR: { id: 'count' } }, { DELTA: num(1) }),
              word('w_beep', { NOTE: '72' }, { SECS: num(0.1) }),
              word(
                'w_if',
                {},
                {
                  COND: stack(
                    word(
                      'logic_compare',
                      { OP: 'GTE' },
                      { A: stack(word('variables_get', { VAR: { id: 'count' } })), B: num(5) },
                    ),
                  ),
                  DO: stack(word('w_broadcast', { MSG: 'full' })),
                },
              ),
            ),
            60,
            280,
          ),
          at(
            chain(
              word('w_when_button', { BTN: 'down' }),
              word('variables_set', { VAR: { id: 'count' } }, { VALUE: num(0) }),
              word('w_led', { WHICH: 'both', COLOR: 'off' }),
            ),
            560,
            40,
          ),
          at(
            chain(
              word('w_when_message', { MSG: 'full' }),
              word('w_led', { WHICH: 'both', COLOR: 'red' }),
              word('w_beep', { NOTE: '60' }, { SECS: num(0.5) }),
            ),
            560,
            280,
          ),
        ],
      },
    },
  },
];
