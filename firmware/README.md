# MATRIXblock Link 韌體

讓 MATRIXblock 網頁用藍牙即時控制 MATRIX Mini R4 的韌體（tethered 模式）。協定見 [ADR 0003](../docs/adr/0003-ble-protocol.md)。

## 需要
- Arduino IDE 2 或 arduino-cli
- 開發板套件：**Arduino UNO R4 Boards**（`arduino:renesas_uno`）
- 函式庫：**MatrixMiniR4**（1.2.6 以上）、**ArduinoBLE**（2.x）
- R4 的 WiFi/BLE 橋接晶片（ESP32-S3）韌體要支援 BLE；如果開機後 OLED 顯示 `BLE ERROR`，請先用 Arduino IDE 的「Firmware Updater」更新 UNO R4 WiFi 的橋接韌體。

## 燒錄（arduino-cli）
```bash
arduino-cli compile --fqbn arduino:renesas_uno:unor4wifi firmware/MatrixblockLink
arduino-cli upload  --fqbn arduino:renesas_uno:unor4wifi -p COM5 firmware/MatrixblockLink
```
把 `COM5` 換成板子的序列埠（`arduino-cli board list` 可以查）。

用 Arduino IDE 的話：開啟 `firmware/MatrixblockLink/MatrixblockLink.ino`，開發板選 **Arduino UNO R4 WiFi**，按「上傳」。

## 使用
1. 板子開機後，OLED 顯示板子名稱（例如 `MXR4-3F2A`）和 `Waiting for app...`。
2. 在 MATRIXblock 網頁按「連線」，選擇同名的板子。
3. 連上後兩顆 LED 會閃綠燈兩下，OLED 顯示 `Connected`。

## 安全機制
- 斷線時立刻停下所有馬達與蜂鳴器。
- 網頁每 300 ms 送一次心跳；超過 1 秒沒收到任何指令就自動停車。

## 改協定時
同時修改 `MatrixblockLink.ino` 的 `PROTOCOL_VERSION` 和網頁端 `src/devices/ble/protocol.ts` 的 `PROTOCOL_VERSION`，網頁會擋下版本不符的板子並提示更新韌體。
