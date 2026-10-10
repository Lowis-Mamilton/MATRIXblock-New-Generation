import { useSyncExternalStore } from 'react';

/** True while the CSS media query matches. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Wide enough for the simulator to sit beside the editor (keep in sync with styles.css). */
export const WIDE = '(min-width: 1100px)';
