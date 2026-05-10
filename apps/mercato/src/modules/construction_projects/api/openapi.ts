import { z, type ZodTypeAny } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  type CrudOpenApiOptions,
} from '@open-mercato/shared/lib/openapi/crud'

export const constructionProjectsTag = 'Construction Projects'

export const constructionProjectsErrorSchema = z.object({
  error: z.string(),
}).passthrough()

export const constructionProjectsOkSchema = z.object({
  ok: z.literal(true),
})

export const constructionProjectsCreatedSchema = z.object({
  id: z.string().uuid(),
})

export function createConstructionProjectsPagedListResponseSchema(itemSchema: ZodTypeAny) {
  return createSharedPagedListResponseSchema(itemSchema, { paginationMetaOptional: true })
}

const buildConstructionProjectsCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: constructionProjectsTag,
  defaultCreateResponseSchema: constructionProjectsCreatedSchema,
  defaultOkResponseSchema: constructionProjectsOkSchema,
  makeListDescription: ({ pluralLower }) =>
    `Returns a paginated collection of ${pluralLower} scoped to the authenticated organization.`,
})

export function createConstructionProjectsCrudOpenApi(options: CrudOpenApiOptions): OpenApiRouteDoc {
  return buildConstructionProjectsCrudOpenApi(options)
}