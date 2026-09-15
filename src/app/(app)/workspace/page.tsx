import { UnifiedWorkspace } from "@/components/organisms/UnifiedWorkspace"
import { defaultWorkspaceSection } from "@/components/organisms/workspace-sections"
import { getWorkspaceData } from "./data"

export default async function ActiveInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  const workspaceData = await getWorkspaceData(resolvedSearchParams, defaultWorkspaceSection)

  return (
    <UnifiedWorkspace
      activeSection={defaultWorkspaceSection}
      {...workspaceData}
    />
  )
}
