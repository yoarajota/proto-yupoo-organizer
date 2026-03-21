import { getUsers, getCurrentProfile } from "@/actions/users"
import UserList from "@/components/organisms/UserList"

export default async function SettingsPage() {
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
