import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Blockly from 'blockly/core';
import * as BlocklyEn from 'blockly/msg/en';
import * as BlocklyZhHant from 'blockly/msg/zh-hant';
import { LANGUAGES, STRINGS, type Lang } from './strings';

const LANG_KEY = 'mb.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved as Lang;
  } catch {
    /* storage unavailable */
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
}

/** Point Blockly's message table at `lang` (blocks pick it up when created). */
export function applyBlocklyLocale(lang: Lang) {
  const base = (lang === 'en' ? BlocklyEn : BlocklyZhHant) as unknown as Record<string, string>;
  Blockly.setLocale(base);
  Object.assign(Blockly.Msg, STRINGS[lang].blocks);
}

export function setLanguage(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage unavailable */
  }
  applyBlocklyLocale(lang);
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
  void i18n.changeLanguage(lang);
}

const lang = initialLang();
applyBlocklyLocale(lang);
document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(STRINGS).map(([k, v]) => [k, { translation: v }])),
  lng: lang,
  fallbackLng: 'zh-TW',
  interpolation: { escapeValue: false },
});

export default i18n;
