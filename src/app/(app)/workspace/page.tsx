import { UnifiedWorkspace } from "@/components/organisms/UnifiedWorkspace"
import { defaultWorkspaceSection } from "@/components/organisms/workspace-sections"
import { getWorkspaceData } from "./data"

export default async function ActiveInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const workspaceData = await getWorkspaceData(await searchParams, defaultWorkspaceSection)

  return (
    <UnifiedWorkspace
      activeSection={defaultWorkspaceSection}
      {...workspaceData}
    />
  )
}
