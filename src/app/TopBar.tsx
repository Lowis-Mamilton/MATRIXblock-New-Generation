import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from './store';
import { setLanguage } from '../i18n';
import { LANGUAGES, type Lang } from '../i18n/strings';
import { bluetoothAvailable } from '../devices/ble/webBluetooth';
import { isIOS } from '../platform';

interface Props {
  onHome(): void;
  onNew(): void;
  onOpen(): void;
  onSave(): void;
  onSettings(): void;
  onUndo(): void;
  onRedo(): void;
  onConnect(): void;
  onRun(): void;
  onStop(): void;
}

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden>
    {children}
  </svg>
);

/** The ☰ menu: everything a student rarely needs. */
function AppMenu({ onHome, onNew, onOpen, onSave, onSettings }: Pick<Props, 'onHome' | 'onNew' | 'onOpen' | 'onSave' | 'onSettings'>) {
  const { t, i18n } = useTranslation();
  const project = useApp((s) => s.project);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = (label: string, action: () => void, icon: ReactNode, show = true) =>
    show && (
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setOpen(false);
          action();
        }}
      >
        <Icon>{icon}</Icon>
        {label}
      </button>
    );

  return (
    <div className="app-menu" ref={root}>
      <button
        type="button"
        className="icon-button menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('ui.menu')}
        title={t('ui.menu')}
        onClick={() => setOpen(!open)}
      >
        <Icon>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </Icon>
      </button>
      {open && (
        <div className="menu-popover" role="menu">
          {item(t('ui.myProjects'), onHome, <path d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" />, !!project)}
          {item(t('ui.newProject'), onNew, <path d="M12 5v14M5 12h14" />)}
          {item(t('ui.openFile'), onOpen, <path d="M3 7h6l2 2h10v10H3zM3 7V5h6" />)}
          {item(t('ui.saveFile'), onSave, <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />, !!project)}
          {item(
            t('ui.settings'),
            onSettings,
            <>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
            </>,
            !!project,
          )}
          <label className="menu-language">
            <Icon>
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
            </Icon>
            <span>{t('ui.language')}</span>
            <select value={i18n.language} onChange={(e) => setLanguage(e.target.value as Lang)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

export function TopBar(props: Props) {
  const { onUndo, onRedo, onConnect, onRun, onStop } = props;
  const { t } = useTranslation();
  const project = useApp((s) => s.project);
  const running = useApp((s) => s.running);
  const rename = useApp((s) => s.rename);
  const history = useApp((s) => s.history);
  const connection = useApp((s) => s.connection);
  const canBluetooth = bluetoothAvailable();

  return (
    <header className="topbar">
      <AppMenu {...props} />
      <img className="logo" src={`${import.meta.env.BASE_URL}logo-white.png`} alt="MATRIX" />

      {project && (
        <input
          className="project-name"
          aria-label={t('ui.projectName')}
          title={t('ui.renameHint')}
          value={project.name}
          onChange={(e) => rename(e.target.value)}
          spellCheck={false}
        />
      )}

      <div className="spacer" />

      {project && (
        <div className="history">
          <button type="button" className="icon-button" onClick={onUndo} disabled={!history.canUndo} aria-label={t('ui.undo')} title={t('ui.undo')}>
            <Icon><path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" /></Icon>
          </button>
          <button type="button" className="icon-button" onClick={onRedo} disabled={!history.canRedo} aria-label={t('ui.redo')} title={t('ui.redo')}>
            <Icon><path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" /></Icon>
          </button>
        </div>
      )}

      <button
        type="button"
        className={`connect ${connection.status}`}
        onClick={onConnect}
        disabled={connection.status === 'connecting'}
        title={
          !canBluetooth
            ? t(isIOS() ? 'ui.noBluetoothIOS' : 'ui.noBluetooth')
            : connection.status === 'connected'
              ? `${t('ui.disconnect')} ${connection.name ?? ''}`
              : t('ui.connectHint')
        }
      >
        <Icon><path d="M7 7l10 10-5 5V2l5 5L7 17" /></Icon>
        <span className="label">
          {connection.status === 'connected'
            ? connection.name
            : connection.status === 'connecting'
              ? t('ui.connecting')
              : t('ui.connect')}
        </span>
      </button>

      {project && (
        <div className="run-controls">
          <button
            type="button"
            className={`run ${running ? 'is-running' : ''}`}
            onClick={onRun}
            aria-label={t('ui.run')}
            title={t('ui.run')}
          >
            <svg viewBox="0 0 24 24" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          </button>
          <button
            type="button"
            className="stop"
            onClick={onStop}
            disabled={!running}
            aria-label={t('ui.stop')}
            title={t('ui.stop')}
          >
            <svg viewBox="0 0 24 24" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          </button>
        </div>
      )}
    </header>
  );
}
