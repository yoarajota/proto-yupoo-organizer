"use client";

import { useState, useTransition } from "react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Target, Bot, CheckCircle, Clock } from "lucide-react";
import { runMissionDiscovery } from "@/actions/sourcing-discovery";
import {
  reviewMissionCategoryClassification,
  runMissionCategoryClassification,
} from "@/actions/sourcing-classification";
import { runMissionMatching } from "@/actions/sourcing-matching";
import { generateOutreachSuggestions } from "@/actions/sourcing-outreach";

export interface MissionCategoryReviewItem {
  id: string;
  mission_id: string;
  group_key: string;
  raw_label: string;
  normalized_label: string;
  display_label: string;
  brand_signal: string | null;
  product_signal: string | null;
  classification_confidence: number | null;
  classification_method: string | null;
  classification_status: string;
  decision_reason: string;
  decision_reason_text: string;
  occurrence_count: number;
  category_ids: string[];
}

export interface MissionRowType {
  id: string;
  product_intent: string;
  seed_url: string;
  destination_context: string | null;
  status: string;
  created_at: string;
  pending_classifications_count: number;
  review_items: MissionCategoryReviewItem[];
}

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

function StatusBadge({ status }: { status: string }) {
  if (status === "created") {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-widest uppercase bg-muted text-muted-foreground"><Clock className="w-3 h-3" /> Created</span>;
  }
  if (status === "scanning" || status === "classifying_categories" || status === "matching") {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-widest uppercase bg-primary/10 text-primary border border-primary/20"><Bot className="w-3 h-3 animate-pulse" /> {status}</span>;
  }
  if (status === "completed") {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-widest uppercase bg-green-500/10 text-green-500 border border-green-500/20"><CheckCircle className="w-3 h-3" /> {status}</span>;
  }
  
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-widest uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20">{status}</span>;
}

function MissionRow({ mission }: { mission: MissionRowType }) {
  const [isPending, startTransition] = useTransition();

  const handleRunDiscovery = () => {
    startTransition(async () => {
      await runMissionDiscovery({
        mission_id: mission.id,
      });
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
      await generateOutreachSuggestions({ mission_id: mission.id, max_suggestions: 10 });
    });
  };

  return (
    <>
      <TableRow className="group">
        <TableCell className="w-[30%] py-4 pl-6 align-top">
          <div className="flex flex-col gap-1">
            <p className="text-body-sm font-medium leading-relaxed">{mission.product_intent}</p>
            <p className="text-[11px] text-muted-foreground break-all">{mission.seed_url}</p>
            {mission.pending_classifications_count > 0 && (
              <p className="text-[10px] uppercase tracking-widest text-amber-600">
                {mission.pending_classifications_count} pending review group{mission.pending_classifications_count === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </TableCell>
        <TableCell className="py-4 align-top">
          {mission.destination_context ? (
            <p className="text-body-sm text-muted-foreground max-w-xs truncate">{mission.destination_context}</p>
          ) : (
            <span className="text-body-sm text-muted-foreground/50 italic">—</span>
          )}
        </TableCell>
        <TableCell className="py-4 align-top" suppressHydrationWarning>
          <span className="text-label-sm text-muted-foreground/80 block w-full whitespace-nowrap">
            {getRelativeTime(mission.created_at)}
          </span>
        </TableCell>
        <TableCell className="py-4 align-top">
          <StatusBadge status={mission.status} />
        </TableCell>
        <TableCell className="py-4 pr-6 align-top text-right">
          {mission.status === "created" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[10px] uppercase tracking-widest font-semibold"
              disabled={isPending}
              onClick={handleRunDiscovery}
            >
              {isPending ? "Starting..." : "Run Discovery"}
            </Button>
          )}
          {mission.status === "classifying_categories" && mission.pending_classifications_count === 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[10px] uppercase tracking-widest font-semibold"
              disabled={isPending}
              onClick={handleRunClassification}
            >
              {isPending ? "Classifying..." : "Run Classification"}
            </Button>
          )}
          {mission.status === "matching" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[10px] uppercase tracking-widest font-semibold"
              disabled={isPending}
              onClick={handleRunMatching}
            >
              {isPending ? "Matching..." : "Run Matching"}
            </Button>
          )}
          {mission.status === "suggestions_ready" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[10px] uppercase tracking-widest font-semibold text-primary border-primary/20 hover:bg-primary/5"
              disabled={isPending}
              onClick={handleGenerateOutreach}
            >
              {isPending ? "Generating..." : "Generate Outreach"}
            </Button>
          )}
        </TableCell>
      </TableRow>

      {mission.review_items.length > 0 && (
        <TableRow>
          <TableCell colSpan={5} className="bg-amber-50/40 px-6 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Category review groups
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Matching unlocks when reviews are cleared
                </p>
              </div>
              <div className="space-y-3">
                {mission.review_items.map((item) => (
                  <CategoryReviewCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function CategoryReviewCard({ item }: { item: MissionCategoryReviewItem }) {
  const [draftBrand, setDraftBrand] = useState(item.brand_signal ?? "");
  const [draftProduct, setDraftProduct] = useState(item.product_signal ?? "");
  const [isPending, startTransition] = useTransition();

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

  return (
    <article className="grid gap-3 border border-amber-200/70 bg-background p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Raw label</p>
        <p className="text-sm font-medium">{item.raw_label}</p>
        <p className="text-[11px] text-muted-foreground">
          {item.occurrence_count} occurrence{item.occurrence_count === 1 ? "" : "s"} grouped under {item.normalized_label}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Confidence {item.classification_confidence?.toFixed(2) ?? "0.00"} via {item.classification_method ?? "pending"}
        </p>
        <p className="text-[11px] text-muted-foreground">{item.decision_reason_text}</p>
      </div>
      <label className="space-y-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand</span>
        <input
          value={draftBrand}
          onChange={(event) => setDraftBrand(event.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          placeholder="lv"
        />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Product</span>
        <input
          value={draftProduct}
          onChange={(event) => setDraftProduct(event.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          placeholder="bags"
        />
      </label>
      <div className="flex flex-wrap items-end justify-end gap-2">
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => runReview("accept")}>
          Accept
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => runReview("edit")}>
          {isPending ? "Saving..." : "Save Edit"}
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => runReview("reject")}>
          Reject
        </Button>
      </div>
    </article>
  );
}

export function MissionsTable({ missions }: MissionsTableProps) {
  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-xl bg-surface-container-low gap-4 text-center">
        <Target className="w-8 h-8 text-muted-foreground/30" />
        <div className="space-y-1">
          <p className="text-body-sm font-semibold">No active missions.</p>
          <p className="text-label-sm text-muted-foreground">Create a sourcing mission to kick off an autonomous search.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-container-low overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b-2 border-foreground/10 hover:bg-transparent">
            <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6 pl-6">Intent</TableHead>
            <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6">Context</TableHead>
            <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6">Created</TableHead>
            <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6">Status</TableHead>
            <TableHead className="text-right text-[10px] uppercase tracking-widest text-muted-foreground py-6 pr-6">Action</TableHead>
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
