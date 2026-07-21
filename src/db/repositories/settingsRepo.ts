import { db } from '../schema'
import type { TaxSettings, Holiday } from '@/types'
import { syncAdd, syncUpdate, syncDelete } from '@/firebase/syncManager'

export const settingsRepo = {
  async getTaxSettings(ipId: number): Promise<TaxSettings | undefined> {
    const settings = await db.taxSettings.where('ipId').equals(ipId).first()
    return settings
      ? { ...settings, considerPreviousYearAdditional: settings.considerPreviousYearAdditional !== false }
      : undefined
  },

  async saveTaxSettings(settings: Omit<TaxSettings, 'id'>, userId?: string): Promise<number> {
    settings = {
      ...settings,
      considerPreviousYearAdditional: settings.considerPreviousYearAdditional !== false,
    }
    const existing = await db.taxSettings.where('ipId').equals(settings.ipId).first()
    if (existing?.id) {
      await db.taxSettings.update(existing.id, { ...settings, updatedAt: new Date().toISOString() })
      if (userId) await syncUpdate(userId, db.taxSettings, existing.id, { ...settings, id: existing.id })
      return existing.id
    }
    const id = await db.taxSettings.add(settings as TaxSettings)
    if (userId) await syncAdd(userId, db.taxSettings, id as number, { ...settings, id })
    return id
  },

  async getHolidays(ipId: number, year: number): Promise<Holiday[]> {
    return db.holidays.where({ ipId, year }).toArray()
  },

  async addHoliday(holiday: Omit<Holiday, 'id'>, userId?: string): Promise<number> {
    const id = await db.holidays.add(holiday as Holiday)
    if (userId) await syncAdd(userId, db.holidays, id as number, { ...holiday, id })
    return id
  },

  async deleteHoliday(id: number, userId?: string): Promise<void> {
    await db.holidays.delete(id)
    if (userId) await syncDelete(userId, db.holidays, id)
  },

  async clearHolidays(ipId: number, year: number): Promise<void> {
    await db.holidays.where({ ipId, year }).delete()
  }
}
