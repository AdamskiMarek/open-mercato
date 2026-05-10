import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['construction_projects.*'],
    admin: ['construction_projects.*'],
    employee: [
      'construction_projects.view',
      'construction_projects.create',
      'construction_projects.update',
      'construction_projects.deal.link',
      'construction_projects.estimate.manage',
    ],
  },

  async onTenantCreated({ em, tenantId, organizationId }) {
    const rows = await em.getConnection().execute(
      `
        select code
        from currencies
        where is_base = true
          and is_active = true
          and tenant_id = ?
          and organization_id = ?
        limit 1
      `,
      [tenantId, organizationId],
    )
    const row = Array.isArray(rows) ? (rows[0] as { code?: string | null } | undefined) : undefined

    if (!row?.code) {
      console.warn('[construction_projects.setup] No active base currency configured for tenant scope', {
        tenantId,
        organizationId,
      })
    }
  },
}

export default setup