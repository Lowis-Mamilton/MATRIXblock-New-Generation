/**
 * Icon glyphs for Icon Blocks, as SVG data URIs (white on transparent, 40×40
 * viewBox) so they can be used by Blockly.FieldImage.
 */
const svg = (body: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
  );

export const GLYPHS = {
  start: svg('<path d="M13 9 L31 20 L13 31 Z" fill="#fff"/>'),
  button: svg('<rect x="8" y="8" width="24" height="24" rx="5"/><circle cx="20" cy="20" r="6" fill="#fff"/>'),
  forward: svg('<path d="M20 32 V9 M11 17 L20 8 L29 17"/>'),
  backward: svg('<path d="M20 8 V31 M11 23 L20 32 L29 23"/>'),
  left: svg('<path d="M28 32 V20 A8 8 0 0 0 20 12 H9 M15 6 L9 12 L15 18"/>'),
  right: svg('<path d="M12 32 V20 A8 8 0 0 1 20 12 H31 M25 6 L31 12 L25 18"/>'),
  stop: svg('<rect x="10" y="10" width="20" height="20" rx="3" fill="#fff"/>'),
  motor: svg('<circle cx="20" cy="20" r="11"/><circle cx="20" cy="20" r="3" fill="#fff"/><path d="M20 4 V9 M20 31 V36 M4 20 H9 M31 20 H36"/>'),
  servo: svg('<path d="M8 30 H32"/><path d="M20 30 L30 12"/><path d="M12 30 A8 8 0 0 1 20 22" stroke-dasharray="2 3"/><circle cx="20" cy="30" r="3" fill="#fff"/>'),
  wait: svg('<circle cx="20" cy="21" r="12"/><path d="M20 14 V21 L25 24 M16 5 H24"/>'),
  waitSensor: svg('<path d="M8 12 H32 L24 21 V31 L16 34 V21 Z"/>'),
  repeat: svg('<path d="M30 15 A11 11 0 1 0 31 25 M30 7 V15 H22"/>'),
  forever: svg('<path d="M20 20 C15 12 6 12 6 20 C6 28 15 28 20 20 C25 12 34 12 34 20 C34 28 25 28 20 20 Z"/>'),
  led: svg('<path d="M14 26 A9 9 0 1 1 26 26 V30 H14 Z"/><path d="M15 34 H25"/>'),
  sound: svg('<path d="M8 16 H14 L22 9 V31 L14 24 H8 Z" fill="#fff"/><path d="M27 14 A8 8 0 0 1 27 26 M31 10 A13 13 0 0 1 31 30"/>'),
};

export type GlyphName = keyof typeof GLYPHS;
