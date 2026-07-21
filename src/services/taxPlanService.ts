import { db } from '@/db/schema'
import { transactionRepo } from '@/db/repositories/transactionRepo'
import { refreshObligationPaymentState } from '@/db/repositories/paymentRepo'
import { buildUsnPlan, periodsAvailableOnDate } from '@/engine/usnPlan'
import { calcAdditionalPremium, calcFixedPremium } from '@/engine/insuranceFormulas'
import { getInternalDeadline, shiftToNextWorkingDay } from '@/engine/dateUtils'
import { d } from '@/engine/decimal'
import { getRuleSet, settingsForRuleSet } from '@/engine/taxRules'
import { scheduleSync, syncDelete } from '@/firebase/syncManager'
import type { CalculationTrace, Holiday, IpProfile, TaxObligation, TaxSettings } from '@/types'

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
  ruleSetVersion: string,
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
    ruleSetVersion,
    inputs: inputJson,
    result: resultJson,
    trace: JSON.stringify(trace),
    createdAt: new Date().toISOString(),
  })
}

function contributionTrace(
  taxYear: number,
  income: string,
  threshold: string,
  calculated: string,
  maximum: string,
  result: string,
  ruleSetVersion: string,
): CalculationTrace {
  return {
    period: `${taxYear}-additional`,
    calculationDate: new Date().toISOString(),
    ruleSetVersion,
    steps: [
      { label: `Доход за ${taxYear} год`, detail: 'Доходы УСН за вычетом возвратов дохода', amount: income },
      { label: 'Необлагаемый порог', detail: 'Дополнительный взнос начисляется только с превышения', amount: threshold },
      { label: 'Расчёт по ставке 1%', detail: `max(0, доход − ${threshold}) × 1%`, amount: calculated },
      { label: 'Предельная сумма', detail: `Максимум дополнительного взноса за ${taxYear} год`, amount: maximum },
      { label: 'Дополнительный взнос к уплате', detail: `Срок уплаты — 1 июля ${taxYear + 1} года`, amount: result },
    ],
    warnings: [],
    excludedTransactions: [],
    rounding: 'Денежные значения рассчитываются Decimal.js и округляются до копеек.',
    normativeSource: 'НК РФ, статья 430; ФНС России — страховые взносы ИП',
    normativeDate: '2026-07-21',
  }
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

async function removeObsoleteObligation(existing: TaxObligation | undefined): Promise<void> {
  if (!existing?.id) return
  const links = await db.paymentAllocations.where('obligationId').equals(existing.id).toArray()
  // A historical payment is an accounting fact. Never delete it or its link
  // merely because source transactions were edited after the payment.
  if (links.length > 0) return
  await db.taxObligations.delete(existing.id)
  await syncDelete(undefined, db.taxObligations, existing.id)
}

const calculationsInFlight = new Map<number, Promise<TaxObligation[]>>()

async function runTaxPlanCalculation(
  ip: IpProfile,
  settings: TaxSettings,
  holidays: Holiday[],
  today = new Date(),
): Promise<TaxObligation[]> {
  if (!ip.id) return []
  const currentRuleSet = getRuleSet(settings.year)
  if (!currentRuleSet) {
    throw new Error(`Для ${settings.year} года нет проверенного набора налоговых правил. Расчёт остановлен.`)
  }
  const currentSettings = settingsForRuleSet(settings, settings.year)
  const previousYear = settings.year - 1
  const previousRuleSet = getRuleSet(previousYear)
  const previousSettings = previousRuleSet ? settingsForRuleSet(settings, previousYear) : null
  const previousYearTotals = previousSettings
    ? await transactionRepo.getYearTotals(ip.id, previousYear)
    : null
  const previousAdditional = previousSettings && previousYearTotals
    ? calcAdditionalPremium(previousSettings, previousYearTotals.income)
    : null

  const periods = periodsAvailableOnDate(currentSettings.year, today)
  const ledgerInputs = await Promise.all(periods.map(async period => {
    const summary = await transactionRepo.getCumulativeTotals(ip.id!, currentSettings.year, period.throughMonth)
    const transactions = await transactionRepo.getByDateRange(
      ip.id!,
      `${currentSettings.year}-01-01`,
      `${currentSettings.year}-${String(period.throughMonth).padStart(2, '0')}-31`,
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
  const plan = buildUsnPlan(currentSettings, ledgerInputs, openingAdvances, {
    previousYearAdditional: previousAdditional?.finalAmount ?? '0.00',
    ruleSetVersion: currentRuleSet.version,
  })
  const saved: TaxObligation[] = []

  for (const item of plan) {
    const period = `${currentSettings.year}-${item.code}`
    const snapshotId = await saveSnapshot(
      ip.id,
      item.quarter === 4 ? 'usn_annual' : 'usn_advance',
      period,
      ledgerInputs.find(input => input.code === item.code),
      item.result,
      item.trace,
      currentRuleSet.version,
    )
    const dueDate = shiftToNextWorkingDay(item.result.dueDate, holidays)
    saved.push(await upsertObligation({
      ipId: ip.id,
      type: item.quarter === 4 ? 'usn_annual' : 'usn_advance',
      period,
      taxYear: currentSettings.year,
      dueYear: Number(dueDate.slice(0, 4)),
      amount: item.result.dueAmount,
      dueDate,
      internalDeadline: getInternalDeadline(dueDate, holidays),
      notificationDueDate: d(item.result.dueAmount).gt(0)
        ? notificationDate(currentSettings.year, item.quarter, holidays)
        : null,
      status: 'calculated',
      calculationSnapshotId: snapshotId,
      availableReduction: item.result.availableReduction,
      usedReduction: item.result.reduction,
      trace: JSON.stringify(item.trace),
    }))
  }

  const fixed = calcFixedPremium(currentSettings)
  const fixedDueDate = shiftToNextWorkingDay(fixed.dueDate, holidays)
  saved.push(await upsertObligation({
    ipId: ip.id,
    type: 'ip_premium_fixed',
    period: `${currentSettings.year}-fixed`,
    taxYear: currentSettings.year,
    dueYear: Number(fixedDueDate.slice(0, 4)),
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

  if (previousAdditional && previousRuleSet && previousYearTotals && d(previousAdditional.finalAmount).gt(0)) {
    const dueDate = shiftToNextWorkingDay(previousAdditional.dueDate, holidays)
    const trace = contributionTrace(
      previousYear,
      previousYearTotals.income,
      previousAdditional.threshold,
      previousAdditional.calculatedAmount,
      previousAdditional.maxAmount,
      previousAdditional.finalAmount,
      previousRuleSet.version,
    )
    saved.push(await upsertObligation({
      ipId: ip.id,
      type: 'ip_premium_additional',
      period: `${previousYear}-additional`,
      taxYear: previousYear,
      dueYear: Number(dueDate.slice(0, 4)),
      amount: previousAdditional.finalAmount,
      dueDate,
      internalDeadline: getInternalDeadline(dueDate, holidays),
      notificationDueDate: null,
      status: 'calculated',
      calculationSnapshotId: null,
      availableReduction: currentSettings.considerPreviousYearAdditional !== false
        ? previousAdditional.finalAmount
        : '0.00',
      usedReduction: '0.00',
      trace: JSON.stringify(trace),
    }))
  } else {
    await removeObsoleteObligation(existing.find(item => (
      item.type === 'ip_premium_additional' && item.period === `${previousYear}-additional`
    )))
  }

  const annual = await transactionRepo.getYearTotals(ip.id, currentSettings.year)
  const additional = calcAdditionalPremium(currentSettings, annual.income)
  if (d(additional.finalAmount).gt(0)) {
    const additionalDueDate = shiftToNextWorkingDay(additional.dueDate, holidays)
    const trace = contributionTrace(
      currentSettings.year,
      annual.income,
      additional.threshold,
      additional.calculatedAmount,
      additional.maxAmount,
      additional.finalAmount,
      currentRuleSet.version,
    )
    saved.push(await upsertObligation({
      ipId: ip.id,
      type: 'ip_premium_additional',
      period: `${currentSettings.year}-additional`,
      taxYear: currentSettings.year,
      dueYear: Number(additionalDueDate.slice(0, 4)),
      amount: additional.finalAmount,
      dueDate: additionalDueDate,
      internalDeadline: getInternalDeadline(additionalDueDate, holidays),
      notificationDueDate: null,
      status: 'calculated',
      calculationSnapshotId: null,
      availableReduction: currentSettings.considerAdditionalInCurrentYear ? additional.finalAmount : '0.00',
      usedReduction: '0.00',
      trace: JSON.stringify(trace),
    }))
  } else {
    await removeObsoleteObligation(existing.find(item => (
      item.type === 'ip_premium_additional' && item.period === `${currentSettings.year}-additional`
    )))
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
