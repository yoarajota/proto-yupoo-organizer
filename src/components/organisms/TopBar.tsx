import Link from "next/link";
import { signOutAndRedirect } from "@/actions/groups";
import { cn } from "@/lib/utils";

interface TopBarProps {
  userEmail?: string;
}

export default function TopBar({ userEmail }: TopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-background/80 backdrop-blur-xl border-b border-border/40 flex items-center px-6">
      <Link href="/" className="font-heading text-xl tracking-tight text-foreground hover:opacity-80 transition-opacity">
        Yupoo <span className="text-editorial">Organizer</span>
      </Link>
      
      <div className="ml-auto flex items-center gap-6">
        {userEmail && (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 hidden sm:block">
            {userEmail}
          </span>
        )}
        <nav className="flex items-center gap-4">
          <Link
            href="/settings"
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Settings
          </Link>
          <form action={signOutAndRedirect}>
            <button
              type="submit"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
