"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { CONSTRUCTION_PROJECTS_API_BASE } from '../lib/apiPaths'
import type { ProjectDetailPayload } from './ui'
import { toNullableNumber, toNullableString } from './ui'

type ConstructionProjectFormProps = {
  mode: 'create' | 'edit'
  projectId?: string
}

type ProjectFormValues = {
  projectCode: string
  name: string
  projectType: string | null
  description: string | null
  notes: string | null
  siteAddress: string | null
  siteCity: string | null
  sitePostalCode: string | null
  siteCountryCode: string | null
  siteLatitude: number | null
  siteLongitude: number | null
  clientCompanyId: string | null
  clientPersonId: string | null
  ownerUserId: string | null
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  estimatedRevenueAmount: number | null
}

function createInitialValues(project?: ProjectDetailPayload | null): ProjectFormValues {
  return {
    projectCode: project?.projectCode ?? '',
    name: project?.name ?? '',
    projectType: project?.projectType ?? null,
    description: project?.description ?? null,
    notes: project?.notes ?? null,
    siteAddress: project?.siteAddress ?? null,
    siteCity: project?.siteCity ?? null,
    sitePostalCode: project?.sitePostalCode ?? null,
    siteCountryCode: project?.siteCountryCode ?? null,
    siteLatitude: project?.siteLatitude ?? null,
    siteLongitude: project?.siteLongitude ?? null,
    clientCompanyId: project?.clientCompanyId ?? null,
    clientPersonId: project?.clientPersonId ?? null,
    ownerUserId: project?.ownerUserId ?? null,
    plannedStartDate: project?.plannedStartDate ?? null,
    plannedEndDate: project?.plannedEndDate ?? null,
    actualStartDate: project?.actualStartDate ?? null,
    actualEndDate: project?.actualEndDate ?? null,
    estimatedRevenueAmount: project?.estimatedRevenueAmount ?? null,
  }
}

export function ConstructionProjectForm({ mode, projectId }: ConstructionProjectFormProps) {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const [loading, setLoading] = React.useState(mode === 'edit')
  const [error, setError] = React.useState<string | null>(null)
  const [initialValues, setInitialValues] = React.useState<ProjectFormValues>(() => createInitialValues())

  React.useEffect(() => {
    if (mode !== 'edit' || !projectId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    void readApiResultOrThrow<ProjectDetailPayload>(`${CONSTRUCTION_PROJECTS_API_BASE}/${projectId}`, undefined, {
      errorMessage: t('construction_projects.form.errors.load', 'Failed to load construction project.'),
    })
      .then((project) => {
        if (cancelled || !project) return
        setInitialValues(createInitialValues(project))
      })
      .catch((loadError) => {
        if (cancelled) return
        const message = loadError instanceof Error
          ? loadError.message
          : t('construction_projects.form.errors.load', 'Failed to load construction project.')
        setError(message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [mode, projectId, t])

  const groups = React.useMemo<CrudFormGroup[]>(() => ([
    {
      id: 'overview',
      column: 1,
      title: t('construction_projects.form.group.overview', 'Overview'),
      fields: [
        {
          id: 'projectCode',
          type: 'text',
          label: t('construction_projects.form.field.projectCode', 'Project code'),
          required: true,
          maxLength: 64,
        },
        {
          id: 'name',
          type: 'text',
          label: t('construction_projects.form.field.name', 'Project name'),
          required: true,
          maxLength: 200,
        },
        {
          id: 'projectType',
          type: 'text',
          label: t('construction_projects.form.field.projectType', 'Project type'),
          maxLength: 100,
        },
        {
          id: 'description',
          type: 'textarea',
          label: t('construction_projects.form.field.description', 'Description'),
        },
        {
          id: 'notes',
          type: 'textarea',
          label: t('construction_projects.form.field.notes', 'Internal notes'),
        },
      ],
    },
    {
      id: 'relationships',
      column: 2,
      title: t('construction_projects.form.group.relationships', 'Relationships'),
      fields: [
        {
          id: 'clientCompanyId',
          type: 'text',
          label: t('construction_projects.form.field.clientCompanyId', 'Client company ID'),
          description: t('construction_projects.form.field.uuidHint', 'Use a related record UUID when available.'),
        },
        {
          id: 'clientPersonId',
          type: 'text',
          label: t('construction_projects.form.field.clientPersonId', 'Client person ID'),
        },
        {
          id: 'ownerUserId',
          type: 'text',
          label: t('construction_projects.form.field.ownerUserId', 'Owner user ID'),
        },
        {
          id: 'estimatedRevenueAmount',
          type: 'number',
          label: t('construction_projects.form.field.estimatedRevenueAmount', 'Estimated revenue'),
          min: 0,
          step: 0.01,
        },
      ],
    },
    {
      id: 'timeline',
      column: 1,
      title: t('construction_projects.form.group.timeline', 'Timeline'),
      fields: [
        {
          id: 'plannedStartDate',
          type: 'date',
          label: t('construction_projects.form.field.plannedStartDate', 'Planned start'),
        },
        {
          id: 'plannedEndDate',
          type: 'date',
          label: t('construction_projects.form.field.plannedEndDate', 'Planned end'),
        },
        {
          id: 'actualStartDate',
          type: 'date',
          label: t('construction_projects.form.field.actualStartDate', 'Actual start'),
        },
        {
          id: 'actualEndDate',
          type: 'date',
          label: t('construction_projects.form.field.actualEndDate', 'Actual end'),
        },
      ],
    },
    {
      id: 'site',
      column: 2,
      title: t('construction_projects.form.group.site', 'Site'),
      fields: [
        {
          id: 'siteAddress',
          type: 'text',
          label: t('construction_projects.form.field.siteAddress', 'Address'),
        },
        {
          id: 'siteCity',
          type: 'text',
          label: t('construction_projects.form.field.siteCity', 'City'),
        },
        {
          id: 'sitePostalCode',
          type: 'text',
          label: t('construction_projects.form.field.sitePostalCode', 'Postal code'),
        },
        {
          id: 'siteCountryCode',
          type: 'text',
          label: t('construction_projects.form.field.siteCountryCode', 'Country code'),
          maxLength: 2,
        },
        {
          id: 'siteLatitude',
          type: 'number',
          label: t('construction_projects.form.field.siteLatitude', 'Latitude'),
          min: -90,
          max: 90,
          step: 0.0001,
        },
        {
          id: 'siteLongitude',
          type: 'number',
          label: t('construction_projects.form.field.siteLongitude', 'Longitude'),
          min: -180,
          max: 180,
          step: 0.0001,
        },
      ],
    },
  ]), [t])

  if (loading) {
    return <LoadingMessage label={t('construction_projects.form.loading', 'Loading construction project...')} />
  }

  if (error) {
    return <ErrorMessage label={error} />
  }

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={mode === 'create'
            ? t('construction_projects.page.create.title', 'Create Construction Project')
            : t('construction_projects.page.edit.title', 'Edit Construction Project')}
          backHref={mode === 'create' ? '/backend/construction-projects' : `/backend/construction-projects/${projectId}`}
          cancelHref={mode === 'create' ? '/backend/construction-projects' : `/backend/construction-projects/${projectId}`}
          submitLabel={mode === 'create'
            ? t('common.create', 'Create')
            : t('common.save', 'Save')}
          fields={[]}
          groups={groups}
          initialValues={initialValues}
          onSubmit={async (values) => {
            const siteCountryCode = toNullableString(values.siteCountryCode)?.toUpperCase() ?? null
            if (siteCountryCode && siteCountryCode.length !== 2) {
              throw createCrudFormError(
                t('construction_projects.form.errors.countryCode', 'Country code must contain 2 letters.'),
                { siteCountryCode: t('construction_projects.form.errors.countryCode', 'Country code must contain 2 letters.') },
              )
            }

            const payload = {
              projectCode: String(values.projectCode ?? '').trim(),
              name: String(values.name ?? '').trim(),
              projectType: toNullableString(values.projectType),
              description: toNullableString(values.description),
              notes: toNullableString(values.notes),
              siteAddress: toNullableString(values.siteAddress),
              siteCity: toNullableString(values.siteCity),
              sitePostalCode: toNullableString(values.sitePostalCode),
              siteCountryCode,
              siteLatitude: toNullableNumber(values.siteLatitude),
              siteLongitude: toNullableNumber(values.siteLongitude),
              clientCompanyId: toNullableString(values.clientCompanyId),
              clientPersonId: toNullableString(values.clientPersonId),
              ownerUserId: toNullableString(values.ownerUserId),
              plannedStartDate: toNullableString(values.plannedStartDate),
              plannedEndDate: toNullableString(values.plannedEndDate),
              actualStartDate: toNullableString(values.actualStartDate),
              actualEndDate: toNullableString(values.actualEndDate),
              estimatedRevenueAmount: toNullableNumber(values.estimatedRevenueAmount),
            }

            if (mode === 'create') {
              if (!organizationId || !tenantId) {
                throw createCrudFormError(
                  t('construction_projects.form.errors.scope', 'Organization context is required.'),
                )
              }
              const created = await createCrud<{ id: string }>('construction_projects/construction-projects', {
                ...payload,
                organizationId,
                tenantId,
              }, {
                errorMessage: t('construction_projects.form.errors.create', 'Failed to create construction project.'),
              })
              flash(t('construction_projects.flash.created', 'Construction project created.'), 'success')
              router.push(created.result?.id
                ? `/backend/construction-projects/${created.result.id}`
                : '/backend/construction-projects')
              return
            }

            await apiCallOrThrow(`${CONSTRUCTION_PROJECTS_API_BASE}/${projectId}`, {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            }, {
              errorMessage: t('construction_projects.form.errors.update', 'Failed to update construction project.'),
            })
            flash(t('construction_projects.flash.updated', 'Construction project updated.'), 'success')
            router.push(`/backend/construction-projects/${projectId}`)
          }}
        />
      </PageBody>
    </Page>
  )
}
