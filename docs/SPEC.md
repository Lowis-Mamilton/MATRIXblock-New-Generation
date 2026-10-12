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
- **Sensors** (10 kinds):
  - I2C1–I2C4: colour sensor (colour, "sees colour?"), laser distance, gesture sensor ("sees gesture?": up / down / left / right / towards / away / clockwise / anticlockwise / wave; a gesture reads as seen for 1 s)
  - D1–D4: ultrasonic distance (cm), digital sensor "triggered?" (micro switch, PIR…)
  - A1–A3: analog sensor value 0–1023 (grayscale, potentiometer, soil moisture, water level…)
  - On board: tilt (pitch / roll / yaw), button (up / down), battery level (%)
  - Timer: seconds since start or the last "reset timer"
- **Operators**: arithmetic, comparison, and / or / not, random
- **Variables**: create, set, change
- **Events**: start, button, broadcast / when I receive (multiple threads)

Out of scope: lists, My Blocks, OLED, joystick, HuskyLens, M-Vision, 2D driving-field simulation (deferred).

### Hardware covered
Outputs: DC motors M1–M4, servos RC1–RC4, two RGB LEDs, buzzer. Inputs: up / down buttons, IMU, battery, colour sensor (MXColor / V3), laser distance sensor (MXLaser / V2) and gesture sensor (MXGesture) on I2C1–I2C4; ultrasonic sensors (HC-SR04 type) or digital sensors on D1–D4; analog sensors on A1–A3. The firmware detects which I2C sensor is plugged into each port; D ports are digital inputs until a program reads an ultrasonic distance there.

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

## Layout and responsiveness

- **Supported sizes**: full editing on tablets (portrait and landscape) and computers; phones can open, view and make small edits.
- **Top bar**: logo, project name, undo / redo, then Connect, ▶ and ■. Everything else (My projects, New, Open, Save, Settings, Language) lives in one ☰ menu.
- **Simulator**: a side panel on wide screens (≥ 1100 px, open by default, collapsible). On narrower screens it becomes a bottom sheet: a slim status bar is always visible (mode, LEDs, running state) and expands to show the board.
- **Simulator content**: the board image first; sensor controls in a collapsible "Sensors" section, closed by default.
- **Block categories**: a round coloured icon with a label for each category — along the bottom in Icon mode, as a left rail in Word mode.
- **Visual direction**: keep the navy top bar for brand recognition; everything else airy, with few lines and shadows.

## Project tools

- Six starter examples (Icon: dancing robot, stop at obstacles, traffic light; Word: square route, patrol, button counter)
- Undo / redo buttons, block tooltips in both modes, tablet-sized touch targets
