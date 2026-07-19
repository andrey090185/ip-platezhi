import * as XLSX from 'xlsx'

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
 * Reads the first sheet, treats the first row as headers.
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

        if (raw.length < 2) {
          resolve([])
          return
        }

        // Clean the header row: remove non-breaking spaces, trim
        const headers = raw[0].map((h) =>
          cleanWhitespace(String(h ?? ''))
        ).filter(Boolean) // drop completely empty headers

        if (headers.length === 0) {
          resolve([])
          return
        }

        const rows: Record<string, string>[] = []
        for (let i = 1; i < raw.length; i++) {
          const row: Record<string, string> = {}
          for (let j = 0; j < headers.length; j++) {
            const val = raw[i]?.[j]
            row[headers[j]] = formatCellValue(val)
          }
          // Skip completely empty rows
          if (Object.values(row).every(v => !v)) continue
          rows.push(row)
        }

        resolve(rows)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Ошибка парсинга Excel'))
      }
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsArrayBuffer(file)
  })
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
