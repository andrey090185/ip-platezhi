import { db } from './schema'
import type { IpProfile, TaxSettings, Holiday, Transaction } from '@/types'

const NOW = new Date().toISOString()

const DEFAULT_TAX_SETTINGS: Omit<TaxSettings, 'id'> = {
  ipId: 0,
  year: 2026,
  usnRateIncome: 6,
  usnRateIncomeMinusExpenses: 15,
  usnRegionalRate: 0,
  usnMinTaxRate: 1,
  usnIncomeLimit: 490500000,
  usnEmployeeLimit: 130,
  usnAssetLimit: 218000000,
  fixedPremium: 57390,
  additionalPremiumThreshold: 300000,
  additionalPremiumRate: 1,
  additionalPremiumMax: 321818,
  considerAdditionalInCurrentYear: false,
  insuranceBaseThreshold: 2979000,
  insuranceMainRate: 30,
  insuranceExcessRate: 15.1,
  traumaRate: 0.2,
  ndsThreshold: 20000000,
  ndsMode: 'standard',
  reducedTariffEnabled: false,
  reducedTariffRates: {},
  createdAt: NOW,
  updatedAt: NOW,
}

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
  await db.taxSettings.add({
    ...DEFAULT_TAX_SETTINGS,
    ipId,
    year,
    createdAt: now,
    updatedAt: now,
  } as TaxSettings)
}

export async function seedHolidays(ipId: number, year: number) {
  const existing = await db.holidays.where({ ipId, year }).first()
  if (existing) return

  const now = new Date().toISOString()
  for (const h of RUSSIAN_HOLIDAYS_2026) {
    await db.holidays.add({
      ipId,
      date: h.date,
      name: h.name,
      year: h.year,
    } as Holiday)
  }
}

export async function seedDemoTransactions(ipId: number) {
  const existing = await db.transactions.where('ipId').equals(ipId).first()
  if (existing) return

  const now = new Date().toISOString()
  const demoTxs: Omit<Transaction, 'id'>[] = [
    { ipId, date: '2026-01-15', type: 'income', amount: '150000', category: 'Услуги', counterparty: 'ООО Ромашка', comment: 'Разработка сайта', usnRelevant: true, ndsRelevant: false, period: '2026-01', createdAt: now, updatedAt: now },
    { ipId, date: '2026-01-28', type: 'income', amount: '85000', category: 'Услуги', counterparty: 'ИП Петров', comment: 'Консультация', usnRelevant: true, ndsRelevant: false, period: '2026-01', createdAt: now, updatedAt: now },
    { ipId, date: '2026-02-10', type: 'income', amount: '200000', category: 'Услуги', counterparty: 'ООО Вектор', comment: 'Аудит', usnRelevant: true, ndsRelevant: false, period: '2026-02', createdAt: now, updatedAt: now },
    { ipId, date: '2026-02-20', type: 'expense', amount: '35000', category: 'Аренда', counterparty: 'Аренда офиса', comment: 'Февраль', usnRelevant: true, ndsRelevant: false, period: '2026-02', createdAt: now, updatedAt: now },
    { ipId, date: '2026-03-05', type: 'income', amount: '180000', category: 'Услуги', counterparty: 'ООО Солнце', comment: 'Маркетинг', usnRelevant: true, ndsRelevant: false, period: '2026-03', createdAt: now, updatedAt: now },
    { ipId, date: '2026-03-15', type: 'income', amount: '120000', category: 'Услуги', counterparty: 'ИП Сидоров', comment: 'Дизайн', usnRelevant: true, ndsRelevant: false, period: '2026-03', createdAt: now, updatedAt: now },
    { ipId, date: '2026-04-10', type: 'income', amount: '250000', category: 'Услуги', counterparty: 'ООО Техно', comment: 'Интеграция', usnRelevant: true, ndsRelevant: false, period: '2026-04', createdAt: now, updatedAt: now },
    { ipId, date: '2026-05-12', type: 'income', amount: '300000', category: 'Услуги', counterparty: 'ООО Медиа', comment: 'Продвижение', usnRelevant: true, ndsRelevant: false, period: '2026-05', createdAt: now, updatedAt: now },
    { ipId, date: '2026-06-08', type: 'income', amount: '175000', category: 'Услуги', counterparty: 'ООО Форум', comment: 'Тренинг', usnRelevant: true, ndsRelevant: false, period: '2026-06', createdAt: now, updatedAt: now },
  ]
  for (const tx of demoTxs) {
    await db.transactions.add(tx as Transaction)
  }
}
