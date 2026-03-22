import Link from "next/link"
import { signOutAndRedirect } from "@/actions/groups"

interface TopBarProps {
  userEmail?: string
}

export default function TopBar({ userEmail }: TopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-20 h-14 bg-white/80 backdrop-blur-md border-b border-border flex items-center px-4">
      <span className="font-semibold text-foreground">Yupoo Organizer</span>
      <div className="ml-auto flex items-center gap-3">
        {userEmail && (
          <span className="text-label-sm text-muted-foreground hidden sm:block">{userEmail}</span>
        )}
        <Link
          href="/settings"
          className="text-label-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Settings
        </Link>
        <form action={signOutAndRedirect}>
          <button
            type="submit"
            className="text-label-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
