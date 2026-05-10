export const metadata = {
  requireAuth: true,
  requireFeatures: ['construction_projects.update'],
  pageTitle: 'Edit Construction Project',
  pageTitleKey: 'construction_projects.page.edit.title',
  pageGroup: 'Construction Projects',
  pageGroupKey: 'construction_projects.nav.group',
  breadcrumb: [
    { label: 'Construction Projects', labelKey: 'construction_projects.page.list.title', href: '/backend/construction-projects' },
    { label: 'Edit', labelKey: 'common.edit' },
  ],
}
