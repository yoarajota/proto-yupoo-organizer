"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { href: "/workspace", label: "Workspace", icon: LayoutGrid },
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
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/suppliers") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/sources");

  const isActive = href === "/workspace" ? isWorkspaceRoute : pathname.startsWith(href);

  const linkContent = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-6 py-3 transition-all duration-300 group relative",
        isActive
          ? "text-foreground"
          : "text-muted-foreground/60 hover:text-foreground"
      )}
    >
      <Icon className={cn(
        "h-4 w-4 shrink-0 transition-transform duration-300",
        isActive ? "scale-110" : "group-hover:scale-110"
      )} />
      {!collapsed && (
        <span className={cn(
          "text-xs font-medium tracking-wide uppercase",
          isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100"
        )}>
          {label}
        </span>
      )}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-full shadow-[0_0_8px_var(--primary)]" />
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" className="bg-foreground text-background border-none rounded-none text-[10px] uppercase tracking-widest px-3 py-1.5">
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
      className="flex flex-col gap-2 py-8 bg-background h-full border-r border-border/40"
      aria-label="Main navigation"
    >
      <div className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} collapsed={collapsed} />
        ))}
      </div>
    </nav>
  );
}
