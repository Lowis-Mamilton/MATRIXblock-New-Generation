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

## 階段二（尚未開始）
- BleR4Device（Web Bluetooth）
- R4 端直譯韌體與指令協定（可能銜接 `MR4-firmware-redo`）
