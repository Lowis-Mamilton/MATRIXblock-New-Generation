import { useTranslation } from 'react-i18next';
import type { BlockMode } from '../blocks/setup';
import { EXAMPLES, type Example } from '../examples';

/** Small illustrations of the two block layouts. */
export function IconPreview() {
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

export function WordPreview() {
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

interface Props {
  onBlank(mode: BlockMode): void;
  onExample(example: Example): void;
  onCancel(): void;
}

export function NewProjectDialog({ onBlank, onExample, onCancel }: Props) {
  const { t } = useTranslation();
  const column = (mode: BlockMode) => (
    <section className="new-mode" aria-labelledby={`new-${mode}`}>
      {mode === 'icon' ? <IconPreview /> : <WordPreview />}
      <h3 id={`new-${mode}`}>{t(mode === 'icon' ? 'ui.iconMode' : 'ui.wordMode')}</h3>
      <p>{t(mode === 'icon' ? 'ui.iconModeDesc' : 'ui.wordModeDesc')}</p>
      <button type="button" className="primary wide" onClick={() => onBlank(mode)}>
        {t('ui.blankProject')}
      </button>
      <h4>{t('ui.fromExample')}</h4>
      <ul className="example-list">
        {EXAMPLES.filter((e) => e.mode === mode).map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onExample(e)}>
              <strong>{t(`examples.${e.key}.title`)}</strong>
              <span>{t(`examples.${e.key}.desc`)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal new-project"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      >
        <h2 id="new-title">{t('ui.newProject')}</h2>
        <p className="hint">{t('ui.pickModeHint')}</p>
        <div className="new-modes">
          {column('icon')}
          {column('word')}
        </div>
        <button type="button" className="secondary" onClick={onCancel}>{t('ui.cancel')}</button>
      </div>
    </div>
  );
}
