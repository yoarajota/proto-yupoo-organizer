"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Store, Package, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import TopBar from "@/components/organisms/TopBar";
import SideNav from "@/components/organisms/SideNav";

const navItems = [
  { href: "/active-inquiries", label: "Inquiries", icon: MessageSquare },
  { href: "/suppliers", label: "Suppliers", icon: Store },
  { href: "/products", label: "Products", icon: Package },
  { href: "/sources", label: "Sources", icon: BookOpen },
];

function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-background/80 backdrop-blur-xl border-t border-border/40 flex md:hidden px-2 pb-safe"
      aria-label="Bottom navigation"
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 transition-all duration-300",
              isActive ? "text-primary scale-110" : "text-muted-foreground/60"
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
  topBar?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      {topBar ?? <TopBar />}

      <div className="flex flex-1 pt-14">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "fixed bottom-0 top-14 left-0 z-20",
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
          <div className="max-w-6xl mx-auto px-6 lg:px-12 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom tab bar: mobile only */}
      <BottomTabBar />
    </div>
  );
}
