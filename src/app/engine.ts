/**
 * The single simulated board and the program runner the UI talks to.
 * Phase 2 swaps `device` for a BLE-connected R4 behind the same interface.
 */
import { SimDevice } from '../devices/sim/SimDevice';
import { Runtime } from '../runtime/interpreter';
import type { DriveConfig, Program } from '../ir/types';

export const device = new SimDevice();

let current: Runtime | null = null;

export function runProgram(
  program: Program,
  drive: DriveConfig,
  hooks: { onHighlight(id: string, on: boolean): void; onRunningChange(running: boolean): void },
): Promise<void> {
  current?.stop();
  device.reset();
  const rt = new Runtime(device, { drive, ...hooks });
  current = rt;
  return rt.run(program);
}

export function stopProgram() {
  current?.stop();
}
