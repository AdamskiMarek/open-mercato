import { matchFeature } from '@open-mercato/shared/lib/auth/featureMatch'

export const MODULE_ID = 'construction_projects' as const

export const ENTITY_IDS = {
  project: 'construction_projects:construction_project',
  dealLink: 'construction_projects:construction_project_deal',
  estimate: 'construction_projects:cost_estimate',
  lineItem: 'construction_projects:cost_line_item',
  loss: 'construction_projects:construction_project_loss',
} as const

export const projectStatuses = [
  'draft',
  'planning',
  'offered',
  'won',
  'in_progress',
  'completed',
  'lost',
  'cancelled',
] as const

export type ConstructionProjectStatus = (typeof projectStatuses)[number]

export const terminalProjectStatuses = ['completed', 'lost', 'cancelled'] as const

export const estimateStatuses = ['draft', 'approved', 'superseded', 'archived'] as const

export type CostEstimateStatus = (typeof estimateStatuses)[number]

export const dealRoles = ['primary', 'variant', 'follow_up', 'subcontract'] as const

export type ConstructionProjectDealRole = (typeof dealRoles)[number]

export const lineItemCategories = [
  'materials',
  'labor',
  'equipment',
  'subcontract',
  'overhead',
  'other',
] as const

export type CostLineItemCategory = (typeof lineItemCategories)[number]

export const lossReasonCodes = [
  'price',
  'timeline',
  'competition',
  'scope_mismatch',
  'financing',
  'client_changed_requirements',
  'internal_capacity',
  'other',
] as const

export type ConstructionProjectLossReasonCode = (typeof lossReasonCodes)[number]

export const financialAccessFeatures = [
  'construction_projects.estimate.manage',
  'construction_projects.estimate.approve',
  'construction_projects.report.view',
] as const

export const maxEstimateLineItems = 500
export const maxPageSize = 100
export const maxCsvExportRows = 10000

export const projectStatusTransitions: Record<ConstructionProjectStatus, ConstructionProjectStatus[]> = {
  draft: ['planning', 'cancelled'],
  planning: ['offered', 'lost', 'cancelled'],
  offered: ['planning', 'won', 'lost', 'cancelled'],
  won: ['in_progress', 'lost', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  lost: [],
  cancelled: [],
}

export function isTerminalProjectStatus(status: ConstructionProjectStatus): boolean {
  return terminalProjectStatuses.includes(status as (typeof terminalProjectStatuses)[number])
}

export function canTransitionProjectStatus(
  currentStatus: ConstructionProjectStatus,
  nextStatus: ConstructionProjectStatus,
): boolean {
  return projectStatusTransitions[currentStatus].includes(nextStatus)
}

export function statusRequiresPrimaryDeal(status: ConstructionProjectStatus): boolean {
  return status === 'offered' || status === 'won' || status === 'in_progress'
}

export function hasFinancialAccess(features: readonly string[] | undefined | null): boolean {
  if (!features?.length) return false
  return financialAccessFeatures.some((requiredFeature) =>
    features.some((grantedFeature) => matchFeature(requiredFeature, grantedFeature)),
  )
}