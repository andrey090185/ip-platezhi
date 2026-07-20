import { db } from '@/db/schema'
import { transactionRepo } from '@/db/repositories/transactionRepo'
import { refreshObligationPaymentState } from '@/db/repositories/paymentRepo'
import { buildUsnPlan, periodsAvailableOnDate } from '@/engine/usnPlan'
import { calcAdditionalPremium, calcFixedPremium } from '@/engine/insuranceFormulas'
import { getInternalDeadline, shiftToNextWorkingDay } from '@/engine/dateUtils'
import { d } from '@/engine/decimal'
import { scheduleSync, syncDelete } from '@/firebase/syncManager'
import type { Holiday, IpProfile, TaxObligation, TaxSettings } from '@/types'

function notificationDate(year: number, quarter: number, holidays: Holiday[]): string | null {
  if (quarter === 4) return null
  const raw: Record<number, string> = {
    1: `${year}-04-25`,
    2: `${year}-07-25`,
    3: `${year}-10-25`,
  }
  return shiftToNextWorkingDay(raw[quarter], holidays)
}

function deriveStatus(amount: string, paidAmount: string, dueDate: string): TaxObligation['status'] {
  if (!d(amount).gt(0)) return 'calculated'
  if (d(paidAmount).gte(d(amount))) return 'paid'
  return dueDate < new Date().toISOString().slice(0, 10) ? 'overdue' : 'due'
}

async function saveSnapshot(
  ipId: number,
  type: string,
  period: string,
  inputs: unknown,
  result: unknown,
  trace: unknown,
): Promise<number> {
  const inputJson = JSON.stringify(inputs)
  const resultJson = JSON.stringify(result)
  const existing = await db.calculationSnapshots
    .where({ ipId, type, period })
    .reverse()
    .sortBy('createdAt')
  const latest = existing.at(-1)
  if (latest && latest.inputs === inputJson && latest.result === resultJson) return latest.id!
  return db.calculationSnapshots.add({
    ipId,
    type,
    period,
    ruleSetVersion: '2026.1',
    inputs: inputJson,
    result: resultJson,
    trace: JSON.stringify(trace),
    createdAt: new Date().toISOString(),
  })
}

async function upsertObligation(
  draft: Omit<TaxObligation, 'id' | 'createdAt' | 'updatedAt' | 'paidAmount' | 'paidDate' | 'paymentComment'>,
): Promise<TaxObligation> {
  const existing = (await db.taxObligations.where({ ipId: draft.ipId, period: draft.period }).toArray())
    .find(item => item.type === draft.type)
  const now = new Date().toISOString()
  const paidAmount = existing?.paidAmount ?? '0.00'
  const record: TaxObligation = {
    ...draft,
    id: existing?.id,
    paidAmount,
    paidDate: existing?.paidDate ?? null,
    paymentComment: existing?.paymentComment ?? '',
    status: deriveStatus(draft.amount, paidAmount, draft.dueDate),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  const id = existing?.id
    ? (await db.taxObligations.put(record), existing.id)
    : await db.taxObligations.add(record)
  return { ...record, id }
}

const calculationsInFlight = new Map<number, Promise<TaxObligation[]>>()

async function runTaxPlanCalculation(
  ip: IpProfile,
  settings: TaxSettings,
  holidays: Holiday[],
  today = new Date(),
): Promise<TaxObligation[]> {
  if (!ip.id) return []
  if (settings.year !== 2026) {
    throw new Error(`Для ${settings.year} года нет проверенного набора налоговых правил. Расчёт остановлен.`)
  }
  const periods = periodsAvailableOnDate(settings.year, today)
  const ledgerInputs = await Promise.all(periods.map(async period => {
    const summary = await transactionRepo.getCumulativeTotals(ip.id!, settings.year, period.throughMonth)
    const transactions = await transactionRepo.getByDateRange(
      ip.id!,
      `${settings.year}-01-01`,
      `${settings.year}-${String(period.throughMonth).padStart(2, '0')}-31`,
    )
    return {
      code: period.code,
      income: summary.netIncome,
      expenses: summary.netExpenses,
      excludedTransactionIds: transactions
        .filter(item => item.status === 'needs_review')
        .map(item => item.id!)
        .filter(Boolean),
    }
  }))

  const existing = await db.taxObligations.where('ipId').equals(ip.id).toArray()
  const openingAdvances = existing
    .filter(item => item.type === 'usn_advance' && item.period.endsWith('-opening'))
    .reduce((sum, item) => sum.plus(d(item.amount)), d(0))
    .toFixed(2)
  const plan = buildUsnPlan(settings, ledgerInputs, openingAdvances)
  const saved: TaxObligation[] = []

  for (const item of plan) {
    const period = `${settings.year}-${item.code}`
    const snapshotId = await saveSnapshot(
      ip.id,
      item.quarter === 4 ? 'usn_annual' : 'usn_advance',
      period,
      ledgerInputs.find(input => input.code === item.code),
      item.result,
      item.trace,
    )
    const dueDate = shiftToNextWorkingDay(item.result.dueDate, holidays)
    saved.push(await upsertObligation({
      ipId: ip.id,
      type: item.quarter === 4 ? 'usn_annual' : 'usn_advance',
      period,
      amount: item.result.dueAmount,
      dueDate,
      internalDeadline: getInternalDeadline(dueDate, holidays),
      notificationDueDate: d(item.result.dueAmount).gt(0)
        ? notificationDate(settings.year, item.quarter, holidays)
        : null,
      status: 'calculated',
      calculationSnapshotId: snapshotId,
      availableReduction: item.result.availableReduction,
      usedReduction: item.result.reduction,
      trace: JSON.stringify(item.trace),
    }))
  }

  const fixed = calcFixedPremium(settings)
  const fixedDueDate = shiftToNextWorkingDay(fixed.dueDate, holidays)
  saved.push(await upsertObligation({
    ipId: ip.id,
    type: 'ip_premium_fixed',
    period: `${settings.year}-fixed`,
    amount: fixed.annualAmount,
    dueDate: fixedDueDate,
    internalDeadline: getInternalDeadline(fixedDueDate, holidays),
    notificationDueDate: null,
    status: 'calculated',
    calculationSnapshotId: null,
    availableReduction: fixed.annualAmount,
    usedReduction: '0.00',
    trace: JSON.stringify({ formula: fixed.formula }),
  }))

  const annual = await transactionRepo.getYearTotals(ip.id, settings.year)
  const additional = calcAdditionalPremium(settings, annual.income)
  if (d(additional.finalAmount).gt(0)) {
    const additionalDueDate = shiftToNextWorkingDay(additional.dueDate, holidays)
    saved.push(await upsertObligation({
      ipId: ip.id,
      type: 'ip_premium_additional',
      period: `${settings.year}-additional`,
      amount: additional.finalAmount,
      dueDate: additionalDueDate,
      internalDeadline: getInternalDeadline(additionalDueDate, holidays),
      notificationDueDate: null,
      status: 'calculated',
      calculationSnapshotId: null,
      availableReduction: settings.considerAdditionalInCurrentYear ? additional.finalAmount : '0.00',
      usedReduction: '0.00',
      trace: JSON.stringify({ formula: additional.formula }),
    }))
  } else {
    const obsolete = existing.find(item => item.type === 'ip_premium_additional' && item.period === `${settings.year}-additional`)
    if (obsolete?.id) {
      const links = await db.paymentAllocations.where('obligationId').equals(obsolete.id).toArray()
      await db.paymentAllocations.where('obligationId').equals(obsolete.id).delete()
      await db.taxObligations.delete(obsolete.id)
      for (const link of links) if (link.id) await syncDelete(undefined, db.paymentAllocations, link.id)
      await syncDelete(undefined, db.taxObligations, obsolete.id)
    }
  }

  for (const obligation of saved) {
    if (!obligation.id) continue
    const links = await db.paymentAllocations.where('obligationId').equals(obligation.id).count()
    if (links > 0) await refreshObligationPaymentState(obligation.id)
  }
  scheduleSync()
  return db.taxObligations.where('ipId').equals(ip.id).toArray()
}

export function recalculateTaxPlan(
  ip: IpProfile,
  settings: TaxSettings,
  holidays: Holiday[],
  today = new Date(),
): Promise<TaxObligation[]> {
  if (!ip.id) return Promise.resolve([])
  const running = calculationsInFlight.get(ip.id)
  if (running) return running
  const calculation = runTaxPlanCalculation(ip, settings, holidays, today)
    .finally(() => calculationsInFlight.delete(ip.id!))
  calculationsInFlight.set(ip.id, calculation)
  return calculation
}
