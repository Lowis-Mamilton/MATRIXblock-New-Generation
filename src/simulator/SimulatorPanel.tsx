import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { device } from '../app/engine';
import { playNote } from '../app/audio';
import { useApp } from '../app/store';
import type { SimSnapshot } from '../devices/sim/SimDevice';
import { MOTOR_PORTS, SENSOR_COLORS, TILT_AXES } from '../ir/types';
import { SWATCHES } from '../blocks/shared/palette';
import { BoardView } from './BoardView';

/**
 * Follow the device: re-read on every change, and every animation frame while
 * a motor is turning (angles move continuously).
 */
function useDeviceSnapshot(): SimSnapshot {
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
  }, []);
  return snap;
}

export function SimulatorPanel() {
  const { t } = useTranslation();
  const snap = useDeviceSnapshot();
  const running = useApp((s) => s.running);
  const lastNote = useRef<number | null>(null);

  useEffect(() => {
    if (snap.note !== lastNote.current) {
      lastNote.current = snap.note;
      playNote(snap.note);
    }
  }, [snap.note]);

  const s = snap.sensors;
  const colourLabel = (c: string) => t(`blocks.MB_C_${c.toUpperCase()}`);

  return (
    <div className="sim">
      <div className="sim-head">
        <span className="sim-mode">{t('ui.simulator')}</span>
      </div>

      <BoardView
        snap={snap}
        oled={['SIMULATOR', running ? 'RUNNING' : 'READY']}
        onButton={(b, pressed) => device.setSensors({ buttons: { [b]: pressed } })}
      />
      <p className="sim-hint">{t('ui.boardHint')}</p>

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
                onClick={() => device.setSensors({ color: c })}
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
            onChange={(e) => device.setSensors({ distance: Number(e.target.value) })}
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
              onChange={(e) => device.setSensors({ tilt: { [axis]: Number(e.target.value) } })}
            />
          </label>
        ))}
      </section>
    </div>
  );
}
