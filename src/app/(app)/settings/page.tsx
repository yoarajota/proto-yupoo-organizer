import { getUsers, getCurrentProfile } from "@/actions/users"
import UserList from "@/components/organisms/UserList"
import { isUiPreviewMode, previewProfile } from "@/lib/preview"

export default async function SettingsPage() {
  if (isUiPreviewMode()) {
    return (
      <div className="space-y-6">
        <header className="border-b border-border/70 pb-6">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Atelier controls
          </p>
          <h1 className="mt-2 text-2xl font-heading text-foreground">Settings</h1>
        </header>
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Users
          </h2>
          <UserList
            users={[
              previewProfile,
              {
                ...previewProfile,
                id: "00000000-0000-4000-8000-000000000002",
                email: "buyer.ops@yupoo.local",
                role: "member",
              },
              {
                ...previewProfile,
                id: "00000000-0000-4000-8000-000000000003",
                email: "research@yupoo.local",
                role: "member",
                is_active: false,
              },
            ]}
            isAdmin={true}
            currentUserId={previewProfile.id}
          />
        </section>
      </div>
    )
  }

  const [usersResult, profileResult] = await Promise.all([
    getUsers(),
    getCurrentProfile(),
  ])

  const users = usersResult.data ?? []
  const currentProfile = profileResult.data
  const isAdmin = currentProfile?.role === "admin"
  const currentUserId = currentProfile?.id ?? ""

  return (
    <div className="py-8">
      <h1 className="text-body-md font-semibold text-foreground mb-6">Settings</h1>
      <section>
        <h2 className="text-label-sm font-medium text-muted-foreground mb-4">Users</h2>
        <UserList users={users} isAdmin={isAdmin} currentUserId={currentUserId} />
      </section>
    </div>
  )
}
