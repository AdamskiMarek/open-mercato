"use client"

import { ConstructionProjectDetail } from '../../../components/ConstructionProjectDetail'

type ConstructionProjectDetailPageProps = {
  params?: {
    id?: string
  }
}

export default function ConstructionProjectDetailPage({ params }: ConstructionProjectDetailPageProps) {
  return <ConstructionProjectDetail projectId={params?.id} />
}
