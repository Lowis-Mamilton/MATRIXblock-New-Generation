import { useTranslation } from 'react-i18next';
import { useApp } from './store';
import { I2C_PORTS, MOTOR_PORTS } from '../ir/types';

export function SettingsDialog({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const project = useApp((s) => s.project);
  const setDrive = useApp((s) => s.setDrive);
  const setSensors = useApp((s) => s.setSensors);
  if (!project) return null;
  const { drive, sensors } = project;

  const select = <T extends string>(label: string, value: T, options: readonly T[], onChange: (v: T) => void) => (
    <label className="setting">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((p) => (
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
        {select(t('ui.leftMotor'), drive.left, MOTOR_PORTS, (left) => setDrive({ ...drive, left }))}
        {select(t('ui.rightMotor'), drive.right, MOTOR_PORTS, (right) => setDrive({ ...drive, right }))}
        {project.mode === 'icon' && (
          <>
            <h3>{t('ui.sensorPorts')}</h3>
            {select(t('ui.colorSensor'), sensors.color, I2C_PORTS, (color) => setSensors({ ...sensors, color }))}
            {select(t('ui.distanceSensor'), sensors.distance, I2C_PORTS, (distance) => setSensors({ ...sensors, distance }))}
          </>
        )}
        <button type="button" className="primary" onClick={onClose}>{t('ui.close')}</button>
      </div>
    </div>
  );
}
