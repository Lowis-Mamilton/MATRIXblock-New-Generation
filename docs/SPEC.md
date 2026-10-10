# MATRIXblock New Generation — 規格

全新設計的 MATRIX Mini R4 圖形化程式環境，參考 LEGO Education Coding Canvas 的 Icon / Word 兩種積木模式，只提供類似 EV3G 的精簡功能方塊。**不沿用舊版 MATRIXblock（Electron + Arduino 編譯燒錄）的架構。**

## 決策
| # | 決策 |
|---|---|
| 硬體 | MATRIX Mini R4（DC 馬達有編碼器） |
| 執行 | Tethered：程式在瀏覽器跑，對板子下即時指令（第二階段需 R4 直譯韌體） |
| 平台 | 網頁 + PWA，以 Chrome 為主（Win / Chromebook / Android；Apple 裝置也用 Chrome）；部署 GitHub Pages |
| 技術 | Vite + TypeScript + React + Blockly v11+（自訂 renderer 做橫式） |
| 模式 | Icon（橫式左→右，低年級，調色盤在底部）／Word（直式上→下，中高年級，左側分類），開專案時選定，不互轉 |
| 語言 | i18n 架構，先做 zh-TW + en |
| 模擬器 | 虛擬 R4 狀態面板（馬達轉速/角度、伺服角度、LED、蜂鳴器；感測器用滑桿調） |
| 存檔 | IndexedDB 自動存 + 匯出/匯入 `.mbng`（JSON），無帳號 |
| 視覺 | 自訂品牌風、自繪 SVG icon；版面參考 LEGO 但不照抄 |
| 品牌色 | 主 #2E5690、logo #195197、強調 #6EC9EF、次 #97ABC8、淺 #CBD5E3、深字 #1D1D36、淺底 #F2F1FF；字型 Montserrat / Poppins + Noto Sans TC |
| 第二階段連線 | 僅 BLE（Web Bluetooth） |
| 階段一範圍 | 編輯器 + 模擬執行；硬體連線與韌體留到階段二 |

### Icon Block 清單（約 12 顆，數值全用彈出選擇器、限制範圍：秒 1–10、速度 慢/中/快、重複 1–10）
- 事件：▶ 開始時、板載按鈕按下時
- 移動：小車 前進/後退/左轉/右轉（N 秒）、停止（左右輪埠於設定面板，預設 M1 左 / M2 右）
- 馬達：單顆馬達轉（埠、方向、N 秒）、伺服轉到角度
- 等待：等 N 秒、等到感測器條件（按鈕 / 顏色 / 距離近）
- 流程：重複 N 次、永遠重複
- 燈聲：LED 設色、蜂鳴器音符/音效

### Word Block 清單（Icon 全部 + 以下）
- 移動：轉向移動、坦克移動（秒/圈/度）
- 馬達：開始轉、轉 N 度/圈、停止（煞車/滑行）、讀角度
- 控制：如果/否則、等到〈條件〉、重複直到、停止全部
- 感測：顏色、距離、IMU 傾斜、按鈕
- 運算：四則、比較、且/或/非、隨機；變數：建立/設定/改變
- 事件：開始、按鈕、廣播/收到訊息（多線程）
- 不做：清單、My Blocks、OLED、搖桿、HuskyLens、M-Vision

### 第一階段周邊
輸出：DC M1–M4、伺服 RC1–RC4、RGB LED、蜂鳴器；輸入：按鈕、M-Color、M-Laser、IMU。

## 架構

```
Blockly workspace ──compile──► IR (JSON 指令樹) ──► Interpreter (async, 多線程, 高亮, 停止)
                                                         │
                                                   Device 介面
                                          ┌──────────────┴──────────────┐
                                    SimDevice (階段一)            BleR4Device (階段二)
```

詳見 [ADR 0001](adr/0001-tethered-ir-interpreter.md) 與 [ADR 0002](adr/0002-horizontal-icon-renderer.md)。

## 實作備註（與原計畫的差異）
- 版本：Blockly 13、React 19、Vite 8、TypeScript 7（動工時的最新穩定版）。
- Icon 與 Word 共用同一個 `src/ir/compile.ts`，直接編譯 Blockly 存檔 JSON（不依賴 DOM，方便測試）。
- 狀態管理用 zustand；模擬器面板直接訂閱 `SimDevice`。
- 程式結束時（所有線程跑完、且沒有「按鈕」事件積木）會停止所有馬達，與 LEGO SPIKE 的行為一致。

## 第二輪：補完 + 階段二（2026-10-10 拷問結論）

### 第一階段補強
- 復原 / 重做按鈕
- 多專案管理：首頁「我的專案」清單（新增、開啟、改名、刪除），存在 IndexedDB
- 範例專案 6 個，開新專案時可選：
  - Icon：跳舞小車、遇到障礙物就停、紅燈停綠燈行
  - Word：正方形路線、避障巡邏、按鈕計數器
- Word 積木滑鼠提示（tooltip）
- 觸控優化（平板拖拉、較大按鈕）
- 延後：2D 小車場地；不做：OLED / 搖桿等更多周邊積木

### 硬體對應修正
- R4 有 **2 顆 RGB LED**、**2 顆按鈕（上 / 下）**：
  - Word：LED 積木可選 LED 1 / LED 2 / 全部；按鈕積木可選上 / 下
  - Icon：LED 預設兩顆一起，選擇器可指定；按鈕事件分「上鍵」「下鍵」兩個積木
  - 模擬器同步改成 2 顆 LED、2 顆按鈕
- 顏色 / 雷射距離感測器接在 I2C1～I2C4：
  - Word 感測器積木有埠下拉選單
  - Icon 在「設定」指定（預設顏色 I2C1、雷射 I2C2）
  - 型號版本（MXColor / V3、MXLaser / V2）由韌體自動偵測
- 馬達一律用閉迴路 `setSpeed`；「轉 N 度」用函式庫的 `rotateFor`

### 階段二：BLE 實機
- 連線：只用 Web Bluetooth；協定見 [ADR 0003](adr/0003-ble-protocol.md)
- 韌體：本 repo `firmware/`，RA4M1 上的 Arduino sketch（ArduinoBLE + MatrixMiniR4）；用 Arduino IDE / arduino-cli 燒錄，網頁偵測韌體版本並提示更新
- 安全：斷線立即停車；看門狗 1 秒沒收到心跳就停車
- 辨識：廣播名稱 `MXR4-` + MAC 末 4 碼；OLED 顯示名稱與連線狀態；連上時 LED 閃一下
- 模擬器面板：連線後切成「實機模式」，即時顯示板子回傳的數值、感測器改唯讀；斷線回到模擬模式。按 ▶ 時有連線就跑實機
- 模擬器外觀改用 MATRIX Mini R4 控制器的實物圖，數值疊在對應的埠位置上

### 部署
- 個人 GitHub 帳號 `Lowis-Mamilton`，公開 repo `matrixblock-ng`，GitHub Pages；完成後再合併到公司官網

