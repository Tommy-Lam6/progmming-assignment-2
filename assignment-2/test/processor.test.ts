import { expect } from 'chai'
import { main } from '../src/processor'
import * as fs from 'fs'
import * as path from 'path'
import * as sinon from 'sinon'
import * as core from '../src/core'

describe('Processor', () => {
  let inputFile = 'sample-data/single-bill.json'
  let outputFile = 'result.json'

  let inputDir = 'sample-data/input-dir'
  let outputDir = 'sample-data/output-dir'

  // ===== 功能擴展與核心邏輯（40 分） =====

  describe('重用習作一計算函數（15 分）', () => {
    it('正確調用習作一的核心計算邏輯', async () => {
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        `--input=${inputFile}`,
        `--output=${outputFile}`,
      ]
      const splitBillSpy = sinon.spy(core, 'splitBill')
      try {
        await main(testArgs)
        expect(splitBillSpy.calledOnce).to.be.true
      } finally {
        splitBillSpy.restore()
      }
    })

    it('保持計算結果的一致性', () => {
      let assignment_1_file = '../assignment-1/src/core.ts'
      let assignment_2_file = '../assignment-2/src/core.ts'

      let assignment_1_content = fs.readFileSync(assignment_1_file, 'utf-8')
      let assignment_2_content = fs.readFileSync(assignment_2_file, 'utf-8')

      expect(assignment_1_content).to.equals(assignment_2_content)
    })
  })

  describe('單一檔案處理能力（15 分）', () => {
    it('支援處理單筆聚餐分帳資料（完整工作流程：讀取、處理、輸出）', async () => {
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        `--input=${inputFile}`,
        `--output=${outputFile}`,
      ]

      // Mock the splitBill function to return a simple output
      const mockOutput = {
        date: '2024年3月21日',
        location: '開心小館',
        subTotal: 100,
        tip: 10,
        totalAmount: 110,
        items: [
          { name: 'Alice', amount: 55 },
          { name: 'Bob', amount: 55 },
        ],
      }

      const splitBillStub = sinon.stub(core, 'splitBill').returns(mockOutput)

      try {
        // Clean up any existing output file
        if (fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile)
        }

        // Call main function
        await main(testArgs)

        // Verify output file was created
        expect(fs.existsSync(outputFile)).to.be.true

        // Read and verify the actual file content
        const fileContent = fs.readFileSync(outputFile, 'utf-8')
        const writtenData = JSON.parse(fileContent)
        expect(writtenData).to.deep.equal(mockOutput)
      } finally {
        splitBillStub.restore()
        // Clean up output file
        if (fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile)
        }
      }
    })
  })

  describe('命令列參數解析（10 分）', () => {
    function prepare(args: { inputFile: string; outputFile: string }) {
      let { inputFile, outputFile } = args
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        `--input=${inputFile}`,
        `--output=${outputFile}`,
      ]
      const mockOutput = {
        date: '2024年3月21日',
        location: `${inputFile} -> ${outputFile}`,
        subTotal: 100,
        tip: 0.1,
        totalAmount: 110,
        items: [
          { name: 'input: ' + inputFile, amount: 55 },
          { name: 'output: ' + outputFile, amount: 55 },
        ],
      }
      const splitBillStub = sinon.stub(core, 'splitBill').returns(mockOutput)

      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile)
      }

      return { testArgs, splitBillStub, mockOutput }
    }

    it('支援 --input 和 --output 參數', async () => {
      let args = [
        'ts-node',
        'src/cli.ts',
        `--input=${inputFile}`,
        `--output=${outputFile}`,
      ]
      // it should not throw error
      await main(args)
    })

    it('正確解析 --input 命令列參數', async () => {
      async function test(args: {
        inputFile: string
        outputFile: string
        location: string
      }) {
        let { testArgs, splitBillStub } = prepare(args)
        try {
          await main(testArgs)
          expect(splitBillStub.calledOnce).to.be.true
          expect(splitBillStub.getCall(0).args[0].location).to.be.equal(
            args.location,
          )
        } finally {
          splitBillStub.restore()
          if (fs.existsSync(args.outputFile)) {
            fs.unlinkSync(args.outputFile)
          }
        }
      }

      await test({
        inputFile: path.join(inputDir, 'bill-1.json'),
        outputFile: path.join(outputDir, 'result-1.json'),
        location: '開心小館',
      })
      await test({
        inputFile: path.join(inputDir, 'bill-2.json'),
        outputFile: path.join(outputDir, 'result-2.json'),
        location: '美味餐廳',
      })
      await test({
        inputFile: path.join(inputDir, 'bill-3.json'),
        outputFile: path.join(outputDir, 'result-3.json'),
        location: '咖啡廳',
      })
    })

    it('正確解析 --output 命令列參數', async () => {
      async function test(args: { inputFile: string; outputFile: string }) {
        let { testArgs, splitBillStub, mockOutput } = prepare(args)
        try {
          await main(testArgs)
          expect(fs.existsSync(args.outputFile)).to.be.true
          let fileOutput = JSON.parse(fs.readFileSync(args.outputFile, 'utf-8'))
          expect(fileOutput).to.deep.equal(mockOutput)
        } finally {
          splitBillStub.restore()
          if (fs.existsSync(args.outputFile)) {
            fs.unlinkSync(args.outputFile)
          }
        }
      }

      await test({
        inputFile: path.join(inputDir, 'bill-1.json'),
        outputFile: path.join(outputDir, 'result-1.json'),
      })
      await test({
        inputFile: path.join(inputDir, 'bill-2.json'),
        outputFile: path.join(outputDir, 'result-2.json'),
      })
      await test({
        inputFile: path.join(inputDir, 'bill-3.json'),
        outputFile: path.join(outputDir, 'result-3.json'),
      })
    })
  })

  // ===== 檔案 I/O 處理（30 分） =====

  describe('JSON 檔案讀取（10 分）', () => {
    it('正確讀取和解析 JSON 檔案 ', async () => {})

    it('處理檔案路徑和權限問題')
  })

  describe('檔案寫入（10 分）', () => {
    it('正確寫入輸出檔案')
    it('支援 JSON 格式的檔案輸出')
  })

  describe('檔案格式驗證（10 分）', () => {
    it('驗證輸入 JSON 格式的正確性')
    it('處理格式錯誤的優雅降級')
  })

  // ===== 錯誤處理與程式品質（20 分） =====

  describe('檔案錯誤處理（8 分）', () => {
    it('處理檔案不存在的情況')
    it('處理檔案讀寫權限問題')
  })

  describe('JSON 錯誤處理（7 分）', () => {
    it('處理 JSON 格式錯誤')
    it('提供有意義的錯誤訊息')
  })

  describe('程式穩定性（5 分）', () => {
    it('程式不會因為輸入錯誤而崩潰')
    it('提供適當的錯誤訊息')
    it('提供適當的退出碼')
  })

  // ===== 加分項目 =====

  describe('批次處理能力（+10 分）', () => {
    it('支援處理多筆聚餐分帳資料')
    it('支援輸入目錄')
    it('支援輸出目錄')
    it('自動掃描目錄中的所有 JSON 檔案')
    it('跳過非 JSON 檔案')
  })

  describe('非同步檔案處理（+5 分）', () => {
    it('使用 async/await 處理檔案 I/O 操作')
    it('使用 Promise-based fs API')
    it('正確處理非同步檔案操作')
    it('保持非同步操作的功能性')
  })

  describe('文字格式輸出（+3 分）', () => {
    it('支援 --format 參數')
    it('支援 json 格式輸出')
    it('支援 text 格式輸出')
    it('輸出格式化的文字報告')
    it('處理無效的格式參數')
  })

  // ===== 整合測試 =====

  describe('End-to-End Integration Tests', () => {
    it('should complete single file workflow successfully')
    it('should complete batch processing workflow successfully')
    it('should handle mixed success and failure scenarios')
    it('should maintain data integrity throughout processing')
  })
})
