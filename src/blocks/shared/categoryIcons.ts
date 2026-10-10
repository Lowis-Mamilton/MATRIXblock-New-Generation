/** White line glyphs for the toolbox category buttons (24×24 viewBox). */
import { CATEGORY_COLOURS, type Category } from './palette';

const GLYPHS: Record<Category, string> = {
  events: '<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>',
  movement: '<path d="M6 11l2-4h8l2 4"/><rect x="3" y="11" width="18" height="6" rx="2"/><circle cx="7.5" cy="18" r="1.8" fill="#fff"/><circle cx="16.5" cy="18" r="1.8" fill="#fff"/>',
  motors: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="#fff"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  sensors: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
  control: '<path d="M17 3l3 3-3 3M4 12V10a4 4 0 014-4h12M7 21l-3-3 3-3M20 12v2a4 4 0 01-4 4H4"/>',
  looks: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5V16h8v-2.5A6 6 0 0012 3z"/>',
  operators: '<path d="M12 4v8M8 8h8M8 18h8"/>',
  variables: '<rect x="4" y="6" width="16" height="12" rx="2.5"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/>',
};

const uri = (body: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
  )}")`;

/**
 * CSS giving each category its round icon; injected once. Drawn as a ::before
 * on the row because Blockly omits the icon element in horizontal toolboxes.
 */
export function injectCategoryStyles() {
  if (document.getElementById('mb-category-icons')) return;
  const style = document.createElement('style');
  style.id = 'mb-category-icons';
  style.textContent = (Object.keys(GLYPHS) as Category[])
    .map((c) => `.mbCat-${c} .blocklyTreeRowContentContainer::before{background-color:${CATEGORY_COLOURS[c]};background-image:${uri(GLYPHS[c])}}`)
    .join('\n');
  document.head.appendChild(style);
}
