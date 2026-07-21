import { db } from './schema'
import type { TaxSettings, Holiday } from '@/types'
import { DEFAULT_TAX_SETTINGS, settingsForRuleSet } from '@/engine/taxRules'

const RUSSIAN_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: 'Новый год', year: 2026 },
  { date: '2026-01-02', name: 'Новый год', year: 2026 },
  { date: '2026-01-03', name: 'Новый год', year: 2026 },
  { date: '2026-01-04', name: 'Новый год', year: 2026 },
  { date: '2026-01-05', name: 'Новый год', year: 2026 },
  { date: '2026-01-06', name: 'Новый год', year: 2026 },
  { date: '2026-01-07', name: 'Рождество Христово', year: 2026 },
  { date: '2026-01-08', name: 'Новый год', year: 2026 },
  { date: '2026-02-23', name: 'День защитника Отечества', year: 2026 },
  { date: '2026-03-08', name: 'Международный женский день', year: 2026 },
  { date: '2026-05-01', name: 'Праздник Весны и Труда', year: 2026 },
  { date: '2026-05-09', name: 'День Победы', year: 2026 },
  { date: '2026-06-12', name: 'День России', year: 2026 },
  { date: '2026-11-04', name: 'День народного единства', year: 2026 },
]

export async function seedTaxSettings(ipId: number, year: number) {
  const existing = await db.taxSettings.where('ipId').equals(ipId).first()
  if (existing) return

  const now = new Date().toISOString()
  const base = {
    ...DEFAULT_TAX_SETTINGS,
    ipId,
    year,
    createdAt: now,
    updatedAt: now,
  } as TaxSettings
  await db.taxSettings.add(settingsForRuleSet(base, year))
}

export async function seedHolidays(ipId: number, year: number) {
  const existing = await db.holidays.where({ ipId, year }).first()
  if (existing) return

  for (const h of RUSSIAN_HOLIDAYS_2026) {
    await db.holidays.add({
      ipId,
      date: h.date,
      name: h.name,
      year: h.year,
    } as Holiday)
  }
}

// Development-only: seed test data for debugging
export async function seedDevData(ipId: number) {
  console.warn('[DEV] Seeding test data for ipId:', ipId)
  const now = new Date().toISOString()
  const testTxs = [
    { ipId, date: '2026-01-15', type: 'income' as const, amount: '150000', category: 'Услуги', counterparty: 'ООО Ромашка', comment: '[DEV] Тестовая операция', usnRelevant: true, ndsRelevant: false, period: '2026-01', importSource: null, importBatchId: null, status: 'accounted' as const, createdAt: now, updatedAt: now },
    { ipId, date: '2026-02-10', type: 'income' as const, amount: '200000', category: 'Услуги', counterparty: 'ООО Вектор', comment: '[DEV] Тестовая операция', usnRelevant: true, ndsRelevant: false, period: '2026-02', importSource: null, importBatchId: null, status: 'accounted' as const, createdAt: now, updatedAt: now },
  ]
  for (const tx of testTxs) {
    await db.transactions.add(tx as any)
  }
}
