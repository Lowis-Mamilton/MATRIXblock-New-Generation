import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../app/store';
import { SWATCHES } from '../blocks/shared/palette';
import { SimulatorPanel } from './SimulatorPanel';
import { useBoard } from './useBoard';

/** "Simulator" or "Board MXR4-xxxx", plus battery when live. */
function ModeChip() {
  const { t } = useTranslation();
  const { live, name, snap } = useBoard();
  return (
    <>
      <span className={`sim-mode ${live ? 'live' : ''}`}>{live ? t('ui.liveBoard', { name }) : t('ui.simulator')}</span>
      {live && snap.battery !== undefined && (
        <span className="sim-battery" title={t('ui.battery')}>
          {snap.battery}%
        </span>
      )}
    </>
  );
}

const Chevron = ({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) => {
  const d = { left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6' }[dir];
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="chevron">
      <path d={d} />
    </svg>
  );
};

const BoardGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="board-glyph">
    <rect x="4" y="3" width="16" height="18" rx="3" />
    <rect x="9" y="15" width="6" height="3" rx="1" />
    <circle cx="8" cy="7" r="1.2" />
    <circle cx="16" cy="7" r="1.2" />
  </svg>
);

/** Simulator beside the editor on wide screens. */
export function SideDock() {
  const { t } = useTranslation();
  const open = useApp((s) => s.sideOpen);
  const toggle = useApp((s) => s.toggleSide);

  if (!open) {
    return (
      <aside className="dock-rail" aria-label={t('ui.simulator')}>
        <button type="button" onClick={toggle} title={t('ui.showSimulator')} aria-label={t('ui.showSimulator')}>
          <BoardGlyph />
          <Chevron dir="left" />
        </button>
      </aside>
    );
  }
  return (
    <aside className="dock-side" aria-label={t('ui.simulator')}>
      <div className="dock-head">
        <ModeChip />
        <button type="button" className="icon-button" onClick={toggle} title={t('ui.hideSimulator')} aria-label={t('ui.hideSimulator')}>
          <Chevron dir="right" />
        </button>
      </div>
      <SimulatorPanel />
    </aside>
  );
}

/** Simulator as a bottom sheet on narrow screens: a status bar that expands. */
export function SheetDock() {
  const { t } = useTranslation();
  const open = useApp((s) => s.sheetOpen);
  const toggle = useApp((s) => s.toggleSheet);
  const { snap, running } = useBoard();

  return (
    <section className={`dock-sheet ${open ? 'open' : ''}`} aria-label={t('ui.simulator')}>
      <button type="button" className="sheet-bar" onClick={toggle} aria-expanded={open}>
        <BoardGlyph />
        <ModeChip />
        <span className="sheet-leds" aria-hidden>
          {snap.leds.map((c, i) => (
            <span key={i} className={`mini-led ${c === 'off' ? 'off' : ''}`} style={{ '--led': SWATCHES[c] } as CSSProperties} />
          ))}
        </span>
        {snap.note !== null && <span className="sheet-note">♪</span>}
        {running && <span className="sheet-running">{t('ui.running')}</span>}
        <span className="sheet-toggle">
          {open ? t('ui.hideSimulator') : t('ui.showSimulator')}
          <Chevron dir={open ? 'down' : 'up'} />
        </span>
      </button>
      {open && (
        <div className="sheet-body">
          <SimulatorPanel />
        </div>
      )}
    </section>
  );
}
