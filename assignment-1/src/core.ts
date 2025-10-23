/* 輸入 Type */
export type BillInput = {
  date: string;
  location: string;
  tipPercentage: number;
  items: BillItem[];
};

type BillItem = SharedBillItem | PersonalBillItem;

type CommonBillItem = {
  price: number;
  name: string;
};

type SharedBillItem = CommonBillItem & {
  isShared: true;
};

type PersonalBillItem = CommonBillItem & {
  isShared: false;
  person: string;
};

/* 輸出 Type */
export type BillOutput = {
  date: string;
  location: string;
  subTotal: number;
  tip: number;
  totalAmount: number;
  items: PersonItem[];
};

type PersonItem = {
  name: string;
  amount: number;
};

/* 核心函數 */
export function splitBill(input: BillInput): BillOutput {
  let date = formatDate(input.date);
  let location = input.location;
  let subTotal = calculateSubTotal(input.items);
  let tip = calculateTip(subTotal, input.tipPercentage);
  let totalAmount = subTotal + tip;
  let items = calculateItems(input.items, input.tipPercentage);
  adjustAmount(totalAmount, items);
  return {
    date,
    location,
    subTotal,
    tip,
    totalAmount,
    items,
  };
}

export function formatDate(date: string): string {
  // input format: YYYY-MM-DD, e.g. "2024-03-21"
  // output format: YYYY年M月D日, e.g. "2024年3月21日"
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function calculateSubTotal(items: BillItem[]): number {
  // sum up all the price of the items
  return items.reduce((total, item) => total + item.price, 0);
}

export function calculateTip(subTotal: number, tipPercentage: number): number {
  // output round to closest 10 cents, e.g. 12.34 -> 12.3
  const tip = subTotal * (tipPercentage / 100); // Convert percentage to decimal
  return Math.round(tip * 10) / 10;
}

function scanPersons(items: BillItem[]): string[] {
  // scan the persons in the items
  const persons = new Set<string>();

  items.forEach((item) => {
    if (!item.isShared) {
      persons.add(item.person);
    }
  });

  // 如果有共享的項目，確保每個人都在列表中
  const hasSharedItems = items.some((item) => item.isShared);
  if (hasSharedItems && persons.size === 0) {
    // 如果只有共享項目，至少需要兩個人分攤
    persons.add("Person 1");
    persons.add("Person 2");
  }

  return Array.from(persons).sort();
}

function calculateItems(
  items: BillItem[],
  tipPercentage: number
): PersonItem[] {
  let names = scanPersons(items);
  let persons = names.length;

  // 計算個人項目總額
  const personalAmounts = new Map<string, number>();
  names.forEach((name) => {
    const personalItems = items.filter(
      (item) => !item.isShared && item.person === name
    );
    const personalTotal = personalItems.reduce(
      (sum, item) => sum + item.price,
      0
    );
    personalAmounts.set(name, personalTotal);
  });

  // 計算共享項目總額
  const sharedItems = items.filter((item) => item.isShared);
  const sharedTotal = sharedItems.reduce((sum, item) => sum + item.price, 0);
  const sharedPerPerson = sharedTotal / persons;

  // 計算每個人的總額（包含小費）
  return names.map((name) => {
    const personalTotal = personalAmounts.get(name) || 0;
    const total = personalTotal + sharedPerPerson;
    const tipAmount = total * (tipPercentage / 100);
    return {
      name,
      amount: Math.round((total + tipAmount) * 10) / 10,
    };
  });
}

function calculatePersonAmount(input: {
  items: BillItem[];
  tipPercentage: number;
  name: string;
  persons: number;
}): number {
  const { items, tipPercentage, name, persons } = input;

  let amount = 0;

  // 計算個人消費項目
  const personalItems = items.filter(
    (item) => !item.isShared && item.person === name
  );
  amount += personalItems.reduce((sum, item) => sum + item.price, 0);

  // 計算共享項目
  const sharedItems = items.filter((item) => item.isShared);
  const sharedAmount = sharedItems.reduce((sum, item) => sum + item.price, 0);
  amount += sharedAmount / persons;

  // 加上小費
  amount += amount * (tipPercentage / 100);

  // 四捨五入到小數點第一位
  return Math.round(amount * 10) / 10;
}

function adjustAmount(totalAmount: number, items: PersonItem[]): void {
  // 計算當前總和
  const currentTotal = items.reduce((sum, item) => sum + item.amount, 0);

  // 計算差額
  const difference = Math.round((totalAmount - currentTotal) * 10) / 10;

  if (difference !== 0 && items.length > 0) {
    // 將差額加到金額最大的人身上
    const maxItem = items.reduce((max, item) =>
      item.amount > max.amount ? item : max
    );
    maxItem.amount = Math.round((maxItem.amount + difference) * 10) / 10;
  }
}
