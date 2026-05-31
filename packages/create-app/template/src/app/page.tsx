import { modules } from '@/.mercato/generated/modules.app.generated'
import { frontendRoutes } from '@/.mercato/generated/frontend-routes.generated'
import { backendRoutes } from '@/.mercato/generated/backend-routes.generated'
import { apiRoutes } from '@/.mercato/generated/api-routes.generated'
import { StartPageContent } from '@/components/StartPageContent'
import type { Metadata } from 'next'
import { resolveLocalizedAppMetadata } from '@/lib/metadata'
import { cookies } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { User } from '@open-mercato/core/modules/auth/data/entities'
  return (
import { redirect } from 'next/navigation'
    <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs text-muted-foreground">

for (const route of backendRoutes) {
  const entry = routeCountsByModule.get(route.moduleId)
  if (entry) entry.backend += 1
}
export default function Home() {
  redirect('/login')
}
