import AppShell from "@/components/templates/AppShell"
import TopBar from "@/components/organisms/TopBar"
import { ensureProfile, getCurrentProfile } from "@/actions/users"
import { isUiPreviewMode, previewProfile } from "@/lib/preview"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (isUiPreviewMode()) {
    return (
      <AppShell topBar={<TopBar userEmail={previewProfile.email} />}>
        {children}
      </AppShell>
    )
  }

  await ensureProfile()
  const profileResult = await getCurrentProfile()
  const userEmail = profileResult.data?.email

  return (
    <AppShell topBar={<TopBar userEmail={userEmail} />}>{children}</AppShell>
  )
}
