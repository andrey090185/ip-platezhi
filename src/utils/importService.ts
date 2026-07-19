import type { Transaction, TransactionType } from '@/types'

/** Keys a user might use in CSV/Excel headers. */
const FIELD_MAP: Record<string, keyof ImportRow> = {
  // === Date ===
  'дата': 'date',
  'дата операции': 'date',
  'дата опер': 'date',
  'дата проводки': 'date',
  'дата документа': 'date',
  'date': 'date',
  'transaction date': 'date',
  'doc date': 'date',
  'posting date': 'date',

  // === Type ===
  'тип': 'type',
  'тип операции': 'type',
  'вид': 'type',
  'вид операции': 'type',
  'направление': 'type',
  'операция': 'type',
  'type': 'type',
  'transaction type': 'type',

  // === Amount ===
  'сумма': 'amount',
  'сумма (₽)': 'amount',
  'сумма, ₽': 'amount',
  'сумма, руб': 'amount',
  'сумма (руб)': 'amount',
  'сумма (руб.)': 'amount',
  'сумма руб': 'amount',
  'сумма операции': 'amount',
  'сумма опер': 'amount',
  'сумма платежа': 'amount',
  'сумма дохода': 'amount',
  'сумма расхода': 'amount',
  'amount': 'amount',
  'sum': 'amount',
  'total': 'amount',

  // === Category ===
  'категория': 'category',
  'категория дохода': 'category',
  'категория расхода': 'category',
  'статья': 'category',
  'статья доходов': 'category',
  'статья расходов': 'category',
  'category': 'category',
  'category name': 'category',

  // === Counterparty ===
  'контрагент': 'counterparty',
  'контрагент (плательщик)': 'counterparty',
  'контрагент (получатель)': 'counterparty',
  'плательщик': 'counterparty',
  'получатель': 'counterparty',
  'от кого': 'counterparty',
  'кому': 'counterparty',
  'корреспондент': 'counterparty',
  'наименование': 'counterparty',
  'имя': 'counterparty',
  'название': 'counterparty',
  'counterparty': 'counterparty',
  'payer': 'counterparty',
  'receiver': 'counterparty',
  'payee': 'counterparty',
  'beneficiary': 'counterparty',

  // === Comment ===
  'комментарий': 'comment',
  'коммент': 'comment',
  'примечание': 'comment',
  'описание': 'comment',
  'назначение': 'comment',
  'назначение платежа': 'comment',
  'основание': 'comment',
  'содержание': 'comment',
  'содержание операции': 'comment',
  'детали': 'comment',
  'детали платежа': 'comment',
  'comment': 'comment',
  'note': 'comment',
  'notes': 'comment',
  'description': 'comment',
  'purpose': 'comment',
  'payment purpose': 'comment',
  'details': 'comment',

  // === USN ===
  'учсн': 'usnRelevant',
  'усн': 'usnRelevant',
  'учитывается в усн': 'usnRelevant',
  'учитывать в усн': 'usnRelevant',
  'для усн': 'usnRelevant',
  'usn': 'usnRelevant',
  'usn relevant': 'usnRelevant',

  // === NDS ===
  'ндс': 'ndsRelevant',
  'учитывается в ндс': 'ndsRelevant',
  'учитывать в ндс': 'ndsRelevant',
  'ставка ндс': 'ndsRelevant',
  'nds': 'ndsRelevant',
  'vat': 'ndsRelevant',
}

export interface ImportRow {
  date: string
  type: string
  amount: string
  category: string
  counterparty: string
  comment: string
  usnRelevant: string
  ndsRelevant: string
}

export interface ImportResult {
  transactions: Omit<Transaction, 'id'>[]
  errors: { row: number; message: string }[]
}

function mapRow(raw: Record<string, string>): ImportRow {
  const mapped: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    const canonical = FIELD_MAP[key.toLowerCase().trim()]
    if (canonical && !mapped[canonical]) {
      mapped[canonical] = value
    }
  }
  return {
    date: mapped.date ?? '',
    type: mapped.type ?? '',
    amount: mapped.amount ?? '',
    category: mapped.category ?? '',
    counterparty: mapped.counterparty ?? '',
    comment: mapped.comment ?? '',
    usnRelevant: mapped.usnRelevant ?? 'true',
    ndsRelevant: mapped.ndsRelevant ?? 'false',
  }
}

function detectType(raw: string): TransactionType {
  const v = raw.toLowerCase().trim()
  if (v === 'доход' || v === 'income' || v === 'приход') return 'income'
  if (v === 'расход' || v === 'expense' || v === 'списание') return 'expense'
  if (v === 'возврат дохода' || v === 'return_income') return 'return_income'
  if (v === 'возврат расхода' || v === 'return_expense') return 'return_expense'
  if (v.includes('доход')) return 'income'
  if (v.includes('расход')) return 'expense'
  if (v.includes('income')) return 'income'
  if (v.includes('expense')) return 'expense'
  return 'income'
}

function parseBool(v: string, fallback: boolean): boolean {
  const t = v.toLowerCase().trim()
  if (t === 'да' || t === 'yes' || t === 'true' || t === '1' || t === '✓') return true
  if (t === 'нет' || t === 'no' || t === 'false' || t === '0' || t === '✗') return false
  return fallback
}

export function generateBatchId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `batch_${ts}_${rand}`
}

export function rowsToTransactions(
  rawRows: Record<string, string>[],
  ipId: number,
): ImportResult {
  const now = new Date().toISOString()
  const batchId = generateBatchId()
  const transactions: Omit<Transaction, 'id'>[] = []
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const mapped = mapRow(raw)

    let date = mapped.date
    if (!date) {
      errors.push({ row: i + 2, message: 'Отсутствует дата, используется текущая' })
      date = now.split('T')[0]
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parts = date.split(/[.\-/]/)
      if (parts.length === 3) {
        const [d1, d2, d3] = parts
        const y = d3.length === 4 ? d3 : d1.length === 4 ? d1 : String(new Date().getFullYear())
        const m = d3.length === 4 ? d2 : d1.length === 4 ? d2 : d1
        const d = d3.length === 4 ? d1 : d1.length === 4 ? d3 : d1
        date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      }
    }

    const rawAmount = mapped.amount
    let amount = rawAmount
      .replace(/[^\d.,\-]/g, '')  // remove all but digits, dots, commas, dashes
      .replace(/,/g, '.')         // convert all commas to dots

    // If there are multiple dots, keep only the last one (decimal separator)
    const dotCount = (amount.match(/\./g) || []).length
    if (dotCount > 1) {
      const lastDot = amount.lastIndexOf('.')
      amount = amount.slice(0, lastDot).replace(/\./g, '') + amount.slice(lastDot)
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) < 0) {
      errors.push({ row: i + 2, message: `Некорректная сумма: "${rawAmount}"` })
      continue
    }
    amount = Number(amount).toFixed(2)

    const type = detectType(mapped.type)
    const period = date.substring(0, 7)

    transactions.push({
      ipId,
      date,
      type,
      amount,
      category: mapped.category,
      counterparty: mapped.counterparty,
      comment: mapped.comment,
      usnRelevant: parseBool(mapped.usnRelevant, true),
      ndsRelevant: parseBool(mapped.ndsRelevant, false),
      period,
      importSource: 'file',
      importBatchId: batchId,
      status: 'accounted',
      createdAt: now,
      updatedAt: now,
    })
  }

  return { transactions, errors }
}