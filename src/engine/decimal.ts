import Decimal from 'decimal.js'

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

export function d(value: string | number | Decimal = 0): Decimal {
  return new Decimal(value as any)
}

export function dSum(...values: (string | number | Decimal)[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(d(v)), d(0))
}

export function dMul(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return d(a).times(d(b))
}

export function dDiv(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return d(a).dividedBy(d(b))
}

export function dMax(...values: (string | number | Decimal)[]): Decimal {
  return values.reduce<Decimal>((max, v) => d(v).gt(max) ? d(v) : max, d(0))
}

export function dMin(a: Decimal, b: Decimal): Decimal {
  return a.lt(b) ? a : b
}

export function dToNumber(v: Decimal): number {
  return v.toNumber()
}

export function dToString(v: Decimal): string {
  return v.toFixed(2)
}

export function dFormat(v: Decimal): string {
  return v.toNumber().toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function dRound(v: Decimal, places = 2): Decimal {
  return v.toDecimalPlaces(places)
}
