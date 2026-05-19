import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { signOutAndRedirect } from "@/actions/groups";

interface TopBarProps {
  userEmail?: string;
}

export default function TopBar({ userEmail }: TopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex h-16 items-center border-b border-border/70 bg-background/95 px-4 backdrop-blur-xl sm:px-6">
      <Link
        href="/workspace"
        className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-80"
      >
        <span className="grid h-9 w-9 place-items-center border border-foreground bg-foreground text-[11px] font-bold uppercase tracking-tight text-background">
          YA
        </span>
        <span className="hidden leading-none sm:block">
          <span className="block font-heading text-sm uppercase tracking-[0.18em]">
            Market Atelier
          </span>
          <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Yupoo sourcing console
          </span>
        </span>
      </Link>

      <div className="ml-5 hidden h-9 min-w-[260px] max-w-md flex-1 items-center gap-2 border border-border/80 bg-surface-container-low px-3 text-muted-foreground md:flex">
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">Search missions, suppliers, products</span>
      </div>

      <div className="ml-auto flex items-center gap-3 sm:gap-5">
        <button
          type="button"
          className="hidden h-9 w-9 place-items-center border border-border/80 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground sm:grid"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
        {userEmail && (
          <span className="hidden max-w-[220px] truncate text-[10px] uppercase tracking-widest text-muted-foreground lg:block">
            {userEmail}
          </span>
        )}
        <nav className="flex items-center gap-4">
          <form action={signOutAndRedirect}>
            <button
              type="submit"
              className="border border-border/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
