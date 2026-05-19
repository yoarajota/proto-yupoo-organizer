"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  MessageSquare,
  PackageCheck,
  ShieldQuestion,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ProductForCard } from "@/app/(app)/workspace/data";
import type { InquiryWithSupplier } from "@/components/organisms/InquiryRow";
import type { MissionRowType } from "@/components/organisms/MissionsTable";
import type { SourceWithProfile } from "@/components/organisms/SourceRow";
import type { SupplierWithStats } from "@/components/organisms/SupplierDirectory";
import { cn } from "@/lib/utils";

type ReviewWorkspaceProps = {
  missions: MissionRowType[];
  inquiries: InquiryWithSupplier[];
  suppliers: SupplierWithStats[];
  products: ProductForCard[];
  sources: SourceWithProfile[];
};

type ReviewItem = {
  id: string;
  title: string;
  description: string;
  type: "verify supplier" | "classify product" | "approve inquiry" | "inspect scrape issue";
  priority: "high" | "medium" | "low";
  href: string;
};

const reviewIcons: Record<ReviewItem["type"], React.ElementType> = {
  "verify supplier": ShieldQuestion,
  "classify product": PackageCheck,
  "approve inquiry": MessageSquare,
  "inspect scrape issue": Wrench,
};

export function ReviewWorkspace({
  missions,
  inquiries,
  suppliers,
  products,
  sources,
}: ReviewWorkspaceProps) {
  const items = buildReviewItems({ missions, inquiries, suppliers, products, sources });
  const highPriorityCount = items.filter((item) => item.priority === "high").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/workspace"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Workspace
          </Link>
          <h1 className="mt-3 text-2xl font-heading text-foreground sm:text-3xl">
            Review queue
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Human decisions across missions, sources, suppliers, products, and inquiries.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <ReviewMetric label="Open" value={items.length} />
          <ReviewMetric label="High" value={highPriorityCount} />
          <ReviewMetric label="Sources" value={sources.length} />
        </div>
      </div>

      <QueueView items={items} />
    </div>
  );
}

function QueueView({ items }: { items: ReviewItem[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-3">
        {items.map((item, index) => (
          <ReviewDecisionRow key={item.id} item={item} index={index} />
        ))}
      </section>
      <aside className="space-y-4">
        <section className="border border-border/70 bg-surface-container-low p-4">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Queue rule
          </p>
          <h2 className="mt-2 text-lg font-heading text-foreground">
            Resolve blockers before expansion
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Failed scrapes, flagged suppliers, and priced inquiries stay above catalog cleanup so sourcing momentum is not hidden in section tabs.
          </p>
        </section>
        <section className="border border-border/70 bg-background p-4">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Empty state target
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            When the queue is clear, route buyers back to missions with a short list of sources worth refreshing.
          </p>
        </section>
      </aside>
    </div>
  );
}

function ReviewDecisionRow({ item, index }: { item: ReviewItem; index: number }) {
  const Icon = reviewIcons[item.type];

  return (
    <article className="grid gap-4 border border-border/70 bg-background p-4 lg:grid-cols-[80px_minmax(0,1fr)_180px] lg:items-center">
      <div className="flex items-center gap-3 lg:block">
        <p className="text-2xl font-heading text-foreground">{index + 1}</p>
        <Badge className={cn("rounded-none lg:mt-2", priorityClass(item.priority))}>
          {item.priority}
        </Badge>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {item.type}
          </p>
        </div>
        <h2 className="mt-2 text-base font-heading text-foreground">{item.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
      </div>
      <Link
        href={item.href}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-9 rounded-none text-[10px] uppercase tracking-widest",
        )}
      >
        Open
        <ExternalLink className="ml-2 h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

function ReviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border/70 bg-background p-3">
      <p className="text-lg font-heading leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function buildReviewItems({
  missions,
  inquiries,
  suppliers,
  products,
  sources,
}: ReviewWorkspaceProps): ReviewItem[] {
  const failedMissions = missions
    .filter((mission) => mission.status === "failed_retrying" || mission.status === "failed_terminal")
    .map<ReviewItem>((mission) => ({
      id: `mission-${mission.id}`,
      title: mission.product_intent,
      description: mission.last_error_message ?? "Mission needs scrape diagnostics before it can continue.",
      type: "inspect scrape issue",
      priority: "high",
      href: `/missions/${mission.id}`,
    }));

  const pendingClassifications = missions
    .filter((mission) => (mission.pending_classifications_count ?? 0) > 0)
    .map<ReviewItem>((mission) => ({
      id: `classify-${mission.id}`,
      title: `${mission.pending_classifications_count} categories need labels`,
      description: mission.destination_context ?? "Classify discovered categories before supplier matching.",
      type: "classify product",
      priority: "medium",
      href: `/missions/${mission.id}`,
    }));

  const flaggedSuppliers = suppliers
    .filter((supplier) => supplier.is_flagged)
    .map<ReviewItem>((supplier) => ({
      id: `supplier-${supplier.id}`,
      title: supplier.name,
      description: supplier.red_flag_source ?? "Supplier was marked for trust review.",
      type: "verify supplier",
      priority: "high",
      href: `/suppliers/${supplier.id}`,
    }));

  const pricedInquiries = inquiries
    .filter((inquiry) => inquiry.status === "price_received" || inquiry.status === "negotiating")
    .map<ReviewItem>((inquiry) => ({
      id: `inquiry-${inquiry.id}`,
      title: inquiry.suppliers?.name ?? "Supplier inquiry",
      description: inquiry.price
        ? `Price received at $${inquiry.price}. Decide whether to negotiate, approve, or park.`
        : inquiry.notes ?? "Inquiry needs a buyer decision.",
      type: "approve inquiry",
      priority: inquiry.status === "price_received" ? "high" : "medium",
      href: "/workspace/inquiries",
    }));

  const unassignedProducts = products
    .filter((product) => !product.brand_id || !product.product_type_id)
    .map<ReviewItem>((product) => ({
      id: `product-${product.id}`,
      title: product.notes ?? "Unclassified product reference",
      description: "Assign brand and product type so matching can use this reference.",
      type: "classify product",
      priority: "low",
      href: `/products/${product.id}`,
    }));

  const inactiveSources = sources
    .filter((source) => !source.is_active)
    .map<ReviewItem>((source) => ({
      id: `source-${source.id}`,
      title: source.url,
      description: source.notes ?? "Inactive source needs a keep/remove decision.",
      type: "inspect scrape issue",
      priority: "low",
      href: "/workspace/sources",
    }));

  return [
    ...failedMissions,
    ...flaggedSuppliers,
    ...pricedInquiries,
    ...pendingClassifications,
    ...unassignedProducts,
    ...inactiveSources,
  ].sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority));
}

function priorityWeight(priority: ReviewItem["priority"]) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function priorityClass(priority: ReviewItem["priority"]) {
  if (priority === "high") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (priority === "medium") return "border-amber-500/40 bg-amber-500/10 text-amber-800";
  return "border-primary/40 bg-primary/10 text-primary";
}
