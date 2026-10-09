import { useTranslation } from 'react-i18next';
import type { BlockMode } from '../blocks/setup';

/** Small illustrations of the two block layouts. */
function IconPreview() {
  return (
    <svg viewBox="0 0 200 80" aria-hidden>
      <rect x="10" y="22" width="40" height="40" rx="10" fill="#E8A33D" />
      <rect x="52" y="22" width="40" height="40" rx="6" fill="#2E5690" />
      <rect x="94" y="14" width="60" height="8" rx="3" fill="#E07A2F" />
      <rect x="94" y="14" width="14" height="48" rx="4" fill="#E07A2F" />
      <rect x="110" y="22" width="30" height="40" rx="6" fill="#8E5BC9" />
      <rect x="142" y="14" width="12" height="48" rx="4" fill="#E07A2F" />
      <rect x="156" y="22" width="34" height="40" rx="6" fill="#3C7DD9" />
    </svg>
  );
}

function WordPreview() {
  return (
    <svg viewBox="0 0 200 80" aria-hidden>
      <rect x="40" y="6" width="90" height="14" rx="7" fill="#E8A33D" />
      <rect x="40" y="22" width="120" height="14" rx="4" fill="#2E5690" />
      <rect x="40" y="38" width="100" height="10" rx="4" fill="#E07A2F" />
      <rect x="40" y="38" width="10" height="34" rx="4" fill="#E07A2F" />
      <rect x="52" y="50" width="100" height="10" rx="4" fill="#8E5BC9" />
      <rect x="40" y="62" width="70" height="10" rx="4" fill="#E07A2F" />
    </svg>
  );
}

export function ModePicker({ onPick, onCancel }: { onPick(mode: BlockMode): void; onCancel?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="modal-backdrop">
      <div className="modal mode-picker" role="dialog" aria-modal="true" aria-labelledby="mode-title">
        <h2 id="mode-title">{t('ui.pickMode')}</h2>
        <p className="hint">{t('ui.pickModeHint')}</p>
        <div className="mode-cards">
          <button type="button" className="mode-card" onClick={() => onPick('icon')}>
            <IconPreview />
            <strong>{t('ui.iconMode')}</strong>
            <span>{t('ui.iconModeDesc')}</span>
          </button>
          <button type="button" className="mode-card" onClick={() => onPick('word')}>
            <WordPreview />
            <strong>{t('ui.wordMode')}</strong>
            <span>{t('ui.wordModeDesc')}</span>
          </button>
        </div>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>{t('ui.cancel')}</button>
        )}
      </div>
    </div>
  );
}
