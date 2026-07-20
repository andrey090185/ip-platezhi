const HEADER_HINTS = {
  date: /(^|\s)(дата|date)(\s|$)|дата\s+(операц|провод|документ)/i,
  amount: /сумм|amount|total|дебет|кредит|списан|зачислен|приход|расход/i,
  details: /контрагент|плательщик|получатель|назначен|описан|комментар|категор|операц|purpose|description|counterparty|payer|payee/i,
}

/** Normalizes bank-export headers without losing their column positions. */
export function normalizeImportHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g, ' ')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[«»"']/g, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[.,;:!?№₽]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function importHeaderScore(cells: unknown[]): number {
  const normalized = cells.map(normalizeImportHeader).filter(Boolean)
  if (normalized.length < 2) return 0

  const matches = {
    date: normalized.some((cell) => HEADER_HINTS.date.test(cell)),
    amount: normalized.some((cell) => HEADER_HINTS.amount.test(cell)),
    details: normalized.some((cell) => HEADER_HINTS.details.test(cell)),
  }
  const groups = Object.values(matches).filter(Boolean).length
  if (groups < 2) return 0

  return groups * 100 + Math.min(normalized.length, 20)
}

/** Finds the real table header after optional bank name, account and period rows. */
export function findImportHeaderRow(rows: unknown[][], scanLimit = 60): number {
  let bestIndex = -1
  let bestScore = 0

  for (let index = 0; index < Math.min(rows.length, scanLimit); index++) {
    const score = importHeaderScore(rows[index] ?? [])
    if (score > bestScore) {
      bestIndex = index
      bestScore = score
    }
  }

  if (bestIndex >= 0) return bestIndex
  return rows.findIndex((row) => (row ?? []).some((cell) => normalizeImportHeader(cell)))
}
