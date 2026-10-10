# MATRIXblock New Generation — Specification

A new graphical programming environment for the **MATRIX Mini R4** robot controller. It follows the two block styles of LEGO Education's Coding Canvas — horizontal **Icon blocks** and vertical **Word blocks** — and offers a deliberately small, EV3-G-like set of blocks rather than the whole hardware library.

It is a ground-up rewrite. The previous MATRIXblock (Electron, blocks → Arduino C++ → compile and flash) is not reused; this one runs programs live from the browser (tethered mode).

## Product decisions

| Topic | Decision |
|---|---|
| Hardware | MATRIX Mini R4 (DC motors with encoders) |
| Execution | Tethered: the program runs in the browser and drives the board live over BLE |
| Platform | Web app + PWA. Chrome / Edge on Windows, macOS, Chromebook and Android. On iPad / iPhone every browser is WebKit without Web Bluetooth, so students use the **Bluefy** browser there; editing and the simulator also work in Safari |
| Stack | Vite + TypeScript + React + Blockly, custom renderer for horizontal Icon blocks |
| Block modes | Icon (left → right, younger students, palette along the bottom) and Word (top → bottom, older students, categories on the left). Chosen when a project is created; projects never convert between modes |
| Languages | i18n framework; Traditional Chinese (zh-TW) and English |
| Simulator | Virtual R4 drawn on the product image: motor speed/angle, servo angle, 2 LEDs, buzzer, OLED, up/down buttons; sensors set with controls |
| Storage | Projects in IndexedDB ("My projects"), plus `.mbng` (JSON) import / export. No accounts |
| Look | MATRIX brand palette and logo, own SVG icons. Layout inspired by LEGO, not copied |
| Brand colours | Primary `#2E5690`, logo `#195197`, accent `#6EC9EF`, secondary `#97ABC8`, light `#CBD5E3`, ink `#1D1D36`, light background `#F2F1FF`. Fonts: Montserrat + Noto Sans TC |
| Connection | BLE only (Web Bluetooth) |
| Hosting | GitHub Pages, personal account `Lowis-Mamilton`, repo `MATRIXblock-New-Generation` (https://lowis-mamilton.github.io/MATRIXblock-New-Generation/); to be merged into the company website later |

## Blocks

### Icon blocks (horizontal)
Every parameter is chosen from a tap-to-pick grid with a small fixed range: seconds 1–10, speed slow / medium / fast, repeat 1–10.

- **Events**: ▶ start; up button pressed; down button pressed
- **Movement**: drive forward / backward / left / right for N seconds; stop. Wheel ports come from Settings (default M1 left, M2 right)
- **Motors**: one motor for N seconds (port, direction, speed); servo to an angle
- **Control**: wait N seconds; repeat N times; forever
- **Sensors**: wait until (up / down button, object near, a colour)
- **Light & sound**: LED colour (LED 1, LED 2 or both); play a note

Icon sensor blocks read the colour / distance sensor on the I2C ports chosen in Settings (default colour I2C1, distance I2C2).

### Word blocks (vertical)
Everything Icon blocks can do, plus:

- **Movement**: steering move and tank move, for seconds / rotations / degrees, or start-and-continue; stop (brake / coast)
- **Motors**: run for an amount, start, stop, reset angle, read angle; servo
- **Control**: if / if-else, wait until ⟨condition⟩, repeat until, stop all
- **Sensors**: colour, "sees colour?", distance (each with an I2C port), tilt (pitch / roll / yaw), button (up / down)
- **Operators**: arithmetic, comparison, and / or / not, random
- **Variables**: create, set, change
- **Events**: start, button, broadcast / when I receive (multiple threads)

Out of scope: lists, My Blocks, OLED, joystick, HuskyLens, M-Vision, 2D driving-field simulation (deferred).

### Hardware covered
Outputs: DC motors M1–M4, servos RC1–RC4, two RGB LEDs, buzzer. Inputs: up / down buttons, IMU, colour sensor (MXColor / V3) and laser distance sensor (MXLaser / V2) on I2C1–I2C4. The firmware detects which sensor model is plugged into each port.

## Architecture

```
Blockly workspace ──compile──► IR (JSON command tree) ──► Interpreter (async, threads, highlight, stop)
                                                                │
                                                          Device interface
                                                ┌───────────────┴───────────────┐
                                           SimDevice                        BleR4Device ── BLE ── R4 firmware
```

- [ADR 0001](adr/0001-tethered-ir-interpreter.md) — tethered execution, IR and in-browser interpreter
- [ADR 0002](adr/0002-horizontal-icon-renderer.md) — horizontal Icon block renderer
- [ADR 0003](adr/0003-ble-protocol.md) — web ↔ R4 BLE protocol

## Behaviour notes

- When every thread has finished (and no button hat is waiting), the program ends and all motors stop, as on LEGO SPIKE.
- Motors run closed-loop (`setSpeed`). Degree / rotation moves use the library's `rotateFor` on the board and finish with a DONE message; a move on a stalled or unplugged motor gives up after twice the expected time + 1.5 s.
- Safety: the board stops every motor when the link drops or when the app is silent for 2.5 s.
- Each board advertises as `MXR4-` + the last 4 hex digits of its address, shows that name on its OLED, and blinks both LEDs green when an app connects.
- While a board is connected, ▶ runs on the board and the simulator panel switches to live readings; otherwise programs run on the simulator.

## Project tools

- Six starter examples (Icon: dancing robot, stop at obstacles, traffic light; Word: square route, patrol, button counter)
- Undo / redo buttons, block tooltips in both modes, tablet-sized touch targets
