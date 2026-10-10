/**
 * The board programs run on: the simulator, or a real R4 connected over BLE.
 */
import { SimDevice } from '../devices/sim/SimDevice';
import { BleR4Device } from '../devices/ble/BleR4Device';
import { connectWebBluetooth } from '../devices/ble/webBluetooth';
import type { ObservableDevice } from '../devices/Device';
import { Runtime } from '../runtime/interpreter';
import type { DriveConfig, Program } from '../ir/types';

export const simulator = new SimDevice();

let board: BleR4Device | null = null;
let current: Runtime | null = null;

/** Where programs run right now. */
export function activeDevice(): ObservableDevice {
  return board ?? simulator;
}

export function connectedBoard(): BleR4Device | null {
  return board;
}

/**
 * Pick and connect a board. Resolves with it once the handshake succeeds;
 * `onLost` fires if the connection drops later.
 */
export async function connectBoard(onLost: () => void): Promise<BleR4Device> {
  const link = await connectWebBluetooth();
  const dev = new BleR4Device(link);
  try {
    await dev.handshake();
  } catch (e) {
    link.disconnect();
    throw e;
  }
  stopProgram();
  board = dev;
  dev.onDisconnect(() => {
    if (board !== dev) return;
    current?.stop();
    board = null;
    onLost();
  });
  return dev;
}

export function disconnectBoard() {
  const dev = board;
  stopProgram();
  board = null;
  dev?.disconnect();
}

export function runProgram(
  program: Program,
  drive: DriveConfig,
  hooks: { onHighlight(id: string, on: boolean): void; onRunningChange(running: boolean): void },
): Promise<void> {
  current?.stop();
  const device = activeDevice();
  if (device === simulator) simulator.reset();
  const rt = new Runtime(device, { drive, ...hooks });
  current = rt;
  return rt.run(program);
}

export function stopProgram() {
  current?.stop();
}
