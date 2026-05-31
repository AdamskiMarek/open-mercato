'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type AppBranding = {
  name: string
  logoSrc: string
  logoAlt: string
}

export const DEFAULT_APP_BRANDING: AppBranding = {
  name: 'Open Mercato',
  logoSrc: '/open-mercato.svg',
  logoAlt: 'Open Mercato logo',
}

const BrandingContext = createContext<AppBranding>(DEFAULT_APP_BRANDING)

type BrandingProviderProps = {
  value: AppBranding
  children: ReactNode
}

export function BrandingProvider({ value, children }: BrandingProviderProps) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useAppBranding() {
  return useContext(BrandingContext)
}