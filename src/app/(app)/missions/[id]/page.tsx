import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { PhotoThumb } from "@/components/atoms/PhotoThumb"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { isUiPreviewMode } from "@/lib/preview"
import {
  formatMissionDiagnostics,
  formatMissionError,
  formatMissionEventLabel,
  formatMissionStageLabel,
  formatMissionStatusLabel,
} from "@/lib/mission-display"

type MissionDiagnosticsPageProps = {
  params: Promise<{ id: string }>
}

type MissionRun = {
  id: string
  stage_name: string
  status: string
  attempt_number: number
  queue_message_id: string | null
  queued_at: string | null
  started_at: string | null
  finished_at: string | null
  diagnostics: unknown
  error_message: string | null
  error_code: string | null
  created_at: string
}

type MissionEvent = {
  id: string
  run_id: string | null
  stage_name: string
  event_name: string
  diagnostics: unknown
  created_at: string
}

type MissionSummary = {
  id: string
  seed_url: string
  status: string
  current_stage: string | null
  queued_at: string | null
  running_at: string | null
  failed_at: string | null
  attempt_count: number
  last_error_message: string | null
  last_error_code: string | null
  created_at: string
  updated_at: string
}

type ScrapedCategory = {
  id: string
  source_url: string
  raw_label: string
  category_path: string[] | null
  preview_image_urls: string[] | null
  normalized_label: string | null
  brand_signal: string | null
  product_signal: string | null
  classification_status: string | null
  classification_confidence: number | null
  extracted_at: string
}

function formatDate(value: string | null) {
  if (!value) return "Not set"
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value))
}

function statusVariant(status: string) {
  if (status === "succeeded" || status === "completed") return "default"
  if (status === "failed" || status === "failed_retrying" || status === "failed_terminal") return "destructive"
  if (status === "queued") return "outline"
  return "secondary"
}

function DiagnosticsList({ value }: { value: unknown }) {
  const items = formatMissionDiagnostics(value)

  if (items.length === 0) {
    return (
      <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        No extra details recorded.
      </p>
    )
  }

  return (
    <dl className="mt-3 grid gap-2 rounded-md bg-muted p-3 text-xs sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="font-medium text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 break-words text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="break-words text-sm text-foreground">{value}</div>
    </div>
  )
}

export default async function MissionDiagnosticsPage({
  params,
}: MissionDiagnosticsPageProps) {
  const { id } = await params

  if (isUiPreviewMode()) {
    return (
      <div className="space-y-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Link
              href="/workspace"
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Missions
            </Link>
            <h1 className="text-2xl font-heading tracking-tight text-foreground">
              Scrape Diagnostics
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Preview execution timeline and source diagnostics for {id}.
            </p>
          </div>
          <Badge variant="destructive">failed_retrying</Badge>
        </div>

        <Card className="rounded-none border-border/70 shadow-none">
          <CardHeader>
            <CardTitle>Scrape Specification</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <DetailItem label="Seed URL" value="https://northgate.example.com/albums" />
            <DetailItem label="Current stage" value="Retry scheduled" />
            <DetailItem label="Attempt count" value={2} />
            <DetailItem label="Runs" value={3} />
            <DetailItem label="Events" value={14} />
            <DetailItem label="Discovered" value="18 categories / 2 suppliers" />
          </CardContent>
        </Card>

        <Card className="rounded-none border-border/70 shadow-none">
          <CardHeader>
            <CardTitle>Last Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Source returned an empty album index.
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border/70 shadow-none">
          <CardHeader>
            <CardTitle>Execution Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {["queued", "scanning", "failed", "retry scheduled"].map((event) => (
                <li key={event} className="border border-border/70 bg-background p-4">
                  <p className="text-sm font-semibold">{event}</p>
                  <p className="mt-1 text-xs text-muted-foreground">mission-worker / May 18, 2026</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") notFound()

  const [
    missionResult,
    runsResult,
    eventsResult,
    categoriesResult,
    suppliersResult,
  ] = await Promise.all([
    supabase
      .from("sourcing_missions")
      .select(
        "id, seed_url, status, current_stage, queued_at, running_at, failed_at, attempt_count, last_error_message, last_error_code, created_at, updated_at",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("sourcing_mission_runs")
      .select(
        "id, stage_name, status, attempt_number, queue_message_id, queued_at, started_at, finished_at, diagnostics, error_message, error_code, created_at",
      )
      .eq("mission_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("sourcing_mission_stage_events")
      .select("id, run_id, stage_name, event_name, diagnostics, created_at")
      .eq("mission_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("discovered_categories")
      .select(
        "id, source_url, raw_label, category_path, preview_image_urls, normalized_label, brand_signal, product_signal, classification_status, classification_confidence, extracted_at",
        { count: "exact" },
      )
      .eq("mission_id", id)
      .order("extracted_at", { ascending: false })
      .limit(80),
    supabase
      .from("discovered_suppliers")
      .select("id", { count: "exact", head: true })
      .eq("mission_id", id),
  ])

  if (missionResult.error || !missionResult.data) notFound()

  const mission = missionResult.data as MissionSummary
  const runs = (runsResult.data ?? []) as MissionRun[]
  const events = (eventsResult.data ?? []) as MissionEvent[]
  const categories = (categoriesResult.data ?? []) as ScrapedCategory[]
  const categoriesWithImagesCount = categories.filter(
    (category) => (category.preview_image_urls ?? []).length > 0,
  ).length

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/workspace/missions"
            className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Missions
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl font-heading tracking-tight text-foreground">
              Scrape Diagnostics
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Admin-only execution timeline, queue runs, and scrape configuration.
            </p>
          </div>
        </div>
        <Badge variant={statusVariant(mission.status)}>
          {formatMissionStatusLabel(mission.status)}
        </Badge>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Scrape Specification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailItem
              label="Seed URL"
              value={
                <a
                  href={mission.seed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {mission.seed_url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              }
            />
            <DetailItem label="Current stage" value={formatMissionStageLabel(mission.current_stage)} />
            <DetailItem label="Attempt count" value={mission.attempt_count} />
            <DetailItem label="Queued" value={formatDate(mission.queued_at)} />
            <DetailItem label="Running" value={formatDate(mission.running_at)} />
            <DetailItem label="Failed" value={formatDate(mission.failed_at)} />
            <DetailItem label="Created" value={formatDate(mission.created_at)} />
          </div>
          {(mission.last_error_message || mission.last_error_code) && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {(() => {
                const errorCopy = formatMissionError({
                  code: mission.last_error_code,
                  message: mission.last_error_message,
                })

                return (
                  <>
                    <p className="font-medium">{errorCopy.title}</p>
                    <p className="mt-1">{errorCopy.detail}</p>
                  </>
                )
              })()}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <DetailItem label="Runs" value={runs.length} />
            <DetailItem label="Events" value={events.length} />
            <DetailItem
              label="Discovered"
              value={`${categoriesResult.count ?? categories.length} categories / ${suppliersResult.count ?? 0} suppliers`}
            />
            <DetailItem
              label="Category images"
              value={`${categoriesWithImagesCount} categories with previews`}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Scraped Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories scraped yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {categories.map((category) => {
                const previewUrls = category.preview_image_urls ?? []

                return (
                  <article key={category.id} className="rounded-md border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{category.raw_label}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {(category.category_path ?? []).join(" / ") || "No category path"}
                        </p>
                        {category.classification_status && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge variant="secondary">
                              {formatMissionStatusLabel(category.classification_status)}
                            </Badge>
                            {category.brand_signal && (
                              <Badge variant="outline">Brand: {category.brand_signal}</Badge>
                            )}
                            {category.product_signal && (
                              <Badge variant="outline">Product: {category.product_signal}</Badge>
                            )}
                            {category.classification_confidence !== null && (
                              <Badge variant="outline">
                                Conf: {category.classification_confidence.toFixed(2)}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <a
                        href={category.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={`Open ${category.raw_label}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    {previewUrls.length > 0 ? (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {previewUrls.map((url, index) => (
                          <a
                            key={`${category.id}-${url}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open preview ${index + 1} for ${category.raw_label}`}
                          >
                            <PhotoThumb
                              src={url}
                              alt={`${category.raw_label} preview ${index + 1}`}
                              size="md"
                              className="border bg-muted"
                            />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                        No preview images captured for this category.
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No run rows recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <article key={run.id} className="rounded-md border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{formatMissionStageLabel(run.stage_name)}</p>
                      <p className="text-xs text-muted-foreground">
                        Attempt {run.attempt_number} · queued {formatDate(run.queued_at)}
                      </p>
                    </div>
                    <Badge variant={statusVariant(run.status)}>
                      {formatMissionStatusLabel(run.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                    <DetailItem label="Started" value={formatDate(run.started_at)} />
                    <DetailItem label="Finished" value={formatDate(run.finished_at)} />
                    <DetailItem label="Queue message" value={run.queue_message_id ?? "None"} />
                  </div>
                  {(run.error_message || run.error_code) && (
                    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {(() => {
                        const errorCopy = formatMissionError({
                          code: run.error_code,
                          message: run.error_message,
                        })

                        return (
                          <>
                            <p className="font-medium">{errorCopy.title}</p>
                            <p className="mt-1">{errorCopy.detail}</p>
                          </>
                        )
                      })()}
                    </div>
                  )}
                  <DiagnosticsList value={run.diagnostics} />
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Execution Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stage events recorded yet.</p>
          ) : (
            <ol className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="rounded-md border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{formatMissionEventLabel(event.event_name)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMissionStageLabel(event.stage_name)} · {formatDate(event.created_at)}
                      </p>
                    </div>
                    {event.run_id && (
                      <span className="max-w-[220px] truncate rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                        run {event.run_id}
                      </span>
                    )}
                  </div>
                  <DiagnosticsList value={event.diagnostics} />
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
