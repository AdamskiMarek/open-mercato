import type {
  ConstructionProject,
  ConstructionProjectDeal,
  ConstructionProjectLoss,
  CostEstimate,
  CostLineItem,
} from '../data/entities'

export type LatestApprovedEstimateSummary = {
  id: string
  versionNo: number
  currencyCode: string
  marginPercent: number | null
  marginAmount: number | null
  totalCostAmount: number | null
  totalSaleAmount: number | null
  approvedAt: string | null
} | null

export type EstimateSummaryPayload = {
  id: string
  versionNo: number
  status: string
  revision: number
  updatedAt: string
  totalCostAmount: number | null
  totalSaleAmount: number | null
  marginAmount: number | null
  marginPercent: number | null
}

export function decimalToNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function dateOnly(value: Date | string | null | undefined): string | null {
  const iso = isoDate(value)
  return iso ? iso.slice(0, 10) : null
}

export function serializeLatestApprovedEstimate(
  estimate: CostEstimate | null | undefined,
  includeFinancials: boolean,
): LatestApprovedEstimateSummary {
  if (!estimate || !includeFinancials) return null
  return {
    id: estimate.id,
    versionNo: estimate.versionNo,
    currencyCode: estimate.currencyCode,
    marginPercent: decimalToNumber(estimate.marginPercent),
    marginAmount: decimalToNumber(estimate.marginAmount),
    totalCostAmount: decimalToNumber(estimate.totalCostAmount),
    totalSaleAmount: decimalToNumber(estimate.totalSaleAmount),
    approvedAt: isoDate(estimate.approvedAt),
  }
}

export function serializeEstimateSummary(
  estimate: CostEstimate,
  includeFinancials: boolean,
): EstimateSummaryPayload {
  return {
    id: estimate.id,
    versionNo: estimate.versionNo,
    status: estimate.status,
    revision: estimate.revision,
    updatedAt: estimate.updatedAt.toISOString(),
    totalCostAmount: includeFinancials ? decimalToNumber(estimate.totalCostAmount) : null,
    totalSaleAmount: includeFinancials ? decimalToNumber(estimate.totalSaleAmount) : null,
    marginAmount: includeFinancials ? decimalToNumber(estimate.marginAmount) : null,
    marginPercent: includeFinancials ? decimalToNumber(estimate.marginPercent) : null,
  }
}

export function serializeEstimateDetail(estimate: CostEstimate) {
  return {
    id: estimate.id,
    name: estimate.name,
    versionNo: estimate.versionNo,
    revision: estimate.revision,
    status: estimate.status,
    currencyCode: estimate.currencyCode,
    defaultMarkupPercent: decimalToNumber(estimate.defaultMarkupPercent),
    notes: estimate.notes ?? null,
    approvedAt: isoDate(estimate.approvedAt),
    totalCostAmount: decimalToNumber(estimate.totalCostAmount),
    totalSaleAmount: decimalToNumber(estimate.totalSaleAmount),
    marginAmount: decimalToNumber(estimate.marginAmount),
    marginPercent: decimalToNumber(estimate.marginPercent),
  }
}

export function serializeLineItem(lineItem: CostLineItem) {
  return {
    id: lineItem.id,
    sortOrder: lineItem.sortOrder,
    category: lineItem.category,
    description: lineItem.description,
    unit: lineItem.unit,
    quantity: decimalToNumber(lineItem.quantity),
    unitCostAmount: decimalToNumber(lineItem.unitCostAmount),
    markupPercent: decimalToNumber(lineItem.markupPercent),
    notes: lineItem.notes ?? null,
    totalCostAmount: decimalToNumber(lineItem.totalCostAmount),
    totalSaleAmount: decimalToNumber(lineItem.totalSaleAmount),
  }
}

export function serializeDealLink(link: ConstructionProjectDeal) {
  return {
    id: link.id,
    dealId: link.dealId,
    role: link.role,
    linkedByUserId: link.linkedByUserId ?? null,
    linkedAt: link.linkedAt.toISOString(),
  }
}

export function serializeLossRecord(loss: ConstructionProjectLoss | null | undefined) {
  if (!loss) return null
  return {
    id: loss.id,
    dealId: loss.dealId ?? null,
    reasonCode: loss.reasonCode,
    reasonDetails: loss.reasonDetails,
    competitorName: loss.competitorName ?? null,
    recordedByUserId: loss.recordedByUserId ?? null,
    recordedAt: loss.recordedAt.toISOString(),
  }
}

export function serializeProjectDetail(
  project: ConstructionProject,
  params: {
    includeFinancials: boolean
    linkedDeals: ReturnType<typeof serializeDealLink>[]
    estimates: EstimateSummaryPayload[]
    latestApprovedEstimate: LatestApprovedEstimateSummary
    latestLossRecord: ReturnType<typeof serializeLossRecord>
  },
) {
  return {
    id: project.id,
    projectCode: project.projectCode,
    name: project.name,
    projectType: project.projectType ?? null,
    status: project.status,
    description: project.description ?? null,
    notes: project.notes ?? null,
    siteAddress: project.siteAddress ?? null,
    siteCity: project.siteCity ?? null,
    sitePostalCode: project.sitePostalCode ?? null,
    siteCountryCode: project.siteCountryCode ?? null,
    siteLatitude: decimalToNumber(project.siteLatitude),
    siteLongitude: decimalToNumber(project.siteLongitude),
    clientCompanyId: project.clientCompanyId ?? null,
    clientPersonId: project.clientPersonId ?? null,
    ownerUserId: project.ownerUserId ?? null,
    plannedStartDate: dateOnly(project.plannedStartDate),
    plannedEndDate: dateOnly(project.plannedEndDate),
    actualStartDate: dateOnly(project.actualStartDate),
    actualEndDate: dateOnly(project.actualEndDate),
    estimatedRevenueAmount: params.includeFinancials ? decimalToNumber(project.estimatedRevenueAmount) : null,
    latestApprovedEstimate: params.latestApprovedEstimate,
    linkedDeals: params.linkedDeals,
    estimates: params.estimates,
    latestLossRecord: params.latestLossRecord,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }
}