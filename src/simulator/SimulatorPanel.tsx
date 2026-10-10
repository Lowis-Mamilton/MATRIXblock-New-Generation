import { useTranslation } from 'react-i18next';
import { simulator } from '../app/engine';
import { I2C_PORTS, SENSOR_COLORS, TILT_AXES } from '../ir/types';
import { SWATCHES } from '../blocks/shared/palette';
import { BoardView } from './BoardView';
import { oledText, useBoard } from './useBoard';

/** Board image plus sensors: editable on the simulator, live readings on a real board. */
export function SimulatorPanel() {
  const { t } = useTranslation();
  const { snap, live, running, name } = useBoard();
  const s = snap.sensors;
  const colourName = (c: string) => t(`blocks.MB_C_${c.toUpperCase()}`);

  return (
    <div className="sim">
      <BoardView
        snap={snap}
        oled={oledText(live, name, running)}
        onButton={live ? undefined : (b, pressed) => simulator.setSensors({ buttons: { [b]: pressed } })}
      />
      <p className="sim-hint">{t(live ? 'ui.liveHint' : 'ui.boardHint')}</p>

      <details className="sim-sensors">
        <summary>{t('ui.sensors')}</summary>
        {live ? (
          <dl className="live-readings">
            {I2C_PORTS.map((p, i) => {
              const r = snap.ports?.[i];
              return (
                <div key={p}>
                  <dt>{p}</dt>
                  <dd>
                    {r?.kind === 'color' && (
                      <>
                        <span className="dot" style={{ background: SWATCHES[r.color ?? 'none'] }} />
                        {t('ui.reading', { sensor: t('ui.colorSensor'), value: colourName(r.color ?? 'none') })}
                      </>
                    )}
                    {r?.kind === 'distance' && t('ui.reading', { sensor: t('ui.distanceSensor'), value: `${r.cm?.toFixed(1)} cm` })}
                    {(!r || r.kind === 'none') && <span className="muted">{t('ui.nothingConnected')}</span>}
                  </dd>
                </div>
              );
            })}
            {TILT_AXES.map((axis) => (
              <div key={axis}>
                <dt>{t(`ui.${axis}`)}</dt>
                <dd>{s.tilt[axis].toFixed(1)}°</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="sim-controls">
            <div className="sim-field">
              <span>{t('ui.colorSensor')}</span>
              <div className="swatches" role="radiogroup" aria-label={t('ui.colorSensor')}>
                {SENSOR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={s.color === c}
                    aria-label={colourName(c)}
                    title={colourName(c)}
                    className={`swatch ${s.color === c ? 'selected' : ''} ${c === 'none' ? 'none' : ''}`}
                    style={{ background: SWATCHES[c] }}
                    onClick={() => simulator.setSensors({ color: c })}
                  />
                ))}
              </div>
            </div>

            <label className="sim-field">
              <span>
                {t('ui.distance')} <b>{s.distance}</b>
              </span>
              <input
                type="range"
                min={0}
                max={200}
                value={s.distance}
                onChange={(e) => simulator.setSensors({ distance: Number(e.target.value) })}
              />
            </label>

            {TILT_AXES.map((axis) => (
              <label className="sim-field" key={axis}>
                <span>
                  {t(`ui.${axis}`)} <b>{s.tilt[axis]}°</b>
                </span>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  value={s.tilt[axis]}
                  onChange={(e) => simulator.setSensors({ tilt: { [axis]: Number(e.target.value) } })}
                />
              </label>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}
