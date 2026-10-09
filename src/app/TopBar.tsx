import { useTranslation } from 'react-i18next';
import { useApp } from './store';
import { setLanguage } from '../i18n';
import { LANGUAGES, type Lang } from '../i18n/strings';

interface Props {
  onNew(): void;
  onOpen(): void;
  onSave(): void;
  onSettings(): void;
  onRun(): void;
  onStop(): void;
}

export function TopBar({ onNew, onOpen, onSave, onSettings, onRun, onStop }: Props) {
  const { t, i18n } = useTranslation();
  const project = useApp((s) => s.project);
  const running = useApp((s) => s.running);
  const rename = useApp((s) => s.rename);

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
        <button type="button" onClick={onNew}>{t('ui.new')}</button>
        <button type="button" onClick={onOpen}>{t('ui.open')}</button>
        <button type="button" onClick={onSave} disabled={!project}>{t('ui.save')}</button>
        <button type="button" onClick={onSettings} disabled={!project}>{t('ui.settings')}</button>
      </nav>

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

      <button type="button" className="connect" disabled title={t('ui.connectSoon')}>
        <svg viewBox="0 0 24 24" aria-hidden><path d="M7 7l10 10-5 5V2l5 5L7 17" /></svg>
        {t('ui.connect')}
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
