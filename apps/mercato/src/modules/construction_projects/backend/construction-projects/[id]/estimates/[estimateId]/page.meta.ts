export const metadata = {
  requireAuth: true,
  requireFeatures: ['construction_projects.view'],
  pageTitle: 'Estimate',
  pageTitleKey: 'construction_projects.page.estimates.title',
  pageGroup: 'Construction Projects',
  pageGroupKey: 'construction_projects.nav.group',
  breadcrumb: [
    { label: 'Construction Projects', labelKey: 'construction_projects.page.list.title', href: '/backend/construction-projects' },
    { label: 'Estimate', labelKey: 'construction_projects.page.estimates.title' },
  ],
}
