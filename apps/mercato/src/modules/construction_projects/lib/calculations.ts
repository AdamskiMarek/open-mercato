import type { CostLineItemCategory } from './domain'

export type EstimateLineItemDraft = {
  id?: string | null
  sortOrder: number
  category: CostLineItemCategory
  description: string
  unit: string
  quantity: number
  unitCostAmount: number
  markupPercent?: number | null
  notes?: string | null
}

export type CalculatedEstimateLineItem = EstimateLineItemDraft & {
  totalCostAmount: number
  totalSaleAmount: number
  effectiveMarkupPercent: number
}

export type CalculatedEstimateTotals = {
  totalCostAmount: number
  totalSaleAmount: number
  marginAmount: number
  marginPercent: number
}

const SCALE = 10_000

export function round4(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * SCALE) / SCALE
}

export function toDecimalString(value: number | null | undefined): string | null {
  if (value == null) return null
  const normalized = round4(value)
  return normalized.toFixed(4)
}

export function calculateLineItemTotals(
  lineItem: EstimateLineItemDraft,
  defaultMarkupPercent?: number | null,
): CalculatedEstimateLineItem {
  const effectiveMarkupPercent = round4(lineItem.markupPercent ?? defaultMarkupPercent ?? 0)
  const totalCostAmount = round4(lineItem.quantity * lineItem.unitCostAmount)
  const totalSaleAmount = round4(totalCostAmount * (1 + (effectiveMarkupPercent / 100)))

  return {
    ...lineItem,
    effectiveMarkupPercent,
    totalCostAmount,
    totalSaleAmount,
  }
}

export function calculateEstimateTotals(
  lineItems: EstimateLineItemDraft[],
  defaultMarkupPercent?: number | null,
): CalculatedEstimateTotals & { lineItems: CalculatedEstimateLineItem[] } {
  const calculatedItems = lineItems.map((lineItem) => calculateLineItemTotals(lineItem, defaultMarkupPercent))
  const totalCostAmount = round4(
    calculatedItems.reduce((sum, lineItem) => sum + lineItem.totalCostAmount, 0),
  )
  const totalSaleAmount = round4(
    calculatedItems.reduce((sum, lineItem) => sum + lineItem.totalSaleAmount, 0),
  )
  const marginAmount = round4(totalSaleAmount - totalCostAmount)
  const marginPercent = totalSaleAmount === 0
    ? 0
    : round4((marginAmount / totalSaleAmount) * 100)

  return {
    lineItems: calculatedItems,
    totalCostAmount,
    totalSaleAmount,
    marginAmount,
    marginPercent,
  }
}