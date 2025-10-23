import * as fs from "fs"; // sync version
import * as fsPromises from "fs/promises"; // async version (Promise-based fs API)
import * as path from "path";
import { splitBill, BillInput, BillOutput } from "./core";

// 定義命令列參數介面
interface CommandLineArgs {
  input: string;
  output: string;
  format?: "json" | "text";
}

// 定義處理結果介面
interface ProcessResult {
  success: boolean;
  error?: string;
  data?: BillOutput;
}

// 定義檔案處理錯誤類型
enum ProcessorErrorType {
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  INVALID_JSON = "INVALID_JSON",
  INVALID_FORMAT = "INVALID_FORMAT",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NO_SPACE = "NO_SPACE",
  INVALID_PATH = "INVALID_PATH",
  UNKNOWN = "UNKNOWN",
}

// 自定義錯誤類別
class ProcessorError extends Error {
  constructor(
    public type: ProcessorErrorType,
    message: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "ProcessorError";
  }
}

// 定義處理器類
class BillProcessor {
  private readonly inputPath: string;
  private readonly outputPath: string;
  private readonly format: "json" | "text";

  constructor(args: CommandLineArgs) {
    this.inputPath = args.input;
    this.outputPath = args.output;
    this.format = args.format || "json";
  }

  private formatAsText(result: BillOutput): string {
    return `日期：${result.date}
地點：${result.location}
小計：${result.subTotal}
小費：${result.tip}
總計：${result.totalAmount}

個人應付金額：
${result.items.map((item) => `${item.name}: ${item.amount}`).join("\n")}`;
  }

  private async readJsonFile(filePath: string): Promise<BillInput> {
    try {
      // 檢查文件是否存在和讀取權限
      await fsPromises.access(filePath, fs.constants.F_OK | fs.constants.R_OK);

      // 讀取文件內容
      const content = await fsPromises.readFile(filePath, "utf-8");

      try {
        // 解析 JSON
        const data = JSON.parse(content);

        try {
          // 驗證 JSON 格式
          this.validateBillInput(data);
          return data;
        } catch (error) {
          throw new ProcessorError(
            ProcessorErrorType.INVALID_FORMAT,
            `Invalid bill format in file ${filePath}: ${
              (error as Error).message
            }`
          );
        }
      } catch (error) {
        if (error instanceof ProcessorError) {
          throw error;
        }
        throw new ProcessorError(
          ProcessorErrorType.INVALID_JSON,
          `Invalid JSON format in file ${filePath}: ${(error as Error).message}`
        );
      }
    } catch (error) {
      if (error instanceof ProcessorError) {
        throw error;
      }
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        throw new ProcessorError(
          ProcessorErrorType.FILE_NOT_FOUND,
          `File not found: ${filePath}`
        );
      }
      if (err.code === "EACCES") {
        throw new ProcessorError(
          ProcessorErrorType.PERMISSION_DENIED,
          `Permission denied: Cannot read file ${filePath}`
        );
      }
      throw new ProcessorError(
        ProcessorErrorType.UNKNOWN,
        `Error reading file ${filePath}: ${err.message}`
      );
    }
  }

  /**
   * 寫入輸出文件
   * @param filePath 輸出文件路徑
   * @param content 要寫入的內容
   * @throws {ProcessorError} 當寫入操作失敗時
   */
  private async writeOutputFile(
    filePath: string,
    content: string
  ): Promise<void> {
    try {
      // 確保輸出目錄存在並可寫
      const outputDir = path.dirname(filePath);
      await fsPromises.mkdir(outputDir, { recursive: true });

      // 檢查目錄寫入權限
      try {
        await fsPromises.access(outputDir, fs.constants.W_OK);
      } catch (error) {
        throw new ProcessorError(
          ProcessorErrorType.PERMISSION_DENIED,
          `Cannot write to directory ${outputDir}`
        );
      }

      // 寫入文件（不需要單獨檢查文件是否存在，writeFile會自動處理）
      await fsPromises.writeFile(filePath, content, "utf-8");
    } catch (error) {
      if (error instanceof ProcessorError) {
        throw error;
      }

      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOSPC") {
        throw new ProcessorError(
          ProcessorErrorType.NO_SPACE,
          "No space left on device"
        );
      }
      if (err.code === "EACCES") {
        throw new ProcessorError(
          ProcessorErrorType.PERMISSION_DENIED,
          `Cannot write to file ${filePath}`
        );
      }

      throw new ProcessorError(
        ProcessorErrorType.UNKNOWN,
        `Failed to write file ${filePath}: ${err.message}`
      );
    }
  }

  /**
   * 統一處理所有錯誤
   * @param error 原始錯誤
   * @returns 標準化的 ProcessorError
   */
  private handleError(error: unknown): ProcessorError {
    // 如果已經是 ProcessorError，直接返回
    if (error instanceof ProcessorError) {
      return error;
    }

    const err = error as Error;
    const message = err?.message?.toLowerCase() || "";

    // 根據錯誤訊息決定錯誤類型和訊息
    if (
      message.includes("no such file or directory") ||
      message.includes("file not found")
    ) {
      return new ProcessorError(
        ProcessorErrorType.FILE_NOT_FOUND,
        `File not found: ${this.getPathFromError(message)}`,
        err
      );
    }

    if (message.includes("permission denied")) {
      return new ProcessorError(
        ProcessorErrorType.PERMISSION_DENIED,
        `Permission denied: ${this.getPathFromError(message)}`,
        err
      );
    }

    if (message.includes("invalid json") || message.includes("syntax error")) {
      return new ProcessorError(
        ProcessorErrorType.INVALID_JSON,
        `Invalid JSON format: ${err.message}`,
        err
      );
    }

    if (message.includes("invalid format")) {
      return new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Invalid format: ${err.message}`,
        err
      );
    }

    if (message.includes("no space")) {
      return new ProcessorError(
        ProcessorErrorType.NO_SPACE,
        "No space left on device",
        err
      );
    }

    if (
      message.includes("invalid path") ||
      message.includes("illegal operation")
    ) {
      return new ProcessorError(
        ProcessorErrorType.INVALID_PATH,
        `Invalid path: ${this.getPathFromError(message)}`,
        err
      );
    }

    // 未知錯誤
    return new ProcessorError(
      ProcessorErrorType.UNKNOWN,
      err.message || "Unknown error occurred",
      err
    );
  }

  /**
   * 從錯誤訊息中解析出檔案路徑
   * @param message 錯誤訊息
   * @returns 解析出的路徑或預設值
   */
  private getPathFromError(message: string): string {
    // 1. 嘗試匹配引號內的路徑（單引號或雙引號）
    const quoteMatches =
      message.match(/'([^']+)'/) || message.match(/"([^"]+)"/);
    if (quoteMatches) {
      return quoteMatches[1];
    }

    // 2. 嘗試匹配常見的路徑格式
    const pathRegex = /(?:[a-zA-Z]:\\|\/)[^:*?"<>|\r\n]+/;
    const pathMatches = message.match(pathRegex);
    if (pathMatches) {
      return pathMatches[0];
    }

    // 3. 如果都沒有匹配到，返回預設值
    return "unknown path";
  }

  /**
   * 驗證日期格式和有效性
   * @param date 要驗證的日期字串
   * @throws {ProcessorError} 當日期格式或值無效時
   */
  private validateDateFormat(date: string): void {
    // 驗證日期格式 YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Invalid date format: ${date}. Expected format: YYYY-MM-DD`
      );
    }

    // 驗證日期有效性
    const [year, month, day] = date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day ||
      isNaN(dateObj.getTime())
    ) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Invalid date: ${date}. Please provide a valid date.`
      );
    }

    // 檢查日期是否在合理範圍內
    const now = new Date();
    const minDate = new Date(2000, 0, 1);
    if (dateObj < minDate || dateObj > now) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Date ${date} is out of valid range (2000-01-01 to present)`
      );
    }
  }

  /**
   * 驗證地點資訊
   * @param location 要驗證的地點字串
   * @throws {ProcessorError} 當地點無效時
   */
  private validateLocation(location: string): void {
    const trimmedLocation = location.trim();
    if (trimmedLocation.length === 0) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        "Location cannot be empty"
      );
    }

    if (trimmedLocation.length > 100) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Location name is too long (${trimmedLocation.length} chars, max 100)`
      );
    }

    // 檢查是否包含無效字符
    const invalidChars = /[<>{}[\]\\]/;
    if (invalidChars.test(trimmedLocation)) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        "Location contains invalid characters"
      );
    }
  }

  /**
   * 驗證小費百分比
   * @param tipPercentage 要驗證的小費百分比
   * @throws {ProcessorError} 當小費百分比無效時
   */
  private validateTipPercentage(tipPercentage: number): void {
    if (typeof tipPercentage !== "number" || isNaN(tipPercentage)) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        "Tip percentage must be a valid number"
      );
    }

    if (tipPercentage < 0) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        "Tip percentage cannot be negative"
      );
    }

    if (tipPercentage > 100) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Tip percentage ${tipPercentage}% is too high (max 100%)`
      );
    }
  }

  /**
   * 驗證帳單項目
   * @param item 要驗證的帳單項目
   * @param index 項目索引（用於錯誤訊息）
   * @throws {ProcessorError} 當帳單項目無效時
   */
  private validateBillItem(item: any, index: number): void {
    if (!item || typeof item !== "object") {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Item at index ${index} is not an object`
      );
    }

    // 驗證價格
    if (typeof item.price !== "number" || isNaN(item.price)) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Invalid price type for item "${
          item.name || "unknown"
        }" at index ${index}`
      );
    }

    if (item.price < 0) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Price cannot be negative for item "${
          item.name || "unknown"
        }" at index ${index}`
      );
    }

    if (item.price > 1000000) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Price is unreasonably high for item "${
          item.name || "unknown"
        }" at index ${index} (max: $1,000,000)`
      );
    }

    // 驗證名稱
    if (typeof item.name !== "string" || item.name.trim().length === 0) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Invalid or empty name for item at index ${index}`
      );
    }

    if (item.name.length > 100) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Item name is too long at index ${index} (${item.name.length} chars, max 100)`
      );
    }

    // 驗證分享狀態
    if (typeof item.isShared !== "boolean") {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Missing or invalid isShared field for item "${item.name}" at index ${index}`
      );
    }

    // 驗證個人項目的人名
    if (!item.isShared) {
      if (!item.person || typeof item.person !== "string") {
        throw new ProcessorError(
          ProcessorErrorType.INVALID_FORMAT,
          `Missing person field for personal item "${item.name}" at index ${index}`
        );
      }

      const trimmedPerson = item.person.trim();
      if (trimmedPerson.length === 0) {
        throw new ProcessorError(
          ProcessorErrorType.INVALID_FORMAT,
          `Empty person name for personal item "${item.name}" at index ${index}`
        );
      }

      if (trimmedPerson.length > 100) {
        throw new ProcessorError(
          ProcessorErrorType.INVALID_FORMAT,
          `Person name is too long for item "${item.name}" at index ${index} (${trimmedPerson.length} chars, max 100)`
        );
      }

      // 檢查人名是否包含無效字符
      const invalidChars = /[<>{}[\]\\]/;
      if (invalidChars.test(trimmedPerson)) {
        throw new ProcessorError(
          ProcessorErrorType.INVALID_FORMAT,
          `Person name contains invalid characters for item "${item.name}" at index ${index}`
        );
      }
    }
  }

  /**
   * 驗證帳單輸入數據的完整性和格式
   * @param data 要驗證的輸入數據
   * @throws {ProcessorError} 當輸入數據無效時
   */
  private validateBillInput(data: any): asserts data is BillInput {
    // 基本類型檢查
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        "Invalid input: Data must be an object"
      );
    }

    // 檢查必要字段是否存在
    const requiredFields = ["date", "location", "tipPercentage", "items"];
    const missingFields = requiredFields.filter((field) => !(field in data));
    if (missingFields.length > 0) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Missing required fields: ${missingFields.join(", ")}`
      );
    }

    // 驗證日期
    if (typeof data.date !== "string") {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        "Invalid input: date must be a string"
      );
    }
    this.validateDateFormat(data.date);

    // 驗證地點
    if (typeof data.location !== "string") {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        "Invalid input: location must be a string"
      );
    }
    this.validateLocation(data.location);

    // 驗證小費百分比
    if (typeof data.tipPercentage !== "number" || isNaN(data.tipPercentage)) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        "Invalid input: tipPercentage must be a number"
      );
    }
    this.validateTipPercentage(data.tipPercentage);

    // 驗證項目清單
    if (!Array.isArray(data.items)) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        "Invalid input: items must be an array"
      );
    }

    const itemsLength = data.items.length;
    if (itemsLength === 0) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        "Invalid input: items array cannot be empty"
      );
    }

    if (itemsLength > 100) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Invalid input: too many items (${itemsLength}, max 100)`
      );
    }

    // 驗證每個項目
    data.items.forEach((item: unknown, index: number) => {
      try {
        this.validateBillItem(item, index);
      } catch (error) {
        if (error instanceof ProcessorError) {
          throw error;
        }
        throw new ProcessorError(
          ProcessorErrorType.INVALID_FORMAT,
          `Invalid item at index ${index}: ${(error as Error).message}`
        );
      }
    });
  }

  /**
   * 處理單一帳單檔案
   * @returns 處理結果
   */
  async processFile(): Promise<ProcessResult> {
    try {
      // 讀取並驗證輸入文件
      const inputData = await this.readJsonFile(this.inputPath);

      // 使用 core.ts 的 splitBill 函數處理數據
      const result = splitBill(inputData);

      // 格式化輸出內容
      const output =
        this.format === "json"
          ? JSON.stringify(result, null, 2)
          : this.formatAsText(result);

      // 寫入輸出文件
      await this.writeOutputFile(this.outputPath, output);

      return {
        success: true,
        data: result,
      };
    } catch (error: unknown) {
      const processedError = this.handleError(error);
      return {
        success: false,
        error: `${processedError.type}: ${processedError.message}`,
      };
    }
  }

  /**
   * 批次處理目錄中的所有帳單檔案
   * @returns 所有檔案的處理結果陣列
   * @throws {ProcessorError} 當目錄處理過程中發生錯誤
   */
  async processDirectory(): Promise<ProcessResult[]> {
    try {
      // 檢查輸入目錄存在性和權限
      try {
        await fsPromises.access(
          this.inputPath,
          fs.constants.F_OK | fs.constants.R_OK
        );
      } catch (error) {
        throw new ProcessorError(
          ProcessorErrorType.FILE_NOT_FOUND,
          `Input directory ${this.inputPath} does not exist or is not accessible`
        );
      }

      // 讀取目錄內容
      const files = await fsPromises.readdir(this.inputPath);
      const jsonFiles = files.filter((file) => file.endsWith(".json"));

      if (jsonFiles.length === 0) {
        throw new ProcessorError(
          ProcessorErrorType.INVALID_FORMAT,
          `No JSON files found in directory ${this.inputPath}`
        );
      }

      // 建立輸出目錄
      try {
        await fsPromises.mkdir(this.outputPath, { recursive: true });
        await fsPromises.access(this.outputPath, fs.constants.W_OK);
      } catch (error) {
        throw new ProcessorError(
          ProcessorErrorType.PERMISSION_DENIED,
          `Cannot create or write to output directory ${this.outputPath}`
        );
      }

      // 並行處理每個 JSON 文件
      const results = await Promise.all(
        jsonFiles.map(async (file): Promise<ProcessResult> => {
          const inputFile = path.join(this.inputPath, file);
          const outputFile = path.join(
            this.outputPath,
            `${path.parse(file).name}.${
              this.format === "json" ? "json" : "txt"
            }`
          );

          try {
            // 讀取並處理單個文件
            const inputData = await this.readJsonFile(inputFile);
            const result = splitBill(inputData);

            // 準備輸出
            const output =
              this.format === "json"
                ? JSON.stringify(result, null, 2)
                : this.formatAsText(result);

            // 寫入輸出文件
            await this.writeOutputFile(outputFile, output);

            return {
              success: true,
              data: result,
            };
          } catch (error) {
            // 轉換錯誤為標準格式
            const processedError = this.handleError(error);
            return {
              success: false,
              error: `Error processing ${file}: ${processedError.type}: ${processedError.message}`,
            };
          }
        })
      );

      return results;
    } catch (error) {
      // 處理目錄層級的錯誤
      const processedError = this.handleError(error);
      return [
        {
          success: false,
          error: `Directory processing failed: ${processedError.type}: ${processedError.message}`,
        },
      ];
    }
  }
}

/**
 * 解析命令列參數
 * @param args 命令列參數陣列
 * @returns 解析後的參數物件
 * @throws {ProcessorError} 當參數無效時
 */
export function parseArgs(args: string[]): CommandLineArgs {
  const params: Partial<CommandLineArgs> = {};

  // 定義有效的選項
  const validOptions = new Set(["input", "output", "format"]);
  const validFormats = new Set(["json", "text"]);

  // 跳過前兩個參數（node 和腳本名稱）
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;

    // 解析選項和值
    const [fullOption, value] = arg.split("=");
    const option = fullOption.slice(2);

    // 驗證選項是否有效
    if (!validOptions.has(option)) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Invalid option: ${option}. Valid options are: ${Array.from(
          validOptions
        ).join(", ")}`
      );
    }

    // 驗證選項值是否存在
    if (!value) {
      throw new ProcessorError(
        ProcessorErrorType.INVALID_FORMAT,
        `Missing value for option: ${option}`
      );
    }

    // 處理特定選項
    switch (option) {
      case "input":
        params.input = value;
        break;
      case "output":
        params.output = value;
        break;
        break;
      case "format":
        if (!validFormats.has(value)) {
          throw new ProcessorError(
            ProcessorErrorType.INVALID_FORMAT,
            `Invalid format: ${value}. Must be either "json" or "text"`
          );
        }
        params.format = value as "json" | "text";
        break;
    }
  }

  // 驗證必要參數
  if (!params.input) {
    throw new ProcessorError(
      ProcessorErrorType.INVALID_FORMAT,
      "Missing required option: --input"
    );
  }
  if (!params.output) {
    throw new ProcessorError(
      ProcessorErrorType.INVALID_FORMAT,
      "Missing required option: --output"
    );
  }

  return params as CommandLineArgs;
}

/**
 * 主程式入口點
 * @param args 命令列參數陣列
 * @description 解析命令列參數並執行相應的處理邏輯，支援單一檔案和批次處理模式
 */
export async function main(args: string[]): Promise<void> {
  try {
    // 解析命令列參數
    const parsedArgs = parseArgs(args);

    // 創建處理器實例
    const processor = new BillProcessor(parsedArgs);

    try {
      // 檢查輸入是否為目錄
      const stats = await fsPromises.stat(parsedArgs.input);
      const isDirectory = stats.isDirectory();

      // 執行相應的處理邏輯
      if (isDirectory) {
        const results = await processor.processDirectory();
        console.log(JSON.stringify(results, null, 2));

        // 檢查處理結果
        if (!results.every((r) => r.success)) {
          console.error("Some files failed to process");
          process.exit(1);
        }
      } else {
        const result = await processor.processFile();
        console.log(JSON.stringify(result, null, 2));

        // 檢查處理結果
        if (!result.success) {
          console.error(`Failed to process file: ${result.error}`);
          process.exit(1);
        }
      }
    } catch (error) {
      // 處理所有的執行錯誤
      const processedError =
        error instanceof ProcessorError
          ? error
          : new ProcessorError(
              ProcessorErrorType.UNKNOWN,
              (error as Error).message || "Unknown error occurred"
            );

      console.error(`Error: ${processedError.type}: ${processedError.message}`);
      process.exit(1);
    }
  } catch (error) {
    // 處理參數解析錯誤
    const processedError =
      error instanceof ProcessorError
        ? error
        : new ProcessorError(
            ProcessorErrorType.INVALID_FORMAT,
            (error as Error).message || "Invalid command line arguments"
          );

    console.error(`Error: ${processedError.type}: ${processedError.message}`);
    process.exit(1);
  }
}
