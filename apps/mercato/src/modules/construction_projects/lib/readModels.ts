import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import {
  ConstructionProject,
  ConstructionProjectDeal,
  ConstructionProjectLoss,
  CostEstimate,
  CostLineItem,
} from '../data/entities'
import type {
  ConstructionProjectListQuery,
  EstimateListQuery,
  LostReasonsReportQuery,
  MarginReportQuery,
} from '../data/validators'
import { decimalToNumber, serializeLatestApprovedEstimate } from './serialization'

export type ConstructionProjectsReadScope = {
  tenantId: string
  selectedOrganizationId: string | null
  organizationIds: string[] | null
}

type ProjectScopeRow = {
  organization_id: string
}

type CountRow = {
  count: string | number
}

type ProjectListRow = {
  id: string
  organization_id: string
  project_code: string
  name: string
  status: string
  project_type: string | null
  owner_user_id: string | null
  latest_approved_estimate_id: string | null
}

type DealCountRow = {
  construction_project_id: string
  count: string | number
}

type MarginSummaryRow = {
  total_sale_amount: string | number | null
  total_margin_amount: string | number | null
  average_margin_percent: string | number | null
}

type MarginReportRow = {
  id: string
  project_code: string
  name: string
  status: string
  project_type: string | null
  owner_user_id: string | null
  estimate_id: string
  version_no: string | number
  currency_code: string
  total_cost_amount: string | number | null
  total_sale_amount: string | number | null
  margin_amount: string | number | null
  margin_percent: string | number | null
  approved_at: Date | string | null
}

type LostReasonsBucketRow = {
  bucket: string
  count: string | number
}

type LostReasonsReportRow = {
  id: string
  project_id: string
  project_code: string
  name: string
  status: string
  project_type: string | null
  owner_user_id: string | null
  deal_id: string | null
  reason_code: string
  reason_details: string
  competitor_name: string | null
  recorded_at: Date | string | null
}

type MaxVersionRow = {
  max_version_no: string | number | null
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
  approvedAt: string
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
  recordedAt: string
}

function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function buildInClause(values: readonly unknown[]): { sql: string; params: unknown[] } {
  return {
    sql: values.map(() => '?').join(', '),
    params: [...values],
  }
}

function buildOrganizationScopeClause(
  column: string,
  scope: ConstructionProjectsReadScope,
): { sql: string; params: unknown[] } {
  if (scope.selectedOrganizationId) {
    return { sql: ` and ${column} = ?`, params: [scope.selectedOrganizationId] }
  }
  if (scope.organizationIds && scope.organizationIds.length > 0) {
    const clause = buildInClause(scope.organizationIds)
    return { sql: ` and ${column} in (${clause.sql})`, params: clause.params }
  }
  return { sql: '', params: [] }
}

function isoString(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

export async function resolveProjectOrganizationId(
  em: EntityManager,
  scope: ConstructionProjectsReadScope,
  projectId: string,
): Promise<string> {
  const orgScope = buildOrganizationScopeClause('organization_id', scope)
  const rows = asRows<ProjectScopeRow>(
    await em.getConnection().execute(
      `
        select organization_id
        from construction_projects
        where id = ?
          and tenant_id = ?
          and deleted_at is null
          ${orgScope.sql}
        limit 1
      `,
      [projectId, scope.tenantId, ...orgScope.params],
    ),
  )
  const row = rows[0]
  if (!row?.organization_id) {
    throw new CrudHttpError(404, { error: 'Construction project not found' })
  }
  return row.organization_id
}

export async function requireProjectInScope(
  em: EntityManager,
  scope: ConstructionProjectsReadScope,
  projectId: string,
): Promise<ConstructionProject> {
  const organizationId = await resolveProjectOrganizationId(em, scope, projectId)
  const project = await findOneWithDecryption(
    em,
    ConstructionProject,
    {
      id: projectId,
      tenantId: scope.tenantId,
      organizationId,
      deletedAt: null,
    },
    undefined,
    { tenantId: scope.tenantId, organizationId },
  )
  if (!project) {
    throw new CrudHttpError(404, { error: 'Construction project not found' })
  }
  return project
}

export async function requireEstimateInScope(
  em: EntityManager,
  scope: ConstructionProjectsReadScope,
  projectId: string,
  estimateId: string,
): Promise<{ organizationId: string; estimate: CostEstimate }> {
  const organizationId = await resolveProjectOrganizationId(em, scope, projectId)
  const estimate = await findOneWithDecryption(
    em,
    CostEstimate,
    {
      id: estimateId,
      project: projectId,
      tenantId: scope.tenantId,
      organizationId,
    },
    undefined,
    { tenantId: scope.tenantId, organizationId },
  )
  if (!estimate) {
    throw new CrudHttpError(404, { error: 'Cost estimate not found' })
  }
  return { organizationId, estimate }
}

export async function listProjectDealLinks(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  projectId: string,
): Promise<ConstructionProjectDeal[]> {
  return findWithDecryption(
    em,
    ConstructionProjectDeal,
    {
      project: projectId,
      tenantId,
      organizationId,
      deletedAt: null,
    },
    { orderBy: { linkedAt: 'desc' } },
    { tenantId, organizationId },
  )
}

export async function listProjectEstimates(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  projectId: string,
  query?: EstimateListQuery,
): Promise<CostEstimate[]> {
  const where: Record<string, unknown> = {
    project: projectId,
    tenantId,
    organizationId,
  }
  if (query?.status?.length) {
    where.status = { $in: query.status }
  }
  return findWithDecryption(
    em,
    CostEstimate,
    where,
    {
      orderBy: { versionNo: 'desc' },
      ...(query
        ? {
            limit: query.pageSize,
            offset: (query.page - 1) * query.pageSize,
          }
        : {}),
    },
    { tenantId, organizationId },
  )
}

export async function listEstimateLineItems(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  estimateId: string,
): Promise<CostLineItem[]> {
  return findWithDecryption(
    em,
    CostLineItem,
    {
      estimate: estimateId,
      tenantId,
      organizationId,
      deletedAt: null,
    },
    { orderBy: { sortOrder: 'asc' } },
    { tenantId, organizationId },
  )
}

export async function loadLatestLossRecord(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  projectId: string,
): Promise<ConstructionProjectLoss | null> {
  return findOneWithDecryption(
    em,
    ConstructionProjectLoss,
    {
      project: projectId,
      tenantId,
      organizationId,
    },
    { orderBy: { recordedAt: 'desc' } },
    { tenantId, organizationId },
  )
}

export async function loadLatestApprovedEstimatesById(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  estimateIds: string[],
): Promise<Map<string, CostEstimate>> {
  if (!estimateIds.length) return new Map()
  const estimates = await findWithDecryption(
    em,
    CostEstimate,
    {
      id: { $in: estimateIds },
      tenantId,
      organizationId,
    },
    undefined,
    { tenantId, organizationId },
  )
  return new Map(estimates.map((estimate) => [estimate.id, estimate]))
}

export async function loadProjectListPage(
  em: EntityManager,
  scope: ConstructionProjectsReadScope,
  query: ConstructionProjectListQuery,
  includeFinancials: boolean,
): Promise<{
  items: Array<{
    id: string
    projectCode: string
    name: string
    status: string
    projectType: string | null
    ownerUserId: string | null
    latestApprovedEstimate: ReturnType<typeof serializeLatestApprovedEstimate>
    linkedDealCount: number
  }>
  total: number
}> {
  const whereParts = ['tenant_id = ?', 'deleted_at is null']
  const params: unknown[] = [scope.tenantId]
  const orgScope = buildOrganizationScopeClause('organization_id', scope)
  if (orgScope.sql) {
    whereParts.push(orgScope.sql.replace(/^ and /, ''))
    params.push(...orgScope.params)
  }
  if (query.status?.length) {
    const clause = buildInClause(query.status)
    whereParts.push(`status in (${clause.sql})`)
    params.push(...clause.params)
  }
  if (query.ownerUserId) {
    whereParts.push('owner_user_id = ?')
    params.push(query.ownerUserId)
  }
  if (query.projectType) {
    whereParts.push('project_type = ?')
    params.push(query.projectType)
  }
  if (query.dealId) {
    const dealOrgScope = buildOrganizationScopeClause('d.organization_id', scope)
    whereParts.push(
      `exists (
        select 1
        from construction_project_deals d
        where d.construction_project_id = construction_projects.id
          and d.deal_id = ?
          and d.tenant_id = ?
          and d.deleted_at is null
          ${dealOrgScope.sql}
      )`,
    )
    params.push(query.dealId, scope.tenantId, ...dealOrgScope.params)
  }
  if (query.q) {
    const pattern = `%${query.q}%`
    whereParts.push('(project_code ilike ? or name ilike ? or description ilike ? or site_city ilike ?)')
    params.push(pattern, pattern, pattern, pattern)
  }

  const whereSql = whereParts.join(' and ')
  const countRows = asRows<CountRow>(
    await em.getConnection().execute(
      `select count(distinct id)::text as count from construction_projects where ${whereSql}`,
      params,
    ),
  )

  const sortFieldMap: Record<ConstructionProjectListQuery['sortField'], string> = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    projectCode: 'project_code',
    name: 'name',
    status: 'status',
  }
  const rows = asRows<ProjectListRow>(
    await em.getConnection().execute(
      `
        select
          id,
          organization_id,
          project_code,
          name,
          status,
          project_type,
          owner_user_id,
          latest_approved_estimate_id
        from construction_projects
        where ${whereSql}
        order by ${sortFieldMap[query.sortField]} ${query.sortDir === 'asc' ? 'asc' : 'desc'}
        limit ?
        offset ?
      `,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    ),
  )

  const projectIds = rows.map((row) => row.id)
  const countMap = new Map<string, number>()
  if (projectIds.length) {
    const projectClause = buildInClause(projectIds)
    const linkOrgScope = buildOrganizationScopeClause('organization_id', scope)
    const dealCounts = asRows<DealCountRow>(
      await em.getConnection().execute(
        `
          select construction_project_id, count(id)::text as count
          from construction_project_deals
          where construction_project_id in (${projectClause.sql})
            and tenant_id = ?
            and deleted_at is null
            ${linkOrgScope.sql}
          group by construction_project_id
        `,
        [...projectClause.params, scope.tenantId, ...linkOrgScope.params],
      ),
    )
    for (const row of dealCounts) {
      countMap.set(row.construction_project_id, Number(row.count))
    }
  }

  const estimateMap = new Map<string, CostEstimate>()
  const estimateIdsByOrg = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.latest_approved_estimate_id) continue
    const estimateIds = estimateIdsByOrg.get(row.organization_id) ?? []
    estimateIds.push(row.latest_approved_estimate_id)
    estimateIdsByOrg.set(row.organization_id, estimateIds)
  }
  for (const [organizationId, estimateIds] of estimateIdsByOrg.entries()) {
    const groupedEstimates = await loadLatestApprovedEstimatesById(em, scope.tenantId, organizationId, estimateIds)
    for (const [estimateId, estimate] of groupedEstimates.entries()) {
      estimateMap.set(estimateId, estimate)
    }
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      projectCode: row.project_code,
      name: row.name,
      status: row.status,
      projectType: row.project_type ?? null,
      ownerUserId: row.owner_user_id ?? null,
      latestApprovedEstimate: serializeLatestApprovedEstimate(
        row.latest_approved_estimate_id ? estimateMap.get(row.latest_approved_estimate_id) ?? null : null,
        includeFinancials,
      ),
      linkedDealCount: countMap.get(row.id) ?? 0,
    })),
    total: Number(countRows[0]?.count ?? 0),
  }
}

export async function loadMarginReportPage(
  em: EntityManager,
  scope: ConstructionProjectsReadScope,
  query: MarginReportQuery,
): Promise<{
  items: MarginReportItem[]
  total: number
  summary: Record<string, unknown>
}> {
  const whereParts = ['project.tenant_id = ?', 'project.deleted_at is null', 'estimate.status = ?']
  const params: unknown[] = [scope.tenantId, 'approved']
  const orgScope = buildOrganizationScopeClause('project.organization_id', scope)
  if (orgScope.sql) {
    whereParts.push(orgScope.sql.replace(/^ and /, ''))
    params.push(...orgScope.params)
  }
  if (query.status?.length) {
    const clause = buildInClause(query.status)
    whereParts.push(`project.status in (${clause.sql})`)
    params.push(...clause.params)
  }
  if (query.ownerUserId) {
    whereParts.push('project.owner_user_id = ?')
    params.push(query.ownerUserId)
  }
  if (query.projectType) {
    whereParts.push('project.project_type = ?')
    params.push(query.projectType)
  }
  if (query.dateFrom) {
    whereParts.push('estimate.approved_at >= ?')
    params.push(`${query.dateFrom}T00:00:00.000Z`)
  }
  if (query.dateTo) {
    whereParts.push('estimate.approved_at <= ?')
    params.push(`${query.dateTo}T23:59:59.999Z`)
  }
  const fromSql = 'from construction_projects project join cost_estimates estimate on estimate.id = project.latest_approved_estimate_id'
  const whereSql = whereParts.join(' and ')
  const countRows = asRows<CountRow>(
    await em.getConnection().execute(
      `select count(distinct project.id)::text as count ${fromSql} where ${whereSql}`,
      params,
    ),
  )
  const summaryRows = asRows<MarginSummaryRow>(
    await em.getConnection().execute(
      `
        select
          sum(estimate.total_sale_amount)::text as total_sale_amount,
          sum(estimate.margin_amount)::text as total_margin_amount,
          avg(estimate.margin_percent)::text as average_margin_percent
        ${fromSql}
        where ${whereSql}
      `,
      params,
    ),
  )
  const sortFieldMap: Record<MarginReportQuery['sortField'], string> = {
    marginPercent: 'estimate.margin_percent',
    approvedAt: 'estimate.approved_at',
    name: 'project.name',
    projectCode: 'project.project_code',
  }
  const rows = asRows<MarginReportRow>(
    await em.getConnection().execute(
      `
        select
          project.id,
          project.project_code,
          project.name,
          project.status,
          project.project_type,
          project.owner_user_id,
          estimate.id as estimate_id,
          estimate.version_no,
          estimate.currency_code,
          estimate.total_cost_amount,
          estimate.total_sale_amount,
          estimate.margin_amount,
          estimate.margin_percent,
          estimate.approved_at
        ${fromSql}
        where ${whereSql}
        order by ${sortFieldMap[query.sortField]} ${query.sortDir === 'asc' ? 'asc' : 'desc'}
        limit ?
        ${query.format === 'csv' ? '' : 'offset ?'}
      `,
      query.format === 'csv'
        ? [...params, 10001]
        : [...params, query.pageSize, (query.page - 1) * query.pageSize],
    ),
  )

  return {
    items: rows.map((row) => ({
      projectId: row.id,
      projectCode: row.project_code,
      name: row.name,
      status: row.status,
      projectType: row.project_type ?? null,
      ownerUserId: row.owner_user_id ?? null,
      estimateId: row.estimate_id,
      estimateVersionNo: Number(row.version_no),
      currencyCode: row.currency_code,
      totalCostAmount: decimalToNumber(row.total_cost_amount),
      totalSaleAmount: decimalToNumber(row.total_sale_amount),
      marginAmount: decimalToNumber(row.margin_amount),
      marginPercent: decimalToNumber(row.margin_percent),
      approvedAt: isoString(row.approved_at),
    })),
    total: Number(countRows[0]?.count ?? 0),
    summary: {
      projectCount: Number(countRows[0]?.count ?? 0),
      totalSaleAmount: decimalToNumber(summaryRows[0]?.total_sale_amount),
      totalMarginAmount: decimalToNumber(summaryRows[0]?.total_margin_amount),
      averageMarginPercent: decimalToNumber(summaryRows[0]?.average_margin_percent),
    },
  }
}

export async function loadLostReasonsReportPage(
  em: EntityManager,
  scope: ConstructionProjectsReadScope,
  query: LostReasonsReportQuery,
): Promise<{
  items: LostReasonsReportItem[]
  total: number
  summary: Record<string, unknown>
}> {
  const whereParts = ['loss.tenant_id = ?', 'project.deleted_at is null']
  const params: unknown[] = [scope.tenantId]
  const orgScope = buildOrganizationScopeClause('loss.organization_id', scope)
  if (orgScope.sql) {
    whereParts.push(orgScope.sql.replace(/^ and /, ''))
    params.push(...orgScope.params)
  }
  if (query.ownerUserId) {
    whereParts.push('project.owner_user_id = ?')
    params.push(query.ownerUserId)
  }
  if (query.projectType) {
    whereParts.push('project.project_type = ?')
    params.push(query.projectType)
  }
  if (query.dateFrom) {
    whereParts.push('loss.recorded_at >= ?')
    params.push(`${query.dateFrom}T00:00:00.000Z`)
  }
  if (query.dateTo) {
    whereParts.push('loss.recorded_at <= ?')
    params.push(`${query.dateTo}T23:59:59.999Z`)
  }
  const fromSql = 'from construction_project_losses loss join construction_projects project on project.id = loss.construction_project_id'
  const whereSql = whereParts.join(' and ')
  const countRows = asRows<CountRow>(
    await em.getConnection().execute(
      `select count(distinct loss.id)::text as count ${fromSql} where ${whereSql}`,
      params,
    ),
  )
  const summaryRows = query.groupBy === 'month'
    ? asRows<LostReasonsBucketRow>(
      await em.getConnection().execute(
        `
          select to_char(date_trunc('month', loss.recorded_at), 'YYYY-MM') as bucket, count(loss.id)::text as count
          ${fromSql}
          where ${whereSql}
          group by date_trunc('month', loss.recorded_at)
          order by bucket asc
        `,
        params,
      ),
    )
    : asRows<LostReasonsBucketRow>(
      await em.getConnection().execute(
        `
          select loss.reason_code as bucket, count(loss.id)::text as count
          ${fromSql}
          where ${whereSql}
          group by loss.reason_code
          order by bucket asc
        `,
        params,
      ),
    )
  const sortFieldMap: Record<LostReasonsReportQuery['sortField'], string> = {
    recordedAt: 'loss.recorded_at',
    projectCode: 'project.project_code',
    name: 'project.name',
    reasonCode: 'loss.reason_code',
  }
  const rows = asRows<LostReasonsReportRow>(
    await em.getConnection().execute(
      `
        select
          loss.id,
          project.id as project_id,
          project.project_code,
          project.name,
          project.status,
          project.project_type,
          project.owner_user_id,
          loss.deal_id,
          loss.reason_code,
          loss.reason_details,
          loss.competitor_name,
          loss.recorded_at
        ${fromSql}
        where ${whereSql}
        order by ${sortFieldMap[query.sortField]} ${query.sortDir === 'asc' ? 'asc' : 'desc'}
        limit ?
        ${query.format === 'csv' ? '' : 'offset ?'}
      `,
      query.format === 'csv'
        ? [...params, 10001]
        : [...params, query.pageSize, (query.page - 1) * query.pageSize],
    ),
  )

  return {
    items: rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectCode: row.project_code,
      name: row.name,
      status: row.status,
      projectType: row.project_type ?? null,
      ownerUserId: row.owner_user_id ?? null,
      dealId: row.deal_id ?? null,
      reasonCode: row.reason_code,
      reasonDetails: row.reason_details,
      competitorName: row.competitor_name ?? null,
      recordedAt: isoString(row.recorded_at),
    })),
    total: Number(countRows[0]?.count ?? 0),
    summary: {
      groupBy: query.groupBy,
      buckets: summaryRows.map((row) => ({ key: row.bucket, count: Number(row.count) })),
    },
  }
}

export async function getMaxEstimateVersionNo(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  projectId: string,
): Promise<number> {
  const rows = asRows<MaxVersionRow>(
    await em.getConnection().execute(
      `
        select max(version_no)::text as max_version_no
        from cost_estimates
        where construction_project_id = ?
          and tenant_id = ?
          and organization_id = ?
      `,
      [projectId, tenantId, organizationId],
    ),
  )
  return Number(rows[0]?.max_version_no ?? 0)
}

export async function countActiveProjectDealLinks(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  projectId: string,
  role?: string,
): Promise<number> {
  const rows = asRows<CountRow>(
    await em.getConnection().execute(
      `
        select count(id)::text as count
        from construction_project_deals
        where construction_project_id = ?
          and tenant_id = ?
          and organization_id = ?
          and deleted_at is null
          ${role ? 'and role = ?' : ''}
      `,
      role ? [projectId, tenantId, organizationId, role] : [projectId, tenantId, organizationId],
    ),
  )
  return Number(rows[0]?.count ?? 0)
}