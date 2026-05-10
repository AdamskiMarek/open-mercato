import { NextResponse } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { marginReportQuerySchema } from '../../../../data/validators'
import { resolveConstructionProjectsRequestContext } from '../../../../lib/requestContext'
import { constructionProjectsTag } from '../../../openapi'
import { csvResponse, handleConstructionProjectsRouteError, pagedResponse, readNullableParam, readStringArrayParam, toCsv } from '../../../helpers'
import { loadMarginReportPage, type MarginReportItem } from '../../../../lib/readModels'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['construction_projects.report.view'] },
}

export const openApi: OpenApiRouteDoc = {
  tag: constructionProjectsTag,
  methods: {
    GET: { summary: 'Margin report for construction projects' },
  },
}

export async function GET(request: Request) {
  try {
    const context = await resolveConstructionProjectsRequestContext(request)
    const url = new URL(request.url)
    const query = marginReportQuerySchema.parse({
      status: readStringArrayParam(url.searchParams, 'status'),
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

    const report = await loadMarginReportPage(context.em, {
      tenantId: context.auth.tenantId,
      selectedOrganizationId: context.selectedOrganizationId,
      organizationIds: context.organizationIds,
    }, query)

    if (query.format === 'csv') {
      if (report.items.length > 10000) {
        return NextResponse.json({ error: 'CSV export exceeds the maximum 10 000 row limit' }, { status: 400 })
      }
      return csvResponse(
        'construction-project-margins.csv',
        toCsv(
          [
            'projectCode',
            'name',
            'status',
            'projectType',
            'ownerUserId',
            'estimateVersionNo',
            'currencyCode',
            'totalCostAmount',
            'totalSaleAmount',
            'marginAmount',
            'marginPercent',
            'approvedAt',
          ],
          report.items.map((item: MarginReportItem) => [
            item.projectCode,
            item.name,
            item.status,
            item.projectType,
            item.ownerUserId,
            item.estimateVersionNo,
            item.currencyCode,
            item.totalCostAmount,
            item.totalSaleAmount,
            item.marginAmount,
            item.marginPercent,
            item.approvedAt,
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