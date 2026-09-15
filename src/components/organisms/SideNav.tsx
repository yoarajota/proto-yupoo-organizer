"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { href: "/workspace", label: "Workspace", icon: LayoutDashboard },
  { href: "/workspace/review", label: "Review", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ElementType;
  collapsed: boolean;
}

function NavItem({ href, label, icon: Icon, collapsed }: NavItemProps) {
  const pathname = usePathname();
  const isWorkspaceRoute =
    (pathname.startsWith("/workspace") &&
      !pathname.startsWith("/workspace/review")) ||
    pathname.startsWith("/suppliers") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/sources");

  const isActive = href === "/workspace" ? isWorkspaceRoute : pathname.startsWith(href);

  const linkContent = (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3 transition-all duration-300 lg:px-5",
        isActive
          ? "bg-surface-container-low text-foreground"
          : "text-muted-foreground hover:bg-surface-container-lowest hover:text-foreground"
      )}
    >
      <Icon className={cn(
        "h-4 w-4 shrink-0 transition-transform duration-300",
        isActive ? "scale-110" : "group-hover:scale-110"
      )} />
      {!collapsed && (
        <span className={cn(
          "text-xs font-semibold tracking-wide uppercase",
          isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100"
        )}>
          {label}
        </span>
      )}
      {isActive && (
        <span className="absolute left-0 top-2 bottom-2 w-1 bg-primary" />
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" className="rounded-none border-none bg-foreground px-3 py-1.5 text-[10px] uppercase tracking-widest text-background">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

interface SideNavProps {
  collapsed?: boolean;
}

export default function SideNav({ collapsed = false }: SideNavProps) {
  return (
    <nav
      className="flex h-full flex-col gap-5 border-r border-border/70 bg-background/90 px-3 py-5"
      aria-label="Main navigation"
    >
      {!collapsed && (
        <div className="px-2 pb-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Buyer flow
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} collapsed={collapsed} />
        ))}
      </div>
    </nav>
  );
}
