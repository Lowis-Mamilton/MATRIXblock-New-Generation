import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '.';
import { compile } from '../ir/compile';

describe('examples', () => {
  it.each(EXAMPLES.map((e) => [e.id, e] as const))('%s compiles to runnable threads', (_, example) => {
    const program = compile(example.workspace);
    expect(program.threads.length).toBeGreaterThan(0);
    for (const t of program.threads) expect(t.body.length).toBeGreaterThan(0);
    const prefix = example.mode === 'icon' ? 'i_' : 'w_';
    const tops = example.workspace.blocks?.blocks ?? [];
    for (const top of tops) expect(top.type.startsWith(prefix)).toBe(true);
  });

  it('has three examples per mode', () => {
    expect(EXAMPLES.filter((e) => e.mode === 'icon')).toHaveLength(3);
    expect(EXAMPLES.filter((e) => e.mode === 'word')).toHaveLength(3);
  });
});
