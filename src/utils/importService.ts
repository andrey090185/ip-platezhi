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
  'дебет': 'type',
  'кредит': 'type',
  'debit': 'type',
  'credit': 'type',
  'type': 'type',
  'transaction type': 'type',

  // === Amount (single column) ===
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

/**
 * Try to auto-detect which column contains what data by scanning ALL rows.
 * Returns a map of lowercased header -> field name only for fields it can detect.
 * Used as fallback when FIELD_MAP matching produces no results.
 */
function autoDetectColumns(rows: Record<string, string>[]): Record<string, keyof ImportRow> {
  if (rows.length === 0) return {}
  const keys = Object.keys(rows[0])

  // Score each column across ALL rows using percentages
  const totals: Record<string, { date: number; amount: number; type: number; filled: number }> = {}
  for (const key of keys) totals[key] = { date: 0, amount: 0, type: 0, filled: 0 }

  for (const row of rows) {
    for (const key of keys) {
      const val = (row[key] || '').trim()
      if (!val) continue
      const t = totals[key]
      t.filled++

      // Date: DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD
      if (/^\d{2}[.\-/]\d{2}[.\-/]\d{2,4}$/.test(val) ||
          /^\d{4}[.\-/]\d{2}[.\-/]\d{2}$/.test(val)) {
        t.date++
      }

      // Amount: clean positive number (not a date)
      const cleaned = val.replace(/[^\d.,\-]/g, '').replace(/,/g, '.')
      const num = Number(cleaned)
      if (!isNaN(num) && num > 0 && num < 1_000_000_000) {
        if (!/^\d{1,2}[.\-/]\d{1,2}[.\-/]\d{1,4}$/.test(val)) {
          t.amount++
        }
      } else if (/[₽€$]/.test(val)) {
        t.amount += 0.5
      }

      // Type: keywords
      const lower = val.toLowerCase()
      if (lower.includes('доход') || lower.includes('расход') ||
          lower.includes('приход') || lower.includes('списание') ||
          lower.includes('возврат') || lower.includes('дебет') ||
          lower.includes('кредит') || lower.includes('income') ||
          lower.includes('expense') || lower.includes('debit') ||
          lower.includes('credit')) {
        t.type++
      }
    }
  }

  // Pick best column: must have >30% non-empty values matching the type
  const bestKey = (field: 'date' | 'amount' | 'type'): string => {
    let best = ''
    let bestPct = 0
    for (const key of keys) {
      const t = totals[key]
      if (t.filled === 0) continue
      const pct = t[field] / t.filled
      if (pct > bestPct && pct >= 0.3) {
        bestPct = pct
        best = key
      }
    }
    return best
  }

  const result: Record<string, keyof ImportRow> = {}
  const dk = bestKey('date')
  if (dk) result[dk.toLowerCase().trim()] = 'date'
  const ak = bestKey('amount')
  if (ak) result[ak.toLowerCase().trim()] = 'amount'
  const tk = bestKey('type')
  if (tk) result[tk.toLowerCase().trim()] = 'type'
  return result
}

export function generateBatchId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `batch_${ts}_${rand}`
}

function processRows(
  rawRows: Record<string, string>[],
  ipId: number,
  extraMapping: Record<string, keyof ImportRow> = {},
): ImportResult {
  const now = new Date().toISOString()
  const batchId = generateBatchId()
  const transactions: Omit<Transaction, 'id'>[] = []
  const errors: { row: number; message: string }[] = []

  // Merge FIELD_MAP with extra mapping (extra overrides on conflict)
  const combinedMap: Record<string, keyof ImportRow> = { ...FIELD_MAP }
  for (const [key, field] of Object.entries(extraMapping)) {
    combinedMap[key] = field
  }

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]

    // Map using both FIELD_MAP and auto-detected columns
    const mapped: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw)) {
      const canonical = combinedMap[key.toLowerCase().trim()]
      if (canonical && !mapped[canonical]) {
        mapped[canonical] = value
      }
    }

    const importRow: ImportRow = {
      date: mapped.date ?? '',
      type: mapped.type ?? '',
      amount: mapped.amount ?? '',
      category: mapped.category ?? '',
      counterparty: mapped.counterparty ?? '',
      comment: mapped.comment ?? '',
      usnRelevant: mapped.usnRelevant ?? 'true',
      ndsRelevant: mapped.ndsRelevant ?? 'false',
    }

    let date = importRow.date
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

    const rawAmount = importRow.amount
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

    const type = detectType(importRow.type)
    const period = date.substring(0, 7)

    transactions.push({
      ipId,
      date,
      type,
      amount,
      category: importRow.category,
      counterparty: importRow.counterparty,
      comment: importRow.comment,
      usnRelevant: parseBool(importRow.usnRelevant, true),
      ndsRelevant: parseBool(importRow.ndsRelevant, false),
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

export function rowsToTransactions(
  rawRows: Record<string, string>[],
  ipId: number,
): ImportResult {
  // First pass: try with FIELD_MAP only
  let result = processRows(rawRows, ipId)

  // If all rows failed with empty date AND empty amount (headers didn't match),
  // try auto-detecting columns
  if (result.transactions.length === 0 && result.errors.length > 0) {
    const allEmptyDateAndAmount = result.errors.every(e =>
      e.message.startsWith('Отсутствует дата') || e.message.startsWith('Некорректная сумма: ""')
    )
    if (allEmptyDateAndAmount) {
      const autoMap = autoDetectColumns(rawRows)
      if (Object.keys(autoMap).length > 0) {
        result = processRows(rawRows, ipId, autoMap)
      }
    }
  }

  return result
}
