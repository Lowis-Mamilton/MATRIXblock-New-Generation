import { useTranslation } from 'react-i18next';
import { useApp } from './store';
import { MOTOR_PORTS, type MotorPort } from '../ir/types';

export function SettingsDialog({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const drive = useApp((s) => s.project?.drive);
  const setDrive = useApp((s) => s.setDrive);
  if (!drive) return null;

  const portSelect = (side: 'left' | 'right') => (
    <label className="setting">
      <span>{t(side === 'left' ? 'ui.leftMotor' : 'ui.rightMotor')}</span>
      <select value={drive[side]} onChange={(e) => setDrive({ ...drive, [side]: e.target.value as MotorPort })}>
        {MOTOR_PORTS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="settings-title">{t('ui.settings')}</h2>
        <h3>{t('ui.driveSettings')}</h3>
        {portSelect('left')}
        {portSelect('right')}
        <button type="button" className="primary" onClick={onClose}>{t('ui.close')}</button>
      </div>
    </div>
  );
}
