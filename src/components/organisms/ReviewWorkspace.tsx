"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileSearch,
  Link2,
  PackageSearch,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatMissionError,
  formatMissionStatusLabel,
} from "@/lib/mission-display";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type ReviewItemType =
  | "verify supplier"
  | "classify product"
  | "approve inquiry"
  | "inspect scrape issue";

type ReviewItem = {
  id: string;
  title: string;
  description: string;
  type: ReviewItemType;
  priority: "high" | "medium" | "low";
  href: string;
  recordLabel: string;
  productLabel: string;
  owner: string;
  age: string;
  stage: string;
  match: string;
};

export function ReviewWorkspace({
  missions,
  inquiries,
  suppliers,
  products,
  sources,
}: ReviewWorkspaceProps) {
  const items = buildReviewItems({ missions, inquiries, suppliers, products, sources });
  const activeItem = items[0] ?? null;
  const highPriorityCount = items.filter((item) => item.priority === "high").length;
  const pendingClassifications = missions.reduce(
    (total, mission) => total + (mission.pending_classifications_count ?? 0),
    0,
  );
  const activeSources = sources.filter((source) => source.is_active).length;
  const trustedSuppliers = suppliers.filter((supplier) => !supplier.is_flagged).length;
  const pricedInquiries = inquiries.filter((inquiry) => inquiry.price !== null).length;
  const classifiedProducts = products.filter(
    (product) => product.brand_id && product.product_type_id,
  ).length;
  const duplicateSignals = products.filter((product) =>
    product.photo_hashes.some((hash) =>
      hash.similarity_matches?.some((match) => !match.is_dismissed),
    ),
  ).length;

  const supplierScore = percent(trustedSuppliers, suppliers.length);
  const productScore = percent(classifiedProducts, products.length);
  const evidenceScore = percent(activeSources + trustedSuppliers, sources.length + suppliers.length);

  return (
    <main className="space-y-4">
      <header className="border-b border-border bg-background pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Link
              href="/workspace"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Workspace
            </Link>
            <div>
              <Badge variant="outline" className="rounded-sm">
                Sourcing case desk
              </Badge>
              <h1 className="mt-2 text-2xl font-heading text-foreground sm:text-3xl">
                Yupoo Organizer review docket
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Triage supplier evidence, product associations, scrape blockers,
                and inquiry decisions from one auditable workspace.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm">
              <FileSearch aria-hidden="true" />
              Audit trail
            </Button>
            {activeItem ? (
              <Link
                href={activeItem.href}
                className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
              >
                <ClipboardCheck aria-hidden="true" />
                Advance case
              </Link>
            ) : (
              <Link
                href="/workspace"
                className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
              >
                <ClipboardCheck aria-hidden="true" />
                Return to desk
              </Link>
            )}
          </div>
        </div>
      </header>

      <section
        aria-label="Case operating metrics"
        className="grid gap-2 sm:grid-cols-3"
      >
        <ReviewMetric
          label="Open review cases"
          value={items.length}
          detail={`${highPriorityCount} high priority`}
        />
        <ReviewMetric
          label="Evidence health"
          value={`${evidenceScore}%`}
          detail={`${activeSources} active sources, ${trustedSuppliers} trusted suppliers`}
        />
        <ReviewMetric
          label="Classification backlog"
          value={pendingClassifications}
          detail={`${duplicateSignals} duplicate signals`}
        />
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.48fr)_minmax(360px,0.9fr)]">
        <section
          aria-labelledby="docket-title"
          className="min-w-0 border border-border bg-card"
        >
          <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="docket-title" className="text-base font-heading">
                Review docket
              </h2>
              <p className="text-sm text-muted-foreground">
                Prioritized cases with ownership, evidence state, and next route.
              </p>
            </div>
            <Button variant="outline" size="sm">
              <Clock3 aria-hidden="true" />
              Sort by priority
            </Button>
          </div>

          {items.length === 0 ? (
            <EmptyReviewState sources={sources} />
          ) : (
            <>
              <div className="space-y-2 p-3 lg:hidden">
                {items.map((item, index) => (
                  <ReviewCaseCard
                    key={`${item.id}-${index}`}
                    item={item}
                    selected={index === 0}
                  />
                ))}
              </div>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead className="text-right">Owner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow
                        key={`${item.id}-${index}`}
                        data-state={index === 0 ? "selected" : undefined}
                      >
                        <TableCell>
                          <Link
                            href={item.href}
                            className="font-medium hover:text-primary"
                          >
                            {item.id}
                          </Link>
                          <div className="text-muted-foreground">{item.age}</div>
                        </TableCell>
                        <TableCell className="max-w-[190px] truncate">
                          {item.recordLabel}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {item.productLabel}
                        </TableCell>
                        <TableCell>
                          <div>{item.stage}</div>
                          <div className="text-muted-foreground">{item.match}</div>
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={item.priority} />
                        </TableCell>
                        <TableCell className="text-right">{item.owner}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </section>

        <aside className="min-w-0 space-y-4" aria-label="Active case panels">
          <section className="border border-border bg-card">
            <div className="border-b border-border px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-heading">
                    Active record health
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {activeItem
                      ? `${activeItem.id} readiness to approve`
                      : "No review case selected"}
                  </p>
                </div>
                <Badge variant={activeItem ? "secondary" : "outline"}>
                  {activeItem ? "Ready after review" : "Queue clear"}
                </Badge>
              </div>
            </div>
            <div className="space-y-3 p-3">
              {[
                { label: "Supplier identity", score: supplierScore, icon: Building2 },
                { label: "Product completeness", score: productScore, icon: PackageSearch },
                { label: "Evidence confidence", score: evidenceScore, icon: ShieldCheck },
              ].map(({ label, score, icon: Icon }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Icon className="size-4 text-primary" aria-hidden="true" />
                      {label}
                    </span>
                    <span className="font-mono text-xs">{score}%</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-sm bg-muted"
                    aria-label={`${label} score ${score} percent`}
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={score}
                  >
                    <div
                      className="h-full rounded-sm bg-primary"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <EvidencePanel
            activeItem={activeItem}
            pendingClassifications={pendingClassifications}
            duplicateSignals={duplicateSignals}
            pricedInquiries={pricedInquiries}
            activeSources={activeSources}
            suppliers={suppliers}
          />
        </aside>
      </div>

      <NextActionFlow activeItem={activeItem} />
    </main>
  );
}

function ReviewCaseCard({
  item,
  selected,
}: {
  item: ReviewItem;
  selected: boolean;
}) {
  return (
    <article
      className={cn(
        "space-y-3 border border-border bg-background p-3",
        selected && "bg-muted",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={item.href}
            className="break-all font-medium hover:text-primary"
          >
            {item.id}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">{item.age}</p>
        </div>
        <PriorityBadge priority={item.priority} />
      </div>

      <div className="space-y-2 text-sm">
        <ReviewCaseFact label="Record" value={item.recordLabel} />
        <ReviewCaseFact label="Subject" value={item.productLabel} />
        <ReviewCaseFact label="Stage" value={`${item.stage} · ${item.match}`} />
        <ReviewCaseFact label="Owner" value={item.owner} />
      </div>

      <Link
        href={item.href}
        className={cn(
          buttonVariants({ variant: selected ? "default" : "outline", size: "sm" }),
          "w-full justify-between",
        )}
      >
        Open case
        <ArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}

function ReviewCaseFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
      <span className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 break-words text-foreground">{value}</span>
    </div>
  );
}

function ReviewMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="border border-border bg-card px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-heading">{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function EmptyReviewState({ sources }: { sources: SourceWithProfile[] }) {
  return (
    <div className="px-3 py-10 text-center">
      <CheckCircle2 className="mx-auto size-8 text-primary" aria-hidden="true" />
      <h3 className="mt-3 text-base font-heading">No blocked cases</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        The review docket is clear. Refresh sources or start a focused mission
        to keep supplier evidence current.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Link href="/workspace" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Workspace
        </Link>
        <Link href="/workspace/sources" className={buttonVariants({ size: "sm" })}>
          {sources.length} sources
        </Link>
      </div>
    </div>
  );
}

function EvidencePanel({
  activeItem,
  pendingClassifications,
  duplicateSignals,
  pricedInquiries,
  activeSources,
  suppliers,
}: {
  activeItem: ReviewItem | null;
  pendingClassifications: number;
  duplicateSignals: number;
  pricedInquiries: number;
  activeSources: number;
  suppliers: SupplierWithStats[];
}) {
  const flaggedSuppliers = suppliers.filter((supplier) => supplier.is_flagged).length;
  const evidence = [
    {
      label: "Classification backlog",
      value:
        pendingClassifications > 0
          ? `${pendingClassifications} categories need labels`
          : "No category labels pending",
      state: pendingClassifications > 0 ? "Needs review" : "Verified",
    },
    {
      label: "Image hashes",
      value:
        duplicateSignals > 0
          ? `${duplicateSignals} products have duplicate signals`
          : "No duplicate clusters waiting",
      state: duplicateSignals > 0 ? "Needs review" : "Verified",
    },
    {
      label: "Price signal",
      value:
        pricedInquiries > 0
          ? `${pricedInquiries} inquiries include price evidence`
          : "No priced inquiries in queue",
      state: pricedInquiries > 0 ? "Verified" : "Needs review",
    },
    {
      label: "Supplier trail",
      value:
        flaggedSuppliers > 0
          ? `${flaggedSuppliers} suppliers flagged against ${activeSources} active sources`
          : `${activeSources} active sources support supplier review`,
      state: flaggedSuppliers > 0 ? "Needs review" : "Verified",
    },
  ];

  const associations = activeItem
    ? [
        `${activeItem.stage} is the highest priority case in the current queue.`,
        activeItem.description,
        `Route opens ${activeItem.href} without losing the docket context.`,
      ]
    : [
        "No current blocker is hiding in section tabs.",
        "Source refresh and mission creation become the next maintenance actions.",
        "The review desk can stay empty without obscuring workspace navigation.",
      ];

  return (
    <section className="border border-border bg-card">
      <div className="border-b border-border px-3 py-3">
        <h2 className="text-base font-heading">Evidence and associations</h2>
        <p className="text-sm text-muted-foreground">
          Linked facts that explain the recommended filing path.
        </p>
      </div>
      <div className="divide-y divide-border">
        {evidence.map((item) => (
          <div
            className="flex items-start justify-between gap-3 px-3 py-2.5"
            key={item.label}
          >
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-sm text-muted-foreground">{item.value}</p>
            </div>
            <Badge variant={item.state === "Verified" ? "secondary" : "outline"}>
              {item.state}
            </Badge>
          </div>
        ))}
      </div>
      <ul className="space-y-2 border-t border-border bg-surface-container-lowest p-3">
        {associations.map((item) => (
          <li className="flex gap-2 text-sm" key={item}>
            <Link2
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextActionFlow({ activeItem }: { activeItem: ReviewItem | null }) {
  const actions = getNextActions(activeItem);

  return (
    <section
      aria-labelledby="next-actions-title"
      className="border border-border bg-card"
    >
      <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="next-actions-title" className="text-base font-heading">
            Clear next action flow
          </h2>
          <p className="text-sm text-muted-foreground">
            The desk keeps the reviewer moving from uncertainty to filing.
          </p>
        </div>
        <Badge variant="outline">
          {activeItem ? `${activeItem.id} decision path` : "Maintenance path"}
        </Badge>
      </div>
      <div className="grid gap-0 md:grid-cols-3">
        {actions.map((action, index) => (
          <article
            className="border-b border-border p-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
            key={action.title}
          >
            <div className="mb-3 flex items-center gap-2">
              {index === 0 ? (
                <AlertTriangle
                  className={cn(
                    "size-4",
                    activeItem ? "text-destructive" : "text-primary",
                  )}
                  aria-hidden="true"
                />
              ) : index === 1 ? (
                <UserRoundCheck className="size-4 text-primary" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              )}
              <span className="font-mono text-xs text-muted-foreground">
                STEP {index + 1}
              </span>
            </div>
            <h3 className="text-sm font-semibold">{action.title}</h3>
            <p className="mt-1 min-h-10 text-sm text-muted-foreground">
              {action.detail}
            </p>
            <Link
              href={action.href}
              className={cn(
                buttonVariants({
                  variant: index === 0 && activeItem ? "default" : "outline",
                  size: "sm",
                }),
                "mt-4 w-full justify-between",
              )}
              aria-label={`${action.cta} for ${action.title}`}
            >
              {action.cta}
              <ArrowRight aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function getNextActions(activeItem: ReviewItem | null) {
  if (!activeItem) {
    return [
      {
        title: "Refresh source coverage",
        detail: "Review inactive or stale sources before launching the next scrape.",
        cta: "Open sources",
        href: "/workspace/sources",
      },
      {
        title: "Start focused mission",
        detail: "Seed a small Yupoo category run to keep the sourcing desk current.",
        cta: "New mission",
        href: "/workspace/missions/new",
      },
      {
        title: "Inspect catalog gaps",
        detail: "Keep brand aliases and product types normalized before matching.",
        cta: "Open catalog",
        href: "/workspace/catalog",
      },
    ];
  }

  if (activeItem.type === "inspect scrape issue") {
    return [
      {
        title: "Open mission diagnostics",
        detail: activeItem.description,
        cta: "Inspect mission",
        href: activeItem.href,
      },
      {
        title: "Check source context",
        detail: "Verify the seed URL and related source evidence before retrying.",
        cta: "Open sources",
        href: "/workspace/sources",
      },
      {
        title: "Retry or park",
        detail: "Once the blocker is understood, rerun the mission or remove it from expansion.",
        cta: "Review mission",
        href: activeItem.href,
      },
    ];
  }

  if (activeItem.type === "approve inquiry") {
    return [
      {
        title: "Review price evidence",
        detail: activeItem.description,
        cta: "Open inquiry",
        href: activeItem.href,
      },
      {
        title: "Compare supplier memory",
        detail: "Check supplier trust, active threads, and related product references.",
        cta: "Open suppliers",
        href: "/workspace/suppliers",
      },
      {
        title: "File sourcing decision",
        detail: "Approve, negotiate, or park the inquiry while the supplier context is fresh.",
        cta: "Decision queue",
        href: activeItem.href,
      },
    ];
  }

  return [
    {
      title: "Inspect active record",
      detail: activeItem.description,
      cta: "Open record",
      href: activeItem.href,
    },
    {
      title: "Validate associations",
      detail: "Confirm supplier, product, catalog, and source relationships before filing.",
      cta: "Open workspace",
      href: "/workspace",
    },
    {
      title: "Advance review state",
      detail: "Close the blocker after evidence confidence is high enough to continue.",
      cta: "Advance case",
      href: activeItem.href,
    },
  ];
}

function PriorityBadge({ priority }: { priority: ReviewItem["priority"] }) {
  if (priority === "high") return <Badge variant="destructive">High risk</Badge>;
  if (priority === "low") return <Badge variant="secondary">Low risk</Badge>;
  return <Badge variant="outline">Medium risk</Badge>;
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
    .map<ReviewItem>((mission) => {
      const errorCopy = formatMissionError({
        message: mission.last_error_message,
        code: mission.last_error_code,
      });

      return {
        id: `MIS-${mission.id.slice(0, 8)}`,
        title: mission.product_intent,
        description: errorCopy.detail,
        type: "inspect scrape issue",
        priority: "high",
        href: `/missions/${mission.id}`,
        recordLabel: hostLabel(mission.seed_url),
        productLabel: mission.product_intent,
        owner: "Ops",
        age: relativeTime(mission.failed_at ?? mission.created_at),
        stage: "Mission diagnostics",
        match: formatMissionStatusLabel(mission.status),
      };
    });

  const pendingClassifications = missions
    .filter((mission) => (mission.pending_classifications_count ?? 0) > 0)
    .map<ReviewItem>((mission) => ({
      id: `CLS-${mission.id.slice(0, 8)}`,
      title: `${mission.pending_classifications_count} categories need labels`,
      description: mission.destination_context ?? "Classify discovered categories before supplier matching.",
      type: "classify product",
      priority: "medium",
      href: `/missions/${mission.id}`,
      recordLabel: hostLabel(mission.seed_url),
      productLabel: mission.product_intent,
      owner: "Catalog",
      age: relativeTime(mission.created_at),
      stage: "Evidence review",
      match: `${mission.pending_classifications_count} pending labels`,
    }));

  const flaggedSuppliers = suppliers
    .filter((supplier) => supplier.is_flagged)
    .map<ReviewItem>((supplier) => ({
      id: `SUP-${supplier.id.slice(0, 8)}`,
      title: supplier.name,
      description: supplier.red_flag_source ?? "Supplier was marked for trust review.",
      type: "verify supplier",
      priority: "high",
      href: `/suppliers/${supplier.id}`,
      recordLabel: supplier.name,
      productLabel: `${supplier.activeInquiryCount} active inquiries`,
      owner: "Trust",
      age: relativeTime(supplier.updated_at ?? supplier.created_at),
      stage: "Supplier check",
      match: supplier.red_flag_source ? "Flag source recorded" : "Manual trust review",
    }));

  const pricedInquiries = inquiries
    .filter((inquiry) => inquiry.status === "price_received" || inquiry.status === "negotiating")
    .map<ReviewItem>((inquiry) => ({
      id: `INQ-${inquiry.id.slice(0, 8)}`,
      title: inquiry.suppliers?.name ?? "Supplier inquiry",
      description: inquiry.price
        ? `Price received at $${inquiry.price}. Decide whether to negotiate, approve, or park.`
        : inquiry.notes ?? "Inquiry needs a buyer decision.",
      type: "approve inquiry",
      priority: inquiry.status === "price_received" ? "high" : "medium",
      href: "/workspace/inquiries",
      recordLabel: inquiry.suppliers?.name ?? "Unknown supplier",
      productLabel: inquiry.products?.notes ?? "Product reference",
      owner: "Buyer",
      age: relativeTime(inquiry.updated_at ?? inquiry.created_at),
      stage: inquiry.status === "price_received" ? "Price received" : "Negotiating",
      match: inquiry.price ? `$${inquiry.price}` : "No price recorded",
    }));

  const unassignedProducts = products
    .filter((product) => !product.brand_id || !product.product_type_id)
    .map<ReviewItem>((product) => ({
      id: `PRD-${product.id.slice(0, 8)}`,
      title: product.notes ?? "Unclassified product reference",
      description: "Assign brand and product type so matching can use this reference.",
      type: "classify product",
      priority: "low",
      href: `/products/${product.id}`,
      recordLabel: product.brands?.name ?? "Brand missing",
      productLabel: product.product_types?.name ?? product.notes ?? "Product type missing",
      owner: "Catalog",
      age: relativeTime(product.created_at),
      stage: "Product completeness",
      match: product.photo_hashes.length
        ? `${product.photo_hashes.length} photos`
        : "No photos",
    }));

  const inactiveSources = sources
    .filter((source) => !source.is_active)
    .map<ReviewItem>((source) => ({
      id: `SRC-${source.id.slice(0, 8)}`,
      title: source.url,
      description: source.notes ?? "Inactive source needs a keep/remove decision.",
      type: "inspect scrape issue",
      priority: "low",
      href: "/workspace/sources",
      recordLabel: hostLabel(source.url),
      productLabel: source.platform,
      owner: source.profiles?.role ?? "Source",
      age: relativeTime(source.updated_at ?? source.created_at),
      stage: "Source evidence",
      match: `${source.brands?.length ?? 0} brand tags`,
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

function percent(value: number, total: number) {
  if (total <= 0) return 100;
  return Math.round((value / total) * 100);
}

function hostLabel(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function relativeTime(dateValue: string | null | undefined) {
  if (!dateValue) return "unknown";

  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) return "unknown";

  const diffInSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d`;
}
