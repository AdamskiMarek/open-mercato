"use client"

import { ConstructionProjectEstimateEditor } from '../../../../../components/ConstructionProjectEstimateEditor'

type ConstructionProjectEstimateEditorPageProps = {
  params?: {
    id?: string
    estimateId?: string
  }
}

export default function ConstructionProjectEstimateEditorPage({ params }: ConstructionProjectEstimateEditorPageProps) {
  return (
    <ConstructionProjectEstimateEditor
      projectId={params?.id}
      estimateId={params?.estimateId}
    />
  )
}
