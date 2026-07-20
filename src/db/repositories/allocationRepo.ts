import { db } from '../schema'
import type { TransactionAllocation } from '@/types'
import { scheduleSync, syncDelete } from '@/firebase/syncManager'

export const allocationRepo = {
  async getAll(ipId: number): Promise<TransactionAllocation[]> {
    return db.transactionAllocations.where('ipId').equals(ipId).toArray()
  },

  async getForTransaction(transactionId: number): Promise<TransactionAllocation[]> {
    return db.transactionAllocations.where('transactionId').equals(transactionId).toArray()
  },

  async replaceForTransaction(
    ipId: number,
    transactionId: number,
    allocations: Omit<TransactionAllocation, 'id' | 'ipId' | 'transactionId' | 'createdAt' | 'updatedAt'>[],
  ): Promise<void> {
    const now = new Date().toISOString()
    const existing = await db.transactionAllocations.where('transactionId').equals(transactionId).toArray()
    await db.transaction('rw', db.transactionAllocations, async () => {
      await db.transactionAllocations.where('transactionId').equals(transactionId).delete()
      if (allocations.length) {
        await db.transactionAllocations.bulkAdd(allocations.map(item => ({
          ...item,
          ipId,
          transactionId,
          createdAt: now,
          updatedAt: now,
        })))
      }
    })
    for (const item of existing) if (item.id) await syncDelete(undefined, db.transactionAllocations, item.id)
    scheduleSync()
  },
}
