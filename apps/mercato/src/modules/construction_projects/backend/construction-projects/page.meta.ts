import React from 'react'

const constructionProjectsIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M3 21h18' }),
  React.createElement('path', { d: 'M5 21V8l7-5 7 5v13' }),
  React.createElement('path', { d: 'M9 21v-6h6v6' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['construction_projects.view'],
  pageTitle: 'Construction Projects',
  pageTitleKey: 'construction_projects.page.list.title',
  pageGroup: 'Construction Projects',
  pageGroupKey: 'construction_projects.nav.group',
  pageOrder: 360,
  icon: constructionProjectsIcon,
  breadcrumb: [
    { label: 'Construction Projects', labelKey: 'construction_projects.page.list.title', href: '/backend/construction-projects' },
  ],
}
