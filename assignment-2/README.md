# Assignment 2 - 聚餐分帳擴展與檔案處理

學生名稱：

## 使用說明

1. **安裝程式庫**：

```bash
npm install
```

2. **執行測試**：

```bash
npm test
```

3. **執行程式**：

```bash
# 基本用法 - 處理單一帳單
npx ts-node src/cli.ts --input=sample-data/single-bill.json --output=result.json

# 指定輸出格式為文字
npx ts-node src/cli.ts --input=sample-data/single-bill.json --output=result.txt --format=text

# 批次處理（加分項目）- 處理目錄中的所有檔案
npx ts-node src/cli.ts --input=sample-data/input-dir/ --output=sample-data/output-dir/ --format=json
```

## 檔案結構

- `src/core.ts` - 習作一的核心計算邏輯
- `src/processor.ts` - 檔案處理主程式（需要實作）
- `src/types.ts` - 額外的型別定義
- `sample-data/` - 範例資料檔案
  - `single-bill.json` - 單筆帳單範例
  - `input-dir/` - 批次處理輸入目錄
  - `output-dir/` - 批次處理輸出目錄

## 實作要求

請根據 `assignment-2.md` 的要求實作 `src/processor.ts` 中的各個函數：

1. **基本功能**：

   - 命令列參數解析
   - 檔案讀取和 JSON 解析
   - 檔案寫入（JSON 和文字格式）
   - 錯誤處理

2. **加分項目**：
   - 批次處理能力
   - 非同步檔案處理（使用 Promise-based fs API）
   - 文字格式輸出
