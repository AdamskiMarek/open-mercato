import './commands/index'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'construction_projects',
  title: 'Construction Projects',
  version: '0.1.0',
  description: 'Project-centric construction bidding, estimating, and margin tracking workflows.',
  author: 'Open Mercato Team',
  license: 'Proprietary',
  requires: ['currencies'],
}

export default metadata