"use client"

import { ConstructionProjectForm } from '../../../../components/ConstructionProjectForm'

type EditConstructionProjectPageProps = {
  params?: {
    id?: string
  }
}

export default function EditConstructionProjectPage({ params }: EditConstructionProjectPageProps) {
  return <ConstructionProjectForm mode="edit" projectId={params?.id} />
}
