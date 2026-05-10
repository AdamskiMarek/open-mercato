import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { emitCrudSideEffects, flushCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import {
  ConstructionProject,
  ConstructionProjectDeal,
  ConstructionProjectLoss,
  CostEstimate,
} from '../data/entities'
import {
  constructionProjectArchiveSchema,
  constructionProjectCreateSchema,
  constructionProjectDealLinkSchema,
  constructionProjectStatusChangeSchema,
  constructionProjectUpdateSchema,
} from '../data/validators'
import {
  canTransitionProjectStatus,
  ENTITY_IDS,
  statusRequiresPrimaryDeal,
} from '../lib/domain'
import { emitConstructionProjectsEvent } from '../events'
import {
  dealExistsInScope,
  ensureConstructionProjectsScope,
  lockProjectRow,
  parseDateOnly,
  readTenantBaseCurrencyCode,
  toCoordinateString,
  toDateOnlyValue,
  toDecimalValue,
  toNullableText,
} from './shared'

const scopedProjectCreateSchema = constructionProjectCreateSchema.extend({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable().optional(),
})

type ScopedProjectCreateInput = z.infer<typeof scopedProjectCreateSchema>

const scopedProjectUpdateSchema = constructionProjectUpdateSchema.extend({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable().optional(),
})

type ScopedProjectUpdateInput = z.infer<typeof scopedProjectUpdateSchema>

const scopedProjectArchiveSchema = constructionProjectArchiveSchema.extend({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable().optional(),
})

type ScopedProjectArchiveInput = z.infer<typeof scopedProjectArchiveSchema>

const scopedProjectStatusChangeSchema = constructionProjectStatusChangeSchema.extend({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable().optional(),
})

type ScopedProjectStatusChangeInput = z.infer<typeof scopedProjectStatusChangeSchema>

const scopedProjectDealLinkSchema = constructionProjectDealLinkSchema.extend({
  projectId: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable().optional(),
})

type ScopedProjectDealLinkInput = z.infer<typeof scopedProjectDealLinkSchema>

const scopedProjectDealUnlinkSchema = z.object({
  projectId: z.string().uuid(),
  linkId: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable().optional(),
})

type ScopedProjectDealUnlinkInput = z.infer<typeof scopedProjectDealUnlinkSchema>

const projectIndexer = { entityType: ENTITY_IDS.project }

async function requireProject(
  em: EntityManager,
  input: { id: string; tenantId: string; organizationId: string },
): Promise<ConstructionProject> {
  const project = await findOneWithDecryption(
    em,
    ConstructionProject,
    {
      id: input.id,
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

async function countActivePrimaryLinks(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  projectId: string,
): Promise<number> {
  return em.count(ConstructionProjectDeal, {
    project: projectId,
    tenantId,
    organizationId,
    role: 'primary',
    deletedAt: null,
  })
}

async function requireNoDuplicateProjectCode(
  em: EntityManager,
  params: { projectCode: string; tenantId: string; organizationId: string; excludeId?: string },
): Promise<void> {
  const existing = await em.findOne(ConstructionProject, {
    projectCode: params.projectCode,
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    deletedAt: null,
    ...(params.excludeId ? { id: { $ne: params.excludeId } } : {}),
  })
  if (existing) {
    throw new CrudHttpError(409, { error: 'Construction project code already exists' })
  }
}

async function emitProjectIndexChange(
  ctx: Parameters<CommandHandler['execute']>[1],
  action: 'created' | 'updated' | 'deleted',
  project: ConstructionProject,
) {
  const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
  await emitCrudSideEffects({
    dataEngine,
    action,
    entity: project,
    identifiers: {
      id: project.id,
      tenantId: project.tenantId,
      organizationId: project.organizationId,
    },
    indexer: projectIndexer,
  })
  await flushCrudSideEffects(dataEngine)
}

const createProjectCommand: CommandHandler<ScopedProjectCreateInput, { id: string }> = {
  id: 'construction_projects.project.create',
  async execute(rawInput, ctx) {
    const input = scopedProjectCreateSchema.parse(rawInput)
    const scope = ensureConstructionProjectsScope(ctx)
    if (scope.organizationId !== input.organizationId || scope.tenantId !== input.tenantId) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    await requireNoDuplicateProjectCode(em, input)

    const project = new ConstructionProject()
    project.organizationId = input.organizationId
    project.tenantId = input.tenantId
    project.projectCode = input.projectCode
    project.name = input.name
    project.projectType = toNullableText(input.projectType)
    project.status = 'draft'
    project.description = toNullableText(input.description)
    project.notes = toNullableText(input.notes)
    project.siteAddress = toNullableText(input.siteAddress)
    project.siteCity = toNullableText(input.siteCity)
    project.sitePostalCode = toNullableText(input.sitePostalCode)
    project.siteCountryCode = toNullableText(input.siteCountryCode)
    project.siteLatitude = toCoordinateString(input.siteLatitude)
    project.siteLongitude = toCoordinateString(input.siteLongitude)
    project.clientCompanyId = input.clientCompanyId ?? null
    project.clientPersonId = input.clientPersonId ?? null
    project.ownerUserId = input.ownerUserId ?? null
    project.plannedStartDate = parseDateOnly(input.plannedStartDate)
    project.plannedEndDate = parseDateOnly(input.plannedEndDate)
    project.actualStartDate = parseDateOnly(input.actualStartDate)
    project.actualEndDate = parseDateOnly(input.actualEndDate)
    project.estimatedRevenueAmount = toDecimalValue(input.estimatedRevenueAmount)
    project.latestApprovedEstimateId = null
    em.persist(project)
    await em.flush()

    await emitProjectIndexChange(ctx, 'created', project)
    await emitConstructionProjectsEvent('construction_projects.project.created', {
      id: project.id,
      projectId: project.id,
      tenantId: project.tenantId,
      organizationId: project.organizationId,
      actorUserId: input.actorUserId ?? null,
    }, { persistent: true }).catch(() => undefined)

    return { id: project.id }
  },
  buildLog: async ({ result, input }) => ({
    actionLabel: 'Create construction project',
    resourceKind: 'construction_projects.project',
    resourceId: result.id,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
  }),
}

const updateProjectCommand: CommandHandler<ScopedProjectUpdateInput, { ok: true }> = {
  id: 'construction_projects.project.update',
  async execute(rawInput, ctx) {
    const input = scopedProjectUpdateSchema.parse(rawInput)
    const scope = ensureConstructionProjectsScope(ctx)
    if (scope.organizationId !== input.organizationId || scope.tenantId !== input.tenantId) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const project = await requireProject(em, input)

    if (input.projectCode !== undefined && input.projectCode !== project.projectCode) {
      await requireNoDuplicateProjectCode(em, {
        projectCode: input.projectCode,
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        excludeId: project.id,
      })
      project.projectCode = input.projectCode
    }
    if (input.name !== undefined) project.name = input.name
    if (input.projectType !== undefined) project.projectType = toNullableText(input.projectType)
    if (input.description !== undefined) project.description = toNullableText(input.description)
    if (input.notes !== undefined) project.notes = toNullableText(input.notes)
    if (input.siteAddress !== undefined) project.siteAddress = toNullableText(input.siteAddress)
    if (input.siteCity !== undefined) project.siteCity = toNullableText(input.siteCity)
    if (input.sitePostalCode !== undefined) project.sitePostalCode = toNullableText(input.sitePostalCode)
    if (input.siteCountryCode !== undefined) project.siteCountryCode = toNullableText(input.siteCountryCode)
    if (input.siteLatitude !== undefined) project.siteLatitude = toCoordinateString(input.siteLatitude)
    if (input.siteLongitude !== undefined) project.siteLongitude = toCoordinateString(input.siteLongitude)
    if (input.clientCompanyId !== undefined) project.clientCompanyId = input.clientCompanyId ?? null
    if (input.clientPersonId !== undefined) project.clientPersonId = input.clientPersonId ?? null
    if (input.ownerUserId !== undefined) project.ownerUserId = input.ownerUserId ?? null
    if (input.plannedStartDate !== undefined) project.plannedStartDate = parseDateOnly(input.plannedStartDate)
    if (input.plannedEndDate !== undefined) project.plannedEndDate = parseDateOnly(input.plannedEndDate)
    if (input.actualStartDate !== undefined) project.actualStartDate = parseDateOnly(input.actualStartDate)
    if (input.actualEndDate !== undefined) project.actualEndDate = parseDateOnly(input.actualEndDate)
    if (input.estimatedRevenueAmount !== undefined) {
      project.estimatedRevenueAmount = toDecimalValue(input.estimatedRevenueAmount)
    }
    project.updatedAt = new Date()

    await em.flush()
    await emitProjectIndexChange(ctx, 'updated', project)
    await emitConstructionProjectsEvent('construction_projects.project.updated', {
      id: project.id,
      projectId: project.id,
      tenantId: project.tenantId,
      organizationId: project.organizationId,
      actorUserId: input.actorUserId ?? null,
    }, { persistent: true }).catch(() => undefined)

    return { ok: true as const }
  },
  buildLog: async ({ input }) => ({
    actionLabel: 'Update construction project',
    resourceKind: 'construction_projects.project',
    resourceId: input.id,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
  }),
}

const archiveProjectCommand: CommandHandler<ScopedProjectArchiveInput, { ok: true }> = {
  id: 'construction_projects.project.archive',
  async execute(rawInput, ctx) {
    const input = scopedProjectArchiveSchema.parse(rawInput)
    const scope = ensureConstructionProjectsScope(ctx)
    if (scope.organizationId !== input.organizationId || scope.tenantId !== input.tenantId) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const project = await requireProject(em, input)
    const approvedEstimateCount = await em.count(CostEstimate, {
      project: project.id,
      tenantId: project.tenantId,
      organizationId: project.organizationId,
      status: 'approved',
    })
    if (approvedEstimateCount > 0 && !input.confirmArchiveApprovedEstimates) {
      throw new CrudHttpError(409, {
        error: 'Project has approved estimates. Confirm archive to continue.',
      })
    }

    const now = new Date()
    project.deletedAt = now
    project.updatedAt = now
    await em.nativeUpdate(
      ConstructionProjectDeal,
      {
        project: project.id,
        tenantId: project.tenantId,
        organizationId: project.organizationId,
        deletedAt: null,
      },
      { deletedAt: now, updatedAt: now },
    )
    await em.flush()

    await emitProjectIndexChange(ctx, 'deleted', project)
    await emitConstructionProjectsEvent('construction_projects.project.archived', {
      id: project.id,
      projectId: project.id,
      tenantId: project.tenantId,
      organizationId: project.organizationId,
      actorUserId: input.actorUserId ?? null,
    }, { persistent: true }).catch(() => undefined)

    return { ok: true as const }
  },
  buildLog: async ({ input }) => ({
    actionLabel: 'Archive construction project',
    resourceKind: 'construction_projects.project',
    resourceId: input.id,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
  }),
}

const changeProjectStatusCommand: CommandHandler<ScopedProjectStatusChangeInput, { ok: true; lossRecordId: string | null }> = {
  id: 'construction_projects.project.change_status',
  async execute(rawInput, ctx) {
    const input = scopedProjectStatusChangeSchema.parse(rawInput)
    const scope = ensureConstructionProjectsScope(ctx)
    if (scope.organizationId !== input.organizationId || scope.tenantId !== input.tenantId) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const project = await requireProject(em, input)
    if (!canTransitionProjectStatus(project.status as never, input.status)) {
      throw new CrudHttpError(409, { error: 'Invalid construction project status transition' })
    }
    if (project.status === 'draft' && input.status !== 'draft' && !project.clientCompanyId && !project.clientPersonId) {
      throw new CrudHttpError(409, { error: 'Leaving draft requires a client company or client person' })
    }

    const primaryLinks = await countActivePrimaryLinks(em, input.tenantId, input.organizationId, project.id)
    if (statusRequiresPrimaryDeal(input.status) && primaryLinks === 0) {
      throw new CrudHttpError(409, { error: 'This status requires an active primary deal link' })
    }

    const previousStatus = project.status
    project.status = input.status
    project.updatedAt = new Date()

    let lossRecordId: string | null = null
    if (input.status === 'lost') {
      const loss = new ConstructionProjectLoss()
      loss.organizationId = project.organizationId
      loss.tenantId = project.tenantId
      loss.project = project
      loss.dealId = input.loss?.dealId ?? null
      loss.reasonCode = input.loss!.reasonCode
      loss.reasonDetails = input.loss!.reasonDetails
      loss.competitorName = toNullableText(input.loss!.competitorName)
      loss.recordedByUserId = input.actorUserId ?? null
      em.persist(loss)
      lossRecordId = loss.id
    }

    await em.flush()
    await emitProjectIndexChange(ctx, 'updated', project)
    await emitConstructionProjectsEvent('construction_projects.project.status_changed', {
      id: project.id,
      projectId: project.id,
      tenantId: project.tenantId,
      organizationId: project.organizationId,
      actorUserId: input.actorUserId ?? null,
      previousStatus,
      nextStatus: input.status,
      note: toNullableText(input.note),
      lossRecordId,
    }, { persistent: true }).catch(() => undefined)
    if (lossRecordId) {
      await emitConstructionProjectsEvent('construction_projects.project.lost_recorded', {
        id: lossRecordId,
        lossRecordId,
        projectId: project.id,
        tenantId: project.tenantId,
        organizationId: project.organizationId,
        actorUserId: input.actorUserId ?? null,
        dealId: input.loss?.dealId ?? null,
        reasonCode: input.loss?.reasonCode ?? null,
      }, { persistent: true }).catch(() => undefined)
    }

    return { ok: true as const, lossRecordId }
  },
  buildLog: async ({ input, result }) => ({
    actionLabel: 'Change construction project status',
    resourceKind: 'construction_projects.project',
    resourceId: input.id,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    context: {
      note: toNullableText(input.note),
      nextStatus: input.status,
      lossRecordId: result.lossRecordId,
    },
  }),
}

const linkDealCommand: CommandHandler<ScopedProjectDealLinkInput, { linkId: string }> = {
  id: 'construction_projects.project.link_deal',
  async execute(rawInput, ctx) {
    const input = scopedProjectDealLinkSchema.parse(rawInput)
    const scope = ensureConstructionProjectsScope(ctx)
    if (scope.organizationId !== input.organizationId || scope.tenantId !== input.tenantId) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const project = await requireProject(em, { id: input.projectId, tenantId: input.tenantId, organizationId: input.organizationId })
    const dealExists = await dealExistsInScope(em, scope, input.dealId)
    if (!dealExists) {
      throw new CrudHttpError(409, { error: 'Deal not found in scope' })
    }

    const existingLink = await em.findOne(ConstructionProjectDeal, {
      dealId: input.dealId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      deletedAt: null,
    })
    if (existingLink) {
      throw new CrudHttpError(409, { error: 'Deal is already linked to another construction project' })
    }

    const primaryCount = await countActivePrimaryLinks(em, input.tenantId, input.organizationId, project.id)
    if (input.role === 'primary' && primaryCount > 0) {
      throw new CrudHttpError(409, { error: 'Project already has an active primary deal link' })
    }
    if (statusRequiresPrimaryDeal(project.status as never) && input.role !== 'primary' && primaryCount === 0) {
      throw new CrudHttpError(409, { error: 'This project status requires a primary deal link' })
    }

    const link = new ConstructionProjectDeal()
    link.organizationId = input.organizationId
    link.tenantId = input.tenantId
    link.project = project
    link.dealId = input.dealId
    link.role = input.role
    link.linkedByUserId = input.actorUserId ?? null
    em.persist(link)
    await em.flush()

    await emitConstructionProjectsEvent('construction_projects.project.deal_linked', {
      id: link.id,
      projectId: project.id,
      linkId: link.id,
      dealId: input.dealId,
      role: input.role,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
    }, { persistent: true }).catch(() => undefined)

    return { linkId: link.id }
  },
  buildLog: async ({ input, result }) => ({
    actionLabel: 'Link deal to construction project',
    resourceKind: 'construction_projects.project',
    resourceId: input.projectId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    relatedResourceKind: 'customers.deal',
    relatedResourceId: input.dealId,
    context: { linkId: result.linkId, role: input.role },
  }),
}

const unlinkDealCommand: CommandHandler<ScopedProjectDealUnlinkInput, { ok: true }> = {
  id: 'construction_projects.project.unlink_deal',
  async execute(rawInput, ctx) {
    const input = scopedProjectDealUnlinkSchema.parse(rawInput)
    const scope = ensureConstructionProjectsScope(ctx)
    if (scope.organizationId !== input.organizationId || scope.tenantId !== input.tenantId) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const project = await requireProject(em, { id: input.projectId, tenantId: input.tenantId, organizationId: input.organizationId })
    const link = await em.findOne(ConstructionProjectDeal, {
      id: input.linkId,
      project: project.id,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      deletedAt: null,
    })
    if (!link) {
      throw new CrudHttpError(404, { error: 'Construction project deal link not found' })
    }

    if (link.role === 'primary' && statusRequiresPrimaryDeal(project.status as never)) {
      const primaryCount = await countActivePrimaryLinks(em, input.tenantId, input.organizationId, project.id)
      if (primaryCount <= 1) {
        throw new CrudHttpError(409, { error: 'Cannot remove the last primary deal link while the current status requires one' })
      }
    }

    link.deletedAt = new Date()
    link.updatedAt = new Date()
    await em.flush()

    await emitConstructionProjectsEvent('construction_projects.project.deal_unlinked', {
      id: link.id,
      projectId: project.id,
      linkId: link.id,
      dealId: link.dealId,
      role: link.role,
      tenantId: link.tenantId,
      organizationId: link.organizationId,
      actorUserId: input.actorUserId ?? null,
    }, { persistent: true }).catch(() => undefined)

    return { ok: true as const }
  },
  buildLog: async ({ input }) => ({
    actionLabel: 'Unlink deal from construction project',
    resourceKind: 'construction_projects.project',
    resourceId: input.projectId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    context: { linkId: input.linkId },
  }),
}

registerCommand(createProjectCommand)
registerCommand(updateProjectCommand)
registerCommand(archiveProjectCommand)
registerCommand(changeProjectStatusCommand)
registerCommand(linkDealCommand)
registerCommand(unlinkDealCommand)

export {
  createProjectCommand,
  updateProjectCommand,
  archiveProjectCommand,
  changeProjectStatusCommand,
  linkDealCommand,
  unlinkDealCommand,
}