const MAX_HIGH_WORD = 0x1fffff
const WORD_SIZE = 0x100000000

/**
 * Generates a positive, JSON-safe 53-bit integer. Random primary keys avoid
 * Dexie auto-increment collisions when two offline devices create records for
 * the same Firebase account before either device synchronizes.
 */
export function createEntityId(): number {
  if (globalThis.crypto?.getRandomValues) {
    const words = globalThis.crypto.getRandomValues(new Uint32Array(2))
    const id = (words[0] & MAX_HIGH_WORD) * WORD_SIZE + words[1]
    return id || 1
  }

  const high = Math.floor(Math.random() * (MAX_HIGH_WORD + 1))
  const low = Math.floor(Math.random() * WORD_SIZE)
  return high * WORD_SIZE + low || 1
}
