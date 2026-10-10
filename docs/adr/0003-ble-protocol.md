# ADR 0003：網頁 ↔ R4 的 BLE 協定

**狀態**：提議（2026-10-10）

## 背景
Tethered 模式下，網頁的直譯器透過 BLE 即時控制 MATRIX Mini R4，板子回傳感測器數值。

R4 的硬體分工：
- RA4M1 跑 Arduino 程式和 ArduinoBLE 主機端
- ESP32-S3 是 BLE 控制器
- STM32 負責馬達、編碼器、伺服、IMU、按鈕，RA4M1 透過 57600 baud 序列埠呼叫它

舊版 MATRIXblock 已用過 Nordic UART Service（NUS）。

## 決策

### 傳輸
- 使用 NUS：服務 `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
  - RX `…0002`：網頁寫入，Write / Write Without Response
  - TX `…0003`：板子 Notify
- **一個 BLE 封包就是一個 frame，最多 20 bytes**，不依賴 MTU 協商
- Frame 格式：`[type:u8][seq:u8][payload…]`，多位元組數值一律 little-endian
- 板子廣播名稱 `MXR4-XXXX`（MAC 末 4 碼）；網頁用 `namePrefix: 'MXR4-'` 篩選

### 網頁 → 板子（指令）
| type | 名稱 | payload | 回覆 |
|---|---|---|---|
| 0x01 | HELLO | — | INFO |
| 0x02 | HEARTBEAT | — | — |
| 0x10 | MOTOR_RUN | port u8, speed i8 | — |
| 0x11 | MOTOR_RUN_DEG | port u8, speed i8, degrees u32 | DONE（轉完時） |
| 0x13 | MOTOR_STOP | port u8, mode u8（0 煞車 / 1 滑行） | — |
| 0x14 | MOTOR_RESET | port u8 | — |
| 0x20 | SERVO | port u8, angle u8 | — |
| 0x21 | LED | which u8（1 / 2 / 3=全部）, r u8, g u8, b u8 | — |
| 0x22 | TONE | freq u16, ms u16 | — |
| 0x23 | NO_TONE | — | — |
| 0x2F | HALT | — | — |

說明：
- 以秒計時的動作由網頁端計時：先送 RUN，時間到再送 STOP。
- 以角度 / 圈數計的動作交給韌體的 `rotateFor`，轉完回 DONE。
- 多顆馬達同時轉角度時，各馬達的角度依速度比例分配，讓它們同時完成。
- port 編號：馬達 1–4、伺服 1–4、I2C 1–4。

### 板子 → 網頁
| type | 名稱 | payload |
|---|---|---|
| 0x80 | T_MOTORS | 4 × 編碼器角度 i32, busy mask u8, buttons u8（bit0 上, bit1 下） |
| 0x81 | T_IMU | pitch, roll, yaw i16（單位 0.01°）, battery % u8 |
| 0x82 | T_PORTS | 4 × (kind u8, value u16)，kind：0 無 / 1 顏色（value=顏色代碼）/ 2 距離（value=mm） |
| 0x90 | DONE | 對應指令的 seq u8 |
| 0x91 | INFO | 協定版本 u8, 韌體版本 major/minor/patch u8 |

- 回報頻率：T_MOTORS、T_IMU、T_PORTS 各每秒 20 次。
- I2C 埠上接了什麼感測器，由韌體每 2 秒掃描一次自動偵測，支援熱插拔。
- 顏色代碼：0 無、1 黑、2 白、3 紅、4 黃、5 綠、6 藍（與 IR 的 `SENSOR_COLORS` 順序一致）。

### 安全
- 斷線時，板子立刻停下所有馬達、關掉蜂鳴器。
- 看門狗：網頁每 300 ms 送一次 HEARTBEAT；板子超過 1000 ms 沒收到任何 frame 就停車。

### 版本
- `PROTOCOL_VERSION = 1`。網頁連線後先送 HELLO，INFO 的協定版本不符就提示「請更新韌體」，並且不執行程式。

## 後果
- 感測器數值是快取的最新回報值，最多延遲約 50 ms；網頁端讀取不需等待，與 `Device` 介面的同步讀取一致。
- 每個 frame 都在 20 bytes 以內，任何 MTU 都能用。
- 與 BLE Bootloader（ESP32 端 DFU）共用同一個藍牙控制器；兩者的切換機制留待 DFU 完成後再整合。
