export const metadata = {
  requireAuth: true,
  requireFeatures: ['construction_projects.report.view'],
  pageTitle: 'Lost Reasons',
  pageTitleKey: 'construction_projects.page.reports.loss.title',
  pageGroup: 'Construction Projects',
  pageGroupKey: 'construction_projects.nav.group',
  breadcrumb: [
    { label: 'Construction Projects', labelKey: 'construction_projects.page.list.title', href: '/backend/construction-projects' },
    { label: 'Lost Reasons', labelKey: 'construction_projects.page.reports.loss.title' },
  ],
}
