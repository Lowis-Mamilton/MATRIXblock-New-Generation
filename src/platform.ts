/** Facts about the device the app runs on. */

/**
 * iPhone / iPad. iPadOS reports itself as a Mac, so a touch-capable "Mac" counts too.
 * Every iOS browser runs on WebKit: no Web Bluetooth (except Bluefy) and
 * in-app browsers ignore `<a download>`.
 */
export function isIOS(nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> = navigator): boolean {
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}
