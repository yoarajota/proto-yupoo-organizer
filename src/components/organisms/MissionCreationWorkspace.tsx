"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Link2,
  Play,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { createSourcingMission } from "@/actions/sourcing-missions";
import { BrandTagGroup } from "@/components/molecules/BrandTagGroup";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SourceWithProfile } from "@/components/organisms/SourceRow";
import type { BrandCatalogOption, CatalogOption } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type MissionCreationWorkspaceProps = {
  brands: BrandCatalogOption[];
  productTypes: CatalogOption[];
  sources: SourceWithProfile[];
};

type MissionDraft = {
  seedUrl: string;
  productIntent: string;
  destinationContext: string;
  targetPrice: string;
  evidence: string;
  selectedBrand: string;
  selectedProductType: string;
};

const initialDraft: MissionDraft = {
  seedUrl: "https://west42.x.yupoo.com/categories",
  productIntent: "Find Prada leather tote suppliers with QC evidence",
  destinationContext: "Buyer wants neutral leather goods under $180 with hardware close-ups.",
  targetPrice: "180",
  evidence: "QC photos, interior stamp, album freshness",
  selectedBrand: "Prada",
  selectedProductType: "Bags",
};

export function MissionCreationWorkspace({
  brands,
  productTypes,
  sources,
}: MissionCreationWorkspaceProps) {
  const [draft, setDraft] = useState<MissionDraft>(initialDraft);
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const sourceHost = useMemo(() => getHost(draft.seedUrl), [draft.seedUrl]);
  const matchingSource = sources.find((source) => getHost(source.url) === sourceHost);
  const isReady = draft.seedUrl.trim().length > 0 && draft.productIntent.trim().length > 0;

  function updateDraft(field: keyof MissionDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function submitMission() {
    setFormError(null);
    setFormMessage(null);

    startTransition(async () => {
      const result = await createSourcingMission({
        seed_url: draft.seedUrl,
        product_intent: draft.productIntent,
        destination_context: draft.destinationContext,
        constraints: {
          target_price: draft.targetPrice,
          required_evidence: draft.evidence,
          brand: draft.selectedBrand,
          product_type: draft.selectedProductType,
        },
      });

      if (result.error) {
        setFormError(result.error.message);
        return;
      }

      setFormMessage("Mission created. Return to the workspace to run or monitor it.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/workspace"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Missions
          </Link>
          <h1 className="mt-3 text-2xl font-heading text-foreground sm:text-3xl">
            New sourcing mission
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Define exactly what the scanner should inspect before launching a Yupoo source pass.
          </p>
        </div>
      </div>

      <GuidedMissionBuilder
        draft={draft}
        brands={brands}
        productTypes={productTypes}
        step={step}
        onStepChange={setStep}
        onUpdate={updateDraft}
        matchingSource={matchingSource}
        sourceHost={sourceHost}
        isReady={isReady}
        isPending={isPending}
        formError={formError}
        formMessage={formMessage}
        onSubmit={submitMission}
      />
    </div>
  );
}

function GuidedMissionBuilder({
  draft,
  brands,
  productTypes,
  step,
  onStepChange,
  onUpdate,
  matchingSource,
  sourceHost,
  isReady,
  isPending,
  formError,
  formMessage,
  onSubmit,
}: MissionFormProps & {
  step: number;
  onStepChange: (step: number) => void;
}) {
  const steps = [
    { label: "Source", icon: Link2 },
    { label: "Intent", icon: Sparkles },
    { label: "Constraints", icon: SlidersHorizontal },
    { label: "Review", icon: ClipboardList },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3 border border-border/70 bg-background p-4">
        {steps.map((item, index) => {
          const Icon = item.icon;
          const active = step === index;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onStepChange(index)}
              className={cn(
                "flex w-full items-center gap-3 border px-3 py-3 text-left transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-surface-container-lowest text-muted-foreground hover:border-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-widest">
                {item.label}
              </span>
            </button>
          );
        })}
      </aside>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-[460px] border border-border/70 bg-background p-4 sm:p-5">
          {step === 0 && (
            <SourceFields
              draft={draft}
              onUpdate={onUpdate}
              matchingSource={matchingSource}
              sourceHost={sourceHost}
            />
          )}
          {step === 1 && (
            <IntentFields
              draft={draft}
              brands={brands}
              productTypes={productTypes}
              onUpdate={onUpdate}
            />
          )}
          {step === 2 && <ConstraintFields draft={draft} onUpdate={onUpdate} />}
          {step === 3 && (
            <MissionSummary
              draft={draft}
              matchingSource={matchingSource}
              sourceHost={sourceHost}
            />
          )}
        </div>

        <RunPanel
          isReady={isReady}
          isPending={isPending}
          formError={formError}
          formMessage={formMessage}
          onSubmit={onSubmit}
        />
      </section>
    </div>
  );
}

type MissionFormProps = {
  draft: MissionDraft;
  brands: BrandCatalogOption[];
  productTypes: CatalogOption[];
  onUpdate: (field: keyof MissionDraft, value: string) => void;
  matchingSource: SourceWithProfile | undefined;
  sourceHost: string;
  isReady: boolean;
  isPending: boolean;
  formError: string | null;
  formMessage: string | null;
  onSubmit: () => void;
};

function SourceFields({
  draft,
  onUpdate,
  matchingSource,
  sourceHost,
}: Pick<MissionFormProps, "draft" | "onUpdate" | "matchingSource" | "sourceHost">) {
  return (
    <div className="space-y-4">
      <SectionTitle
        label="Source"
        title="Start with the album or shop URL"
        description="The scanner will inspect the seed URL, then derive adjacent category and album paths."
      />
      <Field label="Seed URL" required>
        <Input
          value={draft.seedUrl}
          onChange={(event) => onUpdate("seedUrl", event.target.value)}
          className="rounded-none"
          placeholder="https://west42.x.yupoo.com/categories"
        />
      </Field>
      <div className="border border-border/70 bg-surface-container-low p-3">
        <div className="flex items-start gap-3">
          <CircleDot className="mt-0.5 h-4 w-4 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {sourceHost || "Waiting for source"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {matchingSource
                ? `Known ${matchingSource.platform} source with ${(matchingSource.brands ?? []).length} brand annotations.`
                : "New source. The mission will create fresh evidence before matching suppliers."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntentFields({
  draft,
  brands,
  productTypes,
  onUpdate,
}: Pick<MissionFormProps, "draft" | "brands" | "productTypes" | "onUpdate">) {
  return (
    <div className="space-y-4">
      <SectionTitle
        label="Intent"
        title="Tell the scanner what a good lead looks like"
        description="Brand and product context keep scrape results aligned with buyer demand."
      />
      <Field label="Product intent" required>
        <Textarea
          value={draft.productIntent}
          onChange={(event) => onUpdate("productIntent", event.target.value)}
          className="min-h-24 rounded-none"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Brand focus"
          value={draft.selectedBrand}
          options={brands.map((brand) => brand.name)}
          onChange={(value) => onUpdate("selectedBrand", value)}
        />
        <SelectField
          label="Product type"
          value={draft.selectedProductType}
          options={productTypes.map((productType) => productType.name)}
          onChange={(value) => onUpdate("selectedProductType", value)}
        />
      </div>
    </div>
  );
}

function ConstraintFields({
  draft,
  onUpdate,
}: Pick<MissionFormProps, "draft" | "onUpdate">) {
  return (
    <div className="space-y-4">
      <SectionTitle
        label="Constraints"
        title="Make decision criteria explicit"
        description="Optional constraints become the review checklist after the scrape finishes."
      />
      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <Field label="Target ceiling">
          <Input
            value={draft.targetPrice}
            onChange={(event) => onUpdate("targetPrice", event.target.value)}
            className="rounded-none"
            inputMode="numeric"
          />
        </Field>
        <Field label="Required evidence">
          <Input
            value={draft.evidence}
            onChange={(event) => onUpdate("evidence", event.target.value)}
            className="rounded-none"
          />
        </Field>
      </div>
      <Field label="Destination context">
        <Textarea
          value={draft.destinationContext}
          onChange={(event) => onUpdate("destinationContext", event.target.value)}
          className="min-h-28 rounded-none"
        />
      </Field>
    </div>
  );
}

function MissionSummary({
  draft,
  matchingSource,
  sourceHost,
}: Pick<MissionFormProps, "draft" | "matchingSource" | "sourceHost">) {
  return (
    <section className="border border-border/70 bg-background p-4">
      <SectionTitle
        label="Preview"
        title="What will be scanned"
        description="Review the work package before queueing the mission."
      />
      <div className="mt-4 space-y-3">
        <SummaryRow label="Source" value={sourceHost || draft.seedUrl} />
        <SummaryRow label="Intent" value={draft.productIntent || "No intent set"} />
        <SummaryRow label="Buyer context" value={draft.destinationContext || "No context set"} />
        <SummaryRow label="Constraint" value={`Under $${draft.targetPrice || "n/a"} with ${draft.evidence || "standard evidence"}`} />
      </div>
      <div className="mt-4">
        <BrandTagGroup brands={[draft.selectedBrand, draft.selectedProductType].filter(Boolean)} />
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        {matchingSource
          ? "Known source evidence will be compared against fresh scrape output."
          : "This source will start as unverified until scrape evidence is available."}
      </p>
    </section>
  );
}

function RunPanel({
  isReady,
  isPending,
  formError,
  formMessage,
  onSubmit,
}: Pick<MissionFormProps, "isReady" | "isPending" | "formError" | "formMessage" | "onSubmit">) {
  return (
    <aside className="border border-border/70 bg-surface-container-low p-4">
      <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        Run controls
      </p>
      <h3 className="mt-2 text-lg font-heading text-foreground">
        Queue focused scrape
      </h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Required fields are the seed URL and product intent. Constraints remain editable after creation.
      </p>
      <div className="mt-4 space-y-2">
        <ReadinessRow ready={isReady} label="Required fields complete" />
        <ReadinessRow ready={true} label="Preview summary generated" />
        <ReadinessRow ready={true} label="Manual review path available" />
      </div>
      <Button
        type="button"
        disabled={!isReady || isPending}
        onClick={onSubmit}
        className="mt-5 h-10 w-full rounded-none text-[10px] uppercase tracking-widest"
      >
        <Play className="mr-2 h-3.5 w-3.5" />
        {isPending ? "Creating..." : "Create Mission"}
      </Button>
      <Link
        href="/workspace"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "mt-2 h-10 w-full rounded-none text-[10px] uppercase tracking-widest",
        )}
      >
        Back to Queue
      </Link>
      {formError ? <p className="mt-3 text-xs text-destructive">{formError}</p> : null}
      {formMessage ? <p className="mt-3 text-xs text-primary">{formMessage}</p> : null}
    </aside>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-none border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}

function SectionTitle({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <h2 className="mt-2 text-lg font-heading text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border/70 bg-surface-container-lowest p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm leading-5 text-foreground">{value}</p>
    </div>
  );
}

function ReadinessRow({ ready, label }: { ready: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2 className={cn("h-4 w-4", ready ? "text-primary" : "text-muted-foreground")} />
      <span className={ready ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function getHost(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}
