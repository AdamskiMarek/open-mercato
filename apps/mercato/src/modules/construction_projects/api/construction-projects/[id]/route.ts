import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import {
  runCrudMutationGuardAfterSuccess,
  validateCrudMutationGuard,
} from '@open-mercato/shared/lib/crud/mutation-guard'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  constructionProjectArchiveSchema,
  constructionProjectUpdateSchema,
  estimateListQuerySchema,
  projectIdParamsSchema,
} from '../../../data/validators'
import { constructionProjectsTag } from '../../openapi'
import { handleConstructionProjectsRouteError, readNullableParam, readStringArrayParam, withOperationHeader } from '../../helpers'
import { resolveConstructionProjectsRequestContext, resolveAuthActorId, canViewConstructionProjectFinancials } from '../../../lib/requestContext'
import {
  loadLatestLossRecord,
  listProjectDealLinks,
  listProjectEstimates,
  loadLatestApprovedEstimatesById,
  requireProjectInScope,
} from '../../../lib/readModels'
import {
  serializeDealLink,
  serializeEstimateSummary,
  serializeLatestApprovedEstimate,
  serializeLossRecord,
  serializeProjectDetail,
} from '../../../lib/serialization'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['construction_projects.view'] },
  PATCH: { requireAuth: true, requireFeatures: ['construction_projects.update'] },
  DELETE: { requireAuth: true, requireFeatures: ['construction_projects.delete'] },
}

export const openApi: OpenApiRouteDoc = {
  tag: constructionProjectsTag,
  methods: {
    GET: { summary: 'Get construction project detail' },
    PATCH: {
      summary: 'Update construction project',
      requestBody: { schema: constructionProjectUpdateSchema },
    },
    DELETE: {
      summary: 'Archive construction project',
      requestBody: { schema: constructionProjectArchiveSchema },
    },
  },
}

export async function GET(request: Request, ctx: { params?: { id?: string } }) {
  try {
    const { id } = projectIdParamsSchema.parse({ id: ctx.params?.id })
    const context = await resolveConstructionProjectsRequestContext(request)
    const project = await requireProjectInScope(context.em, {
      tenantId: context.auth.tenantId,
      selectedOrganizationId: context.selectedOrganizationId,
      organizationIds: context.organizationIds,
    }, id)
    const includeFinancials = await canViewConstructionProjectFinancials(context)

    const estimatesQuery = estimateListQuerySchema.parse({ page: 1, pageSize: 100 })
    const [dealLinks, estimates, latestLossRecord] = await Promise.all([
      listProjectDealLinks(context.em, project.tenantId, project.organizationId, project.id),
      listProjectEstimates(context.em, project.tenantId, project.organizationId, project.id, estimatesQuery),
      loadLatestLossRecord(context.em, project.tenantId, project.organizationId, project.id),
    ])

    const latestEstimateMap = project.latestApprovedEstimateId
      ? await loadLatestApprovedEstimatesById(
        context.em,
        project.tenantId,
        project.organizationId,
        [project.latestApprovedEstimateId],
      )
      : new Map()

    return NextResponse.json(
      serializeProjectDetail(project, {
        includeFinancials,
        linkedDeals: dealLinks.map((link) => serializeDealLink(link)),
        estimates: estimates.map((estimate) => serializeEstimateSummary(estimate, includeFinancials)),
        latestApprovedEstimate: serializeLatestApprovedEstimate(
          project.latestApprovedEstimateId ? latestEstimateMap.get(project.latestApprovedEstimateId) ?? null : null,
          includeFinancials,
        ),
        latestLossRecord: serializeLossRecord(latestLossRecord),
      }),
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error in construction-projects GET handler:', error)
    return handleConstructionProjectsRouteError(error)
  }
}

export async function PATCH(request: Request, ctx: { params?: { id?: string } }) {
  try {
    const { id } = projectIdParamsSchema.parse({ id: ctx.params?.id })
    const context = await resolveConstructionProjectsRequestContext(request)
    if (!context.selectedOrganizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 400 })
    }
    const payload = constructionProjectUpdateSchema.parse(await readJsonSafe(request, {}))
    const actorUserId = resolveAuthActorId(context.auth)
    const guard = await validateCrudMutationGuard(context.container, {
      tenantId: context.auth.tenantId,
      organizationId: context.selectedOrganizationId,
      userId: actorUserId,
      resourceKind: 'construction_projects.project',
      resourceId: id,
      operation: 'update',
      requestMethod: request.method,
      requestHeaders: request.headers,
      mutationPayload: payload,
    })
    if (guard && !guard.ok) {
      return NextResponse.json(guard.body, { status: guard.status })
    }

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('construction_projects.project.update', {
      input: {
        ...payload,
        id,
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
        operation: 'update',
        requestMethod: request.method,
        requestHeaders: request.headers,
        metadata: guard.metadata ?? null,
      })
    }

    return withOperationHeader(NextResponse.json(result), logEntry)
  } catch (error) {
    return handleConstructionProjectsRouteError(error)
  }
}

export async function DELETE(request: Request, ctx: { params?: { id?: string } }) {
  try {
    const { id } = projectIdParamsSchema.parse({ id: ctx.params?.id })
    const context = await resolveConstructionProjectsRequestContext(request)
    if (!context.selectedOrganizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 400 })
    }
    const payload = constructionProjectArchiveSchema.parse(await readJsonSafe(request, {}))
    const actorUserId = resolveAuthActorId(context.auth)
    const guard = await validateCrudMutationGuard(context.container, {
      tenantId: context.auth.tenantId,
      organizationId: context.selectedOrganizationId,
      userId: actorUserId,
      resourceKind: 'construction_projects.project',
      resourceId: id,
      operation: 'delete',
      requestMethod: request.method,
      requestHeaders: request.headers,
      mutationPayload: payload,
    })
    if (guard && !guard.ok) {
      return NextResponse.json(guard.body, { status: guard.status })
    }

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('construction_projects.project.archive', {
      input: {
        ...payload,
        id,
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
        operation: 'delete',
        requestMethod: request.method,
        requestHeaders: request.headers,
        metadata: guard.metadata ?? null,
      })
    }

    return withOperationHeader(NextResponse.json(result), logEntry)
  } catch (error) {
    return handleConstructionProjectsRouteError(error)
  }
}