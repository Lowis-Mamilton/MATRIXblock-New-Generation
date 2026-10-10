# MATRIXblock New Generation

MATRIX Mini R4 的網頁版圖形化程式環境（PWA），有兩種積木模式：

- **圖示積木（Icon）**：由左往右接的圖示積木，參數用點選的選擇器挑，適合低年級。
- **文字積木（Word）**：由上往下堆疊的文字積木，有變數、條件、運算，適合中高年級。

規格與決策見 [docs/SPEC.md](docs/SPEC.md)；架構決策見 [docs/adr](docs/adr)。

## 開發

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest：IR 編譯、直譯器、BLE 協定、專案庫、範例、字串
npm run typecheck
npm run build      # 輸出到 dist/（含 Service Worker）
```

推到 `main` 後，`.github/workflows/deploy.yml` 會測試、建置並部署到 GitHub Pages
（repo 設定 → Pages → Source 選 **GitHub Actions**）。

## 程式結構

| 路徑 | 內容 |
|---|---|
| `src/ir/` | 中介表示（IR）型別與編譯器（Blockly 存檔 JSON → IR，Icon / Word 共用） |
| `src/runtime/` | 非同步直譯器：多線程、停止、等待條件、廣播、積木高亮 |
| `src/devices/` | `Device` 介面；`sim/SimDevice` 是虛擬 R4，`ble/` 是藍牙實機（協定、BleR4Device、Web Bluetooth 連線） |
| `firmware/` | R4 端的 tethered 韌體（Arduino），燒錄方式見 [firmware/README.md](firmware/README.md) |
| `src/examples/` | 開新專案時可選的範例 |
| `src/blocks/icon/` | 橫式 renderer、拖放提示、點選選擇器、Icon 積木定義 |
| `src/blocks/word/` | Word 積木定義與工具箱 |
| `src/blocks/setup.ts` | Blockly 主題、工具箱、兩種模式的工作區設定 |
| `src/simulator/` | 右側虛擬 R4 面板 |
| `src/project/` | `.mbng` 檔案格式、專案庫（IndexedDB）、匯出 / 匯入 |
| `src/i18n/` | 繁中 / 英文字串（介面與積木） |

## 新增一顆積木

1. 在 `src/blocks/icon/blocks.ts` 或 `src/blocks/word/blocks.ts` 定義積木，並放進工具箱清單。
2. 在 `src/i18n/strings.ts` 加上兩種語言的文字。
3. 在 `src/ir/compile.ts` 的 `STATEMENTS` 或 `EXPRESSIONS` 表加上編譯規則；需要新動作時擴充 `src/ir/types.ts` 與直譯器。
4. 在 `src/ir/compile.test.ts` 補測試。
