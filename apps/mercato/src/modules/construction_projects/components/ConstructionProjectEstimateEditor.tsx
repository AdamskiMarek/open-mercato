"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { FormHeader } from '@open-mercato/ui/backend/forms/FormHeader'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { apiCall, apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrudFormError, raiseCrudError } from '@open-mercato/ui/backend/utils/serverErrors'
import { Alert, AlertDescription, AlertTitle } from '@open-mercato/ui/primitives/alert'
import { Button } from '@open-mercato/ui/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Input } from '@open-mercato/ui/primitives/input'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { calculateEstimateTotals, type EstimateLineItemDraft } from '../lib/calculations'
import { CONSTRUCTION_PROJECTS_API_BASE } from '../lib/apiPaths'
import {
  buildLineItemCategoryOptions,
  EstimateDetailPayload,
  EstimateLineItemPayload,
  EstimateStatusBadge,
  ProjectDetailPayload,
  formatDateTime,
  formatLineItemCategory,
  formatMoney,
  formatPercent,
  toNullableNumber,
  toNullableString,
} from './ui'

type ConstructionProjectEstimateEditorProps = {
  projectId?: string
  estimateId?: string
}

type EditableLineItem = EstimateLineItemDraft & {
  clientKey: string
  id?: string | null
  notes?: string | null
}

function MetricCard({ label, value }: { label: string; value: string }) {
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

export function ConstructionProjectEstimateEditor({
  projectId,
  estimateId,
}: ConstructionProjectEstimateEditorProps) {
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { runMutation } = useGuardedMutation<{ projectId: string; estimateId: string }>({
    contextId: `construction-project-estimate:${estimateId ?? 'unknown'}`,
    blockedMessage: t('ui.forms.flash.saveBlocked', 'Save blocked by validation'),
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [conflictMessage, setConflictMessage] = React.useState<string | null>(null)
  const [project, setProject] = React.useState<ProjectDetailPayload | null>(null)
  const [estimate, setEstimate] = React.useState<EstimateDetailPayload | null>(null)
  const [name, setName] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [defaultMarkupPercent, setDefaultMarkupPercent] = React.useState<number | null>(null)
  const [lineItems, setLineItems] = React.useState<EditableLineItem[]>([])
  const nextDraftLineItemKey = React.useRef(0)

  const createDraftLineItemKey = React.useCallback(() => {
    const key = `draft-line-item-${nextDraftLineItemKey.current}`
    nextDraftLineItemKey.current += 1
    return key
  }, [])

  const loadEditor = React.useCallback(async (silent = false) => {
    if (!projectId || !estimateId) {
      setError(t('construction_projects.estimate.errors.missingId', 'Missing project or estimate id.'))
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    setError(null)

    try {
      const [projectResponse, estimateResponse] = await Promise.all([
        readApiResultOrThrow<ProjectDetailPayload>(`${CONSTRUCTION_PROJECTS_API_BASE}/${projectId}`, undefined, {
          errorMessage: t('construction_projects.estimate.errors.loadProject', 'Failed to load construction project.'),
        }),
        readApiResultOrThrow<{ estimate: EstimateDetailPayload; lineItems: EstimateLineItemPayload[] }>(
          `${CONSTRUCTION_PROJECTS_API_BASE}/${projectId}/estimates/${estimateId}`,
          undefined,
          { errorMessage: t('construction_projects.estimate.errors.load', 'Failed to load estimate.') },
        ),
      ])

      setProject(projectResponse)
      setEstimate(estimateResponse.estimate)
      setName(estimateResponse.estimate.name ?? '')
      setNotes(estimateResponse.estimate.notes ?? '')
      setDefaultMarkupPercent(estimateResponse.estimate.defaultMarkupPercent ?? null)
      setLineItems(estimateResponse.lineItems.map((lineItem) => ({
        clientKey: lineItem.id ? `line-item-${lineItem.id}` : createDraftLineItemKey(),
        id: lineItem.id,
        sortOrder: lineItem.sortOrder,
        category: lineItem.category as EditableLineItem['category'],
        description: lineItem.description,
        unit: lineItem.unit,
        quantity: lineItem.quantity ?? 0,
        unitCostAmount: lineItem.unitCostAmount ?? 0,
        markupPercent: lineItem.markupPercent ?? null,
        notes: lineItem.notes ?? null,
      })))
      setConflictMessage(null)
    } catch (loadError) {
      setError(loadError instanceof Error
        ? loadError.message
        : t('construction_projects.estimate.errors.load', 'Failed to load estimate.'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [createDraftLineItemKey, estimateId, projectId, t])

  React.useEffect(() => {
    void loadEditor()
  }, [loadEditor])

  const isDraft = estimate?.status === 'draft'
  const categoryOptions = React.useMemo(() => buildLineItemCategoryOptions(t), [t])

  const totals = React.useMemo(() => calculateEstimateTotals(lineItems, defaultMarkupPercent), [defaultMarkupPercent, lineItems])

  const updateLineItem = React.useCallback((index: number, patch: Partial<EditableLineItem>) => {
    setLineItems((current) => current.map((lineItem, lineIndex) => lineIndex === index
      ? { ...lineItem, ...patch }
      : lineItem))
  }, [])

  const addLineItem = React.useCallback(() => {
    setLineItems((current) => ([
      ...current,
      {
        clientKey: createDraftLineItemKey(),
        id: null,
        sortOrder: current.length,
        category: 'materials',
        description: '',
        unit: 'pcs',
        quantity: 1,
        unitCostAmount: 0,
        markupPercent: null,
        notes: null,
      },
    ]))
  }, [createDraftLineItemKey])

  const removeLineItem = React.useCallback((index: number) => {
    setLineItems((current) => current.filter((_, lineIndex) => lineIndex !== index).map((lineItem, nextIndex) => ({
      ...lineItem,
      sortOrder: nextIndex,
    })))
  }, [])

  const handleSave = React.useCallback(async () => {
    if (!projectId || !estimateId || !estimate) return
    const mutationPayload = {
      revision: estimate.revision,
      name: String(name).trim(),
      defaultMarkupPercent,
      notes: toNullableString(notes),
      lineItems: lineItems.map((lineItem, index) => ({
        id: lineItem.id ?? null,
        sortOrder: Number.isFinite(lineItem.sortOrder) ? lineItem.sortOrder : index,
        category: lineItem.category,
        description: String(lineItem.description ?? '').trim(),
        unit: String(lineItem.unit ?? '').trim(),
        quantity: Number(lineItem.quantity ?? 0),
        unitCostAmount: Number(lineItem.unitCostAmount ?? 0),
        markupPercent: toNullableNumber(lineItem.markupPercent),
        notes: toNullableString(lineItem.notes),
      })),
    }

    try {
      await runMutation({
        operation: async () => {
          const response = await apiCall<Record<string, unknown>>(
            `${CONSTRUCTION_PROJECTS_API_BASE}/${projectId}/estimates/${estimateId}`,
            {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(mutationPayload),
            },
          )
          if (response.ok) return response.result

          if (response.status === 409) {
            const message = typeof response.result?.error === 'string'
              ? response.result.error
              : t(
                'construction_projects.estimate.conflict',
                'This estimate was updated elsewhere. Reload the draft and apply your changes again.',
              )
            setConflictMessage(message)
            throw createCrudFormError(message, undefined, { status: 409 })
          }

          await raiseCrudError(
            response.response,
            t('construction_projects.estimate.errors.save', 'Failed to save estimate draft.'),
          )
        },
        context: { projectId, estimateId },
        mutationPayload,
      })
      setConflictMessage(null)
      flash(t('construction_projects.flash.estimateSaved', 'Estimate draft saved.'), 'success')
      await loadEditor(true)
    } catch (saveError) {
      if ((saveError as { status?: number } | undefined)?.status === 409) {
        await loadEditor(true)
      }
    }
  }, [defaultMarkupPercent, estimate, estimateId, lineItems, loadEditor, name, notes, projectId, runMutation, t])

  const handleApprove = React.useCallback(async () => {
    if (!projectId || !estimateId) return
    const accepted = await confirm({
      title: t('construction_projects.estimate.approve.title', 'Approve estimate?'),
      text: t('construction_projects.estimate.approve.text', 'This version becomes the latest approved estimate for the project.'),
      confirmText: t('construction_projects.estimate.approve.confirm', 'Approve'),
      cancelText: t('ui.actions.cancel', 'Cancel'),
    })
    if (!accepted) return

    try {
      await runMutation({
        operation: async () => {
          await apiCallOrThrow(`${CONSTRUCTION_PROJECTS_API_BASE}/${projectId}/estimates/${estimateId}/approve`, {
            method: 'POST',
          }, {
            errorMessage: t('construction_projects.estimate.errors.approve', 'Failed to approve estimate.'),
          })
          return { ok: true }
        },
        context: { projectId, estimateId },
        mutationPayload: { estimateId },
      })
      flash(t('construction_projects.flash.estimateApproved', 'Estimate approved.'), 'success')
      await loadEditor(true)
    } catch {
      // useGuardedMutation already surfaced the error
    }
  }, [confirm, estimateId, loadEditor, projectId, runMutation, t])

  const handleArchive = React.useCallback(async () => {
    if (!projectId || !estimateId) return
    const accepted = await confirm({
      title: t('construction_projects.estimate.archive.title', 'Archive estimate?'),
      text: t('construction_projects.estimate.archive.text', 'Archived estimates remain visible but can no longer be edited.'),
      variant: 'destructive',
      confirmText: t('construction_projects.estimate.archive.confirm', 'Archive'),
      cancelText: t('ui.actions.cancel', 'Cancel'),
    })
    if (!accepted) return

    try {
      await runMutation({
        operation: async () => {
          await apiCallOrThrow(`${CONSTRUCTION_PROJECTS_API_BASE}/${projectId}/estimates/${estimateId}`, {
            method: 'DELETE',
          }, {
            errorMessage: t('construction_projects.estimate.errors.archive', 'Failed to archive estimate.'),
          })
          return { ok: true }
        },
        context: { projectId, estimateId },
        mutationPayload: { estimateId },
      })
      flash(t('construction_projects.flash.estimateArchived', 'Estimate archived.'), 'success')
      router.push(`/backend/construction-projects/${projectId}`)
    } catch {
      // useGuardedMutation already surfaced the error
    }
  }, [confirm, estimateId, projectId, router, runMutation, t])

  if (loading) {
    return <LoadingMessage label={t('construction_projects.estimate.loading', 'Loading estimate...')} />
  }

  if (error || !project || !estimate) {
    return <ErrorMessage label={error ?? t('construction_projects.estimate.errors.load', 'Failed to load estimate.')} />
  }

  return (
    <Page>
      <PageBody>
        <FormHeader
          mode="detail"
          backHref={`/backend/construction-projects/${project.id}`}
          title={`${project.projectCode} · v${estimate.versionNo}`}
          entityTypeLabel={t('construction_projects.page.estimates.title', 'Estimate')}
          subtitle={`${t('construction_projects.estimate.subtitle', 'Revision')} ${estimate.revision} · ${estimate.currencyCode}`}
          statusBadge={<EstimateStatusBadge status={estimate.status} t={t} />}
          actionsContent={(
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" asChild>
                <Link href={`/backend/construction-projects/${project.id}`}>
                  {t('construction_projects.estimate.actions.backToProject', 'Back to project')}
                </Link>
              </Button>
              {isDraft ? (
                <Button type="button" variant="outline" onClick={() => { void handleSave() }}>
                  {t('construction_projects.estimate.actions.save', 'Save draft')}
                </Button>
              ) : null}
              {estimate.status === 'draft' ? (
                <Button type="button" onClick={() => { void handleApprove() }}>
                  {t('construction_projects.estimate.actions.approve', 'Approve')}
                </Button>
              ) : null}
              {estimate.status !== 'archived' ? (
                <Button type="button" variant="destructive-outline" onClick={() => { void handleArchive() }}>
                  {t('construction_projects.estimate.actions.archive', 'Archive')}
                </Button>
              ) : null}
            </div>
          )}
        />

        {conflictMessage ? (
          <Alert variant="warning">
            <AlertTitle>{t('construction_projects.estimate.conflict.title', 'Draft conflict detected')}</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{conflictMessage}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => { void loadEditor(true) }}>
                {t('construction_projects.estimate.actions.reload', 'Reload draft')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {!isDraft ? (
          <Alert variant="info">
            <AlertTitle>{t('construction_projects.estimate.readOnly.title', 'Read-only estimate')}</AlertTitle>
            <AlertDescription>
              {t('construction_projects.estimate.readOnly.text', 'Approved and archived estimates are locked for editing. Create a new version from the project detail page to continue costing.')}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label={t('construction_projects.estimate.metric.totalCost', 'Total cost')} value={formatMoney(totals.totalCostAmount, estimate.currencyCode)} />
          <MetricCard label={t('construction_projects.estimate.metric.totalSale', 'Total sale')} value={formatMoney(totals.totalSaleAmount, estimate.currencyCode)} />
          <MetricCard label={t('construction_projects.estimate.metric.marginAmount', 'Margin amount')} value={formatMoney(totals.marginAmount, estimate.currencyCode)} />
          <MetricCard label={t('construction_projects.estimate.metric.marginPercent', 'Margin percent')} value={formatPercent(totals.marginPercent)} />
        </div>

        <Card className="gap-0">
          <CardHeader>
            <CardTitle>{t('construction_projects.estimate.card.header', 'Estimate details')}</CardTitle>
            <CardDescription>
              {t('construction_projects.estimate.card.subtitle', 'Control global markup and review approval history.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('construction_projects.estimate.field.name', 'Estimate name')}</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} disabled={!isDraft} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('construction_projects.estimate.field.defaultMarkupPercent', 'Default markup %')}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={defaultMarkupPercent ?? ''}
                onChange={(event) => setDefaultMarkupPercent(toNullableNumber(event.target.value))}
                disabled={!isDraft}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('construction_projects.estimate.field.approvedAt', 'Approved at')}</label>
              <Input value={formatDateTime(estimate.approvedAt)} disabled />
            </div>
            <div className="space-y-2 md:col-span-3">
              <label className="text-sm font-medium">{t('construction_projects.estimate.field.notes', 'Notes')}</label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!isDraft} rows={4} />
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{t('construction_projects.estimate.lineItems.title', 'Line items')}</CardTitle>
                <CardDescription>
                  {t('construction_projects.estimate.lineItems.subtitle', 'Adjust quantities, unit costs, and markups directly in the draft grid.')}
                </CardDescription>
              </div>
              {isDraft ? (
                <Button type="button" variant="outline" onClick={addLineItem}>
                  {t('construction_projects.estimate.lineItems.actions.add', 'Add line item')}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-3">{t('construction_projects.estimate.lineItems.column.sortOrder', 'Order')}</th>
                  <th className="px-2 py-3">{t('construction_projects.estimate.lineItems.column.category', 'Category')}</th>
                  <th className="px-2 py-3">{t('construction_projects.estimate.lineItems.column.description', 'Description')}</th>
                  <th className="px-2 py-3">{t('construction_projects.estimate.lineItems.column.unit', 'Unit')}</th>
                  <th className="px-2 py-3">{t('construction_projects.estimate.lineItems.column.quantity', 'Qty')}</th>
                  <th className="px-2 py-3">{t('construction_projects.estimate.lineItems.column.unitCostAmount', 'Unit cost')}</th>
                  <th className="px-2 py-3">{t('construction_projects.estimate.lineItems.column.markupPercent', 'Markup %')}</th>
                  <th className="px-2 py-3">{t('construction_projects.estimate.lineItems.column.notes', 'Notes')}</th>
                  <th className="px-2 py-3 text-right">{t('construction_projects.estimate.lineItems.column.totalCostAmount', 'Total cost')}</th>
                  <th className="px-2 py-3 text-right">{t('construction_projects.estimate.lineItems.column.totalSaleAmount', 'Total sale')}</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {totals.lineItems.map((lineItem, index) => (
                  <tr key={lineItem.id ?? `${lineItem.sortOrder}-${lineItem.category}-${index}`} className="border-b align-top">
                    <td className="px-2 py-3">
                      <Input
                        type="number"
                        value={lineItem.sortOrder ?? index}
                        onChange={(event) => updateLineItem(index, { sortOrder: Number(event.target.value) })}
                        disabled={!isDraft}
                        className="min-w-20"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <select
                        value={lineItem.category ?? 'materials'}
                        onChange={(event) => updateLineItem(index, { category: event.target.value as EditableLineItem['category'] })}
                        disabled={!isDraft}
                        className="h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {categoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-3">
                      <Input
                        value={lineItem.description ?? ''}
                        onChange={(event) => updateLineItem(index, { description: event.target.value })}
                        disabled={!isDraft}
                        placeholder={formatLineItemCategory(t, lineItem.category ?? 'materials')}
                        className="min-w-56"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <Input
                        value={lineItem.unit ?? ''}
                        onChange={(event) => updateLineItem(index, { unit: event.target.value })}
                        disabled={!isDraft}
                        className="min-w-24"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={lineItem.quantity ?? 0}
                        onChange={(event) => updateLineItem(index, { quantity: Number(event.target.value) })}
                        disabled={!isDraft}
                        className="min-w-24"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={lineItem.unitCostAmount ?? 0}
                        onChange={(event) => updateLineItem(index, { unitCostAmount: Number(event.target.value) })}
                        disabled={!isDraft}
                        className="min-w-28"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={lineItem.markupPercent ?? ''}
                        onChange={(event) => updateLineItem(index, { markupPercent: toNullableNumber(event.target.value) })}
                        disabled={!isDraft}
                        className="min-w-24"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <Input
                        value={lineItem.notes ?? ''}
                        onChange={(event) => updateLineItem(index, { notes: event.target.value })}
                        disabled={!isDraft}
                        className="min-w-48"
                      />
                    </td>
                    <td className="px-2 py-3 text-right font-medium">{formatMoney(lineItem.totalCostAmount, estimate.currencyCode)}</td>
                    <td className="px-2 py-3 text-right font-medium">{formatMoney(lineItem.totalSaleAmount, estimate.currencyCode)}</td>
                    <td className="px-2 py-3 text-right">
                      {isDraft ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeLineItem(index)}>
                          {t('common.remove', 'Remove')}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
