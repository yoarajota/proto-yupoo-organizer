import { notFound } from "next/navigation"
import { UnifiedWorkspace } from "@/components/organisms/UnifiedWorkspace"
import {
  isWorkspaceSection,
  type WorkspaceSectionId,
} from "@/components/organisms/workspace-sections"
import { getWorkspaceData } from "../data"

export default async function WorkspaceSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { section } = await params

  if (!isWorkspaceSection(section)) {
    notFound()
  }

  const resolvedSearchParams = await searchParams
  const workspaceData = await getWorkspaceData(resolvedSearchParams, section as WorkspaceSectionId)

  return (
    <UnifiedWorkspace
      activeSection={section as WorkspaceSectionId}
      {...workspaceData}
    />
  )
}
