"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { FormHeader } from '@open-mercato/ui/backend/forms/FormHeader'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Input } from '@open-mercato/ui/primitives/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@open-mercato/ui/primitives/tabs'
import { CONSTRUCTION_PROJECTS_API_BASE } from '../lib/apiPaths'
import {
  buildDealRoleOptions,
  DealLinkPayload,
  EstimateSummaryPayload,
  ProjectDetailPayload,
  ProjectStatusBadge,
  EstimateStatusBadge,
  formatDate,
  formatDateTime,
  formatDealRole,
  formatLossReason,
  formatMoney,
  formatPercent,
  toNullableString,
} from './ui'

type ConstructionProjectDetailProps = {
  projectId?: string
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-right">{value}</dd>
    </div>
  )
}

export function ConstructionProjectDetail({ projectId }: ConstructionProjectDetailProps) {
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { runMutation } = useGuardedMutation<{ projectId: string }>({
    contextId: `construction-project:${projectId ?? 'unknown'}`,
    blockedMessage: t('ui.forms.flash.saveBlocked', 'Save blocked by validation'),
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [project, setProject] = React.useState<ProjectDetailPayload | null>(null)
  const [activeTab, setActiveTab] = React.useState('overview')
  const [linkDealId, setLinkDealId] = React.useState('')
  const [linkRole, setLinkRole] = React.useState('primary')

  const loadProject = React.useCallback(async (silent = false) => {
    if (!projectId) {
      setError(t('construction_projects.detail.errors.missingId', 'Missing construction project id.'))
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    setError(null)

    try {
      const response = await readApiResultOrThrow<ProjectDetailPayload>(
        `${CONSTRUCTION_PROJECTS_API_BASE}/${projectId}`,
        undefined,
        { errorMessage: t('construction_projects.detail.errors.load', 'Failed to load construction project.') },
      )
      setProject(response)
    } catch (loadError) {
      setError(loadError instanceof Error
        ? loadError.message
        : t('construction_projects.detail.errors.load', 'Failed to load construction project.'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [projectId, t])

  React.useEffect(() => {
    // Reset state when projectId changes
    setProject(null)
    setError(null)
    setLoading(true)
    void loadProject()
  }, [projectId])

  const handleCreateEstimate = React.useCallback(async (cloneFromEstimateId?: string | null) => {
    if (!project) return
    const result = await runMutation<{ id: string }>({
      operation: async () => {
        return await readApiResultOrThrow<{ id: string }>(
          `${CONSTRUCTION_PROJECTS_API_BASE}/${project.id}/estimates`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              name: `${project.projectCode} ${t('construction_projects.detail.estimate.defaultName', 'Estimate')}`,
              cloneFromEstimateId: cloneFromEstimateId ?? null,
              defaultMarkupPercent: null,
            }),
          },
          {
            errorMessage: cloneFromEstimateId
              ? t('construction_projects.detail.errors.cloneEstimate', 'Failed to clone estimate.')
              : t('construction_projects.detail.errors.createEstimate', 'Failed to create estimate.'),
          },
        )
      },
      context: { projectId: project.id },
      mutationPayload: { cloneFromEstimateId: cloneFromEstimateId ?? null },
    })
    flash(
      cloneFromEstimateId
        ? t('construction_projects.flash.estimateCloned', 'Estimate cloned.')
        : t('construction_projects.flash.estimateCreated', 'Estimate created.'),
      'success',
    )
    if (result?.id) {
      router.push(`/backend/construction-projects/${project.id}/estimates/${result.id}`)
      return
    }
    await loadProject(true)
  }, [loadProject, project, router, runMutation, t])

  const handleArchiveProject = React.useCallback(async () => {
    if (!project) return
    const accepted = await confirm({
      title: t('construction_projects.detail.archive.title', 'Archive construction project?'),
      text: t(
        'construction_projects.detail.archive.text',
        'This archives the project and any active draft estimates. Continue?',
      ),
      variant: 'destructive',
      confirmText: t('construction_projects.detail.archive.confirm', 'Archive'),
      cancelText: t('ui.actions.cancel', 'Cancel'),
    })
    if (!accepted) return

    await runMutation({
      operation: async () => {
        await apiCallOrThrow(`${CONSTRUCTION_PROJECTS_API_BASE}/${project.id}`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ confirmArchiveApprovedEstimates: true }),
        }, {
          errorMessage: t('construction_projects.detail.errors.archive', 'Failed to archive construction project.'),
        })
        return { ok: true }
      },
      context: { projectId: project.id },
      mutationPayload: { confirmArchiveApprovedEstimates: true },
    })

    flash(t('construction_projects.flash.archived', 'Construction project archived.'), 'success')
    router.push('/backend/construction-projects')
  }, [confirm, project, router, runMutation, t])

  const handleLinkDeal = React.useCallback(async () => {
    if (!project) return
    const dealId = toNullableString(linkDealId)
    if (!dealId) return

    await runMutation({
      operation: async () => {
        await apiCallOrThrow(`${CONSTRUCTION_PROJECTS_API_BASE}/${project.id}/deals`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dealId, role: linkRole }),
        }, {
          errorMessage: t('construction_projects.detail.errors.linkDeal', 'Failed to link deal.'),
        })
        return { ok: true }
      },
      context: { projectId: project.id },
      mutationPayload: { dealId, role: linkRole },
    })

    setLinkDealId('')
    flash(t('construction_projects.flash.dealLinked', 'Deal linked.'), 'success')
    await loadProject(true)
  }, [linkDealId, linkRole, loadProject, project, runMutation, t])

  const handleUnlinkDeal = React.useCallback(async (link: DealLinkPayload) => {
    if (!project) return
    const accepted = await confirm({
      title: t('construction_projects.detail.unlink.title', 'Unlink deal?'),
      text: t('construction_projects.detail.unlink.text', 'The deal link will be removed from this project.'),
      variant: 'destructive',
      confirmText: t('construction_projects.detail.unlink.confirm', 'Unlink'),
      cancelText: t('ui.actions.cancel', 'Cancel'),
    })
    if (!accepted) return

    await runMutation({
      operation: async () => {
        await apiCallOrThrow(`${CONSTRUCTION_PROJECTS_API_BASE}/${project.id}/deals/${link.id}`, {
          method: 'DELETE',
        }, {
          errorMessage: t('construction_projects.detail.errors.unlinkDeal', 'Failed to unlink deal.'),
        })
        return { ok: true }
      },
      context: { projectId: project.id },
      mutationPayload: { linkId: link.id },
    })

    flash(t('construction_projects.flash.dealUnlinked', 'Deal unlinked.'), 'success')
    await loadProject(true)
  }, [confirm, loadProject, project, runMutation, t])

  const handleDealUnlink = React.useCallback((link: DealLinkPayload) => {
    void handleUnlinkDeal(link)
  }, [handleUnlinkDeal])

  const dealColumns = React.useMemo<ColumnDef<DealLinkPayload>[]>(() => ([
    {
      accessorKey: 'dealId',
      header: t('construction_projects.detail.deals.column.dealId', 'Deal ID'),
    },
    {
      accessorKey: 'role',
      header: t('construction_projects.detail.deals.column.role', 'Role'),
      cell: ({ row }) => formatDealRole(t, row.original.role),
    },
    {
      accessorKey: 'linkedAt',
      header: t('construction_projects.detail.deals.column.linkedAt', 'Linked at'),
      cell: ({ row }) => formatDateTime(row.original.linkedAt),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          items={[
            {
              id: 'unlink',
              label: t('construction_projects.detail.deals.actions.unlink', 'Unlink'),
              destructive: true,
              onSelect: () => handleDealUnlink(row.original),
            },
          ]}
        />
      ),
    },
  ]), [handleDealUnlink, t])

  const handleEstimateOpen = React.useCallback((estimateId: string) => {
    if (project?.id) {
      router.push(`/backend/construction-projects/${project.id}/estimates/${estimateId}`)
    }
  }, [project?.id, router])

  const estimateColumns = React.useMemo<ColumnDef<EstimateSummaryPayload>[]>(() => ([
    {
      accessorKey: 'versionNo',
      header: t('construction_projects.detail.estimates.column.version', 'Version'),
      cell: ({ row }) => `v${row.original.versionNo}`,
    },
    {
      accessorKey: 'status',
      header: t('construction_projects.detail.estimates.column.status', 'Status'),
      cell: ({ row }) => <EstimateStatusBadge status={row.original.status} t={t} />,
    },
    {
      accessorKey: 'updatedAt',
      header: t('construction_projects.detail.estimates.column.updatedAt', 'Updated'),
      cell: ({ row }) => formatDateTime(row.original.updatedAt),
    },
    {
      accessorKey: 'totalSaleAmount',
      header: t('construction_projects.detail.estimates.column.totalSaleAmount', 'Total sale'),
      cell: ({ row }) => formatMoney(row.original.totalSaleAmount, project?.latestApprovedEstimate?.currencyCode ?? 'USD'),
    },
    {
      accessorKey: 'marginPercent',
      header: t('construction_projects.detail.estimates.column.marginPercent', 'Margin'),
      cell: ({ row }) => formatPercent(row.original.marginPercent),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          items={[
            {
              id: 'open',
              label: t('construction_projects.detail.estimates.actions.open', 'Open'),
              href: `/backend/construction-projects/${project?.id}/estimates/${row.original.id}`,
            },
          ]}
        />
      ),
    },
  ]), [project?.id, project?.latestApprovedEstimate?.currencyCode, t])

  if (loading) {
    return <LoadingMessage label={t('construction_projects.detail.loading', 'Loading construction project...')} />
  }

  if (error || !project) {
    return <ErrorMessage label={error ?? t('construction_projects.detail.errors.load', 'Failed to load construction project.')} />
  }

  const dealRoleOptions = buildDealRoleOptions(t)

  return (
    <Page>
      <PageBody>
        <FormHeader
          mode="detail"
          backHref="/backend/construction-projects"
          title={`${project.projectCode} · ${project.name}`}
          entityTypeLabel={t('construction_projects.page.detail.title', 'Construction Project')}
          subtitle={project.projectType ?? project.siteCity ?? undefined}
          statusBadge={<ProjectStatusBadge status={project.status} t={t} />}
          actionsContent={(
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" asChild>
                <Link href={`/backend/construction-projects/${project.id}/edit`}>
                  {t('common.edit', 'Edit')}
                </Link>
              </Button>
              <Button type="button" variant="outline" onClick={() => { void handleCreateEstimate(null) }}>
                {t('construction_projects.detail.actions.newEstimate', 'New estimate')}
              </Button>
              {project.latestApprovedEstimate ? (
                <Button type="button" variant="outline" onClick={() => { void handleCreateEstimate(project.latestApprovedEstimate?.id ?? null) }}>
                  {t('construction_projects.detail.actions.cloneEstimate', 'Clone approved')}
                </Button>
              ) : null}
              <Button type="button" variant="destructive-outline" onClick={() => { void handleArchiveProject() }}>
                {t('construction_projects.detail.actions.archive', 'Archive')}
              </Button>
            </div>
          )}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">{t('construction_projects.detail.tabs.overview', 'Overview')}</TabsTrigger>
            <TabsTrigger value="deals">{t('construction_projects.detail.tabs.deals', 'Deals')}</TabsTrigger>
            <TabsTrigger value="estimates">{t('construction_projects.detail.tabs.estimates', 'Estimates')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="gap-0 xl:col-span-1">
                <CardHeader>
                  <CardTitle>{t('construction_projects.detail.card.summary', 'Summary')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl>
                    <InfoRow label={t('construction_projects.form.field.projectType', 'Project type')} value={project.projectType ?? '-'} />
                    <InfoRow label={t('construction_projects.form.field.ownerUserId', 'Owner user ID')} value={project.ownerUserId ?? '-'} />
                    <InfoRow label={t('construction_projects.form.field.clientCompanyId', 'Client company ID')} value={project.clientCompanyId ?? '-'} />
                    <InfoRow label={t('construction_projects.form.field.clientPersonId', 'Client person ID')} value={project.clientPersonId ?? '-'} />
                    <InfoRow label={t('construction_projects.form.field.estimatedRevenueAmount', 'Estimated revenue')} value={formatMoney(project.estimatedRevenueAmount, project.latestApprovedEstimate?.currencyCode ?? 'USD')} />
                    <InfoRow label={t('construction_projects.detail.summary.createdAt', 'Created')} value={formatDateTime(project.createdAt)} />
                    <InfoRow label={t('construction_projects.detail.summary.updatedAt', 'Updated')} value={formatDateTime(project.updatedAt)} />
                  </dl>
                </CardContent>
              </Card>

              <Card className="gap-0 xl:col-span-1">
                <CardHeader>
                  <CardTitle>{t('construction_projects.detail.card.timeline', 'Timeline')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl>
                    <InfoRow label={t('construction_projects.form.field.plannedStartDate', 'Planned start')} value={formatDate(project.plannedStartDate)} />
                    <InfoRow label={t('construction_projects.form.field.plannedEndDate', 'Planned end')} value={formatDate(project.plannedEndDate)} />
                    <InfoRow label={t('construction_projects.form.field.actualStartDate', 'Actual start')} value={formatDate(project.actualStartDate)} />
                    <InfoRow label={t('construction_projects.form.field.actualEndDate', 'Actual end')} value={formatDate(project.actualEndDate)} />
                  </dl>
                </CardContent>
              </Card>

              <Card className="gap-0 xl:col-span-1">
                <CardHeader>
                  <CardTitle>{t('construction_projects.detail.card.site', 'Site')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl>
                    <InfoRow label={t('construction_projects.form.field.siteAddress', 'Address')} value={project.siteAddress ?? '-'} />
                    <InfoRow label={t('construction_projects.form.field.siteCity', 'City')} value={project.siteCity ?? '-'} />
                    <InfoRow label={t('construction_projects.form.field.sitePostalCode', 'Postal code')} value={project.sitePostalCode ?? '-'} />
                    <InfoRow label={t('construction_projects.form.field.siteCountryCode', 'Country code')} value={project.siteCountryCode ?? '-'} />
                    <InfoRow label={t('construction_projects.form.field.siteLatitude', 'Latitude')} value={project.siteLatitude ?? '-'} />
                    <InfoRow label={t('construction_projects.form.field.siteLongitude', 'Longitude')} value={project.siteLongitude ?? '-'} />
                  </dl>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="gap-0">
                <CardHeader>
                  <CardTitle>{t('construction_projects.detail.card.latestEstimate', 'Latest approved estimate')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {project.latestApprovedEstimate ? (
                    <dl>
                      <InfoRow label={t('construction_projects.detail.latestEstimate.version', 'Version')} value={`v${project.latestApprovedEstimate.versionNo}`} />
                      <InfoRow label={t('construction_projects.detail.latestEstimate.approvedAt', 'Approved')} value={formatDateTime(project.latestApprovedEstimate.approvedAt)} />
                      <InfoRow label={t('construction_projects.detail.latestEstimate.totalSale', 'Total sale')} value={formatMoney(project.latestApprovedEstimate.totalSaleAmount, project.latestApprovedEstimate.currencyCode)} />
                      <InfoRow label={t('construction_projects.detail.latestEstimate.marginAmount', 'Margin amount')} value={formatMoney(project.latestApprovedEstimate.marginAmount, project.latestApprovedEstimate.currencyCode)} />
                      <InfoRow label={t('construction_projects.detail.latestEstimate.marginPercent', 'Margin percent')} value={formatPercent(project.latestApprovedEstimate.marginPercent)} />
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('construction_projects.detail.latestEstimate.empty', 'No approved estimate yet.')}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="gap-0">
                <CardHeader>
                  <CardTitle>{t('construction_projects.detail.card.loss', 'Loss record')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {project.latestLossRecord ? (
                    <dl>
                      <InfoRow label={t('construction_projects.detail.loss.reason', 'Reason')} value={formatLossReason(t, project.latestLossRecord.reasonCode)} />
                      <InfoRow label={t('construction_projects.detail.loss.details', 'Details')} value={project.latestLossRecord.reasonDetails} />
                      <InfoRow label={t('construction_projects.detail.loss.competitor', 'Competitor')} value={project.latestLossRecord.competitorName ?? '-'} />
                      <InfoRow label={t('construction_projects.detail.loss.recordedAt', 'Recorded')} value={formatDateTime(project.latestLossRecord.recordedAt)} />
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('construction_projects.detail.loss.empty', 'No loss record for this project.')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="gap-0">
                <CardHeader>
                  <CardTitle>{t('construction_projects.detail.card.description', 'Description')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{project.description ?? '-'}</p>
                </CardContent>
              </Card>
              <Card className="gap-0">
                <CardHeader>
                  <CardTitle>{t('construction_projects.detail.card.notes', 'Internal notes')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{project.notes ?? '-'}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="deals" className="space-y-4">
            <Card className="gap-0">
              <CardHeader>
                <CardTitle>{t('construction_projects.detail.deals.title', 'Linked deals')}</CardTitle>
                <CardDescription>
                  {t('construction_projects.detail.deals.subtitle', 'Link CRM deals to keep offers and project work in sync.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                  <Input
                    value={linkDealId}
                    onChange={(event) => setLinkDealId(event.target.value)}
                    placeholder={t('construction_projects.detail.deals.dealIdPlaceholder', 'Deal UUID')}
                  />
                  <select
                    value={linkRole}
                    onChange={(event) => setLinkRole(event.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {dealRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <Button type="button" onClick={() => { void handleLinkDeal() }}>
                    {t('construction_projects.detail.deals.actions.link', 'Link deal')}
                  </Button>
                </div>

                <DataTable
                  columns={dealColumns}
                  data={project.linkedDeals}
                  perspective={{ tableId: 'construction-projects.detail.deals' }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="estimates" className="space-y-4">
            <Card className="gap-0">
              <CardHeader>
                <CardTitle>{t('construction_projects.detail.estimates.title', 'Estimates')}</CardTitle>
                <CardDescription>
                  {t('construction_projects.detail.estimates.subtitle', 'Draft, review, and compare project estimates.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={() => { void handleCreateEstimate(null) }}>
                    {t('construction_projects.detail.actions.newEstimate', 'New estimate')}
                  </Button>
                  {project.latestApprovedEstimate ? (
                    <Button type="button" variant="outline" onClick={() => { void handleCreateEstimate(project.latestApprovedEstimate?.id ?? null) }}>
                      {t('construction_projects.detail.actions.cloneEstimate', 'Clone approved')}
                    </Button>
                  ) : null}
                </div>

                <DataTable
                  columns={estimateColumns}
                  data={project.estimates}
                  perspective={{ tableId: 'construction-projects.detail.estimates' }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
