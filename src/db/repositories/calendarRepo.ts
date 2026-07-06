import { db } from '../schema'
import type { CalendarEvent } from '@/types'
import { syncAdd, syncUpdate, syncDelete } from '@/firebase/syncManager'

export const calendarRepo = {
  async getAll(ipId: number): Promise<CalendarEvent[]> {
    return db.calendarEvents.where('ipId').equals(ipId).toArray()
  },

  async getByMonth(ipId: number, yearMonth: string): Promise<CalendarEvent[]> {
    const all = await db.calendarEvents.where('ipId').equals(ipId).toArray()
    return all.filter(e => e.date.startsWith(yearMonth))
  },

  async getByDate(ipId: number, date: string): Promise<CalendarEvent[]> {
    return db.calendarEvents.where({ ipId, date }).toArray()
  },

  async add(event: Omit<CalendarEvent, 'id'>, userId?: string): Promise<number> {
    const id = await db.calendarEvents.add(event as CalendarEvent)
    if (userId) await syncAdd(userId, db.calendarEvents, id as number, { ...event, id })
    return id
  },

  async addBatch(events: Omit<CalendarEvent, 'id'>[], userId?: string): Promise<void> {
    const ids = await db.calendarEvents.bulkAdd(events as CalendarEvent[])
    if (userId) {
      for (let i = 0; i < events.length; i++) {
        await syncAdd(userId, db.calendarEvents, ids[i] as number, { ...events[i], id: ids[i] })
      }
    }
  },

  async update(id: number, changes: Partial<CalendarEvent>, userId?: string): Promise<void> {
    await db.calendarEvents.update(id, { ...changes, updatedAt: new Date().toISOString() })
    if (userId) await syncUpdate(userId, db.calendarEvents, id, { ...changes, id })
  },

  async delete(id: number, userId?: string): Promise<void> {
    await db.calendarEvents.delete(id)
    if (userId) await syncDelete(userId, db.calendarEvents, id)
  },

  async clearForIp(ipId: number): Promise<void> {
    await db.calendarEvents.where('ipId').equals(ipId).delete()
  }
}
