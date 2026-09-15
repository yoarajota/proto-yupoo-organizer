"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle,
  Clock,
  ExternalLink,
  Link2,
  Search,
} from "lucide-react";
import { deleteSourcingMission } from "@/actions/sourcing-missions";
import { runMissionDiscoveryWithFallback } from "@/actions/sourcing-discovery";
import { runMissionCategoryClassificationWithFallback } from "@/actions/sourcing-classification";
import type { BrandCatalogOption, CatalogOption } from "@/lib/catalog";
import type { MissionRowType } from "@/lib/mission-category-review";
import {
  formatMissionError,
  formatMissionStatusLabel,
} from "@/lib/mission-display";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export type {
  MissionCategoryReviewItem,
  MissionRowType,
} from "@/lib/mission-category-review";

interface MissionsTableProps {
  missions: MissionRowType[];
  brands?: BrandCatalogOption[];
  productTypes?: CatalogOption[];
  isAdmin?: boolean;
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
  return formatMissionStatusLabel(status);
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

  if (status === "discovery_queued" || status === "scanning") {
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

  if (status === "failed" || status === "failed_retrying" || status === "failed_terminal") {
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

function MissionActionCell({
  mission,
  canDelete = false,
}: {
  mission: MissionRowType;
  canDelete?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const inFlightRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionErrorCopy = actionError
    ? formatMissionError({ message: actionError })
    : null;
  const missionErrorCopy = mission.last_error_message || mission.last_error_code
    ? formatMissionError({
        message: mission.last_error_message,
        code: mission.last_error_code,
      })
    : null;

  const handleRunDiscovery = () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    startTransition(async () => {
      setActionError(null);
      try {
        const result = await runMissionDiscoveryWithFallback({ mission_id: mission.id });
        if (result.error) setActionError(result.error.message);
      } finally {
        inFlightRef.current = false;
      }
    });
  };

  const handleDeleteMission = () => {
    const confirmed = window.confirm(
      "Delete this scrape mission and all related scraped data, run logs, and events?",
    );

    if (!confirmed) return;

    startTransition(async () => {
      setActionError(null);
      const result = await deleteSourcingMission(mission.id);
      if (result.error) setActionError(result.error.message);
    });
  };

  const handleRunClassification = () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    startTransition(async () => {
      setActionError(null);
      try {
        const result = await runMissionCategoryClassificationWithFallback({ mission_id: mission.id });
        if (result.error) setActionError(result.error.message);
      } finally {
        inFlightRef.current = false;
      }
    });
  };

  const canScrape =
    mission.status === "created" ||
    mission.status === "discovery_queued" ||
    mission.status === "scanning" ||
    mission.status === "failed_retrying" ||
    mission.status === "failed_terminal";
  const canClassify = mission.status === "completed" || mission.status === "classifying_categories";

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      {canScrape && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={handleRunDiscovery}
        >
          {isPending
            ? "Running..."
            : mission.status === "created"
              ? "Run Scrape"
              : "Retry Scrape"}
        </Button>
      )}
      {canClassify && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={handleRunClassification}
        >
          {isPending ? "Running..." : "Run Classification"}
        </Button>
      )}
      {actionError && (
        <p className="max-w-[200px] text-right text-xs text-destructive">
          {actionErrorCopy?.detail}
        </p>
      )}
      {!actionError && missionErrorCopy && (
        <p className="max-w-[200px] text-right text-xs text-destructive">
          {missionErrorCopy.detail}
        </p>
      )}
      {canDelete && (
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={handleDeleteMission}
        >
          {isPending ? "Deleting..." : "Delete Mission"}
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
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Source</p>
        <p className="text-sm text-muted-foreground truncate" title={seedUrl}>
          {seedUrl}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
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
            aria-label={link.label === "Seed" ? "Seed URL" : link.label}
            className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary"
          >
            {link.label}
            <ExternalLink className="h-3 w-3 opacity-50" />
          </a>
        ))}
      </div>
    </div>
  );
}

function MissionRow({
  mission,
  isAdmin,
}: {
  mission: MissionRowType;
  isAdmin: boolean;
}) {
  return (
    <TableRow className="group transition-colors hover:bg-muted/30">
      <TableCell className="align-top py-4">
        <div className="max-w-xl space-y-3">
          <div className="space-y-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {mission.product_intent}
            </h3>
            {mission.destination_context && (
              <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                {mission.destination_context}
              </p>
            )}
          </div>
          <MissionSourceLinks seedUrl={mission.seed_url} />
        </div>
      </TableCell>
      <TableCell className="align-top py-4">
        <StatusBadge status={mission.status} />
      </TableCell>
      <TableCell className="align-top py-4 text-sm text-muted-foreground">
        <div className="space-y-1">
          <p className="font-medium text-foreground">{getRelativeTime(mission.created_at)}</p>
          <p className="text-xs">{getExactCreatedTime(mission.created_at)}</p>
        </div>
      </TableCell>
      <TableCell className="align-top py-4 text-right">
        <MissionActionCell mission={mission} canDelete={isAdmin} />
        {isAdmin && (
          <Link
            href={`/missions/${mission.id}`}
            className="mt-2 inline-flex h-8 items-center justify-end gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Diagnostics
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </TableCell>
    </TableRow>
  );
}

export function MissionsTable({
  missions,
  isAdmin = false,
}: MissionsTableProps) {
  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 px-4 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Search className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-lg font-medium">No scrape missions</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add a Yupoo shop URL to scrape categories, suppliers, and source links.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 xl:hidden">
        {missions.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            isAdmin={isAdmin}
          />
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm xl:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[45%] py-3">Source</TableHead>
              <TableHead className="py-3">Status</TableHead>
              <TableHead className="py-3">Created</TableHead>
              <TableHead className="py-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {missions.map((mission) => (
              <MissionRow
                key={mission.id}
                mission={mission}
                isAdmin={isAdmin}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function MissionCard({
  mission,
  isAdmin,
}: {
  mission: MissionRowType;
  isAdmin: boolean;
}) {
  return (
    <article className="space-y-4 rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={mission.status} />
          <span className="text-xs text-muted-foreground">
            {getRelativeTime(mission.created_at)}
          </span>
        </div>
        <h3 className="break-words text-sm font-semibold leading-snug text-foreground">
          {mission.product_intent}
        </h3>
        {mission.destination_context && (
          <p className="text-xs leading-5 text-muted-foreground">
            {mission.destination_context}
          </p>
        )}
      </div>

      <MissionSourceLinks seedUrl={mission.seed_url} />

      <div className="border-t pt-3">
        <MissionActionCell mission={mission} canDelete={isAdmin} />
        {isAdmin && (
          <Link
            href={`/missions/${mission.id}`}
            className="mt-2 inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Diagnostics
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </article>
  );
}
