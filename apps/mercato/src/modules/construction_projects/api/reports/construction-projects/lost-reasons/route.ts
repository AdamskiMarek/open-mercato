import { NextResponse } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { lostReasonsReportQuerySchema } from '../../../../data/validators'
import { resolveConstructionProjectsRequestContext } from '../../../../lib/requestContext'
import { constructionProjectsTag } from '../../../openapi'
import { csvResponse, handleConstructionProjectsRouteError, pagedResponse, readNullableParam, toCsv } from '../../../helpers'
import { loadLostReasonsReportPage, type LostReasonsReportItem } from '../../../../lib/readModels'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['construction_projects.report.view'] },
}

export const openApi: OpenApiRouteDoc = {
  tag: constructionProjectsTag,
  methods: {
    GET: { summary: 'Lost reasons report for construction projects' },
  },
}

export async function GET(request: Request) {
  try {
    const context = await resolveConstructionProjectsRequestContext(request)
    const url = new URL(request.url)
    const query = lostReasonsReportQuerySchema.parse({
      groupBy: readNullableParam(url.searchParams, 'groupBy'),
      ownerUserId: readNullableParam(url.searchParams, 'ownerUserId'),
      projectType: readNullableParam(url.searchParams, 'projectType'),
      dateFrom: readNullableParam(url.searchParams, 'dateFrom'),
      dateTo: readNullableParam(url.searchParams, 'dateTo'),
      page: readNullableParam(url.searchParams, 'page'),
      pageSize: readNullableParam(url.searchParams, 'pageSize'),
      sortField: readNullableParam(url.searchParams, 'sortField'),
      sortDir: readNullableParam(url.searchParams, 'sortDir'),
      format: readNullableParam(url.searchParams, 'format'),
    })

    const report = await loadLostReasonsReportPage(context.em, {
      tenantId: context.auth.tenantId,
      selectedOrganizationId: context.selectedOrganizationId,
      organizationIds: context.organizationIds,
    }, query)

    if (query.format === 'csv') {
      if (report.items.length > 10000) {
        return NextResponse.json({ error: 'CSV export exceeds the maximum 10 000 row limit' }, { status: 400 })
      }
      return csvResponse(
        'construction-project-loss-reasons.csv',
        toCsv(
          [
            'projectCode',
            'name',
            'status',
            'projectType',
            'ownerUserId',
            'dealId',
            'reasonCode',
            'reasonDetails',
            'competitorName',
            'recordedAt',
          ],
          report.items.map((item: LostReasonsReportItem) => [
            item.projectCode,
            item.name,
            item.status,
            item.projectType,
            item.ownerUserId,
            item.dealId,
            item.reasonCode,
            item.reasonDetails,
            item.competitorName,
            item.recordedAt,
          ]),
        ),
      )
    }

    return NextResponse.json(
      pagedResponse(report.items, report.total, query.page, query.pageSize, { summary: report.summary }),
    )
  } catch (error) {
    return handleConstructionProjectsRouteError(error)
  }
}