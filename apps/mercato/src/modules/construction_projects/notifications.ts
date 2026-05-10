import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'construction_projects.estimate.approved',
    module: 'construction_projects',
    titleKey: 'construction_projects.notifications.estimateApproved.title',
    bodyKey: 'construction_projects.notifications.estimateApproved.body',
    icon: 'check-circle-2',
    severity: 'success',
    actions: [
      {
        id: 'open',
        labelKey: 'common.open',
        variant: 'outline',
        href: '/backend/construction-projects',
        icon: 'external-link',
      },
      {
        id: 'dismiss',
        labelKey: 'notifications.actions.dismiss',
        variant: 'ghost',
      },
    ],
    primaryActionId: 'open',
    expiresAfterHours: 168,
  },
  {
    type: 'construction_projects.project.lost',
    module: 'construction_projects',
    titleKey: 'construction_projects.notifications.projectLost.title',
    bodyKey: 'construction_projects.notifications.projectLost.body',
    icon: 'triangle-alert',
    severity: 'warning',
    actions: [
      {
        id: 'open',
        labelKey: 'common.open',
        variant: 'outline',
        href: '/backend/construction-projects',
        icon: 'external-link',
      },
      {
        id: 'dismiss',
        labelKey: 'notifications.actions.dismiss',
        variant: 'ghost',
      },
    ],
    primaryActionId: 'open',
    expiresAfterHours: 336,
  },
]

export default notificationTypes