import { findImportHeaderRow } from './importHeaders'

export function exportToCSV(data: Record<string, any>[], filename: string): void {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = String(row[h] ?? '')
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val
    }).join(',')
  )
  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
}

/**
 * Parse one CSV line with full quote support, returning the array of fields.
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

/**
 * Detect the delimiter across the first records, including files whose first
 * rows contain a bank name or account details rather than the table header.
 */
function detectDelimiter(records: string[]): string {
  const candidates = [',', ';', '\t']
  let best = ','
  let bestCount = 0
  for (const delimiter of candidates) {
    const maxColumns = records
      .slice(0, 60)
      .reduce((max, record) => Math.max(max, parseCSVLine(record, delimiter).length), 1)
    if (maxColumns > bestCount) {
      best = delimiter
      bestCount = maxColumns
    }
  }
  return best
}

function splitCSVRecords(text: string): string[] {
  const records: string[] = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"') {
      current += char
      if (inQuotes && text[index + 1] === '"') {
        current += text[index + 1]
        index++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[index + 1] === '\n') index++
      if (current.trim()) records.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) records.push(current)
  return records
}

export function parseCSV(text: string): Record<string, string>[] {
  const records = splitCSVRecords(text.replace(/^\uFEFF/, ''))
  if (records.length < 2) return []

  const delimiter = detectDelimiter(records)
  const parsedRecords = records.map((record) => parseCSVLine(record, delimiter))
  const headerIndex = findImportHeaderRow(parsedRecords)
  if (headerIndex < 0 || headerIndex >= parsedRecords.length - 1) return []
  const headers = parsedRecords[headerIndex].map((header) => header.trim())

  // Parse data rows
  return parsedRecords.slice(headerIndex + 1).map(values => {
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      if (h) row[h] = (values[i] || '').trim()
    })
    return row
  }).filter((row) => Object.values(row).some(Boolean))
}

/** Decode a CSV before parsing. Russian bank exports often use Windows-1251. */
export function parseCSVBuffer(buffer: ArrayBuffer): Record<string, string>[] {
  const bytes = new Uint8Array(buffer)
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder('windows-1251').decode(bytes)
  }
  return parseCSV(text)
}
