# MATRIXblock Link 韌體

讓 MATRIXblock 網頁用藍牙即時控制 MATRIX Mini R4 的韌體（tethered 模式）。協定見 [ADR 0003](../docs/adr/0003-ble-protocol.md)。

## 新控制器第一次設定（每塊板子做一次）

### 1. 安裝工具（電腦只要裝一次）
1. 安裝 [Arduino IDE 2](https://www.arduino.cc/en/software)。
2. **工具 → 開發板 → 開發板管理員**，搜尋並安裝 **Arduino UNO R4 Boards**。
3. **工具 → 管理程式庫**，搜尋並安裝：
   - **MatrixMiniR4**（作者 KKITC，1.2.6 以上）
   - **ArduinoBLE**（2.x）

### 2. 確認下層韌體（STM32）是 6.0 以上
板子開機時如果 OLED 顯示 `Firmware Outdated!`，請先用舊版 MATRIXblock 的「檔案 → 韌體更新」更新下層韌體，再繼續。

### 3. 燒錄 MatrixblockLink
1. 用 USB 線接上板子，打開電池開關。
2. 用 Arduino IDE 開啟 `firmware/MatrixblockLink/MatrixblockLink.ino`。
3. 開發板選 **Arduino UNO R4 WiFi**，連接埠選板子出現的 COM 埠。
4. 按 **上傳**（→）。

上傳完成後，OLED 會顯示這塊板子的名字（例如 `MXR4-5D3D`）和 `Waiting for app...`。**把名字貼在板子上**，學生連線時比較好找。

### 4. 如果 OLED 顯示 `BLE ERROR`
代表負責藍牙的 ESP32 橋接韌體太舊。在 Arduino IDE 選 **工具 → Firmware Updater**，選 **Arduino UNO R4 WiFi**，安裝最新版，再回到第 3 步重新上傳。

### 5. 連線
1. 確認電腦的**藍牙已開啟**（Windows：設定 → 藍牙與裝置）。
2. 用 **Chrome 或 Edge** 打開 MATRIXblock，按右上角 **連線**。
3. 在跳出的清單選這塊板子的名字，按 **配對**。
4. 板子 LED 閃兩下綠燈、OLED 顯示 `Connected` 就完成了。

不需要先在 Windows 的藍牙設定裡配對，全部在瀏覽器裡完成。

## 用 arduino-cli 燒錄（適合一次燒很多塊）
```bash
arduino-cli core install arduino:renesas_uno
arduino-cli lib install MatrixMiniR4 ArduinoBLE
arduino-cli compile --fqbn arduino:renesas_uno:unor4wifi firmware/MatrixblockLink
arduino-cli upload  --fqbn arduino:renesas_uno:unor4wifi -p COM5 firmware/MatrixblockLink
```
把 `COM5` 換成板子的序列埠（`arduino-cli board list` 可以查）。

## 疑難排解
| 現象 | 處理 |
|---|---|
| 連線清單找不到板子 | 電腦藍牙有沒有開？OLED 是否顯示 `Waiting for app...`？若顯示 `Connected`，代表被別的裝置連著，重開板子 |
| 程式跑到一半馬達自己停 | 板子 2.5 秒沒收到網頁訊號就會停車保護。網頁分頁請保持開著；藍牙距離太遠也會發生 |
| 轉角度的積木等很久才往下走 | 那個埠沒接馬達或馬達卡住；板子會在預估時間的 2 倍後放棄並繼續 |
| 想看板子內部訊息 | 用序列埠監控（115200 baud），會印出連線、斷線、看門狗等紀錄 |

## 使用
1. 板子開機後，OLED 顯示板子名稱（例如 `MXR4-3F2A`）和 `Waiting for app...`。
2. 在 MATRIXblock 網頁按「連線」，選擇同名的板子。
3. 連上後兩顆 LED 會閃綠燈兩下，OLED 顯示 `Connected`。

## 安全機制
- 斷線時立刻停下所有馬達與蜂鳴器。
- 網頁每 300 ms 送一次心跳（收到板子回報時也會補送）；板子超過 2.5 秒沒收到任何指令就自動停車。

## 改協定時
同時修改 `MatrixblockLink.ino` 的 `PROTOCOL_VERSION` 和網頁端 `src/devices/ble/protocol.ts` 的 `PROTOCOL_VERSION`，網頁會擋下版本不符的板子並提示更新韌體。
