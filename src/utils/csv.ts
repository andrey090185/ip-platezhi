import type { Transaction } from '@/types'

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
 * Try to decode a Latin-1 string (each char is 0-255) as Windows-1251,
 * returning a proper UTF-8 string. If the result looks like valid Russian text,
 * return it; otherwise return the original.
 */
function tryDecodeWin1251(text: string): string {
  // If the text already has valid UTF-8 Russian chars, skip
  if (/[а-яёА-ЯЁ]/.test(text)) return text

  // Try to interpret each char code as Windows-1251 byte
  try {
    const bytes = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i++) {
      bytes[i] = text.charCodeAt(i) & 0xFF
    }
    const decoded = new TextDecoder('windows-1251').decode(bytes)
    // If decoding produced meaningful Russian chars, use it
    if (/[а-яёА-ЯЁ]/.test(decoded)) return decoded
  } catch {
    // ignore
  }
  return text
}

/**
 * Parse one CSV line with full quote support, returning the array of fields.
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
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
 * Detect the CSV delimiter by scanning the first line.
 * Counts occurrences of `,` and `;` (only outside quoted regions)
 * and returns the one with the most matches. Defaults to `,`.
 */
function detectDelimiter(firstLine: string): string {
  let commaCount = 0
  let semicolonCount = 0
  let inQuotes = false
  for (const char of firstLine) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (!inQuotes) {
      if (char === ',') commaCount++
      if (char === ';') semicolonCount++
    }
  }
  // If semicolons significantly outnumber commas, use semicolon
  if (semicolonCount > commaCount) return ';'
  return ','
}

export function parseCSV(text: string): Record<string, string>[] {
  // Try to decode if it's Windows-1251
  text = tryDecodeWin1251(text)

  // Normalize line endings (handle CRLF & CR)
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Detect delimiter from the header line
  const delimiter = detectDelimiter(lines[0])

  // Parse headers with full quote support
  const headers = parseCSVLine(lines[0], delimiter).map(h =>
    h.replace(/^"|"$/g, '').trim()
  )

  // Parse data rows
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line, delimiter)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = (values[i] || '').replace(/^"|"$/g, '').trim()
    })
    return row
  })
}
