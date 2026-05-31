import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { resolveLocalizedAppMetadata } from '@/lib/metadata'

export async function generateMetadata(): Promise<Metadata> {
  return resolveLocalizedAppMetadata()
}

export default function Home() {
  redirect('/login')
}
