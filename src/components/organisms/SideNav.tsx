"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Store, Package, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { href: "/active-inquiries", label: "Inquiries", icon: MessageSquare },
  { href: "/suppliers", label: "Suppliers", icon: Store },
  { href: "/products", label: "Products", icon: Package },
  { href: "/sources", label: "Sources", icon: BookOpen },
];

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ElementType;
  collapsed: boolean;
}

function NavItem({ href, label, icon: Icon, collapsed }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  const linkContent = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-sm transition-colors",
        isActive
          ? "border-l-4 border-primary font-semibold text-foreground"
          : "border-l-4 border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={linkContent} />
        <TooltipContent side="right">{label}</TooltipContent>
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
      className="flex flex-col gap-1 py-4 bg-surface-container-low h-full"
      aria-label="Main navigation"
    >
      {navItems.map((item) => (
        <NavItem key={item.href} {...item} collapsed={collapsed} />
      ))}
    </nav>
  );
}
