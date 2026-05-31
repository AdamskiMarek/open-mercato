"use client"

import type { ReactNode } from 'react'
import { BrandingProvider } from '@open-mercato/shared/lib/branding/context'
import type { Locale } from '@open-mercato/shared/lib/i18n/config'
import type { Dict } from '@open-mercato/shared/lib/i18n/context'
import { I18nProvider } from '@open-mercato/shared/lib/i18n/context'
import { ThemeProvider, FrontendLayout, QueryProvider, AuthFooter } from '@open-mercato/ui'
import { ClientBootstrapProvider } from '@/components/ClientBootstrap'
import { GlobalNoticeBars } from '@/components/GlobalNoticeBars'
import { ComponentOverridesBootstrap } from '@/components/ComponentOverridesBootstrap'

type AppProvidersProps = {
  children: ReactNode
  locale: Locale
  dict: Dict
  demoModeEnabled: boolean
  noticeBarsEnabled: boolean
}

export function AppProviders({ children, locale, dict, demoModeEnabled, noticeBarsEnabled }: AppProvidersProps) {
  return (
    <BrandingProvider
      value={{
        name: 'Open Mercato',
        logoSrc: '/open-mercato.svg',
        logoAlt: 'Open Mercato',
      }}
    >
      <I18nProvider locale={locale} dict={dict}>
        <ClientBootstrapProvider>
          <ComponentOverridesBootstrap>
            <ThemeProvider>
              <QueryProvider>
                <FrontendLayout footer={<AuthFooter />}>{children}</FrontendLayout>
                {noticeBarsEnabled ? <GlobalNoticeBars demoModeEnabled={demoModeEnabled} /> : null}
              </QueryProvider>
            </ThemeProvider>
          </ComponentOverridesBootstrap>
        </ClientBootstrapProvider>
      </I18nProvider>
    </BrandingProvider>
  )
}
