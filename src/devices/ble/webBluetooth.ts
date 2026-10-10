/** BoardLink over Web Bluetooth (Nordic UART Service). */
import type { BoardLink } from './BleR4Device';
import { NAME_PREFIX, NUS_RX, NUS_SERVICE, NUS_TX } from './protocol';

export const bluetoothAvailable = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator;

/** Ask the user to pick a board, then open the link. Rejects with NotFoundError if they cancel. */
export async function connectWebBluetooth(): Promise<BoardLink> {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: NAME_PREFIX }],
    optionalServices: [NUS_SERVICE],
  });
  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(NUS_SERVICE);
  const rx = await service.getCharacteristic(NUS_RX);
  const tx = await service.getCharacteristic(NUS_TX);
  await tx.startNotifications();

  // GATT allows one operation at a time, so writes go through a queue.
  let queue: Promise<void> = Promise.resolve();
  const canSkipResponse = rx.properties.writeWithoutResponse;
  const listeners: { message?: (d: DataView) => void; disconnect?: () => void } = {};

  tx.addEventListener('characteristicvaluechanged', (e) => {
    const value = (e.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) listeners.message?.(value);
  });
  device.addEventListener('gattserverdisconnected', () => listeners.disconnect?.());

  return {
    name: device.name ?? NAME_PREFIX,
    send(frame) {
      const data = new Uint8Array(frame);
      queue = queue
        .catch(() => {})
        .then(() => (canSkipResponse ? rx.writeValueWithoutResponse(data) : rx.writeValueWithResponse(data)));
      return queue;
    },
    onMessage: (cb) => (listeners.message = cb),
    onDisconnect: (cb) => (listeners.disconnect = cb),
    disconnect: () => device.gatt?.disconnect(),
  };
}
