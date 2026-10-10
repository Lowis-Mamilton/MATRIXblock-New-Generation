# MatrixblockLink firmware

Firmware that lets the MATRIXblock web app drive a MATRIX Mini R4 live over Bluetooth (tethered mode). Protocol: [ADR 0003](../docs/adr/0003-ble-protocol.md).

## First-time setup of a new board (once per board)

### 1. Install the tools (once per computer)
1. Install [Arduino IDE 2](https://www.arduino.cc/en/software).
2. **Tools → Board → Boards Manager**: install **Arduino UNO R4 Boards**.
3. **Tools → Manage Libraries**: install
   - **MatrixMiniR4** (by KKITC, 1.2.6 or later)
   - **ArduinoBLE** (2.x)

### 2. Check the lower (STM32) firmware is 6.0 or later
If the OLED shows `Firmware Outdated!` at power-on, update the lower firmware first with the previous MATRIXblock app (**File → Firmware Update**).

### 3. Flash MatrixblockLink
1. Connect the board over USB and switch the battery on.
2. Open `firmware/MatrixblockLink/MatrixblockLink.ino` in Arduino IDE.
3. Board: **Arduino UNO R4 WiFi**; Port: the board's COM port.
4. Click **Upload**.

The OLED then shows the board's name (for example `MXR4-5D3D`) and `Waiting for app...`. **Label the board with that name** so students can find it in the connection list.

### 4. If the OLED shows `BLE ERROR`
The ESP32 bridge firmware that provides Bluetooth is too old. In Arduino IDE choose **Tools → Firmware Updater**, select **Arduino UNO R4 WiFi**, install the latest version, then repeat step 3.

### 5. Connect
1. Turn on the computer's Bluetooth (Windows: Settings → Bluetooth & devices).
2. Open MATRIXblock in **Chrome or Edge** and click **Connect** (top right).
3. Pick the board's name in the list and click **Pair**.
4. Both LEDs blink green twice and the OLED shows `Connected`.

There is no need to pair the board in Windows settings; everything happens in the browser.

## Flashing with arduino-cli (handy for many boards)

```bash
arduino-cli core install arduino:renesas_uno
arduino-cli lib install MatrixMiniR4 ArduinoBLE
arduino-cli compile --fqbn arduino:renesas_uno:unor4wifi firmware/MatrixblockLink
arduino-cli upload  --fqbn arduino:renesas_uno:unor4wifi -p COM5 firmware/MatrixblockLink
```

Replace `COM5` with the board's port (`arduino-cli board list`).

## Troubleshooting

| Symptom | What to do |
|---|---|
| The board is missing from the connection list | Is the computer's Bluetooth on? Does the OLED say `Waiting for app...`? If it says `Connected`, another device holds it: power-cycle the board |
| Motors stop by themselves mid-program | The board stops for safety after 2.5 s without hearing from the app. Keep the tab open and stay within Bluetooth range |
| A "turn N degrees" block takes long to finish | Nothing is plugged into that port, or the motor is stalled; the board gives up after twice the expected time |
| You want to see what the board is doing | Open a serial monitor at 115200 baud: connections, disconnections and watchdog stops are logged |

## Safety behaviour
- When the link drops, every motor and the buzzer stop.
- The app sends a heartbeat every 300 ms (and whenever telemetry arrives); after 2.5 s without any frame the board stops every motor.

## Changing the protocol
Change `PROTOCOL_VERSION` in both `MatrixblockLink.ino` and `src/devices/ble/protocol.ts`. The app refuses boards with a different version and asks for a firmware update.

## Hardware test tools (`tools/`)

PC-side Python scripts that talk to a board directly over BLE, for bring-up and regression checks. Disconnect the web app first: a board accepts one connection at a time.

```bash
python -m venv .venv && .venv/Scripts/pip install -r firmware/tools/requirements.txt
.venv/Scripts/python firmware/tools/r4_check.py --motor 1 --empty-port 2   # protocol + hardware check (motors turn: lift the wheels)
.venv/Scripts/python firmware/tools/r4_soak.py COM6 300 idle               # stability soak: idle | spam | cycle
.venv/Scripts/python firmware/tools/serial_log.py COM6 r4.log              # keep a timestamped serial log
```
