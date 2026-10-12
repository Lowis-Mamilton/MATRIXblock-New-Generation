import { useTranslation } from 'react-i18next';
import { simulator } from '../app/engine';
import { ANALOG_PORTS, DIGITAL_PORTS, GESTURES, I2C_PORTS, SENSOR_COLORS, TILT_AXES } from '../ir/types';
import type { SensorPatch } from '../devices/sim/SimDevice';
import { SWATCHES } from '../blocks/shared/palette';
import { BoardView } from './BoardView';
import { oledText, useBoard } from './useBoard';

/** A labelled slider that sets one simulated sensor value. */
function Slider({ label, value, min, max, unit = '', set }: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  set: (v: number) => SensorPatch;
}) {
  return (
    <label className="sim-field">
      <span>
        {label} <b>{value}{unit}</b>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => simulator.setSensors(set(Number(e.target.value)))} />
    </label>
  );
}

/** Board image plus sensors: editable on the simulator, live readings on a real board. */
export function SimulatorPanel() {
  const { t } = useTranslation();
  const { snap, live, running, name } = useBoard();
  const s = snap.sensors;
  const colourName = (c: string) => t(`blocks.MB_C_${c.toUpperCase()}`);
  const gestureName = (g: string) => (g === 'none' ? colourName('none') : t(`blocks.MB_G_${g.toUpperCase()}`));
  const level = (on: boolean) => t(on ? 'ui.triggered' : 'ui.notTriggered');

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
                    {r?.kind === 'gesture' && t('ui.reading', { sensor: t('ui.gestureSensor'), value: gestureName(r.gesture ?? 'none') })}
                    {(!r || r.kind === 'none') && <span className="muted">{t('ui.nothingConnected')}</span>}
                  </dd>
                </div>
              );
            })}
            {DIGITAL_PORTS.map((p, i) => {
              const cm = snap.io?.ultrasonic[i] ?? null;
              return (
                <div key={p}>
                  <dt>{p}</dt>
                  <dd>
                    {cm !== null
                      ? t('ui.reading', { sensor: t('ui.ultrasonicSensor'), value: `${cm.toFixed(1)} cm` })
                      : t('ui.reading', { sensor: t('ui.digitalSensor'), value: level(snap.io?.digital[i] ?? false) })}
                  </dd>
                </div>
              );
            })}
            {ANALOG_PORTS.map((p, i) => (
              <div key={p}>
                <dt>{p}</dt>
                <dd>{snap.io?.analog[i] ?? 0}</dd>
              </div>
            ))}
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

            <Slider label={t('ui.distance')} value={s.distance} min={0} max={200} set={(distance) => ({ distance })} />
            <Slider label={t('ui.ultrasonic')} value={s.ultrasonic} min={0} max={200} set={(ultrasonic) => ({ ultrasonic })} />
            <Slider label={t('ui.analog')} value={s.analog} min={0} max={1023} set={(analog) => ({ analog })} />

            <div className="sim-field">
              <span>{t('ui.digital')}</span>
              <div className="chips">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={s.digital}
                  onClick={() => simulator.setSensors({ digital: !s.digital })}
                >
                  {level(s.digital)}
                </button>
              </div>
            </div>

            <div className="sim-field">
              <span>{t('ui.gesture')}</span>
              <div className="chips">
                {GESTURES.filter((g) => g !== 'none').map((g) => (
                  <button
                    key={g}
                    type="button"
                    className="chip"
                    aria-pressed={s.gesture === g}
                    onClick={() => simulator.setSensors({ gesture: g })}
                  >
                    {gestureName(g)}
                  </button>
                ))}
              </div>
            </div>

            {TILT_AXES.map((axis) => (
              <Slider
                key={axis}
                label={t(`ui.${axis}`)}
                value={s.tilt[axis]}
                min={-90}
                max={90}
                unit="°"
                set={(v) => ({ tilt: { [axis]: v } })}
              />
            ))}

            <Slider label={t('ui.battery')} value={snap.battery ?? 100} min={0} max={100} unit="%" set={(battery) => ({ battery })} />
          </div>
        )}
      </details>
    </div>
  );
}
