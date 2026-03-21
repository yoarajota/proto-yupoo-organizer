---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-20'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/implementation-readiness-report-2026-03-20.md
workflowType: 'architecture'
project_name: 'proto-yupoo-organizer'
user_name: 'Jota_'
date: '2026-03-20'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
35 FRs across 6 domains — Group/Auth (FR1–6), Supplier Management (FR7–13),
Product Management (FR14–18), Inquiry Tracking (FR19–25), Price History (FR26–27),
Source Library (FR28–32), Photo Similarity (FR33–35). All domains are
graph-connected through the Inquiry entity (Product × Supplier × Price × Status).
Partial implementation breaks the core product proposition.

**Non-Functional Requirements:**
- Performance: photo upload feedback <2s, list loads <1s, pHash comparison <3s,
  no UI freeze during multi-photo upload (NFR1–4)
- Security: RLS-enforced group isolation, HTTPS + at-rest encryption,
  auth-gated all pages, immediate revocation on member removal (NFR5–8)
- Reliability: no partial records on upload failure, explicit error states on
  downtime, photo files deleted only by explicit user action (NFR9–11)

**Scale & Complexity:**

- Primary domain: Full-stack SPA (Next.js + Supabase BaaS)
- Complexity level: Medium
- Estimated architectural components: ~10 (auth layer, RLS policies, 4 data
  domains, Storage integration, pHash pipeline, Next.js routing, edge functions)

### Technical Constraints & Dependencies

- **Stack is fixed:** Next.js (SPA mode) on Vercel, Supabase (Postgres + RLS +
  Auth + Storage). No technology selection needed.
- **No real-time:** Standard fetch-on-load only — no WebSocket or Supabase
  Realtime subscriptions at MVP.
- **pHash server-side:** Computed server-side or via Vercel Edge Function.
  Deterministic, no ML dependency.
- **Design system fixed:** Tailwind CSS v4 + shadcn/ui + Radix UI. No arbitrary
  Tailwind values — all tokens in `src/app/globals.css` via `@theme`. Atomic Design methodology.
- **Browser targets:** Chrome desktop primary, Mobile Safari read-only secondary.

### Cross-Cutting Concerns Identified

1. **Group RLS scoping** — every DB query must include group_id filter enforced
   by Supabase RLS policies. Affects all 35 FRs.
2. **Attribution metadata** — `created_by` + `created_at` on all records;
   surfaces throughout UI as trust signal.
3. **Photo storage lifecycle** — multi-upload, progress feedback, failure
   atomicity (no partial records), explicit-only deletion.
4. **pHash async pipeline** — triggered on photo upload, runs independently,
   surfaces advisory flags without blocking record creation.
5. **Optimistic UI updates** — status transitions and saves update immediately
   before API confirmation; requires error rollback path.
6. **Error-first reliability** — no silent failures anywhere; Supabase downtime
   must produce visible error state, not corrupt state.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack SPA — Next.js frontend + Supabase BaaS (Postgres + Auth + Storage).
Stack is pre-decided in PRD; this step locks initialization commands and options.

### Starter Options Considered

No evaluation needed — stack is fixed. Standard `create-next-app` with manual
Supabase + shadcn/ui layer-on is the correct path. No third-party full-stack
boilerplate (T3, etc.) — they add opinions that conflict with the pre-decided stack.

### Selected Starter: create-next-app + shadcn/ui + Supabase

**Rationale:** Minimal, composable setup. Each tool added explicitly with current
packages; no boilerplate lock-in. Matches the greenfield, small-team, pre-decided
stack context.

**Initialization Commands:**

```bash
# 1. Create Next.js app
npx create-next-app@latest proto-yupoo-organizer \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

# 2. Add shadcn/ui
npx shadcn@latest init

# 3. Add Supabase SSR client
npm install @supabase/supabase-js @supabase/ssr
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:** TypeScript strict mode — required by shadcn/ui and TS-enforced component props (`PhotoThumb` alt).

**Styling Solution:** Tailwind CSS v4 configured by create-next-app. shadcn/ui extends with CSS variables. All custom tokens added to `src/app/globals.css` via `@theme` — no arbitrary values. Note: `tailwind.config.ts` exists as a placeholder only; it is NOT the token source in v4.

**Build Tooling:** Next.js App Router + Turbopack dev server. Vercel deployment target — zero config (Next.js is at repo root).

**Testing Framework:** Not included — must be added separately (Vitest for unit; Playwright for e2e).

**Code Organization:** `src/` directory layout. App Router conventions: `src/app/` for routes, `src/components/` for Atomic Design hierarchy, `src/lib/` for Supabase client and utilities.

**Development Experience:** Hot reload via Turbopack, ESLint pre-configured, TypeScript strict, path aliases via `@/*`.

**Note:** Project initialization using these commands should be the first implementation story.

## Core Architectural Decisions

### Already Decided (Pre-locked)
- Framework: Next.js App Router, TypeScript strict
- Backend: Supabase (Postgres + RLS + Auth + Storage)
- Hosting: Vercel
- Styling: Tailwind CSS + shadcn/ui, Atomic Design, no arbitrary values
- No real-time: fetch-on-load only
- pHash: server-side, advisory-only

### Data Architecture
- **Validation:** Zod — shared schema for DB types, form validation, Server Action contracts
- **Data fetching:** Server Components for reads + Server Actions for mutations
- **Migrations:** Supabase CLI — SQL files in repo, version-controlled schema
- **No ORM:** Direct Supabase client (`@supabase/ssr`) — no Prisma abstraction over RLS

### Authentication & Security
- **Auth flow:** Email + password (Supabase Auth)
- **RLS:** Primary enforcement at DB layer (Supabase RLS policies). Next.js middleware validates session; data isolation guaranteed by RLS, not application code.
- **Group scoping:** `group_id` FK on all tables, enforced by RLS — never filtered in application code alone

### API & Communication
- **Mutations:** Server Actions for all CRUD operations
- **pHash pipeline:** Single Vercel API Route (serverless function) — triggered after photo upload completes
- **No separate API layer:** No REST or GraphQL API — Server Actions are the interface between client and DB

### Frontend Architecture
- **State management:** None at MVP. Supabase client context for auth, `useState` for UI state. Add Zustand if cross-component filter persistence is needed.
- **Forms:** React Hook Form + Zod — integrated with shadcn/ui Form components
- **Routing:** Next.js App Router file-based routing. Route groups for auth vs app layouts.

### Infrastructure & Deployment
- **pHash location:** Vercel Serverless API Route (`/api/phash`) — no bundle size constraints, straightforward integration
- **CI/CD:** Vercel Preview Deployments (automatic). GitHub Actions added when test gate is needed.
- **Testing:** Vitest (unit/integration) + Playwright (e2e) — not in starter, added in first implementation stories
- **Local development:** Supabase self-hosted (via `supabase start`) — full local stack including Postgres, Auth, Storage, and Edge Functions. No shared dev/staging Supabase project needed. `supabase/migrations/` run against the local instance; `supabase gen types` targets local.

### Decision Impact Analysis
**Implementation sequence driven by dependencies:**
1. Supabase schema + RLS policies (everything depends on this)
2. Auth flow + group creation (gates all other data)
3. Tailwind token system + AppShell (gates all UI work)
4. Atomic Design atoms → molecules → organisms (bottom-up)
5. Server Actions per domain (Suppliers → Products → Inquiries → Sources)
6. pHash API Route (can be added last, deferred to Phase 2 if needed)

**Cross-component dependencies:**
- RLS group_id scoping affects every Supabase query
- Zod schemas shared between Server Actions and React Hook Form
- AppShell is a dependency for every page component

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case` plural — `suppliers`, `products`, `inquiries`, `price_quotes`, `sources`, `groups`, `group_members`, `photo_hashes`
- Columns: `snake_case` — `group_id`, `created_by`, `yupoo_url`, `whatsapp_contact`
- Foreign keys: `{table_singular}_id` — `supplier_id`, `product_id`, `group_id`
- Timestamps: always `created_at` + `updated_at` on every table — never omitted
- Booleans: `is_` prefix — `is_active`, `is_flagged` (never bare `active`, `flagged`)

**Code Naming Conventions:**
- Components: `PascalCase` — `SupplierRow`, `PhotoThumb`, `StatusDropdown`
- Component files: `PascalCase.tsx` — `SupplierRow.tsx`, `PhotoThumb.tsx`
- Server Actions: `camelCase` verb-noun — `createSupplier`, `updateInquiryStatus`, `deleteSource`
- Zod schemas: `PascalCase` + `Schema` suffix — `SupplierSchema`, `InquirySchema`
- DB query helpers: `camelCase` verb-noun — `getSuppliersByGroup`, `getInquiriesByProduct`
- Route segments: `kebab-case` — `/suppliers/[id]`, `/active-inquiries`

### Structure Patterns

**Component organization by Atomic Design level:**
```
src/components/
  atoms/        # Button, Badge, PhotoThumb, AttributionLine, PriceRange, etc.
  molecules/    # StatusDropdown, InquiryMeta, MarketOverviewCallout, etc.
  organisms/    # InquiryRow, SupplierRow, ProductCard, SideNav, TopBar, etc.
  templates/    # AppShell, ListTemplate, DetailTemplate, GalleryTemplate
```

**Server Actions location:**
```
src/actions/
  suppliers.ts   # createSupplier, updateSupplier, deleteSupplier
  products.ts    # createProduct, addProductPhoto, deleteProduct
  inquiries.ts   # createInquiry, updateInquiryStatus, updateInquiryPrice
  sources.ts     # createSource, toggleSourceActive, deleteSource
  groups.ts      # createGroup, inviteMember, removeMember
```
Each file exports named async functions — no default exports.

**Supabase client (never instantiate inline):**
- `src/lib/supabase/server.ts` — server-side client (Server Components + Actions)
- `src/lib/supabase/client.ts` — browser client (Client Components only)

**RUNTIME DEVIATIONS (discovered in Story 1.1 — all agents must follow):**

- **Next.js 16 async cookies:** `cookies()` from `next/headers` returns a `Promise` in Next.js 16. `createClient()` in `server.ts` MUST be `async` and `await cookies()`. Using it synchronously will throw at runtime.
  ```ts
  export async function createClient() {
    const cookieStore = await cookies();
    return createServerClient<Database>(...)
  }
  ```
- **Supabase CLI v2 key format:** Supabase CLI v2.83.0+ uses Publishable/Secret key format — NOT the legacy JWT `anon`/`service_role` keys. `.env.local` values come from `supabase start` output using the new format. Key names remain `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` but the values look different from older docs.
- **Tailwind v4 — no `tailwind.config.ts` for tokens:** `create-next-app` installs Tailwind CSS v4. A placeholder `tailwind.config.ts` was created but is NOT the token source. All design tokens go in `src/app/globals.css` using `@theme` and `@theme inline` directives.
- **Next.js version:** Project runs Next.js 16.2.1. APIs and file conventions may differ from training data. Check `node_modules/next/dist/docs/` before using unfamiliar APIs.

**Zod schemas:**
```
src/lib/schemas/
  supplier.ts / product.ts / inquiry.ts / source.ts / group.ts
```

**Tests co-located:**
- `SupplierRow.test.tsx` next to `SupplierRow.tsx`
- `suppliers.test.ts` next to `suppliers.ts`
- E2e: `e2e/` at project root

### Format Patterns

**Server Action return shape — consistent across all actions:**
```ts
// Success: { data: T, error: null }
// Failure: { data: null, error: { message: string, code?: string } }
// NEVER throw from a Server Action
```

**Supabase query pattern:**
```ts
const { data, error } = await supabase.from('suppliers').select('*')
if (error) return { data: null, error: { message: error.message } }
return { data, error: null }
```

**Date handling:**
- Store: `timestamptz` in Postgres (ISO 8601)
- Display: `Intl.DateTimeFormat` in component — never raw ISO string in UI
- Default values: Supabase `now()` default — never `new Date()` in Server Actions

**JSON field naming:** `snake_case` matching DB columns — no camelCase transformation at MVP

### Process Patterns

**Loading states:**
- `useTransition` for Server Action calls — `isPending` drives skeleton/spinner
- `Skeleton` mirrors real content height — no layout shift
- Never disable the full form — only the submit button

**Optimistic updates:** Apply to `StatusDropdown` transitions only. Never optimistic on create/delete.

**Upload atomicity (NFR9 — critical):**
1. Upload photo to Supabase Storage
2. Only write `photo_hashes` DB record after storage confirms success
3. Storage failure → no DB record, error surfaced to user
4. DB failure after storage → delete the uploaded file, surface error

**Error handling:** Never swallow errors silently. Every failure path shows UI feedback.

**Form validation:** `mode: 'onBlur'` in React Hook Form — field-level on blur, final gate on submit.

### All AI Agents MUST:
1. Use `snake_case` for all DB columns and files in `src/actions/` and `src/lib/schemas/`
2. Return `{ data, error }` from every Server Action — never throw
3. Instantiate Supabase client only from `src/lib/supabase/server.ts` or `client.ts`
4. Place components in the correct Atomic Design directory — never skip levels
5. Never use arbitrary Tailwind values — all values must reference named tokens defined in `src/app/globals.css` via `@theme` (Tailwind v4; `tailwind.config.ts` is a placeholder only)
6. Never create partial DB records — storage upload must complete before any DB write
7. Always show an error state on failure — never swallow errors silently

## Project Structure & Boundaries

### Complete Project Directory Structure

```
proto-yupoo-organizer/              # repo root = Next.js root
├── _bmad/                          # BMAD configuration
├── _bmad-output/                   # planning artifacts + story files
│   ├── planning-artifacts/
│   └── implementation-artifacts/
├── docs/
├── README.md
├── package.json                    # all dependencies incl. supabase CLI devDep
├── next.config.ts
├── tailwind.config.ts              # PLACEHOLDER ONLY — tokens live in src/app/globals.css
├── tsconfig.json
├── components.json                 # shadcn/ui config
├── .env.local                      # Supabase URL + anon key (never committed)
├── .env.example                    # Template with key names, empty values
├── .gitignore
│
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 001_groups.sql
│       ├── 002_suppliers.sql
│       ├── 003_products.sql
│       ├── 004_photo_hashes.sql
│       ├── 005_inquiries.sql
│       ├── 006_sources.sql
│       └── 007_rls_policies.sql
│
├── e2e/                            # Playwright end-to-end tests
│   ├── context-recovery.spec.ts
│   ├── research-session.spec.ts
│   └── auth.spec.ts
│
├── public/
│   └── favicon.ico
│
└── src/
    ├── middleware.ts                # Supabase session validation on every request
    │
    ├── app/
    │   ├── globals.css              # Tailwind v4 @theme tokens live here
    │   ├── layout.tsx
    │   ├── api/
    │   │   └── phash/
    │   │       └── route.ts        # FR33–35: pHash computation endpoint
    │   ├── (auth)/
    │   │   ├── login/
    │   │   │   └── page.tsx
    │   │   └── layout.tsx
    │   └── (app)/
    │       ├── layout.tsx          # AppShell wrapper
    │       ├── active-inquiries/
    │       │   └── page.tsx        # FR19–25: default landing
    │       ├── suppliers/
    │       │   ├── page.tsx        # FR7–13: suppliers directory
    │       │   └── [id]/
    │       │       └── page.tsx
    │       ├── products/
    │       │   ├── page.tsx        # FR14–18: products gallery
    │       │   └── [id]/
    │       │       └── page.tsx    # FR26–27: price history surface
    │       ├── sources/
    │       │   └── page.tsx        # FR28–32: source library
    │       └── settings/
    │           └── page.tsx        # FR1–6: group management
    │
    ├── actions/
    │   ├── suppliers.ts + suppliers.test.ts
    │   ├── products.ts + products.test.ts
    │   ├── inquiries.ts + inquiries.test.ts
    │   ├── sources.ts + sources.test.ts
    │   └── groups.ts + groups.test.ts
    │
    ├── components/
    │   ├── atoms/
    │   │   ├── Button.tsx, Input.tsx, Textarea.tsx, Badge.tsx, Label.tsx
    │   │   ├── Avatar.tsx, Switch.tsx, Icon.tsx, Skeleton.tsx
    │   │   ├── BrandTagChip.tsx, PriceRange.tsx, AttributionLine.tsx
    │   │   ├── PhotoThumb.tsx, RedFlagIcon.tsx
    │   ├── molecules/
    │   │   ├── StatusDropdown.tsx, BrandTagGroup.tsx, SearchField.tsx
    │   │   ├── InquiryMeta.tsx, SupplierLink.tsx, NegotiationElasticity.tsx
    │   │   ├── SimilarityAdvisoryBanner.tsx, MarketOverviewCallout.tsx
    │   │   └── FileUploadInput.tsx
    │   ├── organisms/
    │   │   ├── InquiryRow.tsx, InquiryTable.tsx
    │   │   ├── SupplierRow.tsx, SupplierDirectory.tsx
    │   │   ├── ProductCard.tsx, ProductPhotoStrip.tsx
    │   │   ├── TrustIntelligencePanel.tsx, PhotoUploadZone.tsx
    │   │   └── SideNav.tsx, TopBar.tsx
    │   └── templates/
    │       ├── AppShell.tsx, ListTemplate.tsx
    │       ├── DetailTemplate.tsx, GalleryTemplate.tsx
    │
    ├── lib/
    │   ├── supabase/
    │   │   ├── server.ts           # createServerClient (async — see note below)
    │   │   └── client.ts           # createBrowserClient
    │   ├── schemas/
    │   │   ├── supplier.ts, product.ts, inquiry.ts, source.ts, group.ts
    │   └── utils/
    │       ├── date.ts, price.ts, cn.ts
    │
    └── types/
        └── database.ts             # Generated by: supabase gen types typescript
```

### Architectural Boundaries

**API Boundary:** `src/app/api/phash/route.ts` is the only HTTP endpoint. All other data operations use Server Actions (no HTTP boundary).

**Auth Boundary:** `src/middleware.ts` gates the `(app)` route group. `(auth)` routes are public. Session validated on every request.

**Data Boundary:** All DB access via `src/lib/supabase/server.ts` in Server Components/Actions. `src/types/database.ts` is the single source of DB types (never hand-edited). RLS policies are authoritative for data isolation.

**Component Boundary:** Atoms/molecules are props-only, no data fetching. Organisms hold local state. Pages fetch data as Server Components, pass to organisms as props.

### Requirements to Structure Mapping

| FR Domain | Location |
|---|---|
| FR1–6 Group/Auth | `src/actions/groups.ts` + `src/app/(app)/settings/` + migrations 001 + 007 |
| FR7–13 Suppliers | `src/actions/suppliers.ts` + `src/app/(app)/suppliers/` + migration 002 |
| FR14–18 Products | `src/actions/products.ts` + `src/app/(app)/products/` + migration 003 |
| FR19–25 Inquiries | `src/actions/inquiries.ts` + `src/app/(app)/active-inquiries/` + `products/[id]/` + migration 005 |
| FR26–27 Price History | `src/app/(app)/products/[id]/page.tsx` via `MarketOverviewCallout` |
| FR28–32 Sources | `src/actions/sources.ts` + `src/app/(app)/sources/` + migration 006 |
| FR33–35 pHash | `src/app/api/phash/route.ts` + migration 004 + `SimilarityAdvisoryBanner` |

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices are compatible. Next.js App Router + `@supabase/ssr` is the current recommended pairing. Tailwind + shadcn/ui has no conflicts. Zod works with React Hook Form and Server Actions. Vercel serverless functions suffice for pHash — Edge Runtime not required. No version conflicts identified.

**Pattern Consistency:** `snake_case` DB naming is consistent with Supabase Postgres conventions. `PascalCase` component naming is consistent with React/TypeScript. Server Action return shape `{ data, error }` is consistent across all 5 action files. Upload atomicity pattern directly satisfies NFR9.

**Structure Alignment:** Route groups `(auth)` / `(app)` cleanly separate the auth boundary. Atomic Design directory levels map 1:1 to UX spec component inventory. `supabase/migrations/` supports CLI-based version-controlled schema. Every directory has a mapped requirement.

### Requirements Coverage Validation ✅

**Functional Requirements: 35/35 covered**
- FR1–6 (Auth/Group): `groups.ts` + settings page + RLS migration ✅
- FR7–13 (Suppliers): `suppliers.ts` + suppliers pages + `SupplierDirectory` ✅
- FR14–18 (Products): `products.ts` + `PhotoUploadZone` + gallery + pHash pipeline ✅
- FR19–25 (Inquiries): `inquiries.ts` + active-inquiries + `InquiryTable` on product detail ✅
- FR26–27 (Price History): `MarketOverviewCallout` on product detail page ✅
- FR28–32 (Sources): `sources.ts` + sources page ✅
- FR33–35 (pHash): `/api/phash` + `photo_hashes` migration + `SimilarityAdvisoryBanner` ✅

**Non-Functional Requirements: 11/11 covered**
- NFR1–4 (Performance): Server Components eliminate client-side data waterfalls; pHash on serverless is non-blocking ✅
- NFR5–8 (Security): RLS policies in dedicated migration; middleware session guard; member removal revokes via Supabase Auth ✅
- NFR9–11 (Reliability): Upload atomicity pattern (storage-first, DB-second); `{ data, error }` return shape (never silent); explicit-only Storage deletion ✅

### Gap Analysis Results

**Critical gaps:** None.

**Pre-implementation actions required:**
1. Define Tailwind token inventory in `src/app/globals.css` via `@theme` — must exist before any atom is built (Tailwind v4; NOT `tailwind.config.ts`)
2. Configure Supabase Storage bucket (name, public/private, file size limit) — must exist before `PhotoUploadZone`
3. Add `db:types` npm script: `supabase gen types typescript --local > src/types/database.ts`

### Architecture Completeness Checklist

- [x] Project context analyzed (35 FRs, 11 NFRs, 6 data domains)
- [x] Technical constraints identified (pre-decided stack, no real-time)
- [x] Cross-cutting concerns mapped (RLS, attribution, upload atomicity, pHash, optimistic updates, error-first)
- [x] Critical decisions documented with rationale
- [x] Naming conventions established for DB, code, routes
- [x] Process patterns documented (upload atomicity, error shape, optimistic updates)
- [x] 7 mandatory rules for AI agents
- [x] Complete directory tree with all 35 FRs mapped to files
- [x] Architectural boundaries defined (API, auth, data, component)

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**
**Confidence Level: High**

**Key Strengths:**
- Stack entirely pre-decided — no technology ambiguity for agents
- Every FR has a named file destination
- Upload atomicity and RLS are explicitly specified — the two highest-risk NFRs
- UX component inventory maps 1:1 to Atomic Design directory structure
- pHash is architecturally contained and safely deferrable to Phase 2

### Implementation Handoff

**First implementation priority:**
```bash
npx create-next-app@latest proto-yupoo-organizer \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npx shadcn@latest init
npm install @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers
```
Then: define Tailwind tokens → Supabase migrations + RLS → AppShell → atoms → feature organisms → wire to data.
