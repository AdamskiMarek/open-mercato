"use client"

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Input } from '@open-mercato/ui/primitives/input'
import { CONSTRUCTION_PROJECTS_REPORTS_API_BASE } from '../../../../lib/apiPaths'
import {
  MarginReportItem,
  MarginReportResponse,
  ProjectStatusBadge,
  formatDateTime,
  formatMoney,
  formatPercent,
} from '../../../../components/ui'

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="gap-0">
      <CardHeader className="gap-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent />
    </Card>
  )
}

function buildQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams({ page: '1', pageSize: '50' })
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue
    searchParams.set(key, value)
  }
  return searchParams.toString()
}

export default function ConstructionProjectMarginsReportPage() {
  const t = useT()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [draftFilters, setDraftFilters] = React.useState({
    projectType: '',
    ownerUserId: '',
    dateFrom: '',
    dateTo: '',
  })
  const [appliedFilters, setAppliedFilters] = React.useState(draftFilters)
  const [data, setData] = React.useState<MarginReportResponse | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void readApiResultOrThrow<MarginReportResponse>(
      `${CONSTRUCTION_PROJECTS_REPORTS_API_BASE}/margins?${buildQuery(appliedFilters)}`,
      undefined,
      { errorMessage: t('construction_projects.report.margins.errors.load', 'Failed to load margin report.') },
    )
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error
          ? loadError.message
          : t('construction_projects.report.margins.errors.load', 'Failed to load margin report.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [appliedFilters, t])

  const columns = React.useMemo<ColumnDef<MarginReportItem>[]>(() => ([
    {
      accessorKey: 'projectCode',
      header: t('construction_projects.report.margins.column.projectCode', 'Code'),
      cell: ({ row }) => (
        <Link href={`/backend/construction-projects/${row.original.projectId}`} className="font-medium text-primary hover:underline">
          {row.original.projectCode}
        </Link>
      ),
    },
    {
      accessorKey: 'name',
      header: t('construction_projects.report.margins.column.name', 'Project'),
    },
    {
      accessorKey: 'status',
      header: t('construction_projects.report.margins.column.status', 'Status'),
      cell: ({ row }) => <ProjectStatusBadge status={row.original.status} t={t} />,
    },
    {
      accessorKey: 'estimateVersionNo',
      header: t('construction_projects.report.margins.column.version', 'Estimate'),
      cell: ({ row }) => `v${row.original.estimateVersionNo}`,
    },
    {
      accessorKey: 'totalSaleAmount',
      header: t('construction_projects.report.margins.column.totalSaleAmount', 'Total sale'),
      cell: ({ row }) => formatMoney(row.original.totalSaleAmount, row.original.currencyCode),
    },
    {
      accessorKey: 'marginAmount',
      header: t('construction_projects.report.margins.column.marginAmount', 'Margin amount'),
      cell: ({ row }) => formatMoney(row.original.marginAmount, row.original.currencyCode),
    },
    {
      accessorKey: 'marginPercent',
      header: t('construction_projects.report.margins.column.marginPercent', 'Margin %'),
      cell: ({ row }) => formatPercent(row.original.marginPercent),
    },
    {
      accessorKey: 'approvedAt',
      header: t('construction_projects.report.margins.column.approvedAt', 'Approved'),
      cell: ({ row }) => formatDateTime(row.original.approvedAt),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          items={[
            {
              id: 'project',
              label: t('construction_projects.report.actions.openProject', 'Open project'),
              href: `/backend/construction-projects/${row.original.projectId}`,
            },
            {
              id: 'estimate',
              label: t('construction_projects.report.actions.openEstimate', 'Open estimate'),
              href: `/backend/construction-projects/${row.original.projectId}/estimates/${row.original.estimateId}`,
            },
          ]}
        />
      ),
    },
  ]), [t])

  const exportUrl = React.useMemo(() => {
    const searchParams = new URLSearchParams(buildQuery(appliedFilters))
    searchParams.set('format', 'csv')
    searchParams.set('pageSize', '10000')
    return `${CONSTRUCTION_PROJECTS_REPORTS_API_BASE}/margins?${searchParams.toString()}`
  }, [appliedFilters])

  if (loading && !data) {
    return <LoadingMessage label={t('construction_projects.report.margins.loading', 'Loading margin report...')} />
  }

  if (error && !data) {
    return <ErrorMessage label={error} />
  }

  return (
    <Page>
      <PageHeader
        title={t('construction_projects.page.reports.margins.title', 'Margin Ranking')}
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <a href={exportUrl}>{t('construction_projects.report.actions.exportCsv', 'Export CSV')}</a>
            </Button>
          </div>
        )}
      />
      <PageBody>
        <div className="grid gap-3 lg:grid-cols-4">
          <Input
            value={draftFilters.projectType}
            onChange={(event) => setDraftFilters((current) => ({ ...current, projectType: event.target.value }))}
            placeholder={t('construction_projects.report.filters.projectType', 'Filter by project type')}
          />
          <Input
            value={draftFilters.ownerUserId}
            onChange={(event) => setDraftFilters((current) => ({ ...current, ownerUserId: event.target.value }))}
            placeholder={t('construction_projects.report.filters.ownerUserId', 'Filter by owner user ID')}
          />
          <Input
            type="date"
            value={draftFilters.dateFrom}
            onChange={(event) => setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }))}
          />
          <div className="flex gap-2">
            <Input
              type="date"
              value={draftFilters.dateTo}
              onChange={(event) => setDraftFilters((current) => ({ ...current, dateTo: event.target.value }))}
            />
            <Button type="button" onClick={() => setAppliedFilters(draftFilters)}>
              {t('ui.actions.apply', 'Apply')}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label={t('construction_projects.report.margins.summary.projectCount', 'Projects')} value={data?.summary.projectCount ?? 0} />
          <MetricCard label={t('construction_projects.report.margins.summary.totalSaleAmount', 'Total sale')} value={formatMoney(data?.summary.totalSaleAmount ?? null, data?.items[0]?.currencyCode ?? 'USD')} />
          <MetricCard label={t('construction_projects.report.margins.summary.totalMarginAmount', 'Total margin')} value={formatMoney(data?.summary.totalMarginAmount ?? null, data?.items[0]?.currencyCode ?? 'USD')} />
          <MetricCard label={t('construction_projects.report.margins.summary.averageMarginPercent', 'Average margin')} value={formatPercent(data?.summary.averageMarginPercent ?? null)} />
        </div>

        {error ? <ErrorMessage label={error} /> : null}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          perspective={{ tableId: 'construction-projects.report.margins' }}
          toolbar={(
            <div className="text-sm text-muted-foreground">
              {t('construction_projects.report.margins.toolbar', 'Showing {{count}} approved estimates.', {
                count: data?.items.length ?? 0,
              })}
            </div>
          )}
        />
      </PageBody>
    </Page>
  )
}
