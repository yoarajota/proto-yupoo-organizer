# Sprint Change Proposal — 2026-03-21

**Project:** proto-yupoo-organizer
**Author:** Jota_ (via Correct Course workflow)
**Scope Classification:** Major
**Status:** Approved

---

## Section 1: Issue Summary

**Problem Statement:**
The original planning modeled the app as a multi-group SaaS system — each group had its own isolated data space with group creation, group membership, and group-scoped RLS. This was overengineering. The actual use case is a **single shared workspace** for one trusted team. There is no scenario where multiple separate groups would use this system.

**Discovery Context:**
Identified at Story 1.4 (`ready-for-dev`) before any group management code was written. Stories 1.3 (Auth & Group Schema) is in `review` but migrations have not been applied to production. This is the optimal moment to course-correct — zero rollback cost.

**Trigger:**
User explicitly clarified the intended access model:
> "All the data must be shared between authenticated users. We don't need the 'group' functionality, because the app will be a big group. The admin user can invite other users to the system."

---

## Section 2: Impact Analysis

### Epic Impact
| Epic | Impact | Detail |
|------|--------|--------|
| Epic 1 | High | Story 1.3 schema rewrite; Story 1.4 full pivot |
| Epic 2 | Low | Remove `group_id` from suppliers migration spec |
| Epic 3 | Low | Remove `group_id` from products/photo_hashes migration specs |
| Epic 4 | Low | Remove `group_id` from inquiries migration spec |
| Epic 5 | Low | Remove `group_id` from sources migration spec |
| Epic 6 | None | No schema changes in pHash pipeline stories |

### Story Impact
| Story | Status | Change |
|-------|--------|--------|
| 1.1 | review | No change |
| 1.2 | review | No change |
| 1.3 | review | Rewrite schema ACs: remove groups/group_members, add profiles table |
| 1.4 | ready-for-dev | Full pivot: group management → user management (invite/deactivate) |
| 2.1 | backlog | Remove group_id from suppliers table spec |
| 3.1 | backlog | Remove group_id from products/photo_hashes table spec |
| 4.1 | backlog | Remove group_id from inquiries table spec; update RLS AC |
| 5.1 | backlog | Remove group_id from sources table spec |

### Artifact Conflicts
- **PRD:** FR1–FR6 and NFR5 require rewrite
- **Architecture:** groups/group_members tables removed; RLS strategy changes to auth-scoped + role-based delete
- **Epics doc:** All migration specs must drop group_id; FR coverage map for FR1–FR6 must update
- **UX Design:** No changes needed (no group UI was designed)

### Technical Impact
- 001_groups migration: **removed** entirely
- All feature migrations: drop `group_id` column
- New 001_profiles migration: `profiles(id, role, is_active, invited_by, created_at, updated_at)`
- RLS policy pattern changes from group-join subquery to simple `auth.uid() IS NOT NULL` + role check
- Supabase Auth `inviteUserByEmail` is still the invite mechanism (no change)
- `db:types` script unchanged

---

## Section 3: Recommended Approach

**Selected Path:** Option 1 — Direct Adjustment

Modify stories 1.3 and 1.4 in-place; update migration specs in backlog stories; rewrite PRD FRs and Architecture sections. No rollback needed — Story 1.4 was never started; Story 1.3 migrations are not in production.

**Effort:** Low-Medium
**Risk:** Low — change is purely subtractive (removing group complexity). No new architectural patterns introduced.
**Timeline impact:** Story 1.4 becomes simpler; backlog stories are lighter (no group_id to manage). Net time savings.

---

## Section 4: Detailed Change Proposals (all approved)

### Proposal 1 — PRD: FR1–FR6 and NFR5

| | Content |
|--|---------|
| **FR1** | REMOVED — no group creation concept |
| **FR2** | Admin can invite users to the system via email |
| **FR3** | Admin can deactivate a user account (revokes access immediately) |
| **FR4** | Authenticated users can log in and access all shared data |
| **FR5** | Data created by any user persists even if that user is deactivated |
| **FR6** | Admin can delete any record; a user can delete records they created |
| **NFR5** | All data accessible to any authenticated user; RLS enforces auth-gated (not group-scoped) access |

### Proposal 2 — Architecture: Data Model & RLS

- Remove `groups` and `group_members` tables
- Add `profiles(id, role enum(admin/member), is_active, invited_by, created_at, updated_at)`
- Remove `group_id` from all feature tables
- RLS read policy: `auth.uid() IS NOT NULL`
- RLS delete/update policy: `created_by = auth.uid() OR profiles.role = 'admin'`
- Migration sequence: 001_profiles → 002_suppliers → 003_products → 004_photo_hashes → 005_inquiries → 006_sources → 007_rls_policies

### Proposal 3 — Story 1.3: Auth & Group Schema → Auth & User Schema

- Title change: "Authentication & Group Schema" → "Authentication & User Schema"
- Schema AC: `groups` + `group_members` tables → `profiles` table
- Add AC: first user trigger sets role = 'admin'; subsequent users get role = 'member'
- Add AC: deactivated user (is_active = false) denied on next request
- Keep: middleware redirect, login/logout behavior, db:types script

### Proposal 4 — Story 1.4: Group Management → User Management

- Title: "Group Management (Admin)" → "User Management (Admin)"
- Story statement: invite/deactivate users, not create/manage groups
- Remove: group creation AC (FR1 removed)
- Replace: "group_members.is_active" → "profiles.is_active"
- Replace: "only see data scoped to their group" → "see all shared data"
- Add: Settings/Users page shows all users with role, status, deactivate/reactivate action

### Proposal 5 — Epics 2–6: Remove group_id from migration specs

- Story 2.1 suppliers table: drop `group_id`
- Story 3.1 products + photo_hashes tables: drop `group_id`
- Story 4.1 inquiries table: drop `group_id`; update RLS AC to auth-gated language
- Story 5.1 sources table: drop `group_id`
- All references to "group-scoped access" → "auth-gated access; delete/update to creator or admin"

---

## Section 5: Implementation Handoff

**Scope Classification:** Major (data model change affects all epics, RLS strategy replaced)

**Handoff Recipients:**

| Role | Responsibility |
|------|----------------|
| SM / PO | Update epics.md: rewrite FR1–FR6, update FR coverage map, update all migration specs in stories 2.1, 3.1, 4.1, 5.1 |
| PM / Architect | Update prd.md FR1–FR6 + NFR5; update architecture.md data model + RLS section |
| Dev | Re-review Story 1.3 (schema AC changed); implement updated Story 1.4 |

**Success Criteria:**
- `groups` and `group_members` no longer appear anywhere in migration files
- `group_id` column absent from all feature tables
- `profiles` table exists with role + is_active
- RLS policies: any auth'd user can read; creator or admin can delete/update
- Admin invite flow uses `inviteUserByEmail` (unchanged mechanism)
- Story 1.4 implemented against new spec (user management, not group management)
