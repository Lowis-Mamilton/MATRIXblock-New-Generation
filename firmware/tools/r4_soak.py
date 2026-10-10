"""Stability soak test for the MatrixblockLink firmware.

Connects over BLE like the web app (HELLO, heartbeat every 300 ms) and watches
telemetry while the board's USB serial log is captured alongside. Fails (RED)
when telemetry stops for > 2.5 s, the link drops, or a reconnect fails.

Modes:
  idle   connected, heartbeats only
  spam   heartbeats plus LED / buzzer / servo / motor commands every 300 ms
  cycle  connect + disconnect SECONDS times

usage: python r4_soak.py COMPORT SECONDS [idle|spam|cycle]
"""
import asyncio
import collections
import sys
import threading
import time

import serial
from bleak import BleakClient, BleakScanner

RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
port, duration = sys.argv[1], float(sys.argv[2])
mode = sys.argv[3] if len(sys.argv) > 3 else "idle"

log = collections.deque(maxlen=40)
stop = threading.Event()
t_start = time.time()


def serial_reader():
    while not stop.is_set():
        try:
            with serial.Serial(port, 115200, timeout=0.3) as s:
                while not stop.is_set():
                    line = s.readline()
                    if line:
                        log.append(f"{time.time() - t_start:7.2f} {line.decode(errors='replace').rstrip()}")
        except serial.SerialException:
            time.sleep(0.3)


async def main():
    threading.Thread(target=serial_reader, daemon=True).start()
    board = None
    for _ in range(3):
        devices = await BleakScanner.discover(timeout=6.0)
        board = next((d for d in devices if (d.name or "").startswith("MXR4-")), None)
        if board:
            break
    if not board:
        print("RED: board not advertising (boot hang?)")
        return 1
    if mode == "cycle":
        for k in range(int(duration)):
            try:
                async with BleakClient(board, timeout=10) as c:
                    await c.start_notify(TX, lambda *_: None)
                    await c.write_gatt_char(RX, bytes([0x01, 1]), response=False)
                    await c.write_gatt_char(RX, bytes([0x21, 2, 3, 0, 0, 255]), response=False)
                    await asyncio.sleep(1.0)
            except Exception as e:
                print(f"RED: connect #{k + 1} failed: {e!r}")
                await asyncio.sleep(1.5)
                stop.set()
                for line in list(log)[-25:]:
                    print(line)
                return 1
            await asyncio.sleep(0.5)
        print(f"GREEN: {int(duration)} connect/disconnect cycles")
        await asyncio.sleep(1.0)
        stop.set()
        for line in list(log)[-8:]:
            print(line)
        return 0
    last = {"t": time.time(), "frames": 0}
    dropped = asyncio.Event()

    def on_notify(_, data):
        last["t"] = time.time()
        last["frames"] += 1

    async with BleakClient(board, disconnected_callback=lambda _: dropped.set()) as c:
        await c.start_notify(TX, on_notify)
        await c.write_gatt_char(RX, bytes([0x01, 1]), response=False)
        print(f"connected to {board.name}; idling for {duration:.0f}s")
        verdict = "GREEN"
        t0 = time.time()
        max_gap = 0.0
        k = 0
        while time.time() - t0 < duration:
            await c.write_gatt_char(RX, bytes([0x02, 0]), response=False)
            if mode == "spam":
                k += 1
                colours = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (160, 0, 255)]
                r, g, b = colours[k % 4]
                await c.write_gatt_char(RX, bytes([0x21, k % 255 + 1, 1 + k % 3, r, g, b]), response=False)
                await c.write_gatt_char(RX, bytes([0x22, 2, 0xB8, 0x01, 0x64, 0x00]), response=False)
                await c.write_gatt_char(RX, bytes([0x20, 3, 1, 45 + (k % 2) * 90]), response=False)
                await c.write_gatt_char(RX, bytes([0x10, 4, 1, 30 if k % 2 else 0]), response=False)
            await asyncio.sleep(0.3)
            gap = time.time() - last["t"]
            max_gap = max(max_gap, gap)
            if dropped.is_set():
                verdict = f"RED: link dropped after {time.time() - t0:.1f}s"
                break
            if gap > 2.5:
                verdict = f"RED: telemetry stopped for {gap:.1f}s after {time.time() - t0:.1f}s"
                break
        print(verdict, f"| frames={last['frames']} maxGap={max_gap:.2f}s")
    await asyncio.sleep(1.5)
    stop.set()
    print("--- last serial lines ---")
    for line in list(log)[-25:]:
        print(line)
    return 0 if verdict == "GREEN" else 1


sys.exit(asyncio.run(main()))
