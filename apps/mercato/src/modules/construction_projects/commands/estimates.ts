import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { emitCrudSideEffects, flushCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { calculateEstimateTotals, toDecimalString } from '../lib/calculations'
import { ENTITY_IDS, maxEstimateLineItems } from '../lib/domain'
import {
  estimateCreateSchema,
  estimateDraftSaveSchema,
  estimateLineItemDraftSchema,
} from '../data/validators'
import {
  ConstructionProject,
  CostEstimate,
  CostLineItem,
} from '../data/entities'
import { emitConstructionProjectsEvent } from '../events'
import {
  ensureConstructionProjectsScope,
  lockEstimateRow,
  lockProjectRow,
  readTenantBaseCurrencyCode,
  toDecimalValue,
  toNullableText,
} from './shared'
import { getMaxEstimateVersionNo } from '../lib/readModels'

const scopedEstimateCreateSchema = estimateCreateSchema.extend({
  projectId: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable().optional(),
})

type ScopedEstimateCreateInput = z.infer<typeof scopedEstimateCreateSchema>

const scopedEstimateDraftSaveSchema = estimateDraftSaveSchema.extend({
  projectId: z.string().uuid(),
  estimateId: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable().optional(),
})

type ScopedEstimateDraftSaveInput = z.infer<typeof scopedEstimateDraftSaveSchema>

const scopedEstimateApproveSchema = z.object({
  projectId: z.string().uuid(),
  estimateId: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable().optional(),
})

type ScopedEstimateApproveInput = z.infer<typeof scopedEstimateApproveSchema>

const scopedEstimateArchiveSchema = z.object({
  projectId: z.string().uuid(),
  estimateId: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable().optional(),
})

type ScopedEstimateArchiveInput = z.infer<typeof scopedEstimateArchiveSchema>

const estimateIndexer = { entityType: ENTITY_IDS.estimate }

async function requireProject(
  em: EntityManager,
  input: { projectId: string; tenantId: string; organizationId: string },
): Promise<ConstructionProject> {
  const project = await findOneWithDecryption(
    em,
    ConstructionProject,
    {
      id: input.projectId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      deletedAt: null,
    },
    undefined,
    { tenantId: input.tenantId, organizationId: input.organizationId },
  )
  if (!project) {
    throw new CrudHttpError(404, { error: 'Construction project not found' })
  }
  return project
}

async function requireEstimate(
  em: EntityManager,
  input: { estimateId: string; projectId: string; tenantId: string; organizationId: string },
): Promise<CostEstimate> {
  const estimate = await findOneWithDecryption(
    em,
    CostEstimate,
    {
      id: input.estimateId,
      project: input.projectId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
    },
    undefined,
    { tenantId: input.tenantId, organizationId: input.organizationId },
  )
  if (!estimate) {
    throw new CrudHttpError(404, { error: 'Cost estimate not found' })
  }
  return estimate
}

async function emitEstimateIndexChange(
  ctx: Parameters<CommandHandler['execute']>[1],
  action: 'created' | 'updated' | 'deleted',
  estimate: CostEstimate,
) {
  const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
  await emitCrudSideEffects({
    dataEngine,
    action,
    entity: estimate,
    identifiers: {
      id: estimate.id,
      tenantId: estimate.tenantId,
      organizationId: estimate.organizationId,
    },
    indexer: estimateIndexer,
  })
  await flushCrudSideEffects(dataEngine)
}

function assignEstimateTotals(estimate: CostEstimate, totals: ReturnType<typeof calculateEstimateTotals>) {
  estimate.totalCostAmount = toDecimalString(totals.totalCostAmount) ?? '0.0000'
  estimate.totalSaleAmount = toDecimalString(totals.totalSaleAmount) ?? '0.0000'
  estimate.marginAmount = toDecimalString(totals.marginAmount) ?? '0.0000'
  estimate.marginPercent = toDecimalString(totals.marginPercent) ?? '0.0000'
}

const createEstimateCommand: CommandHandler<ScopedEstimateCreateInput, { id: string; versionNo: number }> = {
  id: 'construction_projects.estimate.create',
  async execute(rawInput, ctx) {
    const input = scopedEstimateCreateSchema.parse(rawInput)
    const scope = ensureConstructionProjectsScope(ctx)
    if (scope.organizationId !== input.organizationId || scope.tenantId !== input.tenantId) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const result = await em.transactional(async (trxEm) => {
      const project = await requireProject(trxEm, input)
      await lockProjectRow(trxEm, project.id, { tenantId: project.tenantId, organizationId: project.organizationId })

      const currencyCode = await readTenantBaseCurrencyCode(trxEm, {
        tenantId: input.tenantId,
        organizationId: input.organizationId,
      })
      if (!currencyCode) {
        throw new CrudHttpError(409, { error: 'No active base currency configured for this organization' })
      }

      const versionNo = (await getMaxEstimateVersionNo(trxEm, input.tenantId, input.organizationId, project.id)) + 1
      const estimate = new CostEstimate()
      estimate.organizationId = input.organizationId
      estimate.tenantId = input.tenantId
      estimate.project = project
      estimate.versionNo = versionNo
      estimate.revision = 0
      estimate.name = input.name
      estimate.status = 'draft'
      estimate.currencyCode = currencyCode
      estimate.defaultMarkupPercent = toDecimalValue(input.defaultMarkupPercent)
      estimate.notes = null
      estimate.totalCostAmount = '0.0000'
      estimate.totalSaleAmount = '0.0000'
      estimate.marginAmount = '0.0000'
      estimate.marginPercent = '0.0000'
      estimate.sourceEstimateId = input.cloneFromEstimateId ?? null
      estimate.createdByUserId = input.actorUserId ?? null
      trxEm.persist(estimate)

      if (input.cloneFromEstimateId) {
        const source = await findOneWithDecryption(
          trxEm,
          CostEstimate,
          {
            id: input.cloneFromEstimateId,
            project: project.id,
            tenantId: input.tenantId,
            organizationId: input.organizationId,
          },
          undefined,
          { tenantId: input.tenantId, organizationId: input.organizationId },
        )
        if (!source) {
          throw new CrudHttpError(409, { error: 'Clone source estimate must belong to the same project' })
        }
        estimate.notes = source.notes ?? null
        const sourceItems = await findWithDecryption(
          trxEm,
          CostLineItem,
          {
            estimate: source.id,
            tenantId: input.tenantId,
            organizationId: input.organizationId,
            deletedAt: null,
          },
          { orderBy: { sortOrder: 'asc' } },
          { tenantId: input.tenantId, organizationId: input.organizationId },
        )
        const totals = calculateEstimateTotals(
          sourceItems.map((lineItem) => ({
            sortOrder: lineItem.sortOrder,
            category: lineItem.category as never,
            description: lineItem.description,
            unit: lineItem.unit,
            quantity: Number(lineItem.quantity),
            unitCostAmount: Number(lineItem.unitCostAmount),
            markupPercent: Number(lineItem.markupPercent ?? input.defaultMarkupPercent ?? 0),
            notes: lineItem.notes ?? null,
          })),
          Number(input.defaultMarkupPercent ?? source.defaultMarkupPercent ?? 0),
        )
        assignEstimateTotals(estimate, totals)
        for (const sourceItem of sourceItems) {
          const clonedLineItem = new CostLineItem()
          clonedLineItem.organizationId = input.organizationId
          clonedLineItem.tenantId = input.tenantId
          clonedLineItem.estimate = estimate
          clonedLineItem.sortOrder = sourceItem.sortOrder
          clonedLineItem.category = sourceItem.category
          clonedLineItem.description = sourceItem.description
          clonedLineItem.unit = sourceItem.unit
          clonedLineItem.quantity = sourceItem.quantity
          clonedLineItem.unitCostAmount = sourceItem.unitCostAmount
          clonedLineItem.markupPercent = sourceItem.markupPercent
          clonedLineItem.notes = sourceItem.notes ?? null
          clonedLineItem.totalCostAmount = sourceItem.totalCostAmount
          clonedLineItem.totalSaleAmount = sourceItem.totalSaleAmount
          trxEm.persist(clonedLineItem)
        }
      }

      await trxEm.flush()
      return { estimate, versionNo }
    })

    await emitEstimateIndexChange(ctx, 'created', result.estimate)
    await emitConstructionProjectsEvent('construction_projects.estimate.created', {
      id: result.estimate.id,
      estimateId: result.estimate.id,
      projectId: input.projectId,
      versionNo: result.versionNo,
      status: result.estimate.status,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
    }, { persistent: true }).catch(() => undefined)

    return { id: result.estimate.id, versionNo: result.versionNo }
  },
  buildLog: async ({ input, result }) => ({
    actionLabel: 'Create construction project estimate',
    resourceKind: 'construction_projects.estimate',
    resourceId: result.id,
    parentResourceKind: 'construction_projects.project',
    parentResourceId: input.projectId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
  }),
}

const cloneEstimateCommand: CommandHandler<ScopedEstimateCreateInput, { id: string; versionNo: number }> = {
  id: 'construction_projects.estimate.clone_version',
  async execute(rawInput, ctx) {
    return createEstimateCommand.execute(rawInput, ctx)
  },
}

const saveEstimateDraftGraphCommand: CommandHandler<ScopedEstimateDraftSaveInput, { ok: true; revision: number }> = {
  id: 'construction_projects.estimate.save_draft_graph',
  async execute(rawInput, ctx) {
    const input = scopedEstimateDraftSaveSchema.parse(rawInput)
    if (input.lineItems.length > maxEstimateLineItems) {
      throw new CrudHttpError(400, { error: 'Estimate draft exceeds the maximum line item count' })
    }
    const scope = ensureConstructionProjectsScope(ctx)
    if (scope.organizationId !== input.organizationId || scope.tenantId !== input.tenantId) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const result = await em.transactional(async (trxEm) => {
      await requireProject(trxEm, input)
      await lockEstimateRow(trxEm, input.estimateId, { tenantId: input.tenantId, organizationId: input.organizationId })
      const estimate = await requireEstimate(trxEm, input)
      if (estimate.status !== 'draft') {
        throw new CrudHttpError(409, { error: 'Only draft estimates can be edited' })
      }
      if (estimate.archivedAt) {
        throw new CrudHttpError(409, { error: 'Archived estimates cannot be edited' })
      }
      if (estimate.revision !== input.revision) {
        throw new CrudHttpError(412, {
          error: 'Estimate revision mismatch',
          latestRevision: estimate.revision,
        })
      }

      const existingItems = await findWithDecryption(
        trxEm,
        CostLineItem,
        {
          estimate: estimate.id,
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          deletedAt: null,
        },
        undefined,
        { tenantId: input.tenantId, organizationId: input.organizationId },
      )
      const existingById = new Map(existingItems.map((lineItem) => [lineItem.id, lineItem]))

      const invalidLineItemId = input.lineItems
        .map((lineItem) => lineItem.id)
        .find((id): id is string => typeof id === 'string' && id.length > 0 && !existingById.has(id))
      if (invalidLineItemId) {
        throw new CrudHttpError(400, { error: 'Line item id does not belong to this estimate' })
      }

      const totals = calculateEstimateTotals(
        input.lineItems.map((lineItem) => estimateLineItemDraftSchema.parse(lineItem)),
        input.defaultMarkupPercent ?? null,
      )

      estimate.name = input.name
      estimate.defaultMarkupPercent = toDecimalValue(input.defaultMarkupPercent)
      estimate.notes = toNullableText(input.notes)
      estimate.revision += 1
      estimate.updatedAt = new Date()
      assignEstimateTotals(estimate, totals)

      const nextIds = new Set<string>()
      for (const calculatedLineItem of totals.lineItems) {
        if (calculatedLineItem.id) {
          const lineItem = existingById.get(calculatedLineItem.id)
          if (!lineItem) {
            throw new CrudHttpError(400, { error: 'Line item id does not belong to this estimate' })
          }
          lineItem.sortOrder = calculatedLineItem.sortOrder
          lineItem.category = calculatedLineItem.category
          lineItem.description = calculatedLineItem.description
          lineItem.unit = calculatedLineItem.unit
          lineItem.quantity = toDecimalString(calculatedLineItem.quantity) ?? '0.0000'
          lineItem.unitCostAmount = toDecimalString(calculatedLineItem.unitCostAmount) ?? '0.0000'
          lineItem.markupPercent = toDecimalString(calculatedLineItem.effectiveMarkupPercent)
          lineItem.notes = toNullableText(calculatedLineItem.notes)
          lineItem.totalCostAmount = toDecimalString(calculatedLineItem.totalCostAmount) ?? '0.0000'
          lineItem.totalSaleAmount = toDecimalString(calculatedLineItem.totalSaleAmount) ?? '0.0000'
          lineItem.updatedAt = new Date()
          nextIds.add(lineItem.id)
        } else {
          const lineItem = new CostLineItem()
          lineItem.organizationId = input.organizationId
          lineItem.tenantId = input.tenantId
          lineItem.estimate = estimate
          lineItem.sortOrder = calculatedLineItem.sortOrder
          lineItem.category = calculatedLineItem.category
          lineItem.description = calculatedLineItem.description
          lineItem.unit = calculatedLineItem.unit
          lineItem.quantity = toDecimalString(calculatedLineItem.quantity) ?? '0.0000'
          lineItem.unitCostAmount = toDecimalString(calculatedLineItem.unitCostAmount) ?? '0.0000'
          lineItem.markupPercent = toDecimalString(calculatedLineItem.effectiveMarkupPercent)
          lineItem.notes = toNullableText(calculatedLineItem.notes)
          lineItem.totalCostAmount = toDecimalString(calculatedLineItem.totalCostAmount) ?? '0.0000'
          lineItem.totalSaleAmount = toDecimalString(calculatedLineItem.totalSaleAmount) ?? '0.0000'
          trxEm.persist(lineItem)
        }
      }

      for (const existingLineItem of existingItems) {
        if (!nextIds.has(existingLineItem.id)) {
          existingLineItem.deletedAt = new Date()
          existingLineItem.updatedAt = new Date()
        }
      }

      await trxEm.flush()
      return { estimate }
    })

    await emitEstimateIndexChange(ctx, 'updated', result.estimate)
    await emitConstructionProjectsEvent('construction_projects.estimate.draft_saved', {
      id: result.estimate.id,
      estimateId: result.estimate.id,
      projectId: input.projectId,
      versionNo: result.estimate.versionNo,
      status: result.estimate.status,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      revision: result.estimate.revision,
    }, { persistent: true }).catch(() => undefined)

    return { ok: true as const, revision: result.estimate.revision }
  },
  buildLog: async ({ input, result }) => ({
    actionLabel: 'Save construction project estimate draft',
    resourceKind: 'construction_projects.estimate',
    resourceId: input.estimateId,
    parentResourceKind: 'construction_projects.project',
    parentResourceId: input.projectId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    context: { revision: result.revision },
  }),
}

const approveEstimateCommand: CommandHandler<ScopedEstimateApproveInput, { ok: true; previousApprovedEstimateId: string | null }> = {
  id: 'construction_projects.estimate.approve',
  async execute(rawInput, ctx) {
    const input = scopedEstimateApproveSchema.parse(rawInput)
    const scope = ensureConstructionProjectsScope(ctx)
    if (scope.organizationId !== input.organizationId || scope.tenantId !== input.tenantId) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const result = await em.transactional(async (trxEm) => {
      const project = await requireProject(trxEm, input)
      await lockProjectRow(trxEm, project.id, { tenantId: input.tenantId, organizationId: input.organizationId })
      const estimate = await requireEstimate(trxEm, input)
      if (estimate.status !== 'draft') {
        throw new CrudHttpError(409, { error: 'Only draft estimates can be approved' })
      }

      const previousApprovedEstimateId = project.latestApprovedEstimateId ?? null
      if (previousApprovedEstimateId && previousApprovedEstimateId !== estimate.id) {
        const previous = await requireEstimate(trxEm, {
          estimateId: previousApprovedEstimateId,
          projectId: input.projectId,
          tenantId: input.tenantId,
          organizationId: input.organizationId,
        })
        previous.status = 'superseded'
        previous.updatedAt = new Date()
      }

      estimate.status = 'approved'
      estimate.approvedAt = new Date()
      estimate.approvedByUserId = input.actorUserId ?? null
      estimate.revision += 1
      estimate.updatedAt = new Date()
      project.latestApprovedEstimateId = estimate.id
      project.updatedAt = new Date()
      await trxEm.flush()

      return { estimate, previousApprovedEstimateId }
    })

    await emitEstimateIndexChange(ctx, 'updated', result.estimate)
    await emitConstructionProjectsEvent('construction_projects.estimate.approved', {
      id: result.estimate.id,
      estimateId: result.estimate.id,
      projectId: input.projectId,
      versionNo: result.estimate.versionNo,
      status: result.estimate.status,
      previousApprovedEstimateId: result.previousApprovedEstimateId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
    }, { persistent: true }).catch(() => undefined)

    return { ok: true as const, previousApprovedEstimateId: result.previousApprovedEstimateId }
  },
  buildLog: async ({ input, result }) => ({
    actionLabel: 'Approve construction project estimate',
    resourceKind: 'construction_projects.estimate',
    resourceId: input.estimateId,
    parentResourceKind: 'construction_projects.project',
    parentResourceId: input.projectId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    context: { previousApprovedEstimateId: result.previousApprovedEstimateId },
  }),
}

const archiveEstimateCommand: CommandHandler<ScopedEstimateArchiveInput, { ok: true }> = {
  id: 'construction_projects.estimate.archive',
  async execute(rawInput, ctx) {
    const input = scopedEstimateArchiveSchema.parse(rawInput)
    const scope = ensureConstructionProjectsScope(ctx)
    if (scope.organizationId !== input.organizationId || scope.tenantId !== input.tenantId) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const estimate = await requireEstimate(em, input)
    if (estimate.status !== 'draft' && estimate.status !== 'superseded') {
      throw new CrudHttpError(409, { error: 'Only draft or superseded estimates can be archived' })
    }
    const project = await requireProject(em, input)
    if (project.latestApprovedEstimateId === estimate.id) {
      throw new CrudHttpError(409, { error: 'The currently approved estimate cannot be archived' })
    }

    estimate.status = 'archived'
    estimate.archivedAt = new Date()
    estimate.updatedAt = new Date()
    await em.flush()

    await emitEstimateIndexChange(ctx, 'updated', estimate)
    await emitConstructionProjectsEvent('construction_projects.estimate.archived', {
      id: estimate.id,
      estimateId: estimate.id,
      projectId: input.projectId,
      versionNo: estimate.versionNo,
      status: estimate.status,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
    }, { persistent: true }).catch(() => undefined)

    return { ok: true as const }
  },
  buildLog: async ({ input }) => ({
    actionLabel: 'Archive construction project estimate',
    resourceKind: 'construction_projects.estimate',
    resourceId: input.estimateId,
    parentResourceKind: 'construction_projects.project',
    parentResourceId: input.projectId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
  }),
}

registerCommand(createEstimateCommand)
registerCommand(cloneEstimateCommand)
registerCommand(saveEstimateDraftGraphCommand)
registerCommand(approveEstimateCommand)
registerCommand(archiveEstimateCommand)

export {
  createEstimateCommand,
  cloneEstimateCommand,
  saveEstimateDraftGraphCommand,
  approveEstimateCommand,
  archiveEstimateCommand,
}