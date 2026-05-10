import { NextResponse } from 'next/server'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import {
  runCrudMutationGuardAfterSuccess,
  validateCrudMutationGuard,
} from '@open-mercato/shared/lib/crud/mutation-guard'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { estimateCreateSchema, estimateListQuerySchema, projectIdParamsSchema } from '../../../../data/validators'
import { canViewConstructionProjectFinancials, resolveConstructionProjectsRequestContext, resolveAuthActorId } from '../../../../lib/requestContext'
import { constructionProjectsTag } from '../../../openapi'
import { handleConstructionProjectsRouteError, pagedResponse, readNullableParam, readStringArrayParam, withOperationHeader } from '../../../helpers'
import { listProjectEstimates, requireProjectInScope } from '../../../../lib/readModels'
import { serializeEstimateSummary } from '../../../../lib/serialization'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['construction_projects.view'] },
  POST: { requireAuth: true, requireFeatures: ['construction_projects.estimate.manage'] },
}

export const openApi: OpenApiRouteDoc = {
  tag: constructionProjectsTag,
  methods: {
    GET: { summary: 'List cost estimates for construction project' },
    POST: {
      summary: 'Create cost estimate draft',
      requestBody: { schema: estimateCreateSchema },
    },
  },
}

export async function GET(request: Request, ctx: { params?: { id?: string } }) {
  try {
    const { id } = projectIdParamsSchema.parse({ id: ctx.params?.id })
    const context = await resolveConstructionProjectsRequestContext(request)
    const includeFinancials = await canViewConstructionProjectFinancials(context)
    if (!includeFinancials) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const project = await requireProjectInScope(context.em, {
      tenantId: context.auth.tenantId,
      selectedOrganizationId: context.selectedOrganizationId,
      organizationIds: context.organizationIds,
    }, id)
    const url = new URL(request.url)
    const query = estimateListQuerySchema.parse({
      page: readNullableParam(url.searchParams, 'page'),
      pageSize: readNullableParam(url.searchParams, 'pageSize'),
      status: readStringArrayParam(url.searchParams, 'status'),
    })
    const estimates = await listProjectEstimates(context.em, project.tenantId, project.organizationId, project.id, query)
    return NextResponse.json(
      pagedResponse(
        estimates.map((estimate) => serializeEstimateSummary(estimate, includeFinancials)),
        estimates.length,
        query.page,
        query.pageSize,
      ),
    )
  } catch (error) {
    return handleConstructionProjectsRouteError(error)
  }
}

export async function POST(request: Request, ctx: { params?: { id?: string } }) {
  try {
    const { id } = projectIdParamsSchema.parse({ id: ctx.params?.id })
    const context = await resolveConstructionProjectsRequestContext(request)
    if (!context.selectedOrganizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 400 })
    }
    const payload = estimateCreateSchema.parse(await readJsonSafe(request, {}))
    const actorUserId = resolveAuthActorId(context.auth)
    const guard = await validateCrudMutationGuard(context.container, {
      tenantId: context.auth.tenantId,
      organizationId: context.selectedOrganizationId,
      userId: actorUserId,
      resourceKind: 'construction_projects.project',
      resourceId: id,
      operation: 'custom',
      requestMethod: request.method,
      requestHeaders: request.headers,
      mutationPayload: payload,
    })
    if (guard && !guard.ok) {
      return NextResponse.json(guard.body, { status: guard.status })
    }

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const commandId = payload.cloneFromEstimateId
      ? 'construction_projects.estimate.clone_version'
      : 'construction_projects.estimate.create'
    const { result, logEntry } = await commandBus.execute<
      typeof payload & { projectId: string; tenantId: string; organizationId: string; actorUserId: string },
      { id: string; versionNo: number }
    >(commandId, {
      input: {
        ...payload,
        projectId: id,
        tenantId: context.auth.tenantId,
        organizationId: context.selectedOrganizationId,
        actorUserId,
      },
      ctx: context.commandContext,
    })

    if (guard?.ok && guard.shouldRunAfterSuccess) {
      await runCrudMutationGuardAfterSuccess(context.container, {
        tenantId: context.auth.tenantId,
        organizationId: context.selectedOrganizationId,
        userId: actorUserId,
        resourceKind: 'construction_projects.project',
        resourceId: id,
        operation: 'custom',
        requestMethod: request.method,
        requestHeaders: request.headers,
        metadata: guard.metadata ?? null,
      })
    }

    return withOperationHeader(
      NextResponse.json({ ok: true as const, id: result.id, versionNo: result.versionNo }),
      logEntry,
    )
  } catch (error) {
    return handleConstructionProjectsRouteError(error)
  }
}