import { NextResponse } from 'next/server'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import {
  runCrudMutationGuardAfterSuccess,
  validateCrudMutationGuard,
} from '@open-mercato/shared/lib/crud/mutation-guard'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { constructionProjectStatusChangeSchema, projectIdParamsSchema } from '../../../../data/validators'
import { resolveConstructionProjectsRequestContext, resolveAuthActorId } from '../../../../lib/requestContext'
import { constructionProjectsTag } from '../../../openapi'
import { handleConstructionProjectsRouteError, withOperationHeader } from '../../../helpers'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['construction_projects.update'] },
}

export const openApi: OpenApiRouteDoc = {
  tag: constructionProjectsTag,
  methods: {
    POST: {
      summary: 'Change construction project status',
      requestBody: { schema: constructionProjectStatusChangeSchema },
    },
  },
}

export async function POST(request: Request, ctx: { params?: { id?: string } }) {
  try {
    const { id } = projectIdParamsSchema.parse({ id: ctx.params?.id })
    const context = await resolveConstructionProjectsRequestContext(request)
    if (!context.selectedOrganizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 400 })
    }
    const payload = constructionProjectStatusChangeSchema.parse(await readJsonSafe(request, {}))
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
    const { result, logEntry } = await commandBus.execute('construction_projects.project.change_status', {
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