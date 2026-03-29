import { cn } from "@/lib/utils";
import { MessageCircle, Share2, Phone, Globe } from "lucide-react";
import type { SourcePlatform } from "@/lib/schemas/source";

interface PlatformBadgeProps {
  platform: SourcePlatform;
  className?: string;
}

const platformIcons: Record<SourcePlatform, React.ReactNode> = {
  reddit: <Share2 size={12} className="shrink-0" />,
  discord: <MessageCircle size={12} className="shrink-0" />,
  whatsapp: <Phone size={12} className="shrink-0" />,
  other: <Globe size={12} className="shrink-0" />,
};

const platformColors: Record<SourcePlatform, string> = {
  reddit: "bg-surface-container-high text-[#FF4500]",
  discord: "bg-surface-container-high text-[#5865F2]",
  whatsapp: "bg-surface-container-high text-[#25D366]",
  other: "bg-surface-container-high text-muted-foreground",
};

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-label-xs font-semibold uppercase tracking-wider",
        platformColors[platform],
        className
      )}
    >
      {platformIcons[platform]}
      {platform}
    </span>
  );
}
