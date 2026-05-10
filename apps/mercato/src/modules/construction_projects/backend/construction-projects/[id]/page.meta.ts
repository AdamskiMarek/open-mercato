export const metadata = {
  requireAuth: true,
  requireFeatures: ['construction_projects.view'],
  pageTitle: 'Construction Project',
  pageTitleKey: 'construction_projects.page.detail.title',
  pageGroup: 'Construction Projects',
  pageGroupKey: 'construction_projects.nav.group',
  breadcrumb: [
    { label: 'Construction Projects', labelKey: 'construction_projects.page.list.title', href: '/backend/construction-projects' },
    { label: 'Construction Project', labelKey: 'construction_projects.page.detail.title' },
  ],
}
