import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { activeDevice, simulator } from '../app/engine';
import { playNote } from '../app/audio';
import { useApp } from '../app/store';
import type { BoardSnapshot, ObservableDevice } from '../devices/Device';
import { I2C_PORTS, MOTOR_PORTS, SENSOR_COLORS, TILT_AXES } from '../ir/types';
import { SWATCHES } from '../blocks/shared/palette';
import { BoardView } from './BoardView';

/**
 * Follow the device: re-read on every change, and every animation frame while
 * a motor is turning (angles move continuously).
 */
function useDeviceSnapshot(device: ObservableDevice): BoardSnapshot {
  const [snap, setSnap] = useState(() => device.snapshot());
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const s = device.snapshot();
      setSnap(s);
      cancelAnimationFrame(raf);
      if (MOTOR_PORTS.some((p) => s.motors[p].speed !== 0)) raf = requestAnimationFrame(update);
    };
    const unsubscribe = device.subscribe(update);
    update();
    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
    };
  }, [device]);
  return snap;
}

export function SimulatorPanel() {
  const { t } = useTranslation();
  const running = useApp((s) => s.running);
  const connection = useApp((s) => s.connection);
  const live = connection.status === 'connected';
  // The connection status changes exactly when the active device does.
  const device = live ? activeDevice() : simulator;
  const snap = useDeviceSnapshot(device);
  const lastNote = useRef<number | null>(null);

  useEffect(() => {
    if (snap.note !== lastNote.current) {
      lastNote.current = snap.note;
      playNote(snap.note);
    }
  }, [snap.note]);

  const s = snap.sensors;
  const colourLabel = (c: string) => t(`blocks.MB_C_${c.toUpperCase()}`);

  const colourName = colourLabel;

  return (
    <div className="sim">
      <div className="sim-head">
        <span className={`sim-mode ${live ? 'live' : ''}`}>
          {live ? t('ui.liveBoard', { name: connection.name }) : t('ui.simulator')}
        </span>
        {live && snap.battery !== undefined && (
          <span className="sim-battery" title={t('ui.battery')}>
            🔋 {snap.battery}%
          </span>
        )}
      </div>

      <BoardView
        snap={snap}
        oled={live ? [connection.name ?? '', running ? 'RUNNING' : 'CONNECTED'] : ['SIMULATOR', running ? 'RUNNING' : 'READY']}
        onButton={live ? undefined : (b, pressed) => simulator.setSensors({ buttons: { [b]: pressed } })}
      />
      <p className="sim-hint">{t(live ? 'ui.liveHint' : 'ui.boardHint')}</p>

      {live ? (
        <section className="sim-sensors">
          <h3>{t('ui.sensors')}</h3>
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
        </section>
      ) : (
        <section className="sim-sensors">
          <h3>{t('ui.sensors')}</h3>

          <div className="sim-field">
            <span>{t('ui.colorSensor')}</span>
            <div className="swatches" role="radiogroup" aria-label={t('ui.colorSensor')}>
              {SENSOR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={s.color === c}
                  aria-label={colourLabel(c)}
                  title={colourLabel(c)}
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
        </section>
      )}
    </div>
  );
}
