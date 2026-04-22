---
type: template
purpose: Structured state checkpoint for repo-onboarding skill. One file tracks progress across all steps and chat sessions.
copy_to: .claude/_output/repo-onboarding/onboarding-state.md
---

# Onboarding State

## Meta

- **Repository:** /home/jota\_/projects/yoarajota/proto-yupoo-organizer
- **Started:** 2026-03-29T21:46:13-03:00
- **Last Updated:** 2026-03-29T22:50:00-03:00 (Step 04 - Batch 3)
- **Output Directory:** .claude/\_output/repo-onboarding/
- **Obsidian Vault Path:** /home/jota\_/projects/global/obsidian/vault
- **Org:** yoarajota
- **MOC Output Path:** /home/jota\_/projects/global/obsidian/vault/yoarajota/proto-yupoo-organizer.md

---

## Topology

- **Type:** single-repo
- **Primary Language(s):** TypeScript
- **Framework(s):** Next.js 15 (verified), Supabase, Tailwind CSS 4

---

## Module Registry

| #   | Module Name    | Path             | Status   | Batch | Notes                               |
| --- | -------------- | ---------------- | -------- | ----- | ----------------------------------- |
| 1   | Core App       | `src/app`        | complete | 1     | Next.js App Router (pages & layout) |
| 2   | UI Library     | `src/components` | complete | 1     | Atomic design components            |
| 3   | Server Actions | `src/actions`    | complete | 2     | Data mutation logic                 |
| 4   | Database       | `supabase`       | complete | 2     | Supabase migrations & schema        |
| 5   | Logic/Utils    | `src/lib`        | complete | 3     | Shared utilities & business logic   |
| 6   | Types          | `src/types`      | complete | 3     | Centralized TS definitions          |

---

## Conventions Summary

- **File Naming:** kebab-case
- **Error Handling:** try-catch, Zod validation
- **Testing:** Vitest, Playwright
- **Git Style:** unknown (shallow clone, 13 commits)

---

### Internal (module ↔ module)

| Source Module  | Target Module  | Type   | Notes                                       |
| -------------- | -------------- | ------ | ------------------------------------------- |
| Core App       | UI Library     | Import | Uses components for all pages               |
| Core App       | Server Actions | Import | Invokes actions for data fetching/mut       |
| Core App       | Logic/Utils    | Import | Uses Supabase clients and schemas           |
| Core App       | Types          | Import | Database and business types                 |
| UI Library     | Server Actions | Import | Interactive components call actions         |
| UI Library     | Logic/Utils    | Import | Uses `cn` util, schemas, and client         |
| UI Library     | Types          | Import | Database types for props                    |
| Server Actions | Logic/Utils    | Import | Uses Supabase server/admin clients, schemas |
| Server Actions | Types          | Import | Database types for return values            |
| Logic/Utils    | Types          | Import | Database types for client initialization    |

### External (module → service)

| Module         | Service     | Type                | Notes                                   |
| -------------- | ----------- | ------------------- | --------------------------------------- |
| Core App       | Next.js     | Framework           | App Router, API Routes                  |
| Logic/Utils    | Supabase    | Database/Auth/Store | Primary backend provider                |
| Server Actions | Supabase    | Database            | Data mutations via Supabase client      |
| Logic/Utils    | sharp-phash | Library             | Perceptual hashing for image similarity |

---

## Hotspots

| #   | File                                        | Change Count | Module     |
| --- | ------------------------------------------- | ------------ | ---------- |
| 1   | `src/types/database.ts`                     | 7            | Database   |
| 2   | `src/app/(app)/suppliers/page.tsx`          | 5            | Core App   |
| 3   | `src/app/(app)/products/[id]/page.tsx`      | 5            | Core App   |
| 4   | `src/components/organisms/TopBar.tsx`       | 4            | UI Library |
| 5   | `src/components/organisms/ProductCard.tsx`  | 4            | UI Library |
| 6   | `src/components/organisms/InquiryTable.tsx` | 4            | UI Library |
| 7   | `src/components/organisms/InquiryRow.tsx`   | 4            | UI Library |
| 8   | `src/components/templates/AppShell.tsx`     | 3            | UI Library |
| 9   | `src/app/(app)/sources/page.tsx`            | 3            | Core App   |
| 10  | `src/app/(app)/products/page.tsx`           | 3            | Core App   |

---

## Current Step

- **Completed Steps:** 00, 01, 02, 03
- **Current Step:** 04 (Complete)
- **Pending Modules:** 0
- **Completed Modules:** 6
