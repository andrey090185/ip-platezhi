import * as XLSX from 'xlsx'
import { findImportHeaderRow } from './importHeaders'

/**
 * Strip all Unicode whitespace characters (including non-breaking spaces)
 * and normalize internal whitespace.
 */
function cleanWhitespace(s: string): string {
  return s.replace(/[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g, ' ').trim()
}

/**
 * Format a value from an Excel cell into a clean string.
 */
function formatCellValue(val: unknown): string {
  if (val == null) return ''

  // Date object from Excel (when cellDates: true)
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // Number: keep as-is, downstream parser handles amount format
  if (typeof val === 'number') {
    return String(val)
  }

  // Boolean
  if (typeof val === 'boolean') {
    return val ? 'да' : 'нет'
  }

  // String
  return cleanWhitespace(String(val))
}

/**
 * Parse an Excel file (.xlsx, .xls) and return an array of row objects.
 * Reads the first sheet and finds the actual header after optional bank metadata.
 */
export function parseExcel(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        // Use cellDates: true so date cells come back as Date objects
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          resolve([])
          return
        }
        const sheet = workbook.Sheets[sheetName]

        // Convert to array of arrays (raw including all value types)
        const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          blankrows: false,
        })

        resolve(excelRowsToRecords(raw))
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Ошибка парсинга Excel'))
      }
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsArrayBuffer(file)
  })
}

/** Pure conversion helper used by the parser and regression tests. */
export function excelRowsToRecords(raw: unknown[][]): Record<string, string>[] {
  if (raw.length < 2) return []

  const headerIndex = findImportHeaderRow(raw)
  if (headerIndex < 0 || headerIndex >= raw.length - 1) return []

  // Keep the original indexes: an empty cell in the header must not shift data.
  const headerColumns = (raw[headerIndex] ?? [])
    .map((header, index) => ({ header: cleanWhitespace(String(header ?? '')), index }))
    .filter(({ header }) => Boolean(header))
  if (headerColumns.length === 0) return []

  const seenHeaders = new Map<string, number>()
  const columns = headerColumns.map(({ header, index }) => {
    const occurrence = (seenHeaders.get(header) ?? 0) + 1
    seenHeaders.set(header, occurrence)
    return { header: occurrence === 1 ? header : `${header} ${occurrence}`, index }
  })

  const rows: Record<string, string>[] = []
  for (let rowIndex = headerIndex + 1; rowIndex < raw.length; rowIndex++) {
    const row: Record<string, string> = {}
    for (const { header, index } of columns) {
      row[header] = formatCellValue(raw[rowIndex]?.[index])
    }
    if (Object.values(row).every((value) => !value)) continue
    rows.push(row)
  }
  return rows
}

/**
 * Detect if a file is an Excel file by extension.
 */
export function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.xls')
}

/**
 * Detect if a file is a CSV file by extension.
 */
export function isCSVFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.csv')
}
