# ADR 0001: Tethered execution with an IR and an in-browser interpreter

**Status**: Accepted (2026-10-09)

## Context
The previous MATRIXblock turned blocks into Arduino C++ and flashed them with arduino-cli. That needs a toolchain on every computer, compiles slowly, and cannot give "press ▶ and it runs now" with the running block highlighted.

## Decision
- Blocks compile to a platform-neutral **IR** (a JSON command tree; every node carries its `blockId`). Icon and Word blocks compile to the same IR.
- An **async interpreter** in the browser runs the IR: several threads (one per hat block), stop, and block highlighting.
- The interpreter touches hardware only through the **Device interface**: `SimDevice` (simulator) and `BleR4Device` (Web Bluetooth + R4 firmware).

## Consequences
- The board must stay connected while a program runs, as with LEGO SPIKE and Coding Canvas.
- The R4 needs its own firmware and command protocol (ADR 0003).
- Blocks, IR and interpreter are unit-testable without hardware.
