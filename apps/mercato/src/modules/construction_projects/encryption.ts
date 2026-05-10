import type { ModuleEncryptionMap } from '@open-mercato/shared/modules/encryption'

export const defaultEncryptionMaps: ModuleEncryptionMap[] = [
  {
    entityId: 'construction_projects:construction_project',
    fields: [
      { field: 'notes' },
      { field: 'site_address' },
      { field: 'site_postal_code' },
      { field: 'site_latitude' },
      { field: 'site_longitude' },
    ],
  },
  {
    entityId: 'construction_projects:cost_estimate',
    fields: [
      { field: 'notes' },
    ],
  },
  {
    entityId: 'construction_projects:construction_project_loss',
    fields: [
      { field: 'reason_details' },
      { field: 'competitor_name' },
    ],
  },
]

export default defaultEncryptionMaps