import {
  BookOpen,
  MessageSquare,
  Package,
  Store,
  Tags,
  Target,
  type LucideIcon,
} from "lucide-react"

export type WorkspaceSectionId =
  | "missions"
  | "catalog"
  | "inquiries"
  | "suppliers"
  | "products"
  | "sources"

export const defaultWorkspaceSection: WorkspaceSectionId = "missions"

export const workspaceSectionOrder: WorkspaceSectionId[] = [
  "missions",
  "catalog",
  "inquiries",
  "suppliers",
  "products",
  "sources",
]

export const workspaceSectionMeta: Record<
  WorkspaceSectionId,
  {
    label: string
    caption: string
    icon: LucideIcon
  }
> = {
  missions: {
    label: "Missions",
    caption: "Autonomous sourcing agents.",
    icon: Target,
  },
  catalog: {
    label: "Catalog",
    caption: "Brands and product type registry.",
    icon: Tags,
  },
  inquiries: {
    label: "Inquiries",
    caption: "Active negotiations and follow-ups.",
    icon: MessageSquare,
  },
  suppliers: {
    label: "Suppliers",
    caption: "Contacts, trust notes, and brand coverage.",
    icon: Store,
  },
  products: {
    label: "Products",
    caption: "Upload photos and inspect references.",
    icon: Package,
  },
  sources: {
    label: "Sources",
    caption: "Research links and channel intelligence.",
    icon: BookOpen,
  },
}

export function isWorkspaceSection(
  value: string,
): value is WorkspaceSectionId {
  return workspaceSectionOrder.includes(value as WorkspaceSectionId)
}

export function getWorkspaceSectionHref(section: WorkspaceSectionId) {
  return section === defaultWorkspaceSection
    ? "/workspace"
    : `/workspace/${section}`
}
