import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'construction_projects.project.created', label: 'Construction Project Created', entity: 'project', category: 'crud' },
  { id: 'construction_projects.project.updated', label: 'Construction Project Updated', entity: 'project', category: 'crud' },
  { id: 'construction_projects.project.archived', label: 'Construction Project Archived', entity: 'project', category: 'crud' },
  { id: 'construction_projects.project.status_changed', label: 'Construction Project Status Changed', entity: 'project', category: 'custom' },
  { id: 'construction_projects.project.deal_linked', label: 'Construction Project Deal Linked', entity: 'project', category: 'custom' },
  { id: 'construction_projects.project.deal_unlinked', label: 'Construction Project Deal Unlinked', entity: 'project', category: 'custom' },
  { id: 'construction_projects.project.lost_recorded', label: 'Construction Project Loss Recorded', entity: 'project', category: 'custom' },
  { id: 'construction_projects.estimate.created', label: 'Cost Estimate Created', entity: 'estimate', category: 'crud' },
  { id: 'construction_projects.estimate.draft_saved', label: 'Cost Estimate Draft Saved', entity: 'estimate', category: 'custom' },
  { id: 'construction_projects.estimate.approved', label: 'Cost Estimate Approved', entity: 'estimate', category: 'custom' },
  { id: 'construction_projects.estimate.archived', label: 'Cost Estimate Archived', entity: 'estimate', category: 'crud' },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'construction_projects',
  events,
})

export const emitConstructionProjectsEvent = eventsConfig.emit

export type ConstructionProjectsEventId = (typeof events)[number]['id']

export default eventsConfig