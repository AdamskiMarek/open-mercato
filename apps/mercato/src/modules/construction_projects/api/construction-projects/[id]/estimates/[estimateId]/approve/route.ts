import { NextResponse } from 'next/server'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import {
  runCrudMutationGuardAfterSuccess,
  validateCrudMutationGuard,
} from '@open-mercato/shared/lib/crud/mutation-guard'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { estimateParamsSchema } from '../../../../../../data/validators'
import { resolveConstructionProjectsRequestContext, resolveAuthActorId } from '../../../../../../lib/requestContext'
import { constructionProjectsTag } from '../../../../../openapi'
import { handleConstructionProjectsRouteError, withOperationHeader } from '../../../../../helpers'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['construction_projects.estimate.approve'] },
}

export const openApi: OpenApiRouteDoc = {
  tag: constructionProjectsTag,
  methods: {
    POST: {
      summary: 'Approve cost estimate',
    },
  },
}

export async function POST(request: Request, ctx: { params?: { id?: string; estimateId?: string } }) {
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
      operation: 'custom',
      requestMethod: request.method,
      requestHeaders: request.headers,
      mutationPayload: { estimateId },
    })
    if (guard && !guard.ok) {
      return NextResponse.json(guard.body, { status: guard.status })
    }

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('construction_projects.estimate.approve', {
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