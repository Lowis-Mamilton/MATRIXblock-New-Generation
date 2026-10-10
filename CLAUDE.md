# MATRIXblock New Generation

Web PWA (Vite + React + TypeScript + Blockly) for programming the MATRIX Mini R4 with Icon (horizontal) and Word (vertical) blocks. Programs run in the browser, on a simulator or on a BLE-connected R4. Product spec: `docs/SPEC.md`. Architecture decisions: `docs/adr/`.

## Architecture boundaries

Blockly JSON → `src/ir/compile.ts` → IR (`src/ir/types.ts`) → `src/runtime/interpreter.ts` → `Device` (`SimDevice` | `BleR4Device`).

- `src/ir/` and `src/runtime/` stay free of Blockly and the DOM: the compiler works on serialized workspace JSON, so both are unit-tested in Node.
- Hardware is reached only through the `Device` interface (`src/devices/Device.ts`); the UI watches a board through `ObservableDevice.snapshot()`.
- Icon blocks use the custom renderer of ADR 0002: fields only, no value inputs. Re-test Icon mode in the browser after any Blockly upgrade.

## Conventions

- All user-facing text lives in `src/i18n/strings.ts` (zh-TW first, en). Block JSON references it as `%{BKY_KEY}`. Every `i_` / `w_` block needs an `MB_TIP_<TYPE>` tooltip in every language; `strings.test.ts` enforces it.
- Adding a block: follow "Adding a block" in `README.md`.
- Docs and code comments are in English; the UI is bilingual.
- Changing the BLE protocol: bump `PROTOCOL_VERSION` in both `firmware/MatrixblockLink/MatrixblockLink.ino` and `src/devices/ble/protocol.ts`, and update ADR 0003.
- Before committing: `npm test`, `npm run typecheck`, `npm run build`; for firmware changes also `arduino-cli compile --fqbn arduino:renesas_uno:unor4wifi firmware/MatrixblockLink`.

## Gotchas

- The user often keeps `npm run dev` running. Vite can cache a module it read while the file was half-written and then serves it empty ("does not provide an export named …"). Write each file in one operation; if it happens, `touch` the affected files and reload.
- Git Bash rewrites `BASE_PATH=/x/` into a Windows path. Test the Pages build with `MSYS_NO_PATHCONV=1 BASE_PATH=/MATRIXblock-New-Generation/ npm run build`.
- Dev builds expose `window.__mbWorkspace` and `window.__mbBlockly` for driving the editor from browser devtools.
- The Web Bluetooth device chooser never appears in automation-launched Chrome. Real BLE tests need the user's own Chrome (they click Pair) or the Python tools in `firmware/tools/`.
- Chrome throttles timers in background tabs to about once a second, so BLE timing must not rely on `setInterval` alone (see the heartbeat note in ADR 0003).

## Hardware (MATRIX Mini R4)

- Ask the user before anything makes motors move (battery on, wheels lifted).
- Flash with `arduino-cli upload --fqbn arduino:renesas_uno:unor4wifi -p <COM> firmware/MatrixblockLink`; uploading resets the board and drops its BLE link.
- A board accepts one BLE connection at a time: the web app must be disconnected before running `firmware/tools/` scripts.
- The sketch reaches the STM32 over software serial at ~5 ms per `mmL` call, so telemetry reads one value per `loop()` pass. On STM32 firmware 6.00 `GetButtonsState` always fails; read buttons with `GetButtonState(1)` (down) and `GetButtonState(2)` (up).
- The USB port is provided by the ESP32 bridge; when the board's COM port vanishes, the board was unplugged or the bridge reset.
