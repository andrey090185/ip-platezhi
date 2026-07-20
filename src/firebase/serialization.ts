function sanitizeFirebaseValue(value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Нельзя синхронизировать бесконечное или неопределённое число')
    return value
  }
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeFirebaseValue(item) ?? null)
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      const sanitized = sanitizeFirebaseValue(item)
      if (sanitized !== undefined) result[key] = sanitized
    }
    return result
  }
  return String(value)
}

/** Firebase Realtime Database rejects undefined at any nesting level. */
export function toFirebaseRecord(data: Record<string, unknown>): Record<string, unknown> {
  const { id: _localId, ...record } = data
  return sanitizeFirebaseValue(record) as Record<string, unknown>
}
