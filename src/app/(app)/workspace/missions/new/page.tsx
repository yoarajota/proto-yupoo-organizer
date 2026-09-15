import { MissionCreationWorkspace } from "@/components/organisms/MissionCreationWorkspace"
import { getWorkspaceData } from "../../data"

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  const workspaceData = await getWorkspaceData(resolvedSearchParams, "missionCreate")

  return (
    <MissionCreationWorkspace
      brands={workspaceData.brands}
      productTypes={workspaceData.productTypes}
      sources={workspaceData.sources}
    />
  )
}
