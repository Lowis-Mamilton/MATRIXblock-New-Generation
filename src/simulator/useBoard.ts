import { useEffect, useRef, useState } from 'react';
import { activeDevice, simulator } from '../app/engine';
import { playNote } from '../app/audio';
import { useApp } from '../app/store';
import type { BoardSnapshot, ObservableDevice } from '../devices/Device';
import { MOTOR_PORTS } from '../ir/types';

/**
 * Follow a device: re-read on every change, and every animation frame while
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

/** The board programs run on right now (simulator or connected R4), and its state. */
export function useBoard() {
  const running = useApp((s) => s.running);
  const connection = useApp((s) => s.connection);
  const live = connection.status === 'connected';
  // The connection status changes exactly when the active device does.
  const device = live ? activeDevice() : simulator;
  const snap = useDeviceSnapshot(device);
  return { snap, live, running, name: connection.name ?? '' };
}

/** Plays the board's buzzer through the speakers; mount once. */
export function BoardAudio() {
  const { snap } = useBoard();
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (snap.note !== last.current) {
      last.current = snap.note;
      playNote(snap.note);
    }
  }, [snap.note]);
  return null;
}

/** Two lines for the board's OLED. */
export const oledText = (live: boolean, name: string, running: boolean): [string, string] =>
  live ? [name, running ? 'RUNNING' : 'CONNECTED'] : ['SIMULATOR', running ? 'RUNNING' : 'READY'];
