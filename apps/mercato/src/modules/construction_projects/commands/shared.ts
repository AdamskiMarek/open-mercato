import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { toDecimalString } from '../lib/calculations'

export type ConstructionProjectsScope = {
  tenantId: string
  organizationId: string
}

export function ensureConstructionProjectsScope(ctx: CommandRuntimeContext): ConstructionProjectsScope {
  const tenantId = ctx.auth?.tenantId ?? null
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!tenantId || !organizationId) {
    throw new CrudHttpError(403, { error: 'Forbidden' })
  }
  ensureTenantScope(ctx, tenantId)
  ensureOrganizationScope(ctx, organizationId)
  return {
    tenantId,
    organizationId,
  }
}

export async function readTenantBaseCurrencyCode(
  em: EntityManager,
  scope: ConstructionProjectsScope,
): Promise<string | null> {
  const rows = await em.getConnection().execute(
    `
      select code
      from currencies
      where is_base = true
        and is_active = true
        and tenant_id = ?
        and organization_id = ?
      limit 1
    `,
    [scope.tenantId, scope.organizationId],
  )
  const row = Array.isArray(rows) ? (rows[0] as { code?: string | null } | undefined) : undefined

  return typeof row?.code === 'string' && row.code.trim().length > 0 ? row.code.trim() : null
}

export async function dealExistsInScope(
  em: EntityManager,
  scope: ConstructionProjectsScope,
  dealId: string,
): Promise<boolean> {
  const rows = await em.getConnection().execute(
    `
      select id
      from customer_deals
      where id = ?
        and tenant_id = ?
        and organization_id = ?
        and deleted_at is null
      limit 1
    `,
    [dealId, scope.tenantId, scope.organizationId],
  )
  const row = Array.isArray(rows) ? (rows[0] as { id?: string } | undefined) : undefined

  return typeof row?.id === 'string' && row.id.length > 0
}

export function toNullableText(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function toDateOnlyValue(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function toDecimalValue(value: number | null | undefined): string | null {
  if (value == null) return null
  return toDecimalString(value)
}

export function toCoordinateString(value: number | null | undefined): string | null {
  if (value == null) return null
  if (!Number.isFinite(value)) return null
  return value.toFixed(6)
}

export async function lockProjectRow(
  em: EntityManager,
  projectId: string,
  scope: ConstructionProjectsScope,
): Promise<void> {
  await em.getConnection().execute(
    `
      select id
      from construction_projects
      where id = ?
        and tenant_id = ?
        and organization_id = ?
        and deleted_at is null
      for update
    `,
    [projectId, scope.tenantId, scope.organizationId],
  )
}

export async function lockEstimateRow(
  em: EntityManager,
  estimateId: string,
  scope: ConstructionProjectsScope,
): Promise<void> {
  await em.getConnection().execute(
    `
      select id
      from cost_estimates
      where id = ?
        and tenant_id = ?
        and organization_id = ?
      for update
    `,
    [estimateId, scope.tenantId, scope.organizationId],
  )
}