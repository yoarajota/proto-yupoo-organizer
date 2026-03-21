"use client"

import { useTransition, useState } from "react"
import { deactivateUser, reactivateUser, inviteUser } from "@/actions/users"
import type { Profile } from "@/actions/users"

interface UserListProps {
  users: Profile[]
  isAdmin: boolean
  currentUserId: string
}

export default function UserList({ users, isAdmin, currentUserId }: UserListProps) {
  const [pending, startTransition] = useTransition()
  const [actionUserId, setActionUserId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteMessage, setInviteMessage] = useState<{ text: string; isError: boolean } | null>(
    null,
  )

  function handleDeactivate(userId: string) {
    setActionUserId(userId)
    startTransition(async () => {
      await deactivateUser(userId)
      setActionUserId(null)
    })
  }

  function handleReactivate(userId: string) {
    setActionUserId(userId)
    startTransition(async () => {
      await reactivateUser(userId)
      setActionUserId(null)
    })
  }

  function handleInvite() {
    if (!inviteEmail.trim()) {
      setInviteMessage({ text: "Email is required.", isError: true })
      return
    }
    startTransition(async () => {
      const result = await inviteUser({ email: inviteEmail })
      if (result.error) {
        setInviteMessage({ text: result.error.message, isError: true })
      } else {
        setInviteMessage({ text: `Invitation sent to ${result.data?.email}.`, isError: false })
        setInviteEmail("")
      }
    })
  }

  return (
    <div>
      {isAdmin && (
        <div className="mb-6 flex gap-2 items-start flex-wrap">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="user@example.com"
            className="border border-border rounded px-3 py-1.5 text-body-sm bg-surface-container-low text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleInvite}
            disabled={pending}
            className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-label-sm font-medium disabled:opacity-50"
          >
            Invite
          </button>
          {inviteMessage && (
            <p
              className={`w-full text-label-xs mt-1 ${inviteMessage.isError ? "text-destructive" : "text-success"}`}
            >
              {inviteMessage.text}
            </p>
          )}
        </div>
      )}

      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
        {users.map((user) => {
          const isOwnRow = user.id === currentUserId
          const isActing = pending && actionUserId === user.id

          return (
            <div
              key={user.id}
              className="flex items-center justify-between px-4 py-3 bg-surface-container-low"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-body-sm text-foreground truncate">
                  {user.email ?? user.id}
                </span>
                <span
                  className={`text-label-xs px-1.5 py-0.5 rounded font-medium ${
                    user.role === "admin"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {user.role}
                </span>
                {!user.is_active && (
                  <span className="text-label-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
                    inactive
                  </span>
                )}
              </div>

              {isAdmin && !isOwnRow && (
                <div>
                  {user.is_active ? (
                    <button
                      onClick={() => handleDeactivate(user.id)}
                      disabled={isActing}
                      className="text-label-xs text-destructive hover:underline disabled:opacity-50"
                    >
                      {isActing ? "Deactivating…" : "Deactivate"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivate(user.id)}
                      disabled={isActing}
                      className="text-label-xs text-primary hover:underline disabled:opacity-50"
                    >
                      {isActing ? "Reactivating…" : "Reactivate"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
