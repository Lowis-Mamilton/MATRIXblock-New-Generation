"""Hardware check for the MatrixblockLink firmware, run from a PC over BLE.

Exercises the same protocol the web app uses: handshake, telemetry, LED,
buzzer, a degree move on a motor with an encoder, the timeout guard on a port
without a motor, a servo, and the watchdog. Motors turn, so lift the wheels.

usage: python r4_check.py [--motor 1] [--empty-port 2] [--telemetry-only]
"""
import argparse
import asyncio
import struct
import time

from bleak import BleakClient, BleakScanner

RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
WATCHDOG_S = 2.5

state = {"motors": None, "imu": None, "ports": None, "done": set(), "info": None, "frames": 0}
_seq = 0


def next_seq():
    global _seq
    _seq = _seq % 255 + 1
    return _seq


def on_notify(_, data: bytearray):
    state["frames"] += 1
    t = data[0]
    if t == 0x80:
        state["motors"] = (struct.unpack_from("<4i", data, 2), data[18], data[19])
    elif t == 0x81:
        p, r, y = struct.unpack_from("<3h", data, 2)
        state["imu"] = (p / 100, r / 100, y / 100, data[8])
    elif t == 0x82:
        state["ports"] = [(data[2 + i * 3], struct.unpack_from("<H", data, 3 + i * 3)[0]) for i in range(4)]
    elif t == 0x90:
        state["done"].add(data[2])
    elif t == 0x91:
        state["info"] = (data[2], f"{data[3]}.{data[4]}.{data[5]}")


def angle(port):
    return state["motors"][0][port - 1]


async def wait_done(seq, timeout=8.0):
    t0 = time.time()
    while seq not in state["done"] and time.time() - t0 < timeout:
        await asyncio.sleep(0.02)
    return seq in state["done"], time.time() - t0


async def main(args):
    print("scanning...")
    devices = await BleakScanner.discover(timeout=8.0)
    board = next((d for d in devices if (d.name or "").startswith("MXR4-")), None)
    if not board:
        print("FAIL: no MXR4-* board advertising")
        return 1
    print("found", board.name, board.address)
    ok = True

    async with BleakClient(board) as c:
        await c.start_notify(TX, on_notify)

        async def send(*b):
            await c.write_gatt_char(RX, bytes(b), response=False)

        beating = {"on": True}

        async def heartbeat():
            while True:
                if beating["on"]:
                    await send(0x02, 0)
                await asyncio.sleep(0.3)

        hb = asyncio.create_task(heartbeat())
        await send(0x01, next_seq())
        await asyncio.sleep(1.5)
        print("info (protocol, firmware):", state["info"])
        print("telemetry frames in 1.5 s:", state["frames"])
        print("motors (angles, busy, buttons):", state["motors"])
        print("imu (pitch, roll, yaw, battery%):", state["imu"])
        print("ports (kind, value):", state["ports"])
        ok &= state["info"] is not None and state["frames"] > 20
        if args.telemetry_only:
            hb.cancel()
            return 0 if ok else 1

        print("LED red + 880 Hz beep")
        await send(0x21, next_seq(), 3, 255, 0, 0)
        await send(0x22, next_seq(), *struct.pack("<HH", 880, 200))
        await asyncio.sleep(0.6)
        await send(0x21, next_seq(), 3, 0, 0, 0)

        m = args.motor
        a0 = angle(m)
        s = next_seq()
        await send(0x11, s, m, 40, *struct.pack("<I", 360))
        done, took = await wait_done(s)
        await asyncio.sleep(0.2)
        moved = angle(m) - a0
        print(f"M{m} 360 deg @40%: done={done} in {took:.2f}s, moved {moved} deg")
        ok &= done and abs(moved - 360) < 30

        s = next_seq()
        await send(0x11, s, args.empty_port, 50, *struct.pack("<I", 90))
        done, took = await wait_done(s)
        print(f"M{args.empty_port} (no motor) 90 deg: done={done} in {took:.2f}s (timeout guard)")
        ok &= done

        await send(0x20, next_seq(), 1, 45)
        await asyncio.sleep(0.5)
        await send(0x20, next_seq(), 1, 90)
        print("servo RC1 45 -> 90 sent (check by eye)")

        await send(0x10, next_seq(), m, 40)
        await asyncio.sleep(0.4)
        beating["on"] = False
        await asyncio.sleep(WATCHDOG_S + 0.5)
        a1 = angle(m)
        await asyncio.sleep(0.5)
        stopped = abs(angle(m) - a1) < 5
        print(f"watchdog stops M{m} after {WATCHDOG_S}s of silence: {stopped}")
        ok &= stopped
        beating["on"] = True
        await send(0x2F, next_seq())
        hb.cancel()

    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--motor", type=int, default=1, help="motor port with an encoder motor")
    ap.add_argument("--empty-port", type=int, default=2, help="motor port with nothing plugged in")
    ap.add_argument("--telemetry-only", action="store_true", help="no motors, LEDs or sound")
    raise SystemExit(asyncio.run(main(ap.parse_args())))
