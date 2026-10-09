import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { device } from '../app/engine';
import { playNote } from '../app/audio';
import type { SimSnapshot } from '../devices/sim/SimDevice';
import { MOTOR_PORTS, SENSOR_COLORS, SERVO_PORTS, TILT_AXES } from '../ir/types';
import { SWATCHES } from '../blocks/shared/palette';

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const noteName = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

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

function Dial({ angle, speed, label }: { angle: number; speed: number; label: string }) {
  return (
    <div className="dial">
      <svg viewBox="-24 -24 48 48" aria-hidden>
        <circle r="20" className="dial-ring" />
        <g transform={`rotate(${angle % 360})`}>
          <line y1="0" y2="-17" className="dial-hand" />
          <circle cy="-17" r="3" className="dial-tip" />
        </g>
        <circle r="3" className="dial-hub" />
      </svg>
      <div className="dial-label">{label}</div>
      <div className="dial-value">
        <span>{Math.round(speed)}%</span>
        <span>{Math.round(angle)}°</span>
      </div>
    </div>
  );
}

function Servo({ angle, label }: { angle: number; label: string }) {
  // 0° points left, 90° up, 180° right.
  const rad = ((180 - angle) * Math.PI) / 180;
  return (
    <div className="dial">
      <svg viewBox="-24 -24 48 32" aria-hidden>
        <path d="M -20 4 A 20 20 0 0 1 20 4" className="dial-ring" fill="none" />
        <line x1="0" y1="4" x2={18 * Math.cos(rad)} y2={4 - 18 * Math.sin(rad)} className="dial-hand" />
        <circle cy="4" r="3" className="dial-hub" />
      </svg>
      <div className="dial-label">{label}</div>
      <div className="dial-value">{Math.round(angle)}°</div>
    </div>
  );
}

export function SimulatorPanel() {
  const { t } = useTranslation();
  const snap = useDeviceSnapshot();
  const lastNote = useRef<number | null>(null);

  useEffect(() => {
    if (snap.note !== lastNote.current) {
      lastNote.current = snap.note;
      playNote(snap.note);
    }
  }, [snap.note]);

  const s = snap.sensors;
  const colourKey = (c: string) => `MB_C_${c.toUpperCase()}`;

  return (
    <div className="sim">
      <section className="sim-board" aria-label="MATRIX Mini R4">
        <div className="sim-board-head">
          <span className="sim-board-name">MATRIX Mini R4</span>
          <span
            className={`sim-led ${snap.led === 'off' ? 'off' : ''}`}
            style={{ '--led': SWATCHES[snap.led] } as React.CSSProperties}
            title={`${t('ui.led')}: ${snap.led}`}
          />
          <span className={`sim-buzzer ${snap.note !== null ? 'on' : ''}`} title={t('ui.buzzer')}>
            ♪ {snap.note !== null ? noteName(snap.note) : ''}
          </span>
        </div>

        <h3>{t('ui.motors')}</h3>
        <div className="sim-grid">
          {MOTOR_PORTS.map((p) => (
            <Dial key={p} label={p} angle={snap.motors[p].angle} speed={snap.motors[p].speed} />
          ))}
        </div>

        <h3>{t('ui.servos')}</h3>
        <div className="sim-grid">
          {SERVO_PORTS.map((p) => (
            <Servo key={p} label={p} angle={snap.servos[p]} />
          ))}
        </div>
      </section>

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
                aria-label={t(`blocks.${colourKey(c)}`)}
                title={t(`blocks.${colourKey(c)}`)}
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
              {t('ui.tilt')} · {t(`ui.${axis}`)} <b>{s.tilt[axis]}°</b>
            </span>
            <input
              type="range"
              min={-90}
              max={90}
              value={s.tilt[axis]}
              onChange={(e) => device.setSensors({ tilt: { ...s.tilt, [axis]: Number(e.target.value) } })}
            />
          </label>
        ))}

        <div className="sim-field">
          <span>{t('ui.button')}</span>
          <button
            type="button"
            className={`hold-button ${s.button ? 'pressed' : ''}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              device.setSensors({ button: true });
            }}
            onPointerUp={() => device.setSensors({ button: false })}
            onPointerCancel={() => device.setSensors({ button: false })}
          >
            {t('ui.press')}
          </button>
        </div>
      </section>
    </div>
  );
}
