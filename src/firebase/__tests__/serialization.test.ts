import { describe, expect, it } from 'vitest'
import { toFirebaseRecord } from '../serialization'

describe('Firebase serialization', () => {
  it('removes local ids and undefined values recursively', () => {
    expect(toFirebaseRecord({
      id: 42,
      amount: '100.00',
      optional: undefined,
      nested: { kept: false, removed: undefined },
      values: [1, undefined, null],
    })).toEqual({
      amount: '100.00',
      nested: { kept: false },
      values: [1, null, null],
    })
  })

  it('keeps zero, false and null values', () => {
    expect(toFirebaseRecord({ id: 1, zero: 0, enabled: false, empty: null })).toEqual({
      zero: 0,
      enabled: false,
      empty: null,
    })
  })
})
