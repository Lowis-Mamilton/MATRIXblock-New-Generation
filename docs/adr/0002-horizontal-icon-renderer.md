# ADR 0002：Icon Block 橫式 renderer

**狀態**：採用（2026-10-09，spike 驗證通過）

## 背景
Blockly 的內建 renderer 都假設敘述積木由上往下堆疊。Icon 模式需要由左往右接。

## 決策
- `IconRenderer` 覆寫 `Renderer.render()`，整個接管排版：自己量欄位、畫外框，把 previous / next / statement connection 放在左右邊緣。Blockly 的連線系統會依 connection offset 自動把積木橫向排好。
- 所有積木共用一條「連線基準線」（左右連線的 y）。一般積木掛在線下；迴圈積木做成拱形（頭、上臂、尾蓋），內部鏈從頭部右側開始，往上高出 `ARM + 內部 ascent`。
- 積木 mixin 覆寫 `getHeightWidth()`，回傳橫向鏈的尺寸，供工作區邊界、flyout 排版使用。
- 用自訂 `IconConnectionPreviewer` 取代內建的 insertion marker（後者會把後續積木往下推）。拖曳時改在吸附點顯示一條發光直線。

## 後果
- 依賴 Blockly 的 `Renderer.render`、`BlockSvg.width/height/childlessWidth`、`RenderedConnection.setOffsetInBlock`、`pathObject.addConnectionHighlight` 等介面；升級 Blockly 大版本時要回歸測試 Icon 模式。
- Icon 積木只能用欄位（field），不支援 value input。
