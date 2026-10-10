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

export function TopBar({ onHome, onNew, onOpen, onSave, onSettings, onUndo, onRedo, onConnect, onRun, onStop }: Props) {
  const { t, i18n } = useTranslation();
  const project = useApp((s) => s.project);
  const running = useApp((s) => s.running);
  const rename = useApp((s) => s.rename);
  const history = useApp((s) => s.history);
  const connection = useApp((s) => s.connection);
  const canBluetooth = bluetoothAvailable();

  const action = (key: string, onClick: () => void, disabled: boolean, icon: React.ReactNode) => (
    <button type="button" onClick={onClick} disabled={disabled} title={t(`ui.${key}`)} aria-label={t(`ui.${key}`)}>
      <svg viewBox="0 0 24 24" aria-hidden>{icon}</svg>
      <span className="label">{t(`ui.${key}`)}</span>
    </button>
  );

  return (
    <header className="topbar">
      <img className="logo" src={`${import.meta.env.BASE_URL}logo-white.png`} alt="MATRIX" />
      <span className="product">block</span>

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

      <nav className="file-actions">
        {action('myProjects', onHome, !project, <path d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" />)}
        {action('new', onNew, false, <path d="M12 5v14M5 12h14" />)}
        {action('open', onOpen, false, <path d="M3 7h6l2 2h10v10H3zM3 7V5h6" />)}
        {action('save', onSave, !project, <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />)}
        {action('settings', onSettings, !project, <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>)}
      </nav>

      {project && (
        <div className="history">
          <button type="button" onClick={onUndo} disabled={!history.canUndo} aria-label={t('ui.undo')} title={t('ui.undo')}>
            <svg viewBox="0 0 24 24" aria-hidden><path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" /></svg>
          </button>
          <button type="button" onClick={onRedo} disabled={!history.canRedo} aria-label={t('ui.redo')} title={t('ui.redo')}>
            <svg viewBox="0 0 24 24" aria-hidden><path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" /></svg>
          </button>
        </div>
      )}

      <div className="spacer" />

      <select
        className="lang"
        aria-label={t('ui.language')}
        value={i18n.language}
        onChange={(e) => setLanguage(e.target.value as Lang)}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>

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
        <svg viewBox="0 0 24 24" aria-hidden><path d="M7 7l10 10-5 5V2l5 5L7 17" /></svg>
        <span className="label">
          {connection.status === 'connected'
            ? connection.name
            : connection.status === 'connecting'
              ? t('ui.connecting')
              : t('ui.connect')}
        </span>
      </button>

      <div className="run-controls">
        <button
          type="button"
          className={`run ${running ? 'is-running' : ''}`}
          onClick={onRun}
          disabled={!project}
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
    </header>
  );
}
