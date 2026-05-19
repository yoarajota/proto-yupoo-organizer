"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import SideNav from "@/components/organisms/SideNav";

const navItems = [
  { href: "/workspace", label: "Desk", icon: LayoutDashboard },
  { href: "/workspace/review", label: "Review", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-border/70 bg-background/95 px-2 backdrop-blur-xl md:hidden"
      aria-label="Bottom navigation"
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isWorkspaceRoute =
          (pathname.startsWith("/workspace") &&
            !pathname.startsWith("/workspace/review")) ||
          pathname.startsWith("/suppliers") ||
          pathname.startsWith("/products") ||
          pathname.startsWith("/sources");
        const isActive = href === "/workspace" ? isWorkspaceRoute : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 transition-all duration-300",
              isActive ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] uppercase font-bold tracking-tighter opacity-80">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({
  children,
  topBar,
}: {
  children: React.ReactNode;
  topBar: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--background)_0%,var(--surface-container-lowest)_100%)] text-foreground">
      {topBar}

      <div className="flex min-h-screen pt-16">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "fixed bottom-0 top-16 left-0 z-20",
            "hidden md:block transition-all duration-500 ease-in-out",
            "md:w-[var(--width-sidebar-collapsed)] lg:w-[var(--width-sidebar)]"
          )}
        >
          <div className="hidden lg:block h-full">
            <SideNav collapsed={false} />
          </div>
          <div className="block lg:hidden h-full">
            <SideNav collapsed={true} />
          </div>
        </aside>

        {/* Main content */}
        <main
          className={cn(
            "flex-1 min-w-0 transition-all duration-500 ease-in-out",
            "md:ml-[var(--width-sidebar-collapsed)] lg:ml-[var(--width-sidebar)]",
            "pb-20 md:pb-12"
          )}
        >
          <div className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom tab bar: mobile only */}
      <BottomTabBar />
    </div>
  );
}
