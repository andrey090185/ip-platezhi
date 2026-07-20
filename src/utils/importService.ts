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

function detectType(raw: string): TransactionType | null {
  const v = raw.toLowerCase().trim()
  if (v === 'доход' || v === 'income' || v === 'приход') return 'income'
  if (v === 'расход' || v === 'expense' || v === 'списание') return 'expense'
  if (v === 'возврат дохода' || v === 'return_income') return 'return_income'
  if (v === 'возврат расхода' || v === 'return_expense') return 'return_expense'
  if (v.includes('доход')) return 'income'
  if (v.includes('расход')) return 'expense'
  if (v.includes('income')) return 'income'
  if (v.includes('expense')) return 'expense'
  if (v.includes('дебет') || v.includes('debit')) return 'expense'
  if (v.includes('кредит') || v.includes('credit')) return 'income'
  return null
}

export function transactionFingerprint(input: Pick<Transaction, 'ipId' | 'date' | 'type' | 'amount' | 'counterparty' | 'comment'>): string {
  const source = [
    input.ipId,
    input.date,
    input.type,
    Number(input.amount).toFixed(2),
    input.counterparty.trim().toLowerCase(),
    input.comment.trim().toLowerCase(),
  ].join('|')
  let hash = 2166136261
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `tx_${(hash >>> 0).toString(16).padStart(8, '0')}`
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

  // Score each column across ALL rows
  const totals: Record<string, { date: number; amount: number; type: number; filled: number; textRatio: number }> = {}
  for (const key of keys) {
    totals[key] = { date: 0, amount: 0, type: 0, filled: 0, textRatio: 0 }
  }

  let totalRows = 0
  for (const row of rows) {
    totalRows++
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
      const cleaned = val.replace(/[^\d.,-]/g, '').replace(/,/g, '.')
      const num = Number(cleaned)
      if (!isNaN(num) && num > 0 && num < 1_000_000_000) {
        if (!/^\d{1,2}[.\-/]\d{1,2}[.\-/]\d{1,4}$/.test(val)) {
          t.amount++
        }
      } else if (/[₽€$]/.test(val)) {
        t.amount += 0.5
      }

      // Track text ratio (non-numeric, non-date values)
      const isNumeric = !isNaN(num) && cleaned.length > 0
      const isDate = /^\d{1,4}[.\-/]\d{1,2}[.\-/]\d{1,4}$/.test(val)
      if (!isNumeric && !isDate && val.length > 3) {
        t.textRatio++
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

  // Helper: pick the best column for a field
  const bestKey = (field: 'date' | 'amount' | 'type'): string => {
    let best = ''
    let bestCount = 0
    for (const key of keys) {
      const t = totals[key]
      // For amount: skip columns where most non-empty values are text (>80% text ratio)
      if (field === 'amount' && t.filled > 0) {
        const textPct = t.textRatio / t.filled
        if (textPct > 0.8) continue // skip text-only columns for amount
      }
      const count = t[field]
      if (count > bestCount && count > 0) {
        bestCount = count
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

  // Special case: if no single amount column found, look for debit/credit pair
  if (!ak) {
    const headerKeys = keys.map(k => k.toLowerCase().trim())
    const debitKey = headerKeys.find(k => k.includes('дебет') || k.includes('debit'))
    const creditKey = headerKeys.find(k => k.includes('кредит') || k.includes('credit'))
    // If both debit and credit columns exist, use the one with more numeric values
    for (const candidate of [debitKey, creditKey]) {
      if (candidate && (!ak || (totals[candidate]?.amount || 0) > (totals[ak]?.amount || 0))) {
        // Check it actually has amounts (not just headers like "Дебет")
        if ((totals[candidate]?.amount || 0) > (totals[candidate]?.textRatio || 0)) {
          // Also try to combine debit+credit: map the same field twice?
          // Actually just use the better one
        }
        if ((totals[candidate]?.amount || 0) >= 2) {
          result[candidate] = 'amount'
        }
      }
    }
  }

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

    // Bank statements often provide separate debit/credit amount columns.
    // Use the non-empty one and infer direction instead of dropping the row.
    const debitEntry = Object.entries(raw).find(([key]) => /дебет|debit/i.test(key))
    const creditEntry = Object.entries(raw).find(([key]) => /кредит|credit/i.test(key))
    const debitValue = debitEntry?.[1]?.trim()
    const creditValue = creditEntry?.[1]?.trim()
    if (debitValue && !creditValue) {
      mapped.amount = debitValue
      mapped.type = 'debit'
    } else if (creditValue && !debitValue) {
      mapped.amount = creditValue
      mapped.type = 'credit'
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
      errors.push({ row: i + 2, message: 'Отсутствует дата — строка пропущена' })
      continue
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
      errors.push({ row: i + 2, message: `Некорректная дата: "${importRow.date}"` })
      continue
    }

    const rawAmount = importRow.amount
    let amount = rawAmount
      .replace(/[^\d.,-]/g, '')  // remove all but digits, dots, commas, dashes
      .replace(/,/g, '.')         // convert all commas to dots

    // If there are multiple dots, keep only the last one (decimal separator)
    const dotCount = (amount.match(/\./g) || []).length
    if (dotCount > 1) {
      const lastDot = amount.lastIndexOf('.')
      amount = amount.slice(0, lastDot).replace(/\./g, '') + amount.slice(lastDot)
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) === 0) {
      errors.push({ row: i + 2, message: `Некорректная сумма: "${rawAmount}"` })
      continue
    }
    const signedAmount = Number(amount)
    amount = Math.abs(signedAmount).toFixed(2)

    const detectedType = detectType(importRow.type)
    const type = detectedType ?? (signedAmount < 0 ? 'expense' : 'income')
    const needsReview = detectedType === null
    const period = date.substring(0, 7)

    const transaction: Omit<Transaction, 'id'> = {
      ipId,
      date,
      type,
      amount,
      category: importRow.category,
      counterparty: importRow.counterparty,
      comment: importRow.comment,
      usnRelevant: needsReview ? false : parseBool(importRow.usnRelevant, type === 'income'),
      ndsRelevant: parseBool(importRow.ndsRelevant, false),
      period,
      importSource: 'file',
      importBatchId: batchId,
      status: needsReview ? 'needs_review' : 'accounted',
      createdAt: now,
      updatedAt: now,
    }
    transaction.fingerprint = transactionFingerprint(transaction)
    transactions.push(transaction)
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
