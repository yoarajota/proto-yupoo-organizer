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
      className="fixed bottom-0 left-0 right-0 z-20 h-14 bg-white border-t border-border flex md:hidden"
      aria-label="Bottom navigation"
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
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
  children: React.ReactNode
  topBar?: React.ReactNode
}) {
  return (
    <>
      {topBar ?? <TopBar />}

      {/* Desktop sidebar: ≥1024px full, 768–1023px collapsed */}
      <aside
        className={cn(
          "fixed top-14 bottom-0 z-10",
          "hidden md:block",
          "md:w-sidebar-collapsed lg:w-sidebar"
        )}
      >
        {/* collapsed prop driven by viewport via CSS — SideNav renders full,
            but the sidebar width controls visibility; collapsed icon-only on md */}
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
          "pt-14",
          "md:pl-sidebar-collapsed lg:pl-sidebar",
          "pb-14 md:pb-0"
        )}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6">{children}</div>
      </main>

      {/* Bottom tab bar: mobile only */}
      <BottomTabBar />
    </>
  );
}
