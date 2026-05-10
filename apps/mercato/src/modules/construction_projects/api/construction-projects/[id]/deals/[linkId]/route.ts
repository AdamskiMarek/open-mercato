import { NextResponse } from 'next/server'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import {
  runCrudMutationGuardAfterSuccess,
  validateCrudMutationGuard,
} from '@open-mercato/shared/lib/crud/mutation-guard'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { dealLinkParamsSchema } from '../../../../../data/validators'
import { resolveConstructionProjectsRequestContext, resolveAuthActorId } from '../../../../../lib/requestContext'
import { constructionProjectsTag } from '../../../../openapi'
import { handleConstructionProjectsRouteError, withOperationHeader } from '../../../../helpers'

export const metadata = {
  DELETE: { requireAuth: true, requireFeatures: ['construction_projects.deal.link'] },
}

export const openApi: OpenApiRouteDoc = {
  tag: constructionProjectsTag,
  methods: {
    DELETE: {
      summary: 'Unlink deal from construction project',
    },
  },
}

export async function DELETE(request: Request, ctx: { params?: { id?: string; linkId?: string } }) {
  try {
    const { id, linkId } = dealLinkParamsSchema.parse({ id: ctx.params?.id, linkId: ctx.params?.linkId })
    const context = await resolveConstructionProjectsRequestContext(request)
    if (!context.selectedOrganizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 400 })
    }
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
      mutationPayload: { linkId },
    })
    if (guard && !guard.ok) {
      return NextResponse.json(guard.body, { status: guard.status })
    }

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('construction_projects.project.unlink_deal', {
      input: {
        projectId: id,
        linkId,
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

    return withOperationHeader(NextResponse.json(result), logEntry)
  } catch (error) {
    return handleConstructionProjectsRouteError(error)
  }
}