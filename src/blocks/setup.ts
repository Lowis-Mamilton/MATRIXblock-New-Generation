/**
 * Blockly configuration shared by the editor: theme, toolbox and workspace
 * options for each block mode.
 */
import * as Blockly from 'blockly/core';
import { CATEGORY_COLOURS as C, type Category } from './shared/palette';
import { ICON_RENDERER } from './icon/renderer';
import { IconConnectionPreviewer } from './icon/previewer';
import { ICON_TOOLBOX } from './icon/blocks';
import { WORD_TOOLBOX } from './word/blocks';
import type { Lang } from '../i18n/strings';
import { STRINGS } from '../i18n/strings';
import { injectCategoryStyles } from './shared/categoryIcons';

export type BlockMode = 'icon' | 'word';

const shade = (hex: string, amount: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(Math.min(255, Math.max(0, ((n >> s) & 255) * (1 + amount))));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
};

const style = (c: string, hat?: string) => ({
  colourPrimary: c,
  colourSecondary: shade(c, 0.25),
  colourTertiary: shade(c, -0.25),
  ...(hat ? { hat } : {}),
});

const blockStyles: Record<string, ReturnType<typeof style>> = {
  events_hat: style(C.events, 'cap'),
  // Blockly's built-in operator / variable blocks use these style names.
  logic_blocks: style(C.operators),
  math_blocks: style(C.operators),
  variable_blocks: style(C.variables),
};
for (const cat of Object.keys(C) as Category[]) blockStyles[`${cat}_blocks`] = style(C[cat]);

export const THEME = Blockly.Theme.defineTheme('matrixblock', {
  name: 'matrixblock',
  base: Blockly.Themes.Classic,
  blockStyles,
  categoryStyles: Object.fromEntries(
    (Object.keys(C) as Category[]).map((cat) => [`${cat}_category`, { colour: C[cat] }]),
  ),
  componentStyles: {
    workspaceBackgroundColour: '#F7F8FC',
    toolboxBackgroundColour: '#FFFFFF',
    toolboxForegroundColour: '#1D1D36',
    flyoutBackgroundColour: '#EEF1F8',
    flyoutForegroundColour: '#1D1D36',
    flyoutOpacity: 0.97,
    scrollbarColour: '#97ABC8',
    insertionMarkerColour: '#6EC9EF',
    insertionMarkerOpacity: 0.4,
    cursorColour: '#6EC9EF',
  },
  fontStyle: { family: 'Montserrat, "Noto Sans TC", sans-serif', weight: '600', size: 12 },
  startHats: true,
});

/** Round coloured icon + label for a toolbox category (styled in styles.css). */
const categoryCss = (category: string) => ({
  row: `blocklyToolboxCategory mbCat mbCat-${category}`,
  label: 'blocklyToolboxCategoryLabel mbCatLabel',
});

export function buildToolbox(mode: BlockMode, lang: Lang): Blockly.utils.toolbox.ToolboxDefinition {
  injectCategoryStyles();
  const names = STRINGS[lang].categories;
  if (mode === 'icon') {
    return {
      kind: 'categoryToolbox',
      contents: ICON_TOOLBOX.map(({ category, blocks }) => ({
        kind: 'category',
        name: names[category],
        categorystyle: `${category}_category`,
        cssconfig: categoryCss(category),
        contents: blocks.map((b) => ({ kind: 'block', type: b.type, ...(b.fields ? { fields: b.fields } : {}) })),
      })),
    };
  }
  return {
    kind: 'categoryToolbox',
    contents: WORD_TOOLBOX.map(({ category, contents }) => ({
      kind: 'category',
      name: names[category as Category],
      categorystyle: `${category}_category`,
      cssconfig: categoryCss(category),
      ...(contents === 'VARIABLE' ? { custom: 'VARIABLE' } : { contents }),
    })) as Blockly.utils.toolbox.ToolboxItemInfo[],
  };
}

export function workspaceOptions(mode: BlockMode, lang: Lang): Blockly.BlocklyOptions {
  const common: Blockly.BlocklyOptions = {
    theme: THEME,
    toolbox: buildToolbox(mode, lang),
    trashcan: true,
    sounds: false,
    move: { scrollbars: true, drag: true, wheel: true },
  };
  if (mode === 'icon') {
    return {
      ...common,
      renderer: ICON_RENDERER,
      horizontalLayout: true,
      toolboxPosition: 'end',
      zoom: { controls: true, wheel: false, pinch: true, startScale: 1.0, maxScale: 2.5, minScale: 0.5 },
      plugins: { connectionPreviewer: IconConnectionPreviewer },
    };
  }
  return {
    ...common,
    renderer: 'zelos',
    zoom: { controls: true, wheel: false, pinch: true, startScale: 0.75, maxScale: 2, minScale: 0.4 },
  };
}
