"use client"

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { CONSTRUCTION_PROJECTS_API_BASE } from '../../lib/apiPaths'
import type { ConstructionProjectListItem, PagedResponse } from '../../components/ui'
import { ProjectStatusBadge, formatMoney } from '../../components/ui'

function SummaryCard({ label, value }: { label: string; value: string | number }) {
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

export default function ConstructionProjectsListPage() {
  const t = useT()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<PagedResponse<ConstructionProjectListItem> | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void readApiResultOrThrow<PagedResponse<ConstructionProjectListItem>>(
      `${CONSTRUCTION_PROJECTS_API_BASE}?page=1&pageSize=50`,
      undefined,
      { errorMessage: t('construction_projects.list.errors.load', 'Failed to load construction projects.') },
    )
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error
          ? loadError.message
          : t('construction_projects.list.errors.load', 'Failed to load construction projects.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [t])

  const rows = data?.items ?? []

  const columns = React.useMemo<ColumnDef<ConstructionProjectListItem>[]>(() => ([
    {
      accessorKey: 'projectCode',
      header: t('construction_projects.list.column.projectCode', 'Code'),
      cell: ({ row }) => (
        <Link href={`/backend/construction-projects/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.projectCode}
        </Link>
      ),
    },
    {
      accessorKey: 'name',
      header: t('construction_projects.list.column.name', 'Project'),
    },
    {
      accessorKey: 'status',
      header: t('construction_projects.list.column.status', 'Status'),
      cell: ({ row }) => <ProjectStatusBadge status={row.original.status} t={t} />,
    },
    {
      accessorKey: 'projectType',
      header: t('construction_projects.list.column.projectType', 'Type'),
      cell: ({ row }) => row.original.projectType ?? '-',
    },
    {
      accessorKey: 'linkedDealCount',
      header: t('construction_projects.list.column.linkedDealCount', 'Deals'),
    },
    {
      id: 'latestApprovedEstimate',
      header: t('construction_projects.list.column.latestEstimate', 'Latest approved estimate'),
      cell: ({ row }) => {
        const estimate = row.original.latestApprovedEstimate
        if (!estimate) return <span className="text-muted-foreground">-</span>
        return (
          <div className="space-y-1">
            <div className="font-medium">v{estimate.versionNo}</div>
            <div className="text-xs text-muted-foreground">
              {formatMoney(estimate.totalSaleAmount, estimate.currencyCode)}
            </div>
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          items={[
            {
              id: 'open',
              label: t('construction_projects.list.actions.open', 'Open'),
              href: `/backend/construction-projects/${row.original.id}`,
            },
            {
              id: 'edit',
              label: t('construction_projects.list.actions.edit', 'Edit'),
              href: `/backend/construction-projects/${row.original.id}/edit`,
            },
          ]}
        />
      ),
    },
  ]), [t])

  const summary = React.useMemo(() => {
    const activeCount = rows.filter((row) => !['completed', 'lost', 'cancelled'].includes(row.status)).length
    const wonCount = rows.filter((row) => row.status === 'won' || row.status === 'completed').length
    const lostCount = rows.filter((row) => row.status === 'lost').length
    return {
      total: data?.total ?? 0,
      activeCount,
      wonCount,
      lostCount,
    }
  }, [data?.total, rows])

  if (loading) {
    return <LoadingMessage label={t('construction_projects.list.loading', 'Loading construction projects...')} />
  }

  if (error) {
    return <ErrorMessage label={error} />
  }

  return (
    <Page>
      <PageHeader
        title={t('construction_projects.page.list.title', 'Construction Projects')}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/backend/construction-projects/reports/margins">
                {t('construction_projects.list.actions.marginReport', 'Margin report')}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/backend/construction-projects/reports/lost-reasons">
                {t('construction_projects.list.actions.lostReasonsReport', 'Lost reasons')}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/backend/construction-projects/create">
                {t('construction_projects.list.actions.create', 'Create project')}
              </Link>
            </Button>
          </div>
        )}
      />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard label={t('construction_projects.list.summary.total', 'Total projects')} value={summary.total} />
          <SummaryCard label={t('construction_projects.list.summary.active', 'Active')} value={summary.activeCount} />
          <SummaryCard label={t('construction_projects.list.summary.won', 'Won / completed')} value={summary.wonCount} />
          <SummaryCard label={t('construction_projects.list.summary.lost', 'Lost')} value={summary.lostCount} />
        </div>

        <DataTable
          columns={columns}
          data={rows}
          toolbar={(
            <div className="text-sm text-muted-foreground">
              {t('construction_projects.list.summary.window', 'Showing the latest {{count}} projects.', {
                count: rows.length,
              })}
            </div>
          )}
          perspective={{ tableId: 'construction-projects.list' }}
        />
      </PageBody>
    </Page>
  )
}
