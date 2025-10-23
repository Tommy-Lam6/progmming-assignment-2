import { expect } from 'chai'
import {
  BillInput,
  BillOutput,
  calculateTip,
  formatDate,
  splitBill,
} from '../src/core'

describe('日期格式', () => {
  it('2-digit month and day', () => {
    let input = '2024-12-21'
    let output = '2024年12月21日'
    expect(formatDate(input)).to.equal(output)
  })

  it('1-digit month', () => {
    let input = '2024-01-21'
    let output = '2024年1月21日'
    expect(formatDate(input)).to.equal(output)
  })

  it('1-digit day', () => {
    let input = '2024-12-01'
    let output = '2024年12月1日'
    expect(formatDate(input)).to.equal(output)
  })
})

describe('小費計算', () => {
  it('無小費', () => {
    let subTotal = 100
    let tipPercentage = 0
    let output = 0
    expect(calculateTip(subTotal, tipPercentage)).to.equal(output)
  })

  it('有小費，不需要四捨五入', () => {
    let subTotal = 100
    let tipPercentage = 10
    let output = 10
    expect(calculateTip(subTotal, tipPercentage)).to.equal(output)
  })

  it('有小費，向下四捨五入', () => {
    let subTotal = 123.4
    let tipPercentage = 10
    let output = 12.3
    expect(calculateTip(subTotal, tipPercentage)).to.equal(output)
  })

  it('有小費，向上四捨五入', () => {
    let subTotal = 123.5
    let tipPercentage = 10
    let output = 12.4
    expect(calculateTip(subTotal, tipPercentage)).to.equal(output)
  })
})

describe('分帳計算', () => {
  it('無舍入誤差', () => {
    const input: BillInput = {
      date: '2024-03-21',
      location: '開心小館',
      tipPercentage: 10,
      items: [
        {
          price: 82,
          name: '牛排',
          isShared: true,
        },
        {
          price: 10,
          name: '橙汁',
          isShared: false,
          person: 'Alice',
        },
        {
          price: 8,
          name: '熱檸檬水',
          isShared: false,
          person: 'Bob',
        },
      ],
    }
    const output: BillOutput = {
      date: '2024年3月21日',
      location: '開心小館',
      subTotal: 100,
      tip: 10,
      totalAmount: 110,
      items: [
        {
          name: 'Alice',
          amount: 56.1,
        },
        {
          name: 'Bob',
          amount: 53.9,
        },
      ],
    }
    expect(splitBill(input)).to.deep.equal(output)
  })

  it('有舍入誤差，向下調整 0.1 元', () => {
    const input: BillInput = {
      date: '2024-03-21',
      location: '開心小館',
      tipPercentage: 10,
      items: [
        {
          price: 199,
          name: '牛排',
          isShared: true,
        },
        {
          price: 10,
          name: '橙汁',
          isShared: false,
          person: 'Alice',
        },
        {
          price: 12,
          name: '薯條',
          isShared: true,
        },
        {
          price: 8,
          name: '熱檸檬水',
          isShared: false,
          person: 'Bob',
        },
        {
          price: 8,
          name: '熱檸檬水',
          isShared: false,
          person: 'Charlie',
        },
      ],
    }
    const output: BillOutput = {
      date: '2024年3月21日',
      location: '開心小館',
      subTotal: 237,
      tip: 23.7,
      totalAmount: 260.7,
      items: [
        {
          name: 'Alice',
          amount: 88.3 /* 向下調整 0.1 元 */,
        },
        {
          name: 'Bob',
          amount: 86.2,
        },
        {
          name: 'Charlie',
          amount: 86.2,
        },
      ],
    }
    expect(splitBill(input)).to.deep.equal(output)
  })

  it('有舍入誤差，向上調整 0.1 元', () => {
    const input: BillInput = {
      date: '2024-03-21',
      location: '開心小館',
      tipPercentage: 10,
      items: [
        {
          price: 194,
          name: '牛排',
          isShared: true,
        },
        {
          price: 10,
          name: '橙汁',
          isShared: false,
          person: 'Alice',
        },
        {
          price: 10,
          name: '橙汁',
          isShared: false,
          person: 'Bob',
        },
        {
          price: 10,
          name: '橙汁',
          isShared: false,
          person: 'Charlie',
        },
      ],
    }
    const output: BillOutput = {
      date: '2024年3月21日',
      location: '開心小館',
      subTotal: 224,
      tip: 22.4,
      totalAmount: 246.4,
      items: [
        {
          name: 'Alice',
          amount: 82.2 /* 向上調整 0.1 元 */,
        },
        {
          name: 'Bob',
          amount: 82.1,
        },
        {
          name: 'Charlie',
          amount: 82.1,
        },
      ],
    }
    expect(splitBill(input)).to.deep.equal(output)
  })
})
