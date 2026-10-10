import { describe, expect, it } from 'vitest';
import { STRINGS } from './strings';
import { EXPRESSION_TYPES, STATEMENT_TYPES, TRIGGER_TYPES } from '../ir/compile';

const ourBlocks = [...STATEMENT_TYPES, ...EXPRESSION_TYPES, ...TRIGGER_TYPES].filter((t) => /^[iw]_/.test(t));

describe('strings', () => {
  it.each(Object.keys(STRINGS))('%s has a tooltip for every MATRIXblock block', (lang) => {
    const blocks = STRINGS[lang as keyof typeof STRINGS].blocks as Record<string, string>;
    const missing = ourBlocks.filter((t) => !blocks[`MB_TIP_${t.toUpperCase()}`]);
    expect(missing).toEqual([]);
  });

  it('keeps %N placeholders identical across languages', () => {
    const zh = STRINGS['zh-TW'].blocks as Record<string, string>;
    const en = STRINGS.en.blocks as Record<string, string>;
    const slots = (s: string) => (s.match(/%\d/g) ?? []).sort().join();
    for (const key of Object.keys(zh)) expect([key, slots(en[key])]).toEqual([key, slots(zh[key])]);
  });
});
