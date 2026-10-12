# ADR 0003: Web ↔ R4 BLE protocol

**Status**: Accepted (2026-10-10), verified on hardware. Protocol 2 (2026-10-12) adds gesture, D / A port and ultrasonic telemetry; not yet verified on hardware.

## Context
In tethered mode the web interpreter drives a MATRIX Mini R4 live over BLE and the board streams sensor values back.

How the R4 divides the work:
- **RA4M1** runs the Arduino sketch and the ArduinoBLE host stack.
- **ESP32-S3** is the BLE controller (and the USB bridge). The RA4M1 talks to it with AT commands over a 115200-baud UART.
- **STM32** owns motors, encoders, servos, IMU and buttons. The RA4M1 calls it over a 57600-baud software serial link; each call takes about 5 ms.

The old MATRIXblock already used the Nordic UART Service (NUS).

## Decision

### Transport
- NUS service `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`:
  - RX `…0002`: written by the web app (Write / Write Without Response)
  - TX `…0003`: notified by the board
- **One frame per BLE packet, at most 20 bytes**, so no MTU negotiation is needed.
- Frame: `[type:u8][seq:u8][payload…]`, little-endian.
- Boards advertise as `MXR4-XXXX` (last 4 hex digits of the address); the web app filters on `namePrefix: 'MXR4-'`.

### Web → board (commands)
| type | name | payload | reply |
|---|---|---|---|
| 0x01 | HELLO | — | INFO |
| 0x02 | HEARTBEAT | — | — |
| 0x10 | MOTOR_RUN | port u8, speed i8 | — |
| 0x11 | MOTOR_RUN_DEG | port u8, speed i8, degrees u32 | DONE when finished |
| 0x13 | MOTOR_STOP | port u8, mode u8 (0 brake / 1 coast) | — |
| 0x14 | MOTOR_RESET | port u8 | — |
| 0x20 | SERVO | port u8, angle u8 | — |
| 0x21 | LED | which u8 (1 / 2 / 3 = both), r u8, g u8, b u8 | — |
| 0x22 | TONE | freq u16, ms u16 | — |
| 0x23 | NO_TONE | — | — |
| 0x2F | HALT | — | — |
| 0x30 | IO_MODE | ultrasonic mask u8 (bit 0 = D1) | — |

- Moves measured in seconds are timed by the web app: RUN, then STOP when the time is up.
- Moves measured in degrees / rotations run on the board (`rotateFor`) and end with DONE. When several motors move together, the degrees are shared out by speed so they finish together.
- A degree move that never ends (unplugged or stalled motor) is abandoned after 2 × the expected time + 1.5 s: the board brakes and sends DONE.
- Port numbers: motors 1–4, servos 1–4, I2C 1–4, D 1–4.
- D ports are digital inputs until IO_MODE marks them as ultrasonic. The web app sends IO_MODE the first time a program reads an ultrasonic distance on a port (and again if a program reads that port as digital), so the first read returns "far away" (999 cm) until telemetry arrives. The mask resets to 0 on disconnect.

### Board → web
| type | name | payload |
|---|---|---|
| 0x80 | T_MOTORS | 4 × encoder degrees i32, busy mask u8, buttons u8 (bit0 up, bit1 down) |
| 0x81 | T_IMU | pitch, roll, yaw i16 (0.01°), battery % u8 |
| 0x82 | T_PORTS | 4 × (kind u8, value u16); kind 0 none / 1 colour (value = colour code) / 2 distance (value = mm) / 3 gesture (value = gesture code) |
| 0x83 | T_IO | D1–D4 levels u8 (bit 0 = D1), A1–A3 u16 (0–1023), D1–D4 ultrasonic mm u16 (0xFFFF = not measuring / no echo) |
| 0x90 | DONE | seq u8 of the finished command |
| 0x91 | INFO | protocol version u8, firmware version major / minor / patch u8 |

- T_MOTORS every 50 ms, T_IMU every 100 ms, T_IO every 100 ms, T_PORTS every 200 ms. STM32 values are read one per loop pass, round robin, so `BLE.poll()` stays responsive.
- The firmware probes I2C1–I2C4 every 2 s and detects plugged / unplugged sensors.
- Colour codes: 0 none, 1 black, 2 white, 3 red, 4 yellow, 5 green, 6 blue (the order of `SENSOR_COLORS` in the IR).
- Gesture codes: 0 none, 1 up, 2 down, 3 left, 4 right, 5 forward (towards), 6 backward (away), 7 clockwise, 8 anticlockwise, 9 wave (the order of `GESTURES` in the IR). The PAJ7620 reports a gesture once, so the firmware keeps reporting it for 1 s. It reads the flag registers directly: the library's `getGesture()` waits up to 2 s to tell gestures apart, which would stall `BLE.poll()`.
- Ultrasonic: one port measured every 60 ms, round robin. `pulseIn` blocks for up to ~27 ms when nothing echoes.
- The web app drops telemetry frames shorter than their type's length.

### Safety
- When the link drops, the board stops every motor and the buzzer.
- Watchdog: the web app sends HEARTBEAT every 300 ms; the board halts after 2500 ms without any frame.
  - Chrome throttles timers in background or occluded tabs to about once a second. On real hardware this tripped a 1 s watchdog every 2–3 s, so the web app also sends a heartbeat whenever telemetry arrives and its last frame is ≥ 300 ms old (Bluetooth events are not throttled).

### Versioning
- `PROTOCOL_VERSION = 2`, defined in both `firmware/MatrixblockLink/MatrixblockLink.ino` and `src/devices/ble/protocol.ts`. The app sends HELLO on connect; if INFO reports a different protocol it disconnects and asks for a firmware update.

### Hardware findings
- With STM32 firmware 6.00, `GetButtonsState` (both buttons at once) always fails, and its timeouts corrupted the reads after it. The firmware reads each button with `GetButtonState`.
- A TT motor turns about 7.6°/s per 1 % speed (≈ 760°/s at 100 %); the simulator uses the same figure.

## Consequences
- Sensor values are the latest telemetry, up to ~50–200 ms old; reads never wait, matching the synchronous reads of the `Device` interface.
- Every frame fits in 20 bytes, so any MTU works.
- Tethered mode and the planned BLE bootloader (DFU on the ESP32) share one BLE controller; switching between them is left for when DFU exists.
