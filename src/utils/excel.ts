import * as XLSX from 'xlsx'

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
        const workbook = XLSX.read(data, { type: 'array', cellDates: false })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          resolve([])
          return
        }
        const sheet = workbook.Sheets[sheetName]
        // Convert to array of arrays, defval '' to keep empty cells
        const raw: string[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          blankrows: false,
        })
        if (raw.length < 2) {
          resolve([])
          return
        }
        const headers = raw[0].map((h) => String(h).trim())
        const rows: Record<string, string>[] = []
        for (let i = 1; i < raw.length; i++) {
          const row: Record<string, string> = {}
          for (let j = 0; j < headers.length; j++) {
            const val = raw[i][j]
            row[headers[j]] = val != null ? String(val).trim() : ''
          }
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