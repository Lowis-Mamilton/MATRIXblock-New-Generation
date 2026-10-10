import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  fileName: string;
  text: string;
  onClose(): void;
}

/**
 * Last-resort export for browsers that can neither download nor share files
 * (iOS in-app browsers such as Bluefy): hand the student the project text.
 */
export function ExportDialog({ fileName, text, onClose }: Props) {
  const { t } = useTranslation();
  const area = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      area.current?.select();
      document.execCommand('copy');
    }
    setCopied(true);
  };

  const share = () => void navigator.share({ title: fileName, text }).catch(() => {});

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="export-title">{t('ui.exportTitle')}</h2>
        <p className="hint">{t('ui.exportHint', { name: fileName })}</p>
        <textarea ref={area} readOnly value={text} rows={6} onFocus={(e) => e.currentTarget.select()} />
        <div className="dialog-actions">
          {'share' in navigator && (
            <button type="button" className="secondary" onClick={share}>{t('ui.shareText')}</button>
          )}
          <button type="button" className="secondary" onClick={() => void copy()}>
            {copied ? t('ui.copied') : t('ui.copy')}
          </button>
          <button type="button" className="primary" onClick={onClose}>{t('ui.close')}</button>
        </div>
      </div>
    </div>
  );
}
