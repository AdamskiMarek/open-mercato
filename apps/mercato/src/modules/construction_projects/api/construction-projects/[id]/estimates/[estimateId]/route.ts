import { NextResponse } from 'next/server'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import {
  runCrudMutationGuardAfterSuccess,
  validateCrudMutationGuard,
} from '@open-mercato/shared/lib/crud/mutation-guard'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { estimateDraftSaveSchema, estimateParamsSchema } from '../../../../../data/validators'
import { canViewConstructionProjectFinancials, resolveConstructionProjectsRequestContext, resolveAuthActorId } from '../../../../../lib/requestContext'
import { constructionProjectsTag } from '../../../../openapi'
import { handleConstructionProjectsRouteError, withOperationHeader } from '../../../../helpers'
import { listEstimateLineItems, requireEstimateInScope } from '../../../../../lib/readModels'
import { serializeEstimateDetail, serializeLineItem } from '../../../../../lib/serialization'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['construction_projects.view'] },
  PATCH: { requireAuth: true, requireFeatures: ['construction_projects.estimate.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['construction_projects.estimate.manage'] },
}

export const openApi: OpenApiRouteDoc = {
  tag: constructionProjectsTag,
  methods: {
    GET: { summary: 'Get cost estimate detail' },
    PATCH: {
      summary: 'Save cost estimate draft graph',
      requestBody: { schema: estimateDraftSaveSchema },
    },
    DELETE: { summary: 'Archive cost estimate' },
  },
}

export async function GET(request: Request, ctx: { params?: { id?: string; estimateId?: string } }) {
  try {
    const { id, estimateId } = estimateParamsSchema.parse({ id: ctx.params?.id, estimateId: ctx.params?.estimateId })
    const context = await resolveConstructionProjectsRequestContext(request)
    const includeFinancials = await canViewConstructionProjectFinancials(context)
    if (!includeFinancials) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { organizationId, estimate } = await requireEstimateInScope(context.em, {
      tenantId: context.auth.tenantId,
      selectedOrganizationId: context.selectedOrganizationId,
      organizationIds: context.organizationIds,
    }, id, estimateId)
    const lineItems = await listEstimateLineItems(context.em, context.auth.tenantId, organizationId, estimate.id)
    return NextResponse.json({
      estimate: serializeEstimateDetail(estimate),
      lineItems: lineItems.map((lineItem) => serializeLineItem(lineItem)),
    })
  } catch (error) {
    return handleConstructionProjectsRouteError(error)
  }
}

export async function PATCH(request: Request, ctx: { params?: { id?: string; estimateId?: string } }) {
  try {
    const { id, estimateId } = estimateParamsSchema.parse({ id: ctx.params?.id, estimateId: ctx.params?.estimateId })
    const context = await resolveConstructionProjectsRequestContext(request)
    if (!context.selectedOrganizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 400 })
    }
    const payload = estimateDraftSaveSchema.parse(await readJsonSafe(request, {}))
    const actorUserId = resolveAuthActorId(context.auth)
    const guard = await validateCrudMutationGuard(context.container, {
      tenantId: context.auth.tenantId,
      organizationId: context.selectedOrganizationId,
      userId: actorUserId,
      resourceKind: 'construction_projects.estimate',
      resourceId: estimateId,
      operation: 'custom',
      requestMethod: request.method,
      requestHeaders: request.headers,
      mutationPayload: payload,
    })
    if (guard && !guard.ok) {
      return NextResponse.json(guard.body, { status: guard.status })
    }

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('construction_projects.estimate.save_draft_graph', {
      input: {
        ...payload,
        projectId: id,
        estimateId,
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
        resourceKind: 'construction_projects.estimate',
        resourceId: estimateId,
        operation: 'custom',
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

export async function DELETE(request: Request, ctx: { params?: { id?: string; estimateId?: string } }) {
  try {
    const { id, estimateId } = estimateParamsSchema.parse({ id: ctx.params?.id, estimateId: ctx.params?.estimateId })
    const context = await resolveConstructionProjectsRequestContext(request)
    if (!context.selectedOrganizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 400 })
    }
    const actorUserId = resolveAuthActorId(context.auth)
    const guard = await validateCrudMutationGuard(context.container, {
      tenantId: context.auth.tenantId,
      organizationId: context.selectedOrganizationId,
      userId: actorUserId,
      resourceKind: 'construction_projects.estimate',
      resourceId: estimateId,
      operation: 'delete',
      requestMethod: request.method,
      requestHeaders: request.headers,
      mutationPayload: { estimateId },
    })
    if (guard && !guard.ok) {
      return NextResponse.json(guard.body, { status: guard.status })
    }

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('construction_projects.estimate.archive', {
      input: {
        projectId: id,
        estimateId,
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
        resourceKind: 'construction_projects.estimate',
        resourceId: estimateId,
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