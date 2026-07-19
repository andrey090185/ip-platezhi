import type { Transaction, TransactionType } from '@/types'

/** Keys a user might use in CSV/Excel headers. */
const FIELD_MAP: Record<string, keyof ImportRow> = {
  'дата': 'date',
  'дата операции': 'date',
  'тип': 'type',
  'тип операции': 'type',
  'сумма': 'amount',
  'сумма (₽)': 'amount',
  'сумма, ₽': 'amount',
  'категория': 'category',
  'контрагент': 'counterparty',
  'комментарий': 'comment',
  'коммент': 'comment',
  'примечание': 'comment',
  'учсн': 'usnRelevant',
  'усн': 'usnRelevant',
  'учитывается в усн': 'usnRelevant',
  'ндс': 'ndsRelevant',
  'учитывается в ндс': 'ndsRelevant',
  'date': 'date',
  'type': 'type',
  'amount': 'amount',
  'sum': 'amount',
  'category': 'category',
  'counterparty': 'counterparty',
  'comment': 'comment',
  'note': 'comment',
  'description': 'comment',
  'usn': 'usnRelevant',
  'nds': 'ndsRelevant',
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

    let amount = mapped.amount.replace(/[^\d.,\-]/g, '').replace(',', '.')
    if (!amount || isNaN(Number(amount)) || Number(amount) < 0) {
      errors.push({ row: i + 2, message: `Некорректная сумма: "${mapped.amount}"` })
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