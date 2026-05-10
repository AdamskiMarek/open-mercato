import { z } from 'zod'
import {
  dealRoles,
  estimateStatuses,
  lineItemCategories,
  lossReasonCodes,
  maxCsvExportRows,
  maxEstimateLineItems,
  maxPageSize,
  projectStatuses,
} from '../lib/domain'

const uuidSchema = z.string().uuid()
const nullableUuidSchema = uuidSchema.nullable().optional()
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const optionalDateOnlySchema = dateOnlySchema.nullable().optional()
const moneyNumberSchema = z.coerce.number().finite().min(0)
const positiveQuantitySchema = z.coerce.number().finite().gt(0)
const percentageNumberSchema = z.coerce.number().finite().min(0)
const optionalStringSchema = z.string().trim().min(1).nullish()

const latitudeSchema = z.coerce.number().finite().min(-90).max(90)
const longitudeSchema = z.coerce.number().finite().min(-180).max(180)

function ensureDateOrder<T extends {
  plannedStartDate?: string | null
  plannedEndDate?: string | null
  actualStartDate?: string | null
  actualEndDate?: string | null
}>(value: T, ctx: z.RefinementCtx) {
  if (value.plannedStartDate && value.plannedEndDate && value.plannedEndDate < value.plannedStartDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['plannedEndDate'],
      message: 'construction_projects.validation.timeline.planned_order',
    })
  }
  if (value.actualStartDate && value.actualEndDate && value.actualEndDate < value.actualStartDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['actualEndDate'],
      message: 'construction_projects.validation.timeline.actual_order',
    })
  }
}

function ensurePageWindow<T extends { pageSize?: number | null }>(value: T, ctx: z.RefinementCtx) {
  if (typeof value.pageSize === 'number' && value.pageSize > maxPageSize) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pageSize'],
      message: 'construction_projects.validation.page_size',
    })
  }
}

export const constructionProjectListQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.array(z.enum(projectStatuses)).optional(),
  ownerUserId: uuidSchema.optional(),
  projectType: z.string().trim().optional(),
  dealId: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(50),
  sortField: z.enum(['createdAt', 'updatedAt', 'projectCode', 'name', 'status']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
}).superRefine(ensurePageWindow)

export type ConstructionProjectListQuery = z.infer<typeof constructionProjectListQuerySchema>

export const constructionProjectFieldsSchema = z.object({
  projectCode: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  projectType: optionalStringSchema,
  description: optionalStringSchema,
  notes: optionalStringSchema,
  siteAddress: optionalStringSchema,
  siteCity: optionalStringSchema,
  sitePostalCode: optionalStringSchema,
  siteCountryCode: z.string().trim().min(2).max(2).nullish(),
  siteLatitude: latitudeSchema.nullish(),
  siteLongitude: longitudeSchema.nullish(),
  clientCompanyId: nullableUuidSchema,
  clientPersonId: nullableUuidSchema,
  ownerUserId: nullableUuidSchema,
  plannedStartDate: optionalDateOnlySchema,
  plannedEndDate: optionalDateOnlySchema,
  actualStartDate: optionalDateOnlySchema,
  actualEndDate: optionalDateOnlySchema,
  estimatedRevenueAmount: moneyNumberSchema.nullish(),
})

export const constructionProjectBaseSchema = constructionProjectFieldsSchema.superRefine(ensureDateOrder)

export const constructionProjectCreateSchema = constructionProjectBaseSchema
export type ConstructionProjectCreateInput = z.infer<typeof constructionProjectCreateSchema>

export const constructionProjectUpdateSchema = constructionProjectFieldsSchema.partial().superRefine(ensureDateOrder)
export type ConstructionProjectUpdateInput = z.infer<typeof constructionProjectUpdateSchema>

export const constructionProjectArchiveSchema = z.object({
  confirmArchiveApprovedEstimates: z.coerce.boolean().optional().default(false),
})

export type ConstructionProjectArchiveInput = z.infer<typeof constructionProjectArchiveSchema>

export const constructionProjectLossInputSchema = z.object({
  dealId: nullableUuidSchema,
  reasonCode: z.enum(lossReasonCodes),
  reasonDetails: z.string().trim().min(1).max(4000),
  competitorName: optionalStringSchema,
})

export type ConstructionProjectLossInput = z.infer<typeof constructionProjectLossInputSchema>

export const constructionProjectStatusChangeSchema = z.object({
  status: z.enum(projectStatuses),
  note: optionalStringSchema,
  loss: constructionProjectLossInputSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.status === 'lost' && !value.loss) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['loss'],
      message: 'construction_projects.validation.loss.required',
    })
  }
})

export type ConstructionProjectStatusChangeInput = z.infer<typeof constructionProjectStatusChangeSchema>

export const constructionProjectDealLinkSchema = z.object({
  dealId: uuidSchema,
  role: z.enum(dealRoles).default('primary'),
})

export type ConstructionProjectDealLinkInput = z.infer<typeof constructionProjectDealLinkSchema>

export const estimateCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  cloneFromEstimateId: nullableUuidSchema,
  defaultMarkupPercent: percentageNumberSchema.nullish(),
})

export type EstimateCreateInput = z.infer<typeof estimateCreateSchema>

export const estimateLineItemDraftSchema = z.object({
  id: nullableUuidSchema,
  sortOrder: z.coerce.number().int().min(0),
  category: z.enum(lineItemCategories),
  description: z.string().trim().min(1).max(500),
  unit: z.string().trim().min(1).max(32),
  quantity: positiveQuantitySchema,
  unitCostAmount: moneyNumberSchema,
  markupPercent: percentageNumberSchema.nullish(),
  notes: optionalStringSchema,
})

export type EstimateLineItemDraftInput = z.infer<typeof estimateLineItemDraftSchema>

export const estimateDraftSaveSchema = z.object({
  revision: z.coerce.number().int().min(0),
  name: z.string().trim().min(1).max(200),
  defaultMarkupPercent: percentageNumberSchema.nullish(),
  notes: optionalStringSchema,
  lineItems: z.array(estimateLineItemDraftSchema).max(maxEstimateLineItems),
})

export type EstimateDraftSaveInput = z.infer<typeof estimateDraftSaveSchema>

export const estimateListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(50),
  status: z.array(z.enum(estimateStatuses)).optional(),
}).superRefine(ensurePageWindow)

export type EstimateListQuery = z.infer<typeof estimateListQuerySchema>

export const marginReportQuerySchema = z.object({
  status: z.array(z.enum(projectStatuses)).optional(),
  ownerUserId: uuidSchema.optional(),
  projectType: z.string().trim().optional(),
  dateFrom: optionalDateOnlySchema,
  dateTo: optionalDateOnlySchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(25),
  sortField: z.enum(['marginPercent', 'approvedAt', 'name', 'projectCode']).default('marginPercent'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  format: z.enum(['json', 'csv']).default('json'),
}).superRefine((value, ctx) => {
  ensurePageWindow(value, ctx)
  if (value.format === 'csv' && value.pageSize > maxCsvExportRows) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pageSize'],
      message: 'construction_projects.validation.csv_limit',
    })
  }
})

export type MarginReportQuery = z.infer<typeof marginReportQuerySchema>

export const lostReasonsReportQuerySchema = z.object({
  groupBy: z.enum(['reasonCode', 'month']).default('reasonCode'),
  ownerUserId: uuidSchema.optional(),
  projectType: z.string().trim().optional(),
  dateFrom: optionalDateOnlySchema,
  dateTo: optionalDateOnlySchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(25),
  sortField: z.enum(['recordedAt', 'projectCode', 'name', 'reasonCode']).default('recordedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  format: z.enum(['json', 'csv']).default('json'),
}).superRefine((value, ctx) => {
  ensurePageWindow(value, ctx)
  if (value.format === 'csv' && value.pageSize > maxCsvExportRows) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pageSize'],
      message: 'construction_projects.validation.csv_limit',
    })
  }
})

export type LostReasonsReportQuery = z.infer<typeof lostReasonsReportQuerySchema>

export const projectIdParamsSchema = z.object({
  id: uuidSchema,
})

export const estimateParamsSchema = z.object({
  id: uuidSchema,
  estimateId: uuidSchema,
})

export const dealLinkParamsSchema = z.object({
  id: uuidSchema,
  linkId: uuidSchema,
})