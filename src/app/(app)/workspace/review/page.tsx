import { ReviewWorkspace } from "@/components/organisms/ReviewWorkspace"
import { getWorkspaceData } from "../data"

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  const workspaceData = await getWorkspaceData(resolvedSearchParams, "review")

  return (
    <ReviewWorkspace
      missions={workspaceData.missions}
      inquiries={workspaceData.inquiries}
      suppliers={workspaceData.suppliers}
      products={workspaceData.products}
      sources={workspaceData.sources}
    />
  )
}
