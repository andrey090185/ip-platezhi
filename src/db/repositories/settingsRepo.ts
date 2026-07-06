import { db } from '../schema'
import type { TaxSettings, Holiday } from '@/types'

export const settingsRepo = {
  async getTaxSettings(ipId: number): Promise<TaxSettings | undefined> {
    return db.taxSettings.where('ipId').equals(ipId).first()
  },

  async saveTaxSettings(settings: Omit<TaxSettings, 'id'>): Promise<number> {
    const existing = await db.taxSettings.where('ipId').equals(settings.ipId).first()
    if (existing?.id) {
      await db.taxSettings.update(existing.id, { ...settings, updatedAt: new Date().toISOString() })
      return existing.id
    }
    return db.taxSettings.add(settings as TaxSettings)
  },

  async getHolidays(ipId: number, year: number): Promise<Holiday[]> {
    return db.holidays.where({ ipId, year }).toArray()
  },

  async addHoliday(holiday: Omit<Holiday, 'id'>): Promise<number> {
    return db.holidays.add(holiday as Holiday)
  },

  async deleteHoliday(id: number): Promise<void> {
    await db.holidays.delete(id)
  },

  async clearHolidays(ipId: number, year: number): Promise<void> {
    await db.holidays.where({ ipId, year }).delete()
  }
}
