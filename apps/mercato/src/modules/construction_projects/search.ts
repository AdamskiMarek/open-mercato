import type { SearchModuleConfig } from '@open-mercato/shared/modules/search'
import { ENTITY_IDS } from './lib/domain'

function getText(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return ''
}

export const searchConfig: SearchModuleConfig = {
  defaultStrategies: ['fulltext', 'tokens'],
  entities: [
    {
      entityId: ENTITY_IDS.project,
      enabled: true,
      priority: 10,
      fieldPolicy: {
        searchable: ['project_code', 'name', 'project_type', 'site_city', 'site_country_code', 'description', 'status'],
        excluded: [
          'notes',
          'site_address',
          'site_postal_code',
          'site_latitude',
          'site_longitude',
          'estimated_revenue_amount',
          'latest_approved_estimate_id',
          'client_company_id',
          'client_person_id',
          'owner_user_id',
        ],
      },
      formatResult: async (ctx) => ({
        title: [
          getText(ctx.record, 'project_code', 'projectCode'),
          getText(ctx.record, 'name'),
        ].filter(Boolean).join(' · '),
        subtitle: [
          getText(ctx.record, 'status'),
          getText(ctx.record, 'site_city', 'siteCity'),
        ].filter(Boolean).join(' · '),
        icon: 'building',
        badge: 'construction_projects.search.badge',
      }),
    },
  ],
}

export const config = searchConfig
export default searchConfig