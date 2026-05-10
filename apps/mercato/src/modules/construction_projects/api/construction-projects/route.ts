import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import {
  runCrudMutationGuardAfterSuccess,
  validateCrudMutationGuard,
} from '@open-mercato/shared/lib/crud/mutation-guard'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { constructionProjectCreateSchema, constructionProjectListQuerySchema } from '../../data/validators'
import { resolveConstructionProjectsRequestContext, resolveAuthActorId, canViewConstructionProjectFinancials } from '../../lib/requestContext'
import { constructionProjectsTag } from '../openapi'
import { handleConstructionProjectsRouteError, pagedResponse, readNullableParam, readStringArrayParam, withOperationHeader } from '../helpers'
import { loadProjectListPage } from '../../lib/readModels'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['construction_projects.view'] },
  POST: { requireAuth: true, requireFeatures: ['construction_projects.create'] },
}

const createResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string().uuid(),
})

export const openApi: OpenApiRouteDoc = {
  tag: constructionProjectsTag,
  methods: {
    GET: {
      summary: 'List construction projects',
      query: constructionProjectListQuerySchema,
    },
    POST: {
      summary: 'Create construction project',
      requestBody: { schema: constructionProjectCreateSchema },
      responses: [{ status: 200, description: 'Construction project created', schema: createResponseSchema }],
    },
  },
}

export async function GET(request: Request) {
  try {
    const context = await resolveConstructionProjectsRequestContext(request)
    const url = new URL(request.url)
    const query = constructionProjectListQuerySchema.parse({
      q: readNullableParam(url.searchParams, 'q'),
      status: readStringArrayParam(url.searchParams, 'status'),
      ownerUserId: readNullableParam(url.searchParams, 'ownerUserId'),
      projectType: readNullableParam(url.searchParams, 'projectType'),
      dealId: readNullableParam(url.searchParams, 'dealId'),
      page: readNullableParam(url.searchParams, 'page'),
      pageSize: readNullableParam(url.searchParams, 'pageSize'),
      sortField: readNullableParam(url.searchParams, 'sortField'),
      sortDir: readNullableParam(url.searchParams, 'sortDir'),
    })
    const includeFinancials = await canViewConstructionProjectFinancials(context)
    const result = await loadProjectListPage(context.em, {
      tenantId: context.auth.tenantId,
      selectedOrganizationId: context.selectedOrganizationId,
      organizationIds: context.organizationIds,
    }, query, includeFinancials)
    return NextResponse.json(pagedResponse(result.items, result.total, query.page, query.pageSize))
  } catch (error) {
    return handleConstructionProjectsRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const context = await resolveConstructionProjectsRequestContext(request)
    if (!context.selectedOrganizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 400 })
    }
    const payload = constructionProjectCreateSchema.parse(await readJsonSafe(request, {}))
    const actorUserId = resolveAuthActorId(context.auth)
    const guard = await validateCrudMutationGuard(context.container, {
      tenantId: context.auth.tenantId,
      organizationId: context.selectedOrganizationId,
      userId: actorUserId,
      resourceKind: 'construction_projects.project',
      resourceId: 'new',
      operation: 'create',
      requestMethod: request.method,
      requestHeaders: request.headers,
      mutationPayload: payload,
    })
    if (guard && !guard.ok) {
      return NextResponse.json(guard.body, { status: guard.status })
    }

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute<
      typeof payload & { tenantId: string; organizationId: string; actorUserId: string },
      { id: string }
    >('construction_projects.project.create', {
      input: {
        ...payload,
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
        resourceId: result.id,
        operation: 'create',
        requestMethod: request.method,
        requestHeaders: request.headers,
        metadata: guard.metadata ?? null,
      })
    }

    return withOperationHeader(
      NextResponse.json({ ok: true as const, id: result.id }),
      logEntry,
    )
  } catch (error) {
    return handleConstructionProjectsRouteError(error)
  }
}