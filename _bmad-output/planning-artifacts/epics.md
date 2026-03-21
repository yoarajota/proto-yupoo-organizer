---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
status: complete
completedAt: '2026-03-20'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# proto-yupoo-organizer - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for proto-yupoo-organizer, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: ~~Admin can create a group and become its owner~~ — REMOVED
FR2: Admin can invite users to the system via email
FR3: Admin can deactivate a user account (revokes access immediately)
FR4: Authenticated users can log in and access all shared data
FR5: Data created by any user persists even if that user is deactivated
FR6: Admin can delete any record in the system; a user can delete records they created
FR7: Members can create a supplier card with name, Yupoo shop URL, and WhatsApp contact
FR8: Members can tag a supplier with one or more brands they carry
FR9: Members can add free-text trust notes to a supplier card
FR10: Members can flag a supplier with a red flag and attach a source link (e.g. scam report URL)
FR11: Members can record negotiation elasticity data on a supplier (opening price vs. final price)
FR12: Members can view all suppliers in the group with their full details
FR13: Members can filter/search suppliers by brand
FR14: Members can create a product card by uploading one or more photos
FR15: Members can add additional photos to an existing product card
FR16: Members can add optional free-text notes to a product card
FR17: Members can view a product card with all its photos, linked suppliers, and inquiry history
FR18: System flags when uploaded photos match photos already in the group's product library (advisory similarity signal)
FR19: Members can create an inquiry linking a product to a supplier
FR20: Members can set and update the status of an inquiry (Sent / Price Received / Negotiating / Decided / Ghosted)
FR21: Members can record a price on an inquiry
FR22: Members can add notes to an inquiry
FR23: Members can view all inquiries for a product across all suppliers
FR24: Members can view all inquiries for a supplier across all products
FR25: Members can view their own active inquiries (in-progress statuses)
FR26: Members can view the full price history for a product across all suppliers and all group members
FR27: Price history displays who logged the price and when
FR28: Members can save a source (URL) with a platform tag (Reddit / Discord / WhatsApp / Other)
FR29: Members can tag a source with one or more brand names
FR30: Members can add free-text notes to a source
FR31: Members can view and filter saved sources by brand or platform
FR32: Members can mark a source as no longer active/relevant
FR33: System computes a perceptual hash for each uploaded photo
FR34: When a photo is uploaded, system checks it against existing photo hashes in the group library
FR35: System surfaces matches as an advisory flag — "similar photos found in [Supplier X]" — without merging records automatically

### NonFunctional Requirements

NFR1: Photo upload progress feedback appears within 2 seconds of initiating upload on desktop Chrome
NFR2: Inquiry list and supplier list load within 1 second on a standard desktop connection
NFR3: pHash comparison completes within 3 seconds of photo upload completion
NFR4: App remains responsive during multi-photo uploads (no UI freeze)
NFR5: All data is accessible to any authenticated user — RLS enforces auth-gated access; delete/update restricted to creator or admin
NFR6: All data is encrypted in transit (HTTPS) and at rest (Supabase default)
NFR7: Authentication is required to access any app data — no public endpoints expose group data
NFR8: Removed members lose access to all group data immediately upon removal
NFR9: Failed uploads must not create partial records — no data loss on upload failure
NFR10: App displays an error state on Supabase downtime rather than silently failing or corrupting data
NFR11: Photo files in Supabase Storage are deleted only by explicit deletion actions — not on product card edits

### Additional Requirements

- **Starter Template (Epic 1, Story 1):** `create-next-app` + shadcn/ui + Supabase SSR is the required initialization path — no boilerplate beyond this. First story must run these init commands.
- **Supabase CLI migrations:** 7 SQL migration files required in `supabase/migrations/`: 001_profiles, 002_suppliers, 003_products, 004_photo_hashes, 005_inquiries, 006_sources, 007_rls_policies.
- **RLS as primary data isolation:** Auth-gated read access (`auth.uid() IS NOT NULL`); creator-or-admin delete/update — enforced by RLS policies, never in application code alone. No `group_id` concept.
- **`db:types` npm script:** `supabase gen types typescript --local > src/types/database.ts` must exist before any feature code is written.
- **Tailwind token inventory:** Must be fully defined in `tailwind.config.ts` before any atom component is built.
- **Supabase Storage bucket configuration:** Bucket name, public/private setting, and file size limit must be established before PhotoUploadZone is implemented.
- **Upload atomicity pattern (NFR9):** Storage-first, DB-second. On DB failure after storage success → delete uploaded file. No partial records permissible.
- **Server Action return shape:** Always `{ data: T, error: null }` on success or `{ data: null, error: { message: string, code?: string } }` on failure. Never throw from a Server Action.
- **pHash API Route:** Vercel Serverless API Route at `/api/phash` — triggered after photo upload completes; non-blocking to record creation.
- **Testing setup:** Vitest (unit/integration) + Playwright (e2e) — not included in starter, must be added as a setup story.
- **Middleware:** `src/middleware.ts` — session validation on every request, gates `(app)` route group; `(auth)` routes are public.
- **Local dev stack:** `supabase start` for full local Postgres + Auth + Storage + Edge Functions — no shared dev/staging instance.

### UX Design Requirements

UX-DR1: Define Tailwind design token groups before first component — `fontSize` (label-xs 10px, label-sm 11px, label-md 12px, body-sm 13px, body-md 14px), `spacing`/`width` (sidebar 240px, thumb-sm 48px, thumb-md 64px), `borderRadius`, semantic `colors` (surface-container-low #eff4ff, surface-container-lowest #ffffff, surface-container-high #dce9ff, error #ba1a1a), `letterSpacing` (widest for uppercase labels), `gridTemplateColumns` (gallery, inquiry)
UX-DR2: Implement `AppShell` template: fixed SideNav (240px) + fixed TopBar (glassmorphism bg-white/80 backdrop-blur-md) + scrollable main content; max-w-5xl content constraint; responsive switch managed exclusively in AppShell
UX-DR3: Implement `SideNav` organism: active state via border-l-4 border-primary pill + bold text (no background fill); collapses to icon-only strip (64px) at md breakpoint; bottom tab bar with 4 tabs (Inquiries, Suppliers, Products, Sources) at sm breakpoint
UX-DR4: Implement `StatusDropdown` molecule: status badge opens transition picker on click; optimistic update (badge changes before API confirms); aria-live="polite" for screen reader; arrow key navigation via Radix DropdownMenu
UX-DR5: Implement inquiry status badge color system tokens: Sent (zinc-100 bg / zinc-600 text), Price Received (blue-50 / blue-700), Negotiating (amber-50 / amber-700), Decided (green-50 / green-700), Ghosted (zinc-50 / zinc-400)
UX-DR6: Implement `PhotoUploadZone` organism: drag-drop area prominent with multi-file upload in one gesture; per-file progress bar inside zone; no UI freeze during upload (async, non-blocking); `SimilarityAdvisoryBanner` integrated on match detection
UX-DR7: Implement `MarketOverviewCallout` molecule: displays price range with quote count and decisions/negotiating tally; shown prominently on Product Detail above the inquiry table; role="region" ARIA
UX-DR8: Implement `SimilarityAdvisoryBanner` molecule: dismissable, non-blocking advisory banner; role="alert" for accessibility; links to matched supplier; never auto-merges records
UX-DR9: Implement `AttributionLine` atom: "added by [user], [relative time]" — label-xs / text-[10px] text-outline — present on all inquiry rows, prices, and notes; attribution shown everywhere
UX-DR10: Implement `TrustIntelligencePanel` organism: right-column panel on Supplier Detail; free-text trust notes (Textarea), red flag toggle with source link field, and `NegotiationElasticity` display
UX-DR11: Implement `ProductPhotoStrip` organism: horizontal scrollable photo strip at top of Product Detail; photo lightbox (Dialog) on click with full-size image + prev/next navigation
UX-DR12: Implement responsive Mobile Safari layout: bottom tab bar at sm breakpoint; creation flow CTAs replaced with "Use desktop to add" prompt; list views single-column; detail views stacked (no two-column split); all read/lookup surfaces fully functional
UX-DR13: Implement `BrandTagChip` atom (display / filter / removable variants) and `BrandTagGroup` molecule; active filter chip filled, inactive outlined; filter takes effect immediately (no Apply button)
UX-DR14: Implement color system: Background zinc-50, Surface white, Border zinc-200, Muted text zinc-500, Body text zinc-900, Accent blue-600; Red flag error red-500; all colors as named semantic tokens in tailwind.config — no raw hex in components
UX-DR15: Implement empty state patterns per spec: first group login → primary CTA to add first supplier; filtered list returns nothing → "No results for [filter]" + "Clear filters" link; product with no inquiries → "No inquiries yet — add one" with Button
UX-DR16: Implement Sheet (side panel) for all create/edit forms (keeps list context visible); Dialog (centered) for destructive confirmations only; detail views always dedicated pages — never modal
UX-DR17: Implement `PhotoThumb` atom: square image with rounded corners, broken-state fallback, `alt` prop required (TypeScript enforced), minimum 44×44px touch target at sm breakpoint
UX-DR18: Implement `PriceRange` atom: "R$45–R$62" formatted display, font-semibold text-primary, right-aligned on list rows
UX-DR19: Implement `NegotiationElasticity` molecule: Opening price → Final price with directional arrow + % average label
UX-DR20: Implement `InquiryRow` organism and `InquiryTable` organism: grid-cols-[64px_2fr_1.5fr_1fr_1fr_120px] layout; PhotoThumb + supplier name + ref code as two-line cell; status badge inline; AttributionLine in label-xs; no row borders

### FR Coverage Map

FR1: REMOVED
FR2: Epic 1 — Admin invites users to the system
FR3: Epic 1 — Admin deactivates user account
FR4: Epic 1 — Authenticated users log in and access all shared data
FR5: Epic 1 — Data persists when user deactivated
FR6: Epic 1 — Creator-or-admin delete enforcement (RLS)
FR7: Epic 2 — Create supplier card
FR8: Epic 2 — Tag supplier with brands
FR9: Epic 2 — Free-text trust notes
FR10: Epic 2 — Red flag with source link
FR11: Epic 2 — Negotiation elasticity data
FR12: Epic 2 — View all suppliers with full details
FR13: Epic 2 — Filter/search suppliers by brand
FR14: Epic 3 — Create product card via photo upload
FR15: Epic 3 — Add photos to existing product
FR16: Epic 3 — Free-text notes on product card
FR17: Epic 3 — View product card with photos + inquiry history
FR18: Epic 6 — Advisory flag for similar photos (pHash)
FR19: Epic 4 — Create inquiry linking product to supplier
FR20: Epic 4 — Set and update inquiry status
FR21: Epic 4 — Record price on inquiry
FR22: Epic 4 — Add notes to inquiry
FR23: Epic 4 — View all inquiries for a product
FR24: Epic 4 — View all inquiries for a supplier
FR25: Epic 4 — View own active inquiries
FR26: Epic 4 — View full price history for a product
FR27: Epic 4 — Attribution on price history entries
FR28: Epic 5 — Save source with platform tag
FR29: Epic 5 — Tag source with brand names
FR30: Epic 5 — Free-text notes on source
FR31: Epic 5 — View and filter sources by brand/platform
FR32: Epic 5 — Mark source as inactive/irrelevant
FR33: Epic 6 — Compute pHash per uploaded photo
FR34: Epic 6 — Check new photo against existing hashes
FR35: Epic 6 — Surface advisory match flag

## Epic List

### Epic 1: Project Foundation, Auth & Design System
Users can register, log in, and access the fully styled app shell. Admin can invite and manage users. Any authenticated user immediately sees all shared data.
**FRs covered:** FR2, FR3, FR4, FR5, FR6
**Also covers:** Project initialization (create-next-app + shadcn/ui + Supabase SSR), Supabase migrations + RLS policies (auth-gated + creator-or-admin), Tailwind design tokens, AppShell + SideNav, session middleware, testing setup (Vitest + Playwright), mobile responsive layout

### Epic 2: Supplier Directory & Trust Intelligence
Users can build and browse a shared supplier directory with Yupoo URLs, WhatsApp contacts, brand tags, trust notes, red flags, and negotiation elasticity data. The group's supplier knowledge is immediately available to every member.
**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12, FR13

### Epic 3: Photo-First Product Catalog
Users can create product cards by uploading photos (no product name required), add photos to existing cards, browse the product gallery visually, and view a product's full photo strip with linked supplier history.
**FRs covered:** FR14, FR15, FR16, FR17

### Epic 4: Inquiry Tracking & Context Recovery
Users can track all active inquiries, update negotiation status deliberately, log prices, and recover full context (product photos + competing quotes + supplier trust notes) in under 10 seconds. Shared price history is visible to the whole group.
**FRs covered:** FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27

### Epic 5: Source Library
Users can save research sources (Reddit, Discord, WhatsApp links) with brand tags and platform labels so future research sessions start from accumulated group knowledge rather than a fresh search.
**FRs covered:** FR28, FR29, FR30, FR31, FR32

### Epic 6: Photo Similarity Detection
The app automatically flags when a new supplier's photos match existing product photos — surfacing potential same-factory suppliers as an advisory signal, without auto-merging any records. Safely deferrable to Phase 2 per PRD risk mitigation.
**FRs covered:** FR18, FR33, FR34, FR35

---

## Epic 1: Project Foundation, Auth & Design System

Users can register, log in, and access the fully styled app shell. Group admins can invite and manage members. A new member logs in and immediately sees the group's shared data with no setup required.

### Story 1.1: Project Initialization & Development Environment

As a developer,
I want to scaffold the Next.js + shadcn/ui + Supabase project with testing tools configured,
So that the team has a working foundation before any feature work begins.

**Acceptance Criteria:**

**Given** the project repo is initialized,
**When** `npm run dev` is executed,
**Then** the Next.js app loads at localhost:3000 without errors.

**Given** the development environment,
**When** `supabase start` is executed,
**Then** the local Supabase stack (Postgres, Auth, Storage) is running.

**Given** the project,
**When** setup is complete,
**Then** `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `react-hook-form`, `@hookform/resolvers` are installed; Vitest and Playwright are configured with placeholder tests; `.env.example` has all key names with empty values; `.env.local` is gitignored; path alias `@/*` resolves to `src/`.

### Story 1.2: Design System Tokens & AppShell

As a user,
I want to see a professionally styled app shell with a fixed sidebar, top bar, and responsive layout,
So that I can navigate the app confidently on desktop and read data on mobile.

**Acceptance Criteria:**

**Given** a desktop viewport (≥1024px),
**When** the app loads,
**Then** I see a fixed 240px SideNav on the left, a fixed glassmorphism TopBar (`bg-white/80 backdrop-blur-md`), and a scrollable main content area with `max-w-5xl` constraint.

**Given** the SideNav,
**When** I navigate to a section,
**Then** the active item shows `border-l-4 border-primary` + bold text — no background fill.

**Given** a viewport ≤768px (Mobile Safari),
**When** the app loads,
**Then** SideNav is replaced by a bottom tab bar with 4 tabs: Inquiries, Suppliers, Products, Sources.

**Given** a viewport 768–1023px,
**When** the app loads,
**Then** SideNav collapses to a 64px icon-only strip.

**Given** any component using a design value,
**When** it is rendered,
**Then** all `fontSize`, `spacing`/`width`, `borderRadius`, `colors`, and `letterSpacing` values reference named tokens in `tailwind.config.ts` — no arbitrary bracket values exist anywhere.

### Story 1.3: Authentication & User Schema

As a user,
I want to register with email and password and log in to the app,
So that I can access the shared workspace securely.

**Acceptance Criteria:**

**Given** I am not authenticated,
**When** I navigate to any app route,
**Then** `src/proxy.ts` (Next.js 16 middleware) redirects me to `/login`.

**Given** the login page,
**When** I submit valid credentials,
**Then** I am authenticated via Supabase Auth and redirected to `/active-inquiries`.

**Given** the login page,
**When** I submit invalid credentials,
**Then** an inline error is shown; no redirect occurs.

**Given** the database migrations run,
**When** I inspect the schema,
**Then** a `profiles` table exists with: `id UUID` (FK → `auth.users`), `role` (enum: `admin`/`member`), `is_active boolean DEFAULT true`, `invited_by UUID NULLABLE`, `created_at`, `updated_at`; `supabase gen types typescript --local > src/types/database.ts` runs as the `db:types` npm script.

**Given** a deactivated user's session token,
**When** they attempt to access any app route,
**Then** they are denied and redirected to `/login` immediately (NFR8).

### Story 1.4: User Management (Admin)

As an admin,
I want to invite new users to the system and deactivate users who leave,
So that only trusted people have access to the shared workspace.

**Acceptance Criteria:**

**Given** I am the first authenticated user,
**When** I land on any `(app)` route,
**Then** `ensureProfile()` creates my `profiles` row with `role = 'admin'` (FR2 prerequisite).

**Given** I am an admin on the Settings page,
**When** I enter a user's email and click Invite,
**Then** an invitation email is sent via Supabase Auth `inviteUserByEmail`; a `profiles` row is created with `role = 'member'` and `is_active = true` (FR2).

**Given** I am an admin,
**When** I deactivate a user,
**Then** `profiles.is_active` is set to false; their session is revoked immediately (FR3, NFR8).

**Given** any authenticated user,
**When** they access the app,
**Then** they see all shared data — RLS enforces auth-gated access at the DB layer (FR4, NFR5).

**Given** a deactivated user's records (suppliers, products they created),
**When** viewed by remaining users,
**Then** all records remain intact and visible (FR5).

**Given** I am an admin on the Settings / Users page,
**When** it loads,
**Then** I see all users with role, active status, and Deactivate/Reactivate action (own row has no action).

---

## Epic 2: Supplier Directory & Trust Intelligence

Users can build and browse a shared supplier directory with Yupoo URLs, WhatsApp contacts, brand tags, trust notes, red flags, and negotiation elasticity data. The group's supplier knowledge is immediately available to every member.

### Story 2.1: Create & Edit Supplier

As a group member,
I want to create a supplier card with name, Yupoo URL, WhatsApp, and brand tags,
So that the group can start building its shared supplier directory.

**Acceptance Criteria:**

**Given** the Suppliers page,
**When** I click "Add Supplier",
**Then** a Sheet (side panel) opens with a form — only name, Yupoo URL, and WhatsApp are required; brand tags are optional (FR7, FR8).

**Given** the form,
**When** I submit valid data,
**Then** `createSupplier` Server Action runs; Sheet closes; supplier appears in the directory.

**Given** the form,
**When** I leave a required field empty and blur,
**Then** an inline validation error appears on that field; the form cannot submit.

**Given** the `suppliers` migration,
**When** it runs,
**Then** the table includes: `id`, `name`, `yupoo_url`, `whatsapp_contact`, `brands` (text[]), `trust_notes`, `is_flagged`, `red_flag_source`, `negotiation_opening_price`, `negotiation_final_price`, `created_by`, `created_at`, `updated_at`. RLS policies (from 007_rls_policies.sql pattern): auth-gated SELECT/INSERT; creator-or-admin UPDATE/DELETE.

**Given** an existing supplier,
**When** I click Edit,
**Then** the Sheet reopens prefilled; saving runs `updateSupplier`.

### Story 2.2: Supplier Directory & Brand Filtering

As a group member,
I want to browse all group suppliers in a filterable list,
So that I can quickly locate the right supplier for a research session.

**Acceptance Criteria:**

**Given** the Suppliers page,
**When** it loads,
**Then** all group suppliers render as `SupplierRow` components showing: name, brand tag chips, price range (if inquiry prices exist), active inquiry count, and red flag icon (FR12).

**Given** brand filter chips above the list,
**When** I click a chip,
**Then** the list filters immediately — no Apply button; active chip is filled, inactive is outlined (FR13).

**Given** the search field,
**When** I type,
**Then** the list filters in real time by supplier name.

**Given** no suppliers in the group,
**When** the page loads,
**Then** "Add your first supplier to get started" with a primary CTA is shown.

### Story 2.3: Supplier Detail & Trust Intelligence

As a group member,
I want to view a supplier's full profile — trust notes, red flag, and negotiation elasticity,
So that I enter every negotiation informed about this supplier's reliability and price patterns.

**Acceptance Criteria:**

**Given** a supplier row,
**When** I click the supplier name,
**Then** I navigate to the Supplier Detail page (DetailTemplate) with breadcrumb "Suppliers > [Name]".

**Given** the Supplier Detail page,
**When** it loads,
**Then** the right column shows `TrustIntelligencePanel`: editable trust notes (Textarea), red flag Switch with source link field, and `NegotiationElasticity` display (opening price → final price with % avg arrow) (FR9, FR10, FR11).

**Given** I edit trust notes and save,
**When** `updateSupplier` confirms,
**Then** the updated notes display immediately.

**Given** a supplier with a red flag,
**When** viewed in the Supplier Directory,
**Then** a red flag icon (`error` color, no background) is visible inline on the supplier's row — no drilling required.

---

## Epic 3: Photo-First Product Catalog

Users can create product cards by uploading photos (no product name required), add photos to existing cards, browse the product gallery visually, and view a product's full photo strip with linked supplier history.

### Story 3.1: Create Product via Photo Upload

As a group member,
I want to create a product card by dragging and dropping photos,
So that I capture a product's visual identity without needing a product name.

**Acceptance Criteria:**

**Given** the Products page,
**When** I drag photos onto the `PhotoUploadZone` or click to select files,
**Then** a multi-file upload begins; a per-file progress bar appears for each file; the app remains fully responsive during upload (FR14, NFR1, NFR4).

**Given** upload success,
**When** Supabase Storage confirms the file,
**Then** the `photo_hashes` DB record is written (storage-first, DB-second); a product card is created and visible in the gallery (NFR9).

**Given** a Storage upload failure,
**When** the upload fails,
**Then** no database record is created; a clear error message is shown (NFR9, NFR10).

**Given** any `PhotoThumb` rendered,
**When** it appears,
**Then** it has a required `alt` prop (TypeScript enforced); broken images show a fallback placeholder.

**Given** the `products` and `photo_hashes` migrations,
**When** they run,
**Then** both tables exist with all required columns including `created_by`, `created_at`, `updated_at`.

### Story 3.2: Add Photos & Notes to Existing Product

As a group member,
I want to add more photos and free-text notes to an existing product card,
So that the product's visual identity and context can grow over time.

**Acceptance Criteria:**

**Given** a product detail page,
**When** I click "Add Photos",
**Then** the `PhotoUploadZone` is shown; new photos upload and append to the product's photo strip via `addProductPhoto` (FR15).

**Given** a notes field on the product detail page,
**When** I type and save,
**Then** notes are persisted via `updateProduct` and displayed below the photo strip (FR16).

**Given** a failed additional upload,
**When** one file fails in a multi-file batch,
**Then** previously completed uploads are unaffected; only the failed photo is absent (NFR9).

### Story 3.3: Products Gallery & Product Detail View

As a group member,
I want to browse products visually in a gallery and see a product's full photo strip on detail,
So that I can find and recognize products by sight rather than by name.

**Acceptance Criteria:**

**Given** the Products page,
**When** it loads,
**Then** products display in a uniform card grid (`GalleryTemplate`); each `ProductCard` shows: product photo, notes preview, and supplier count (FR17 partial).

**Given** no products,
**When** the page loads,
**Then** "Upload your first product photos to get started" CTA is shown.

**Given** a `ProductCard`,
**When** I click it,
**Then** I navigate to Product Detail showing `ProductPhotoStrip` (horizontal scrollable) at top and a notes field below.

**Given** the `ProductPhotoStrip`,
**When** I click a thumbnail,
**Then** a Dialog opens with the full-size photo and prev/next navigation.

---

## Epic 4: Inquiry Tracking & Context Recovery

Users can track all active inquiries, update negotiation status deliberately, log prices, and recover full context (product photos + competing quotes + supplier trust notes) in under 10 seconds. Shared price history is visible to the whole group.

### Story 4.1: Create Inquiry Linking Product to Supplier

As a group member,
I want to create an inquiry that links a product to a supplier with a starting status,
So that I can track which suppliers I've contacted for a product.

**Acceptance Criteria:**

**Given** the Product Detail page,
**When** I click "Add Inquiry",
**Then** a Sheet opens with: supplier dropdown (all group suppliers), status defaulting to "Sent", optional price, optional notes (FR19).

**Given** the form,
**When** I select a supplier and submit,
**Then** `createInquiry` creates the record; it appears in the product's inquiry table and the active inquiries list.

**Given** the `inquiries` migration and `rls_policies` migration,
**When** they run,
**Then** the `inquiries` table has: `id`, `product_id`, `supplier_id`, `status` (enum: sent/price_received/negotiating/decided/ghosted), `price`, `notes`, `created_by`, `created_at`, `updated_at`; RLS policies grant auth-gated SELECT/INSERT and creator-or-admin UPDATE/DELETE to all tables (following the pattern in `007_rls_policies.sql`).

### Story 4.2: Active Inquiries List (Default Landing)

As a group member,
I want to land on a list of all active group inquiries when I open the app,
So that I can quickly locate an inquiry to follow up on after a supplier reply.

**Acceptance Criteria:**

**Given** I log in,
**When** I land on `/active-inquiries`,
**Then** all inquiries with status Sent, Price Received, or Negotiating are displayed in `InquiryTable`; each `InquiryRow` shows: `PhotoThumb`, product info, supplier name, status badge, price, and `AttributionLine` ("added by [user], [time]", `label-xs`) (FR25).

**Given** the page is loading,
**When** data has not yet arrived,
**Then** `Skeleton` rows at the same height as real rows appear — no layout shift.

**Given** no active inquiries,
**When** the page loads,
**Then** "No active inquiries yet — add your first inquiry from a product page." is shown.

**Given** an inquiry row,
**When** I click it,
**Then** I navigate to the associated Product Detail page.

### Story 4.3: Inquiry Status & Price Management

As a group member,
I want to update an inquiry's negotiation status and log a received price deliberately,
So that my negotiation state is accurately tracked and visible to the group.

**Acceptance Criteria:**

**Given** a `StatusDropdown` on any inquiry row,
**When** I click the status badge,
**Then** a dropdown opens with valid next statuses; the badge updates optimistically before API confirmation (FR20).

**Given** an optimistic status update,
**When** the API call fails,
**Then** the badge reverts to the previous status and an inline error message is shown.

**Given** the status badge system,
**When** rendered for each status,
**Then** colors match the spec: Sent = zinc-100/zinc-600, Price Received = blue-50/blue-700, Negotiating = amber-50/amber-700, Decided = green-50/green-700, Ghosted = zinc-50/zinc-400.

**Given** a price field on an inquiry,
**When** I enter a value and save,
**Then** `updateInquiryPrice` persists the price; it feeds the group's price history (FR21).

**Given** a notes field,
**When** I edit and save,
**Then** `updateInquiryNotes` persists the note (FR22).

**Given** a screen reader,
**When** a status changes,
**Then** an `aria-live="polite"` announcement of the new status is made.

### Story 4.4: Product Detail — Market Overview & Full Inquiry History

As a group member,
I want to see all inquiries for a product with a price range summary in a single view,
So that I recover full negotiation context in under 10 seconds after a supplier reply.

**Acceptance Criteria:**

**Given** the Product Detail page,
**When** it loads,
**Then** it shows: `ProductPhotoStrip` at top → `MarketOverviewCallout` → `InquiryTable` listing all inquiries for this product across all suppliers and group members — no sub-navigation required (FR23, FR26, FR27).

**Given** the `MarketOverviewCallout`,
**When** price data exists,
**Then** it displays "X quotes: R$Y–R$Z" with a count of Decided vs. Negotiating inquiries; `role="region"` ARIA is set.

**Given** the inquiry table on product detail,
**When** rendered,
**Then** each row shows: supplier name, status badge, price, `AttributionLine` (who logged, when) — attribution present on every row (FR27).

**Given** a product with no inquiries,
**When** the detail page loads,
**Then** "No inquiries yet — add one" with a `Button` is shown.

### Story 4.5: Supplier Detail — Linked Inquiry History

As a group member,
I want to see all inquiries linked to a supplier on the supplier's detail page,
So that I can review everything my group has negotiated with this supplier in one place.

**Acceptance Criteria:**

**Given** the Supplier Detail page,
**When** it loads,
**Then** a "Linked Inquiries" section shows all inquiries for this supplier across all products and group members — with `PhotoThumb`, product info, status badge, price, and `AttributionLine` (FR24).

**Given** no inquiries for this supplier,
**When** the section renders,
**Then** "No inquiries logged for this supplier yet." is shown.

---

## Epic 5: Source Library

Users can save research sources (Reddit, Discord, WhatsApp links) with brand tags and platform labels so future research sessions start from accumulated group knowledge rather than a fresh search.

### Story 5.1: Save & Manage Sources

As a group member,
I want to save a research source URL with a platform tag and brand labels,
So that future research sessions start from the group's accumulated knowledge.

**Acceptance Criteria:**

**Given** the Sources page,
**When** I click "Add Source",
**Then** a Sheet opens with: URL (required), platform tag — Reddit/Discord/WhatsApp/Other (required), brand tags (optional), notes (optional) (FR28, FR29, FR30).

**Given** the form,
**When** I submit,
**Then** `createSource` creates the record; it appears in the source library.

**Given** the `sources` migration,
**When** it runs,
**Then** the table has: `id`, `url`, `platform` (enum), `brands` (text[]), `notes`, `is_active`, `created_by`, `created_at`, `updated_at`. RLS: auth-gated SELECT/INSERT; creator-or-admin UPDATE/DELETE.

### Story 5.2: Source Library — Browse & Filter

As a group member,
I want to browse and filter saved sources by brand or platform,
So that I instantly find relevant research starting points.

**Acceptance Criteria:**

**Given** the Sources page,
**When** it loads,
**Then** all group sources are listed in a table: platform badge, URL (clickable link), brand tag chips, notes, and an active toggle (FR31).

**Given** brand or platform filter chips,
**When** I click one,
**Then** the list filters immediately — no Apply button; active chip is filled, inactive is outlined (FR31).

**Given** the active toggle on a source row,
**When** I toggle it off,
**Then** `toggleSourceActive` marks the source inactive and it becomes visually muted (FR32).

**Given** a filtered list that returns no matches,
**When** rendered,
**Then** "No results for [filter]" and a "Clear filters" link are shown.

---

## Epic 6: Photo Similarity Detection

The app automatically flags when a new supplier's photos match existing product photos — surfacing potential same-factory suppliers as an advisory signal, without auto-merging any records.

### Story 6.1: pHash Computation Pipeline

As the system,
I want to compute and store a perceptual hash for every uploaded photo,
So that visual similarity checks can run against the group's photo library.

**Acceptance Criteria:**

**Given** a photo successfully uploaded to Supabase Storage,
**When** the upload completes,
**Then** a non-blocking request is sent to `/api/phash` with the storage path (FR33).

**Given** the `/api/phash` Vercel Serverless Route,
**When** it receives a request,
**Then** it computes the pHash and writes it to `photo_hashes.phash`; the original product creation flow is not blocked (FR33).

**Given** pHash computation,
**When** it completes,
**Then** it finishes within 3 seconds of photo upload completion (NFR3).

**Given** a pHash computation failure,
**When** the API returns an error,
**Then** the photo and product record are unaffected; no UI error is shown for this background operation.

### Story 6.2: Similarity Advisory Flag

As a group member,
I want to be alerted when newly uploaded photos match photos already in the library,
So that I can identify potential same-factory suppliers without manual visual inspection.

**Acceptance Criteria:**

**Given** a photo upload completes and pHash is computed,
**When** a hash match above the similarity threshold is found in the group library,
**Then** a `SimilarityAdvisoryBanner` is shown: "X photo(s) match products already in your library — [Supplier Name] uses similar images" (FR18, FR34, FR35).

**Given** the `SimilarityAdvisoryBanner`,
**When** shown,
**Then** it is dismissable; uses `role="alert"` for accessibility; no automatic record merging occurs.

**Given** a ProductCard with a confirmed pHash match,
**When** shown in the gallery,
**Then** a warning badge is visible on the card.

**Given** photos with no matches,
**When** pHash check completes,
**Then** no banner or indicator is shown — silent on no-match.
