---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
inputDocuments: ['_bmad-output/brainstorming/brainstorming-session-2026-03-20-1720.md']
workflowType: 'prd'
classification:
  projectType: 'Web App (SaaS-lite)'
  domain: 'Import/Trade Research Tooling'
  complexity: 'medium'
  projectContext: 'greenfield'
---

# Product Requirements Document - proto-yupoo-organizer

**Author:** Jota_
**Date:** 2026-03-20

## Executive Summary

**proto-yupoo-organizer** is a desktop-first web app for Brazilian importers who source products from Yupoo (Chinese marketplace). It replaces browser bookmarks, unstructured WhatsApp threads, and mental overhead with a structured, collaborative research platform shared among a trusted group.

**The core problem:** Research value is permanently lost. When a seller replies on WhatsApp hours later (timezone gap), the buyer has lost context. Price quotes, product variants, supplier notes, and scam signals exist in silos or nowhere. Even with a small number of active conversations, the system collapses.

**The solution:** Research becomes cumulative. Every inquiry, price, supplier note, and source feeds a shared knowledge base that grows over time. Users enter every negotiation informed — knowing the expected price range, the supplier's reliability, and what their group has already discovered.

**Tagline:** *Never get lost while importing search.*

**Classification:** Desktop-first SPA — greenfield — small trusted friend group — medium complexity (collaborative data model, photo identity/similarity matching, group-scoped data) — no post-purchase scope.

### What Makes This Special

- **Photo-first product identity** — no consistent product names exist in the Yupoo ecosystem. Photos are the only stable identifier. Products are created by uploading photos (multiple per product); all suppliers, prices, and inquiry history attach to that visual identity.
- **Negotiation power through shared history** — price quotes are stored as historical benchmarks, visible to the whole group. Users know the expected range before opening a WhatsApp conversation.
- **Supplier relationship memory** — trust notes, scam flags, negotiation elasticity, and brands carried are permanently stored per supplier, replacing browser bookmarks as the supplier CRM.
- **Source layer** — discovery sources (Reddit threads, Discord servers, WhatsApp groups) are saved with brand and platform tags, making future research start from accumulated knowledge, not from scratch.

## Success Criteria

### User Success

- Users can find any product, supplier, inquiry, or price without scrolling through WhatsApp or opening bookmarks
- When a WhatsApp reply arrives, full context (product photos, other suppliers contacted, competing quotes) is visible in under 10 seconds
- Users enter negotiations with a reference price already known
- No user says "I got lost using the app" — the app must never become a source of disorganization

### Business Success

- The friend group stops using browser bookmarks as a supplier CRM
- Shared inquiry history prevents contacting the same supplier twice for the same product
- Price history accumulates over time, making each negotiation better-informed than the last

### Technical Success

- Hosted on Vercel, backend on Supabase (auth + database + file storage for photos)
- All inquiries, prices, suppliers, and sources are persistently stored — no data loss
- Multi-photo upload per product works reliably
- Group-scoped auth: all members see shared data (suppliers, prices, sources) within their group

### Measurable Outcomes

- Browser bookmarks folder for Yupoo shops empty within 1 month of launch
- Zero "which shop was this again?" moments during active research sessions
- Every new brand research session starts from the app's source library, not a fresh Reddit search

## Product Scope

### MVP — Full Scope

All features ship together — the data model is graph-connected (products → suppliers → inquiries → prices); partial builds feel broken and fail the "never get lost" success criterion.

**Must-Have Capabilities:**
- Group-scoped auth (Supabase Auth + RLS) with admin role
- Supplier cards (Yupoo URL, WhatsApp, brands, trust notes, red flags, negotiation elasticity)
- Product cards with multi-photo upload (Supabase Storage)
- Inquiry tracker: product × supplier × status × price × notes
- Shared source library (URL + brand + platform tags)
- Shared price history (benchmark prices visible to whole group)
- Photo similarity flagging (pHash — advisory signal, not auto-merge)

### Growth Features (Phase 2)

- Mobile-optimized layout (Safari mobile must be functional at MVP; full optimization post-MVP)
- Notification when a group member logs a price for a product you're tracking
- Bulk import of suppliers from a Yupoo shop URL

### Vision (Phase 3)

- Automatic Yupoo shop metadata fetching
- Price trend charts per supplier over time
- Export research session as shareable report

### Risk Mitigation

**Technical Risk — pHash:** Only novel implementation. Flag is advisory only (not auto-merge); test with known duplicate/non-duplicate photo pairs before launch. Can be deferred to Phase 2 if implementation stalls — the rest of the app delivers standalone value.

## User Journeys

### Journey 1: Researching a new brand (Core Path)

Jota_ sees a Reddit post about a brand he wants to source with two Yupoo shop links. He opens the app, saves the Reddit thread to Sources tagged with the brand name and platform. He creates a Supplier card for the first shop (Yupoo URL, WhatsApp, notes). He finds three products, creates Product cards for each with multiple photos. For each product he adds an Inquiry: selects the supplier, sets status to "Sent." He closes the browser. Two days later a WhatsApp reply arrives. He opens the app, finds the inquiry in seconds, sees the product photos, sees his friend already got a competing quote from another supplier last week. He enters the negotiation knowing the reference price. Status updated to "Negotiating."

**Capabilities revealed:** Source saving, supplier card creation, product card with multi-photo, inquiry creation and status tracking, shared price history visibility.

---

### Journey 2: Friend joins and gets up to speed instantly

A friend is added by the admin. She logs in, opens the Supplier list, and immediately sees 12 suppliers her friends have catalogued — with trust notes, brands carried, and red flags. She's researching a bag brand, checks the source library, finds a Discord server saved 3 weeks ago tagged with that brand. She goes straight there instead of starting from scratch on Reddit. She finds a new shop, adds it as a supplier, and creates an inquiry. The group now has 13 suppliers.

**Capabilities revealed:** Group-scoped auth (all data visible on join), source library with brand filtering, collaborative supplier pool.

---

### Journey 3: Same factory detected (Edge Case)

Jota_ finds a new Yupoo shop and uploads product photos. The app flags: "2 of these photos match products already in your library — Supplier X uses the same images." He checks Supplier X's card — already contacted, already has a price logged by his friend. He decides not to create a duplicate inquiry and instead notes this shop on the existing supplier card.

**Capabilities revealed:** Photo similarity detection, cross-supplier deduplication, supplier card notes.

---

### Journey 4: Admin manages the group

Jota_ sets up the app, creates the group, invites three friends via email. One friend leaves the importing business — Jota_ removes their access. Data created by that user stays in the group.

**Capabilities revealed:** Group creation, member invitation, member removal, data ownership at group level (not user level).

---

### Journey Requirements Summary

| Capability | Revealed By |
|---|---|
| Auth + group-scoped access | Journeys 2, 4 |
| Admin: invite/remove members | Journey 4 |
| Source library with brand + platform tags | Journeys 1, 2 |
| Supplier cards (URL, WhatsApp, brands, notes, red flags) | Journeys 1, 2 |
| Product cards with multi-photo upload | Journey 1 |
| Inquiry tracker with status flow | Journey 1 |
| Shared price history as reference | Journey 1 |
| Photo similarity flagging | Journey 3 |
| Group data persists regardless of who added it | Journey 4 |

## Innovation & Novel Patterns

### Detected Innovation Areas

**Photo-First Product Identity**
Products in the Yupoo ecosystem have no stable text identifiers. This app treats photos as the primary product identity — uploading photos creates a product. All supplier relationships, inquiry history, and price benchmarks attach to a visual identity rather than a text record. This inverts the standard catalog model and matches how users actually navigate the platform.

**Visual Factory Deduplication**
Multiple Yupoo shops often source from the same factory and share identical product photos. Perceptual image hashing (pHash) flags when a newly added supplier uses photos already in the system — inferring a common supplier. This transforms a manual visual memory task into an automated advisory signal.

### Validation Approach

- pHash similarity can be validated cheaply: upload known duplicate photos from two shops, confirm the flag triggers. No ML needed — pHash is deterministic and fast.
- Photo-first identity is validated by usage: if users never type a product name and never need to, the model works.

### Risk Mitigation

- **False positives:** Flag is advisory only — "these photos look similar, check if it's the same supplier" — not an automatic merge.
- **Photo storage costs:** Supabase Storage with per-upload size limits; photos are reference images, not high-res assets.

## Web App Technical Requirements

**Stack:** Next.js SPA on Vercel + Supabase (PostgreSQL + RLS + Auth + Storage). No real-time subscriptions — standard fetch-on-load. pHash computed server-side or via edge function.

### Browser Matrix

| Browser | Platform | Support Level |
|---|---|---|
| Chrome | Desktop | Primary — full support |
| Safari | Mobile | Secondary — must be functional |
| Firefox, Edge | Desktop | Not required |

**Responsive design:** Desktop-first. Mobile (Safari) must support read/lookup use cases — not full feature parity. No native mobile features (camera, push notifications).

**SEO:** None — fully auth-gated, no public pages.

**Accessibility:** Basic — keyboard navigable, sufficient color contrast, form labels. No WCAG AA certification required.

## UX Considerations

**Inquiry status as negotiation signal management:** The status flow (Sent → Price Received → Negotiating → Decided / Ghosted) is not merely organizational — it tracks negotiation phase intentionally. Users transition to "Negotiating" only when ready to signal buying intent. The UX should make status transitions deliberate and visible, not accidental. Mixing phases across multiple parallel inquiries is a risk; the design should surface active negotiations clearly.

## Functional Requirements

### Group & User Management

- **FR1:** Admin can create a group and become its owner
- **FR2:** Admin can invite members to the group via email
- **FR3:** Admin can remove members from the group
- **FR4:** Members can log in and access all group-scoped data
- **FR5:** Data created by any member belongs to the group and persists if that member is removed
- **FR6:** System enforces group-scoped access — members only see data from their own group

### Supplier Management

- **FR7:** Members can create a supplier card with name, Yupoo shop URL, and WhatsApp contact
- **FR8:** Members can tag a supplier with one or more brands they carry
- **FR9:** Members can add free-text trust notes to a supplier card
- **FR10:** Members can flag a supplier with a red flag and attach a source link (e.g. scam report URL)
- **FR11:** Members can record negotiation elasticity data on a supplier (opening price vs. final price)
- **FR12:** Members can view all suppliers in the group with their full details
- **FR13:** Members can filter/search suppliers by brand

### Product Management

- **FR14:** Members can create a product card by uploading one or more photos
- **FR15:** Members can add additional photos to an existing product card
- **FR16:** Members can add optional free-text notes to a product card
- **FR17:** Members can view a product card with all its photos, linked suppliers, and inquiry history
- **FR18:** System flags when uploaded photos match photos already in the group's product library (advisory similarity signal)

### Inquiry Tracking

- **FR19:** Members can create an inquiry linking a product to a supplier
- **FR20:** Members can set and update the status of an inquiry (Sent / Price Received / Negotiating / Decided / Ghosted)
- **FR21:** Members can record a price on an inquiry
- **FR22:** Members can add notes to an inquiry
- **FR23:** Members can view all inquiries for a product across all suppliers
- **FR24:** Members can view all inquiries for a supplier across all products
- **FR25:** Members can view their own active inquiries (in-progress statuses)

### Price History & Reference

- **FR26:** Members can view the full price history for a product across all suppliers and all group members
- **FR27:** Price history displays who logged the price and when

### Source Library

- **FR28:** Members can save a source (URL) with a platform tag (Reddit / Discord / WhatsApp / Other)
- **FR29:** Members can tag a source with one or more brand names
- **FR30:** Members can add free-text notes to a source
- **FR31:** Members can view and filter saved sources by brand or platform
- **FR32:** Members can mark a source as no longer active/relevant

### Photo Similarity Detection

- **FR33:** System computes a perceptual hash for each uploaded photo
- **FR34:** When a photo is uploaded, system checks it against existing photo hashes in the group library
- **FR35:** System surfaces matches as an advisory flag — "similar photos found in [Supplier X]" — without merging records automatically

## Non-Functional Requirements

### Performance

- **NFR1:** Photo upload progress feedback appears within 2 seconds of initiating upload on desktop Chrome
- **NFR2:** Inquiry list and supplier list load within 1 second on a standard desktop connection
- **NFR3:** pHash comparison completes within 3 seconds of photo upload completion
- **NFR4:** App remains responsive during multi-photo uploads (no UI freeze)

### Security

- **NFR5:** All data is scoped to the user's group via Supabase Row Level Security — no cross-group data leakage is permissible
- **NFR6:** All data is encrypted in transit (HTTPS) and at rest (Supabase default)
- **NFR7:** Authentication is required to access any app data — no public endpoints expose group data
- **NFR8:** Removed members lose access to all group data immediately upon removal

### Reliability

- **NFR9:** Failed uploads must not create partial records — no data loss on upload failure
- **NFR10:** App displays an error state on Supabase downtime rather than silently failing or corrupting data
- **NFR11:** Photo files in Supabase Storage are deleted only by explicit deletion actions — not on product card edits
