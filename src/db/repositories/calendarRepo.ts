import { db } from '../schema'
import type { CalendarEvent } from '@/types'

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

  async add(event: Omit<CalendarEvent, 'id'>): Promise<number> {
    return db.calendarEvents.add(event as CalendarEvent)
  },

  async addBatch(events: Omit<CalendarEvent, 'id'>[]): Promise<void> {
    await db.calendarEvents.bulkAdd(events as CalendarEvent[])
  },

  async update(id: number, changes: Partial<CalendarEvent>): Promise<void> {
    await db.calendarEvents.update(id, { ...changes, updatedAt: new Date().toISOString() })
  },

  async delete(id: number): Promise<void> {
    await db.calendarEvents.delete(id)
  },

  async clearForIp(ipId: number): Promise<void> {
    await db.calendarEvents.where('ipId').equals(ipId).delete()
  }
}
