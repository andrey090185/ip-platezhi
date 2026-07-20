import { describe, expect, it } from 'vitest'
import { createEntityId } from '../entityId'

describe('createEntityId', () => {
  it('returns positive safe integers', () => {
    for (let index = 0; index < 100; index += 1) {
      const id = createEntityId()
      expect(Number.isSafeInteger(id)).toBe(true)
      expect(id).toBeGreaterThan(0)
    }
  })

  it('does not repeat ids in a practical local batch', () => {
    const ids = Array.from({ length: 1_000 }, () => createEntityId())
    expect(new Set(ids).size).toBe(ids.length)
  })
})
