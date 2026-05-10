import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { RbacService } from '@open-mercato/core/modules/auth/services/rbacService'
import { hasFinancialAccess } from './domain'

type AuthContext = NonNullable<Awaited<ReturnType<typeof getAuthFromRequest>>>
type AuthContextWithTenant = AuthContext & { tenantId: string }

export type ConstructionProjectsRequestContext = {
  container: Awaited<ReturnType<typeof createRequestContainer>>
  auth: AuthContextWithTenant
  em: EntityManager
  scope: Awaited<ReturnType<typeof resolveOrganizationScopeForRequest>>
  selectedOrganizationId: string | null
  organizationIds: string[] | null
  commandContext: CommandRuntimeContext
}

export function resolveAuthActorId(auth: AuthContext): string {
  if (typeof auth.sub === 'string' && auth.sub.trim().length > 0) return auth.sub
  if (typeof auth.userId === 'string' && auth.userId.trim().length > 0) return auth.userId
  if (typeof auth.keyId === 'string' && auth.keyId.trim().length > 0) return auth.keyId
  return 'system'
}

export async function resolveConstructionProjectsRequestContext(
  request: Request,
): Promise<ConstructionProjectsRequestContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(request)
  if (!auth || !auth.tenantId) {
    throw new CrudHttpError(401, { error: 'Unauthorized' })
  }

  const scope = await resolveOrganizationScopeForRequest({ container, auth, request })
  const selectedOrganizationId = scope?.selectedId ?? auth.orgId ?? null
  const organizationIds = scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null)

  return {
    container,
    auth: auth as AuthContextWithTenant,
    em: (container.resolve('em') as EntityManager).fork(),
    scope,
    selectedOrganizationId,
    organizationIds,
    commandContext: {
      container,
      auth,
      organizationScope: scope,
      selectedOrganizationId,
      organizationIds,
      request,
    },
  }
}

export async function loadConstructionProjectsAclFeatures(
  context: Pick<ConstructionProjectsRequestContext, 'container' | 'auth' | 'selectedOrganizationId'>,
): Promise<string[]> {
  const rbacService = context.container.resolve('rbacService') as RbacService
  const acl = await rbacService.loadAcl(context.auth.sub, {
    tenantId: context.auth.tenantId ?? null,
    organizationId: context.selectedOrganizationId ?? context.auth.orgId ?? null,
  })
  return acl.features
}

export async function canViewConstructionProjectFinancials(
  context: Pick<ConstructionProjectsRequestContext, 'container' | 'auth' | 'selectedOrganizationId'>,
): Promise<boolean> {
  return hasFinancialAccess(await loadConstructionProjectsAclFeatures(context))
}