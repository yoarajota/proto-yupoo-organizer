"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { PhotoThumb } from "@/components/atoms/PhotoThumb";
import type {
  MissionCategoryReviewItem,
  MissionRowType,
} from "@/lib/mission-category-review";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Target, Bot, CheckCircle, Clock, ExternalLink, Link2, AlertCircle, ChevronRight, ChevronDown, X } from "lucide-react";
import { runMissionDiscovery } from "@/actions/sourcing-discovery";
import {
  reviewMissionCategoryClassification,
  runMissionCategoryClassification,
} from "@/actions/sourcing-classification";
import { runMissionMatching } from "@/actions/sourcing-matching";
import { generateOutreachSuggestions } from "@/actions/sourcing-outreach";

export type {
  MissionCategoryReviewItem,
  MissionRowType,
} from "@/lib/mission-category-review";

interface MissionsTableProps {
  missions: MissionRowType[];
}

function getRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

function getExactCreatedTime(dateStr: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function getStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function StatusBadge({ status }: { status: string }) {
  const label = getStatusLabel(status);

  if (status === "created") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
        <Clock className="h-3 w-3" /> {label}
      </span>
    );
  }
  if (
    status === "scanning" ||
    status === "classifying_categories" ||
    status === "matching"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
        <Bot className="h-3 w-3 animate-pulse" /> {label}
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-green-500/15 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400">
        <CheckCircle className="h-3 w-3" /> {label}
      </span>
    );
  }
  if (status === "failed" || status === "failed_retrying") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive">
        <AlertCircle className="h-3 w-3" /> {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/15 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
      {label}
    </span>
  );
}

function MissionActionCell({ mission }: { mission: MissionRowType }) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRunDiscovery = () => {
    startTransition(async () => {
      setActionError(null);
      const result = await runMissionDiscovery({ mission_id: mission.id });
      if (result.error) setActionError(result.error.message);
    });
  };

  const handleRunMatching = () => {
    startTransition(async () => {
      await runMissionMatching({ mission_id: mission.id, shortlist_limit: 10 });
    });
  };

  const handleRunClassification = () => {
    startTransition(async () => {
      await runMissionCategoryClassification({ mission_id: mission.id });
    });
  };

  const handleGenerateOutreach = () => {
    startTransition(async () => {
      await generateOutreachSuggestions({
        mission_id: mission.id,
        max_suggestions: 10,
      });
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {(mission.status === "created" ||
        mission.status === "scanning" ||
        mission.status === "failed_retrying") && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={handleRunDiscovery}
        >
          {isPending
            ? "Starting..."
            : mission.status === "created"
              ? "Run Discovery"
              : "Retry Discovery"}
        </Button>
      )}
      {actionError && (
        <p className="max-w-[200px] text-right text-xs text-destructive">
          {actionError}
        </p>
      )}
      {mission.status === "classifying_categories" &&
        mission.pending_classifications_count === 0 && (
          <Button
            size="sm"
            variant="default"
            disabled={isPending}
            onClick={handleRunClassification}
          >
            {isPending ? "Classifying..." : "Run Classification"}
          </Button>
        )}
      {mission.status === "matching" && (
        <Button
          size="sm"
          variant="default"
          disabled={isPending}
          onClick={handleRunMatching}
        >
          {isPending ? "Matching..." : "Run Matching"}
        </Button>
      )}
      {mission.status === "suggestions_ready" && (
        <Button
          size="sm"
          variant="default"
          disabled={isPending}
          onClick={handleGenerateOutreach}
        >
          {isPending ? "Generating..." : "Generate Outreach"}
        </Button>
      )}
    </div>
  );
}

function getMissionSourceLinks(seedUrl: string) {
  try {
    const seed = new URL(seedUrl);
    const origin = seed.origin;

    return {
      host: seed.hostname,
      links: [
        { label: "Shop Root", href: new URL("/", origin).href },
        { label: "Seed", href: seed.href },
        { label: "Categories", href: new URL("/categories", origin).href },
        { label: "Albums", href: new URL("/albums", origin).href },
      ],
    };
  } catch {
    return null;
  }
}

function MissionSourceLinks({ seedUrl }: { seedUrl: string }) {
  const sourceLinks = getMissionSourceLinks(seedUrl);

  if (!sourceLinks) {
    return (
      <div className="space-y-1 mt-4">
        <p className="text-xs font-medium text-muted-foreground">Source</p>
        <p className="text-sm text-muted-foreground truncate" title={seedUrl}>
          {seedUrl}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-4">
      <div className="flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">
          {sourceLinks.host}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sourceLinks.links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary transition-colors"
          >
            {link.label}
            <ExternalLink className="h-3 w-3 opacity-50" />
          </a>
        ))}
      </div>
    </div>
  );
}

function CategoryPreviewPanel({
  item,
  selectedPreviewIndex,
  selectedPreviewUrl,
  onSelectPreview,
  onOpenLightbox,
}: {
  item: MissionCategoryReviewItem;
  selectedPreviewIndex: number;
  selectedPreviewUrl: string | null;
  onSelectPreview: (index: number) => void;
  onOpenLightbox: () => void;
}) {
  if (item.preview_image_urls.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Previews</p>
        <p className="text-xs text-muted-foreground">
          {selectedPreviewIndex + 1} of {item.preview_image_urls.length}
        </p>
      </div>
      {selectedPreviewUrl && (
        <button
          type="button"
          className="group block w-full overflow-hidden rounded-md border bg-muted"
          onClick={onOpenLightbox}
        >
          <img
            src={selectedPreviewUrl}
            alt={`${item.raw_label} preview`}
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </button>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {item.preview_image_urls.map((url, index) => (
          <button
            key={`${item.id}-${index}`}
            type="button"
            onClick={() => onSelectPreview(index)}
            className={`shrink-0 overflow-hidden rounded-md border-2 transition-all ${
              index === selectedPreviewIndex
                ? "border-primary"
                : "border-transparent opacity-70 hover:opacity-100"
            }`}
          >
            <PhotoThumb
              src={url}
              alt={`Thumb ${index + 1}`}
              size="sm"
              className="h-10 w-10 object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryReviewSummary({ item }: { item: MissionCategoryReviewItem }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
          {item.occurrence_count} occurrence{item.occurrence_count === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground border px-2 py-0.5 rounded-md">
          {item.classification_method ?? "pending"}
        </span>
        {item.classification_confidence !== null && (
          <span className="text-muted-foreground border px-2 py-0.5 rounded-md">
            conf: {item.classification_confidence.toFixed(2)}
          </span>
        )}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold">{item.raw_label}</p>
          {item.source_urls?.[0] && (
            <a
              href={item.source_urls[0]}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
              title="View original category"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Grouped under <span className="font-medium text-foreground">{item.normalized_label}</span>
        </p>
      </div>
      {item.decision_reason_text && (
        <p className="text-sm text-muted-foreground bg-muted/50 p-2.5 rounded-md leading-relaxed">
          {item.decision_reason_text}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {item.brand_signal && (
          <span className="text-xs border px-2 py-1 rounded-md text-foreground">
            Brand: <span className="font-medium">{item.brand_signal}</span>
          </span>
        )}
        {item.product_signal && (
          <span className="text-xs border px-2 py-1 rounded-md text-foreground">
            Product: <span className="font-medium">{item.product_signal}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function CategoryReviewInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        placeholder={placeholder}
      />
    </div>
  );
}

function CategoryReviewActions({
  isPending,
  onReview,
}: {
  isPending: boolean;
  onReview: (decision: "accept" | "edit" | "reject") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
        disabled={isPending}
        onClick={() => onReview("reject")}
      >
        Reject
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => onReview("edit")}
      >
        {isPending ? "Saving..." : "Save Edit"}
      </Button>
      <Button
        size="sm"
        className="bg-green-600 hover:bg-green-700 text-white"
        disabled={isPending}
        onClick={() => onReview("accept")}
      >
        Accept
      </Button>
    </div>
  );
}

function CategoryPreviewLightbox({
  item,
  selectedPreviewIndex,
  selectedPreviewUrl,
  isOpen,
  onOpenChange,
  onPrevious,
  onNext,
}: {
  item: MissionCategoryReviewItem;
  selectedPreviewIndex: number;
  selectedPreviewUrl: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (!selectedPreviewUrl) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-all" />
        <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="relative flex w-full max-w-4xl flex-col items-center gap-4">
            <img
              src={selectedPreviewUrl}
              alt="Preview"
              className="max-h-[80vh] max-w-full rounded-md object-contain shadow-2xl"
            />
            <div className="flex items-center gap-4 bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
              <button
                type="button"
                onClick={onPrevious}
                className="text-white hover:text-white/70 transition-colors p-1"
              >
                ←
              </button>
              <span className="text-sm font-medium text-white min-w-[3rem] text-center">
                {selectedPreviewIndex + 1} / {item.preview_image_urls.length}
              </span>
              <button
                type="button"
                onClick={onNext}
                className="text-white hover:text-white/70 transition-colors p-1"
              >
                →
              </button>
            </div>
            <Dialog.Close
              className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 backdrop-blur-md transition-colors"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CategoryReviewCard({ item }: { item: MissionCategoryReviewItem }) {
  const [draftBrand, setDraftBrand] = useState(item.brand_signal ?? "");
  const [draftProduct, setDraftProduct] = useState(item.product_signal ?? "");
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const selectedPreviewUrl =
    item.preview_image_urls[selectedPreviewIndex] ?? null;

  const runReview = (decision: "accept" | "edit" | "reject") => {
    startTransition(async () => {
      await reviewMissionCategoryClassification({
        category_id: item.id,
        decision,
        brand: draftBrand,
        product: draftProduct,
      });
    });
  };

  const selectPreviousPreview = () => {
    setSelectedPreviewIndex((index) =>
      index > 0 ? index - 1 : item.preview_image_urls.length - 1,
    );
  };

  const selectNextPreview = () => {
    setSelectedPreviewIndex((index) =>
      index < item.preview_image_urls.length - 1 ? index + 1 : 0,
    );
  };

  return (
    <article className="flex flex-col md:flex-row gap-6 p-5 rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="w-full md:w-56 shrink-0">
        <CategoryPreviewPanel
          item={item}
          selectedPreviewIndex={selectedPreviewIndex}
          selectedPreviewUrl={selectedPreviewUrl}
          onSelectPreview={setSelectedPreviewIndex}
          onOpenLightbox={() => setIsLightboxOpen(true)}
        />
      </div>
      <div className="flex-1 space-y-5">
        <CategoryReviewSummary item={item} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CategoryReviewInput
            label="Brand"
            placeholder="e.g. lv"
            value={draftBrand}
            onChange={setDraftBrand}
          />
          <CategoryReviewInput
            label="Product"
            placeholder="e.g. bags"
            value={draftProduct}
            onChange={setDraftProduct}
          />
        </div>
        <div className="flex justify-end pt-2 border-t mt-4">
          <div className="mt-4">
            <CategoryReviewActions isPending={isPending} onReview={runReview} />
          </div>
        </div>
      </div>
      <CategoryPreviewLightbox
        item={item}
        selectedPreviewIndex={selectedPreviewIndex}
        selectedPreviewUrl={selectedPreviewUrl}
        isOpen={isLightboxOpen}
        onOpenChange={setIsLightboxOpen}
        onPrevious={selectPreviousPreview}
        onNext={selectNextPreview}
      />
    </article>
  );
}

function MissionReviewItems({ mission }: { mission: MissionRowType }) {
  if (mission.review_items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Category Review Groups</h4>
        <p className="text-xs text-muted-foreground">
          Matching unlocks when reviews are cleared
        </p>
      </div>
      <div className="grid gap-4">
        {mission.review_items.map((item) => (
          <CategoryReviewCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function MissionRow({ mission }: { mission: MissionRowType }) {
  const [isExpanded, setIsExpanded] = useState(mission.pending_classifications_count > 0);
  const hasReviews = mission.review_items.length > 0;

  return (
    <>
      <TableRow className="group hover:bg-muted/30 transition-colors">
        <TableCell className="align-top py-4">
          <div className="max-w-xl space-y-1">
            <p className="font-medium text-sm leading-snug">{mission.product_intent}</p>
            {mission.destination_context && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {mission.destination_context}
              </p>
            )}
            <MissionSourceLinks seedUrl={mission.seed_url} />
          </div>
        </TableCell>
        <TableCell className="align-top py-4">
          <div className="space-y-2">
            <StatusBadge status={mission.status} />
            {mission.pending_classifications_count > 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                {mission.pending_classifications_count} pending review{mission.pending_classifications_count === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell className="align-top py-4 text-sm text-muted-foreground">
          <div className="space-y-1">
            <p className="font-medium text-foreground">{getRelativeTime(mission.created_at)}</p>
            <p className="text-xs">{getExactCreatedTime(mission.created_at)}</p>
          </div>
        </TableCell>
        <TableCell className="align-top py-4 text-right">
          <MissionActionCell mission={mission} />
          {hasReviews && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 text-xs h-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "Hide Reviews" : "Show Reviews"}
              {isExpanded ? <ChevronDown className="ml-1 h-3 w-3" /> : <ChevronRight className="ml-1 h-3 w-3" />}
            </Button>
          )}
        </TableCell>
      </TableRow>
      {hasReviews && isExpanded && (
        <TableRow className="bg-muted/10 hover:bg-muted/10 border-b-2">
          <TableCell colSpan={4} className="p-0 border-t">
            <div className="px-6 py-6 bg-muted/20">
              <MissionReviewItems mission={mission} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function MissionsTable({ missions }: MissionsTableProps) {
  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed rounded-lg bg-muted/10 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Target className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">No active missions</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Create a sourcing mission to kick off an autonomous search across supplier catalogs.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
            <TableHead className="w-[45%] py-3">Mission Details</TableHead>
            <TableHead className="py-3">Status</TableHead>
            <TableHead className="py-3">Created</TableHead>
            <TableHead className="text-right py-3">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {missions.map((mission) => (
            <MissionRow key={mission.id} mission={mission} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
