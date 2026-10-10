# MATRIXblock New Generation

A web-based graphical programming environment (PWA) for the **MATRIX Mini R4** robot controller, with two block styles:

- **Icon blocks** — picture blocks that snap left to right; every value is picked from a grid. For beginners and younger students.
- **Word blocks** — text blocks that stack top to bottom, with variables, conditions and maths. For older students.

Programs run live from the browser: on a built-in simulator, or on a real R4 connected over Bluetooth.

**Live app:** https://lowis-mamilton.github.io/MATRIXblock-New-Generation/

## Documentation

- [docs/SPEC.md](docs/SPEC.md) — what the product does and why
- [docs/adr/](docs/adr) — architecture decisions (tethered IR interpreter, horizontal Icon renderer, BLE protocol)
- [firmware/README.md](firmware/README.md) — setting up a new R4 board and flashing the firmware

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run typecheck
npm run build      # dist/, including the service worker
```

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and deploys to GitHub Pages.

## Project layout

| Path | Contents |
|---|---|
| `src/ir/` | IR types and the compiler (Blockly JSON → IR, shared by both block modes) |
| `src/runtime/` | Async interpreter: threads, stop, wait-until, broadcast, block highlighting |
| `src/devices/` | `Device` interface; `sim/` virtual R4; `ble/` real R4 (protocol, `BleR4Device`, Web Bluetooth link) |
| `src/blocks/icon/` | Horizontal renderer, drop previewer, tap-to-pick field, Icon block definitions |
| `src/blocks/word/` | Word block definitions and toolbox |
| `src/blocks/setup.ts` | Blockly theme, toolboxes and per-mode workspace options |
| `src/app/` | React UI: top bar, editor host, project home, dialogs, app store, engine |
| `src/simulator/` | Simulator panel drawn on the R4 product image |
| `src/project/` | `.mbng` file format, project library (IndexedDB), import / export |
| `src/examples/` | Starter projects offered when creating a project |
| `src/i18n/` | All UI and block text (zh-TW, en) |
| `firmware/` | R4 tethered firmware (Arduino) and PC-side hardware test tools |
| `assets/` | Source artwork (logos, board image); `scripts/make_assets.py` regenerates the icons and board image in `public/` from it |

## Adding a block

1. Define it in `src/blocks/icon/blocks.ts` or `src/blocks/word/blocks.ts` and add it to that toolbox list.
2. Add its text and tooltip (`MB_TIP_<TYPE>`) in both languages in `src/i18n/strings.ts`.
3. Add a compile rule to `STATEMENTS` / `EXPRESSIONS` in `src/ir/compile.ts`; for a new kind of action, extend `src/ir/types.ts`, the interpreter and both devices.
4. Cover it in `src/ir/compile.test.ts`. `src/i18n/strings.test.ts` fails until the tooltip exists in every language.
