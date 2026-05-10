"use client"

import * as React from 'react'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { StatusBadge, type StatusMap } from '@open-mercato/ui/primitives/status-badge'
import {
  dealRoles,
  estimateStatuses,
  lineItemCategories,
  lossReasonCodes,
  projectStatuses,
} from '../lib/domain'

export type ConstructionProjectListItem = {
  id: string
  projectCode: string
  name: string
  status: string
  projectType: string | null
  ownerUserId: string | null
  latestApprovedEstimate: LatestApprovedEstimateSummary
  linkedDealCount: number
}

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

export type DealLinkPayload = {
  id: string
  dealId: string
  role: string
  linkedByUserId: string | null
  linkedAt: string
}

export type LossRecordPayload = {
  id: string
  dealId: string | null
  reasonCode: string
  reasonDetails: string
  competitorName: string | null
  recordedByUserId: string | null
  recordedAt: string
} | null

export type ProjectDetailPayload = {
  id: string
  projectCode: string
  name: string
  projectType: string | null
  status: string
  description: string | null
  notes: string | null
  siteAddress: string | null
  siteCity: string | null
  sitePostalCode: string | null
  siteCountryCode: string | null
  siteLatitude: number | null
  siteLongitude: number | null
  clientCompanyId: string | null
  clientPersonId: string | null
  ownerUserId: string | null
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  estimatedRevenueAmount: number | null
  latestApprovedEstimate: LatestApprovedEstimateSummary
  linkedDeals: DealLinkPayload[]
  estimates: EstimateSummaryPayload[]
  latestLossRecord: LossRecordPayload
  createdAt: string
  updatedAt: string
}

export type EstimateDetailPayload = {
  id: string
  name: string
  versionNo: number
  revision: number
  status: string
  currencyCode: string
  defaultMarkupPercent: number | null
  notes: string | null
  approvedAt: string | null
  totalCostAmount: number | null
  totalSaleAmount: number | null
  marginAmount: number | null
  marginPercent: number | null
}

export type EstimateLineItemPayload = {
  id: string
  sortOrder: number
  category: string
  description: string
  unit: string
  quantity: number | null
  unitCostAmount: number | null
  markupPercent: number | null
  notes: string | null
  totalCostAmount: number | null
  totalSaleAmount: number | null
}

export type MarginReportItem = {
  projectId: string
  projectCode: string
  name: string
  status: string
  projectType: string | null
  ownerUserId: string | null
  estimateId: string
  estimateVersionNo: number
  currencyCode: string
  totalCostAmount: number | null
  totalSaleAmount: number | null
  marginAmount: number | null
  marginPercent: number | null
  approvedAt: string | null
}

export type LostReasonsReportItem = {
  id: string
  projectId: string
  projectCode: string
  name: string
  status: string
  projectType: string | null
  ownerUserId: string | null
  dealId: string | null
  reasonCode: string
  reasonDetails: string
  competitorName: string | null
  recordedAt: string | null
}

export type MarginReportSummary = {
  projectCount: number
  totalSaleAmount: number | null
  totalMarginAmount: number | null
  averageMarginPercent: number | null
}

export type LostReasonsBucket = {
  key: string
  count: number
}

export type PagedResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type MarginReportResponse = PagedResponse<MarginReportItem> & {
  summary: MarginReportSummary
}

export type LostReasonsReportResponse = PagedResponse<LostReasonsReportItem> & {
  summary: {
    groupBy: 'reasonCode' | 'month'
    buckets: LostReasonsBucket[]
  }
}

const projectStatusVariants: StatusMap<(typeof projectStatuses)[number]> = {
  draft: 'neutral',
  planning: 'info',
  offered: 'warning',
  won: 'success',
  in_progress: 'info',
  completed: 'success',
  lost: 'error',
  cancelled: 'neutral',
}

const estimateStatusVariants: StatusMap<(typeof estimateStatuses)[number]> = {
  draft: 'warning',
  approved: 'success',
  superseded: 'info',
  archived: 'neutral',
}

const estimateStatusFallbacks: Record<(typeof estimateStatuses)[number], string> = {
  draft: 'Draft',
  approved: 'Approved',
  superseded: 'Superseded',
  archived: 'Archived',
}

function normalizeStatusLabel(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

export function formatMoney(amount: number | null | undefined, currencyCode = 'USD'): string {
  if (amount == null || !Number.isFinite(amount)) return '-'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`
  }
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${value.toFixed(2)}%`
}

export function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function formatProjectStatus(t: TranslateFn, status: string): string {
  return t(`construction_projects.status.${status}`, normalizeStatusLabel(status))
}

export function formatEstimateStatus(t: TranslateFn, status: string): string {
  const fallback = estimateStatusFallbacks[status as (typeof estimateStatuses)[number]] ?? normalizeStatusLabel(status)
  return t(`construction_projects.estimate_status.${status}`, fallback)
}

export function formatDealRole(t: TranslateFn, role: string): string {
  return t(`construction_projects.deal_role.${role}`, normalizeStatusLabel(role))
}

export function formatLineItemCategory(t: TranslateFn, category: string): string {
  return t(`construction_projects.line_item_category.${category}`, normalizeStatusLabel(category))
}

export function formatLossReason(t: TranslateFn, reasonCode: string): string {
  return t(`construction_projects.loss_reason.${reasonCode}`, normalizeStatusLabel(reasonCode))
}

export function buildProjectStatusOptions(t: TranslateFn) {
  return projectStatuses.map((status) => ({
    value: status,
    label: formatProjectStatus(t, status),
  }))
}

export function buildDealRoleOptions(t: TranslateFn) {
  return dealRoles.map((role) => ({ value: role, label: formatDealRole(t, role) }))
}

export function buildLineItemCategoryOptions(t: TranslateFn) {
  return lineItemCategories.map((category) => ({
    value: category,
    label: formatLineItemCategory(t, category),
  }))
}

export function buildLossReasonOptions(t: TranslateFn) {
  return lossReasonCodes.map((reasonCode) => ({
    value: reasonCode,
    label: formatLossReason(t, reasonCode),
  }))
}

export function ProjectStatusBadge({
  status,
  t,
}: {
  status: string
  t: TranslateFn
}) {
  const variant = projectStatusVariants[status as (typeof projectStatuses)[number]] ?? 'neutral'
  return (
    <StatusBadge variant={variant} dot>
      {formatProjectStatus(t, status)}
    </StatusBadge>
  )
}

export function EstimateStatusBadge({
  status,
  t,
}: {
  status: string
  t: TranslateFn
}) {
  const variant = estimateStatusVariants[status as (typeof estimateStatuses)[number]] ?? 'neutral'
  return (
    <StatusBadge variant={variant} dot>
      {formatEstimateStatus(t, status)}
    </StatusBadge>
  )
}
