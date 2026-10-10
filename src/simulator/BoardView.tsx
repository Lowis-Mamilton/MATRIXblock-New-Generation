import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { SimSnapshot } from '../devices/sim/SimDevice';
import type { ButtonId, MotorPort, ServoPort } from '../ir/types';
import { SWATCHES } from '../blocks/shared/palette';

/**
 * Positions on board-r4.webp (478×470, cropped from the product render), as
 * percentages so the overlays scale with the image.
 */
const pos = (x: number, y: number): CSSProperties => ({
  left: `${((x - 72) / 478) * 100}%`,
  top: `${((y - 6) / 470) * 100}%`,
});

const MOTOR_AT: Record<MotorPort, CSSProperties> = {
  M1: pos(178, 325),
  M2: pos(443, 325),
  M3: pos(443, 112),
  M4: pos(178, 112),
};
const SERVO_AT: Record<ServoPort, CSSProperties> = {
  RC1: pos(172, 297),
  RC2: pos(451, 297),
  RC3: pos(451, 140),
  RC4: pos(172, 140),
};
const LED_AT = [pos(219, 83), pos(404, 83)];
const BUTTON_AT: Record<ButtonId, CSSProperties> = {
  up: { ...pos(397, 375), width: `${(44 / 478) * 100}%`, height: `${(30 / 470) * 100}%` },
  down: { ...pos(397, 411), width: `${(44 / 478) * 100}%`, height: `${(29 / 470) * 100}%` },
};
const OLED_AT: CSSProperties = { ...pos(253, 386), width: `${(117 / 478) * 100}%`, height: `${(44 / 470) * 100}%` };
const BUZZER_AT = pos(320, 150);

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const noteName = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

interface Props {
  snap: SimSnapshot;
  /** Two lines shown on the board's OLED. */
  oled: [string, string];
  /** Pressing the on-board buttons; omitted when the buttons are read-only. */
  onButton?: (button: ButtonId, pressed: boolean) => void;
}

export function BoardView({ snap, oled, onButton }: Props) {
  const { t } = useTranslation();
  return (
    <div className="board" role="group" aria-label="MATRIX Mini R4">
      <img className="board-img" src={`${import.meta.env.BASE_URL}board-r4.webp`} alt="" draggable={false} />

      {snap.leds.map((c, i) => (
        <span
          key={i}
          className={`board-led ${c === 'off' ? 'off' : ''}`}
          style={{ ...LED_AT[i], '--led': SWATCHES[c] } as CSSProperties}
          title={`LED ${i + 1}: ${t(`blocks.MB_C_${c.toUpperCase()}`)}`}
        />
      ))}

      {(Object.keys(MOTOR_AT) as MotorPort[]).map((p) => {
        const m = snap.motors[p];
        return (
          <div key={p} className={`board-motor ${m.speed !== 0 ? 'on' : ''}`} style={MOTOR_AT[p]} title={`${p}: ${Math.round(m.speed)}% · ${Math.round(m.angle)}°`}>
            <svg viewBox="-12 -12 24 24" aria-hidden>
              <circle r="11" className="board-motor-ring" />
              <line y2="-9" transform={`rotate(${m.angle % 360})`} className="board-motor-hand" />
            </svg>
            <span className="board-motor-angle">{Math.round(m.angle)}°</span>
          </div>
        );
      })}

      {(Object.keys(SERVO_AT) as ServoPort[]).map((p) => (
        <span key={p} className="board-servo" style={SERVO_AT[p]} title={`${p}: ${Math.round(snap.servos[p])}°`}>
          {Math.round(snap.servos[p])}°
        </span>
      ))}

      {snap.note !== null && (
        <span className="board-note" style={BUZZER_AT}>
          ♪ {noteName(snap.note)}
        </span>
      )}

      <div className="board-oled" style={OLED_AT} aria-live="polite">
        <span>{oled[0]}</span>
        <span>{oled[1]}</span>
      </div>

      {(['up', 'down'] as const).map((b) => (
        <button
          key={b}
          type="button"
          className={`board-button ${snap.sensors.buttons[b] ? 'pressed' : ''}`}
          style={BUTTON_AT[b]}
          aria-label={t(b === 'up' ? 'ui.buttonUp' : 'ui.buttonDown')}
          aria-pressed={snap.sensors.buttons[b]}
          title={t(b === 'up' ? 'ui.buttonUp' : 'ui.buttonDown')}
          disabled={!onButton}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            onButton?.(b, true);
          }}
          onPointerUp={() => onButton?.(b, false)}
          onPointerCancel={() => onButton?.(b, false)}
          onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && onButton?.(b, true)}
          onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && onButton?.(b, false)}
        />
      ))}
    </div>
  );
}
