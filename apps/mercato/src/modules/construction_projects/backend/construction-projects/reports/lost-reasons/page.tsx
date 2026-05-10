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
  LostReasonsReportItem,
  LostReasonsReportResponse,
  ProjectStatusBadge,
  formatDateTime,
  formatLossReason,
} from '../../../../components/ui'

function buildQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams({ page: '1', pageSize: '50' })
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue
    searchParams.set(key, value)
  }
  return searchParams.toString()
}

export default function ConstructionProjectLostReasonsReportPage() {
  const t = useT()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [draftFilters, setDraftFilters] = React.useState({
    groupBy: 'reasonCode',
    projectType: '',
    ownerUserId: '',
    dateFrom: '',
    dateTo: '',
  })
  const [appliedFilters, setAppliedFilters] = React.useState(draftFilters)
  const [data, setData] = React.useState<LostReasonsReportResponse | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void readApiResultOrThrow<LostReasonsReportResponse>(
      `${CONSTRUCTION_PROJECTS_REPORTS_API_BASE}/lost-reasons?${buildQuery(appliedFilters)}`,
      undefined,
      { errorMessage: t('construction_projects.report.loss.errors.load', 'Failed to load lost reasons report.') },
    )
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error
          ? loadError.message
          : t('construction_projects.report.loss.errors.load', 'Failed to load lost reasons report.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [appliedFilters, t])

  const columns = React.useMemo<ColumnDef<LostReasonsReportItem>[]>(() => ([
    {
      accessorKey: 'projectCode',
      header: t('construction_projects.report.loss.column.projectCode', 'Code'),
      cell: ({ row }) => (
        <Link href={`/backend/construction-projects/${row.original.projectId}`} className="font-medium text-primary hover:underline">
          {row.original.projectCode}
        </Link>
      ),
    },
    {
      accessorKey: 'name',
      header: t('construction_projects.report.loss.column.name', 'Project'),
    },
    {
      accessorKey: 'status',
      header: t('construction_projects.report.loss.column.status', 'Status'),
      cell: ({ row }) => <ProjectStatusBadge status={row.original.status} t={t} />,
    },
    {
      accessorKey: 'reasonCode',
      header: t('construction_projects.report.loss.column.reasonCode', 'Reason'),
      cell: ({ row }) => formatLossReason(t, row.original.reasonCode),
    },
    {
      accessorKey: 'competitorName',
      header: t('construction_projects.report.loss.column.competitorName', 'Competitor'),
      cell: ({ row }) => row.original.competitorName ?? '-',
    },
    {
      accessorKey: 'recordedAt',
      header: t('construction_projects.report.loss.column.recordedAt', 'Recorded'),
      cell: ({ row }) => formatDateTime(row.original.recordedAt),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          items={[
            {
              id: 'open',
              label: t('construction_projects.report.actions.openProject', 'Open project'),
              href: `/backend/construction-projects/${row.original.projectId}`,
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
    return `${CONSTRUCTION_PROJECTS_REPORTS_API_BASE}/lost-reasons?${searchParams.toString()}`
  }, [appliedFilters])

  if (loading && !data) {
    return <LoadingMessage label={t('construction_projects.report.loss.loading', 'Loading lost reasons report...')} />
  }

  if (error && !data) {
    return <ErrorMessage label={error} />
  }

  return (
    <Page>
      <PageHeader
        title={t('construction_projects.page.reports.loss.title', 'Lost Reasons')}
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <a href={exportUrl}>{t('construction_projects.report.actions.exportCsv', 'Export CSV')}</a>
            </Button>
          </div>
        )}
      />
      <PageBody>
        <div className="grid gap-3 lg:grid-cols-5">
          <select
            value={draftFilters.groupBy}
            onChange={(event) => setDraftFilters((current) => ({ ...current, groupBy: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="reasonCode">{t('construction_projects.report.loss.filters.groupByReason', 'Group by reason')}</option>
            <option value="month">{t('construction_projects.report.loss.filters.groupByMonth', 'Group by month')}</option>
          </select>
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

        <Card className="gap-0">
          <CardHeader>
            <CardTitle>{t('construction_projects.report.loss.summary.title', 'Loss distribution')}</CardTitle>
            <CardDescription>
              {t('construction_projects.report.loss.summary.subtitle', 'The current filter window groups lost projects by the selected bucket.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(data?.summary.buckets ?? []).map((bucket) => (
                <Card key={bucket.key} className="gap-0">
                  <CardHeader className="gap-2">
                    <CardDescription>
                      {data?.summary.groupBy === 'reasonCode' ? formatLossReason(t, bucket.key) : bucket.key}
                    </CardDescription>
                    <CardTitle className="text-2xl">{bucket.count}</CardTitle>
                  </CardHeader>
                  <CardContent />
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {error ? <ErrorMessage label={error} /> : null}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          perspective={{ tableId: 'construction-projects.report.lost-reasons' }}
          toolbar={(
            <div className="text-sm text-muted-foreground">
              {t('construction_projects.report.loss.toolbar', 'Showing {{count}} lost-project records.', {
                count: data?.items.length ?? 0,
              })}
            </div>
          )}
        />
      </PageBody>
    </Page>
  )
}
