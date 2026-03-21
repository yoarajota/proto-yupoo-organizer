# Story 1.2: Design System Tokens & AppShell

Status: review

## Story

As a user,
I want to see a professionally styled app shell with a fixed sidebar, top bar, and responsive layout,
so that I can navigate the app confidently on desktop and read data on mobile.

## Acceptance Criteria

1. **Given** a desktop viewport (≥1024px), **When** the app loads, **Then** I see a fixed 240px SideNav on the left, a fixed glassmorphism TopBar (`bg-white/80 backdrop-blur-md`), and a scrollable main content area with `max-w-5xl` constraint.

2. **Given** the SideNav, **When** I navigate to a section, **Then** the active item shows `border-l-4 border-primary` + bold text — no background fill on the active item.

3. **Given** a viewport ≤768px (Mobile Safari), **When** the app loads, **Then** SideNav is replaced by a bottom tab bar with 4 tabs: Inquiries, Suppliers, Products, Sources.

4. **Given** a viewport 768px–1023px, **When** the app loads, **Then** SideNav collapses to a 64px icon-only strip.

5. **Given** any component using a design value, **When** it is rendered, **Then** all `fontSize`, `spacing`/`width`, `borderRadius`, `colors`, and `letterSpacing` values reference named tokens in `globals.css` via Tailwind v4 `@theme` — no arbitrary bracket values (`text-[10px]`, `w-[240px]`) exist anywhere.

## Tasks / Subtasks

- [x] Task 1: Define design token system in `src/app/globals.css` (AC: #5)
  - [x] Override shadcn `:root` CSS vars to match design direction (primary → blue-600, background → zinc-50, border → zinc-200, destructive/error → #ba1a1a)
  - [x] Add project-specific custom color tokens to `:root` — surface-container-low (#eff4ff), surface-container-lowest (#ffffff), surface-container-high (#dce9ff), error (#ba1a1a)
  - [x] Add custom color references to the existing `@theme inline` block — `--color-surface-container-low`, `--color-surface-container-lowest`, `--color-surface-container-high`, `--color-error`
  - [x] Add a new `@theme` block (static, non-inline) for dimensional and typographic tokens — see Dev Notes for exact values
  - [x] Switch font from Geist to Inter in `src/app/layout.tsx` and update `--font-sans` CSS variable

- [x] Task 2: Install required shadcn/ui components (AC: #1, #2, #3)
  - [x] Run `npx shadcn@latest add tooltip` (for icon-only SideNav collapsed state titles)
  - [x] Run `npx shadcn@latest add separator` (for nav dividers)
  - [x] Verify `lucide-react` is available — shadcn installs it automatically; no separate install needed

- [x] Task 3: Create route group layouts and stub pages (AC: #1)
  - [x] Create `src/app/(auth)/layout.tsx` — minimal layout, no AppShell (public routes: login)
  - [x] Create `src/app/(auth)/login/page.tsx` — placeholder returning `<div>Login page (Story 1.3)</div>`
  - [x] Create `src/app/(app)/layout.tsx` — wraps children in `AppShell`
  - [x] Create stub page `src/app/(app)/active-inquiries/page.tsx` — placeholder with heading "Active Inquiries"
  - [x] Create stub page `src/app/(app)/suppliers/page.tsx` — placeholder with heading "Suppliers"
  - [x] Create stub page `src/app/(app)/products/page.tsx` — placeholder with heading "Products"
  - [x] Create stub page `src/app/(app)/sources/page.tsx` — placeholder with heading "Sources"
  - [x] Redirect root `src/app/page.tsx` to `/active-inquiries` via `redirect('/active-inquiries')` from `next/navigation`

- [x] Task 4: Build `TopBar` organism (AC: #1)
  - [x] Create `src/components/organisms/TopBar.tsx` — fixed header, glassmorphism `bg-white/80 backdrop-blur-md`, `h-14` (`56px`), full-width, `z-20`
  - [x] TopBar renders: left-side app name/logo text, right-side reserved area (empty at this stage; avatar added in Story 1.4)
  - [x] TopBar is a Server Component (no client state needed at this stage)

- [x] Task 5: Build `SideNav` organism (AC: #1, #2, #3, #4)
  - [x] Create `src/components/organisms/SideNav.tsx` — `"use client"` (uses `usePathname`)
  - [x] Import `usePathname` from `next/navigation` to detect active route
  - [x] Render 4 nav items: Inquiries → `/active-inquiries`, Suppliers → `/suppliers`, Products → `/products`, Sources → `/sources`
  - [x] Active state: `border-l-4 border-primary font-semibold text-foreground` on active item — NO background fill
  - [x] Inactive state: `text-muted-foreground hover:text-foreground` transition
  - [x] Desktop (≥1024px): full 240px sidebar, show icon + label
  - [x] Tablet (768–1023px): collapsed 64px strip, show icon only; label shown via Tooltip on hover
  - [x] Mobile (≤767px): hidden (bottom tab bar renders instead)
  - [x] Icons: use Lucide React — `MessageSquare` (Inquiries), `Store` (Suppliers), `Package` (Products), `BookOpen` (Sources)

- [x] Task 6: Build `AppShell` template (AC: #1, #2, #3, #4)
  - [x] Create `src/components/templates/AppShell.tsx` — `"use client"` (manages responsive state)
  - [x] Layout: CSS Grid `grid-cols-[auto_1fr]` on desktop, single column on mobile
  - [x] SideNav: fixed position, full-height, `w-sidebar` (240px) on ≥1024px, `w-sidebar-collapsed` (64px) on 768–1023px, hidden on ≤767px
  - [x] TopBar: fixed at top, `h-14`, full-width, `left-0 right-0 top-0 z-20`
  - [x] Main content: `pt-14` (clears TopBar), `pl-sidebar` on desktop, `pl-sidebar-collapsed` on tablet, `pl-0 pb-14` (clears bottom tabs) on mobile
  - [x] Content wrapper: `max-w-5xl mx-auto px-4 sm:px-6` for content constraint
  - [x] Background: `bg-zinc-50` on body; SideNav on `bg-surface-container-low` (#eff4ff)
  - [x] Bottom tab bar: visible only on ≤767px — 4 tab items with icon + label, `fixed bottom-0 left-0 right-0 bg-white border-t border-border z-20 h-14`
  - [x] Bottom tab active state: icon and label in `text-primary` (blue-600); inactive: `text-muted-foreground`

- [x] Task 7: Write tests (AC: #1–#5)
  - [x] Create `src/components/organisms/SideNav.test.tsx` — test: active item has correct border class for each route; inactive items do not have border class; icon-only mode renders Tooltip text
  - [x] Create `src/components/templates/AppShell.test.tsx` — test: renders children, renders TopBar, renders SideNav
  - [x] Run `npm run test:run` and confirm all tests pass

## Dev Notes

### CRITICAL: Tailwind v4 Token Architecture

**This project uses Tailwind CSS v4** (NOT v3). The `tailwind.config.ts` is a placeholder — do NOT add tokens there. All custom tokens go in `src/app/globals.css`.

The existing `globals.css` has:
- `@import "tailwindcss"` — loads Tailwind v4
- `@theme inline` block — maps shadcn CSS variables to Tailwind utilities (existing, do NOT remove)
- `:root` block — defines shadcn CSS variables (override these to match design direction)
- `.dark` block — dark mode overrides (skip; app is light-only at MVP)

**Token implementation approach:**

**Step 1** — Override shadcn `:root` values to match design direction. The current defaults are gray-neutral. Override:
```css
:root {
  /* Override shadcn defaults to match design direction */
  --primary: oklch(0.488 0.243 264.376);          /* blue-600 → text-primary, bg-primary */
  --primary-foreground: oklch(0.985 0 0);          /* white */
  --background: oklch(0.98 0 0);                   /* zinc-50 equivalent */
  --border: oklch(0.922 0 0);                      /* zinc-200 (already set, verify) */
  --destructive: oklch(0.444 0.177 26.1);          /* red-700 (close to #ba1a1a) */
  --muted-foreground: oklch(0.553 0.013 262);      /* zinc-500 equivalent */

  /* Project-specific custom colors — ADD these new vars */
  --surface-container-low: #eff4ff;
  --surface-container-lowest: #ffffff;
  --surface-container-high: #dce9ff;
  --color-error-raw: #ba1a1a;
}
```

**Step 2** — Extend the existing `@theme inline` block to expose custom vars as Tailwind utilities:
```css
@theme inline {
  /* ...existing shadcn mappings... (keep all existing lines) */

  /* Add project-specific tokens after existing lines */
  --color-surface-container-low: var(--surface-container-low);
  --color-surface-container-lowest: var(--surface-container-lowest);
  --color-surface-container-high: var(--surface-container-high);
  --color-error: var(--color-error-raw);
}
```
This enables: `bg-surface-container-low`, `bg-surface-container-high`, `text-error`, etc.

**Step 3** — Add a NEW `@theme` block (after `@theme inline`) for static dimensional/typographic tokens:
```css
@theme {
  /* Typography scale — referenced as text-label-xs, text-label-sm, etc. */
  --font-size-label-xs: 0.625rem;        /* 10px — column headers, attribution lines */
  --font-size-label-sm: 0.6875rem;       /* 11px */
  --font-size-label-md: 0.75rem;         /* 12px */
  --font-size-body-sm: 0.8125rem;        /* 13px */
  --font-size-body-md: 0.875rem;         /* 14px */

  /* Layout dimensions — referenced as w-sidebar, w-sidebar-collapsed, w-thumb-sm, w-thumb-md */
  --width-sidebar: 15rem;                /* 240px — fixed SideNav width */
  --width-sidebar-collapsed: 4rem;       /* 64px — icon-only tablet SideNav */
  --width-thumb-sm: 3rem;               /* 48px — PhotoThumb small */
  --width-thumb-md: 4rem;               /* 64px — PhotoThumb medium */

  /* Letter spacing — referenced as tracking-widest (already in Tailwind, verify it's named) */
  /* Only add if Tailwind default 'widest' is insufficient */

  /* Grid templates — referenced as grid-cols-inquiry, grid-cols-gallery */
  --grid-template-columns-inquiry: 64px 2fr 1.5fr 1fr 1fr 120px;
  --grid-template-columns-gallery: repeat(auto-fill, minmax(200px, 1fr));
}
```

**Result**: Components use `text-label-xs`, `w-sidebar`, `w-sidebar-collapsed`, `bg-surface-container-low` etc. — zero arbitrary bracket values.

### Font Update: Geist → Inter

The UX spec requires Inter via `next/font`. Update `src/app/layout.tsx`:
```tsx
import { Inter } from "next/font/google";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});
```
Remove Geist imports. Update `className` on `<html>` to use `inter.variable` only.

The `--font-sans: var(--font-sans)` mapping in `@theme inline` already exists — just changing the variable value in layout.tsx propagates the font.

### Atomic Design Placement

- `src/components/templates/AppShell.tsx` — templates layer (page-level structure)
- `src/components/organisms/SideNav.tsx` — organisms layer (stateful, multi-molecule)
- `src/components/organisms/TopBar.tsx` — organisms layer (stateful, top-level chrome)

Do NOT place in `molecules/` or `atoms/`. Route rules from architecture:
> "Atoms/molecules are props-only, no data fetching. Organisms hold local state."

AppShell has local state (responsive breakpoint management) → template is fine for this.

### SideNav Active State Pattern

```tsx
"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

const navItems = [
  { href: "/active-inquiries", label: "Inquiries", icon: MessageSquare },
  { href: "/suppliers", label: "Suppliers", icon: Store },
  { href: "/products", label: "Products", icon: Package },
  { href: "/sources", label: "Sources", icon: BookOpen },
];

function NavItem({ href, label, icon: Icon, collapsed }) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-sm transition-colors",
        isActive
          ? "border-l-4 border-primary font-semibold text-foreground"
          : "border-l-4 border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
```

**CRITICAL**: Active state uses `border-l-4 border-primary` + bold text. No `bg-*` fill on active items per design direction.

### AppShell Responsive Layout

Use Tailwind responsive prefixes for the 3 breakpoints:
- `lg:` (≥1024px) — full sidebar `w-sidebar`
- `md:` (768–1023px) — collapsed sidebar `w-sidebar-collapsed`
- default (≤767px) — no sidebar, bottom tab bar

The SideNav fixed position must NOT overlap the TopBar. Use `top-14` (clears the `h-14` TopBar) on the SideNav. Main content uses `pt-14` to clear TopBar.

### Existing `globals.css` Structure — Do Not Break

The existing file has:
```
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@custom-variant dark (...);
@theme inline { /* 40+ lines — shadcn color+font mappings */ }
:root { /* shadcn default vars */ }
.dark { /* dark mode vars */ }
@layer base { * { ... } body { ... } html { ... } }
```

**Safe edit approach**:
1. Override specific `:root` vars by adding/changing values in the existing `:root` block
2. Append new color mappings to the END of the existing `@theme inline` block (before closing `}`)
3. Add a new `@theme { }` block AFTER the `@theme inline` block

### AGENTS.md Warning

The `app/AGENTS.md` file contains: _"This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."_

Before implementing route groups `(auth)` and `(app)`, check `node_modules/next/dist/docs/` for any Next.js 16 changes to the App Router. Key areas to verify: route group layout nesting, redirect behavior, Link component API.

### Route Group File Creation Order

Create files in this order to avoid import errors:
1. `src/app/(auth)/layout.tsx`
2. `src/app/(auth)/login/page.tsx`
3. `src/app/(app)/layout.tsx` (imports AppShell — create AppShell first)
4. Stub pages for all 4 app routes
5. Update `src/app/page.tsx` to redirect

### What This Story Does NOT Include

- No authentication logic (Story 1.3)
- No middleware (Story 1.3)
- No Supabase queries or Server Actions
- No data-fetching in any component — all stubs return static JSX
- No shadcn sidebar component — build custom SideNav per UX spec
- No `src/components/atoms/` components beyond what already exists (`Button` from shadcn)
- The `src/components/atoms/` directory is created but only populated in later stories

### Project Structure Notes

Files to create in this story:
```
src/
├── app/
│   ├── layout.tsx                         # MODIFY: swap Geist → Inter font
│   ├── page.tsx                           # MODIFY: redirect to /active-inquiries
│   ├── globals.css                        # MODIFY: add design tokens
│   ├── (auth)/
│   │   ├── layout.tsx                     # NEW: minimal public layout
│   │   └── login/
│   │       └── page.tsx                   # NEW: placeholder
│   └── (app)/
│       ├── layout.tsx                     # NEW: AppShell wrapper
│       ├── active-inquiries/
│       │   └── page.tsx                   # NEW: stub
│       ├── suppliers/
│       │   └── page.tsx                   # NEW: stub
│       ├── products/
│       │   └── page.tsx                   # NEW: stub
│       └── sources/
│           └── page.tsx                   # NEW: stub
└── components/
    ├── organisms/
    │   ├── TopBar.tsx                     # NEW
    │   ├── TopBar.test.tsx                # NEW (optional, basic render test)
    │   ├── SideNav.tsx                    # NEW
    │   └── SideNav.test.tsx               # NEW
    └── templates/
        ├── AppShell.tsx                   # NEW
        └── AppShell.test.tsx              # NEW
```

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Implementation Patterns (Atomic Design, naming, no arbitrary Tailwind values)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Complete Project Directory Structure
- Epics: `_bmad-output/planning-artifacts/epics.md` — Story 1.2 acceptance criteria
- Epics: `_bmad-output/planning-artifacts/epics.md` — UX-DR1 (token groups), UX-DR2 (AppShell), UX-DR3 (SideNav), UX-DR14 (color system)
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` — Design System Foundation, Visual Design Foundation, Design Direction "The Architectural Curator"
- Story 1.1: `_bmad-output/implementation-artifacts/1-1-project-initialization-development-environment.md` — Debug Log: Tailwind v4 deviation, Next.js 16 async cookies, Supabase CLI v2 keys

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

1. **shadcn tooltip uses @base-ui/react, not @radix-ui** — The installed `tooltip.tsx` uses `@base-ui/react/tooltip` which has a `render` prop API instead of `asChild`. Used `render={linkContent}` on `TooltipTrigger` for collapsed SideNav. The `asChild` pattern from shadcn/Radix docs does NOT apply here.

2. **RTL cleanup requires explicit `afterEach`** — Added `afterEach(cleanup)` to `src/test/setup.ts` as Vitest v4 did not auto-cleanup between tests.

### Completion Notes List

- Task 1: All design tokens added to `globals.css` — `:root` overrides for primary/background/muted-foreground/destructive, custom surface colors, `@theme inline` extensions, new `@theme` block for typography/layout/grid tokens. Font switched Geist → Inter in `layout.tsx`.
- Task 2: `tooltip` and `separator` shadcn components installed. `lucide-react` confirmed available. `TooltipProvider` added to root `layout.tsx` as required by shadcn.
- Task 3: Route groups `(auth)` and `(app)` created with their layouts. All 4 stub pages created. Root page redirects to `/active-inquiries`.
- Task 4: `TopBar` organism created as Server Component with glassmorphism styling.
- Task 5: `SideNav` organism created as Client Component with `usePathname` for active detection, all 4 nav items, responsive collapsed/expanded states, Tooltip for icon-only mode.
- Task 6: `AppShell` template created with CSS-responsive sidebar (visible at md/lg), bottom tab bar (hidden at md+), proper padding offsets.
- Task 7: 14 tests written and passing. `src/test/setup.ts` updated with `afterEach(cleanup)`.
- Build: `npm run build` passes with no TypeScript errors.

### File List

- `src/app/globals.css` — modified: design tokens
- `src/app/layout.tsx` — modified: Inter font, TooltipProvider
- `src/app/page.tsx` — modified: redirect to /active-inquiries
- `src/app/(auth)/layout.tsx` — new
- `src/app/(auth)/login/page.tsx` — new
- `src/app/(app)/layout.tsx` — new
- `src/app/(app)/active-inquiries/page.tsx` — new
- `src/app/(app)/suppliers/page.tsx` — new
- `src/app/(app)/products/page.tsx` — new
- `src/app/(app)/sources/page.tsx` — new
- `src/components/organisms/TopBar.tsx` — new
- `src/components/organisms/SideNav.tsx` — new
- `src/components/organisms/SideNav.test.tsx` — new
- `src/components/templates/AppShell.tsx` — new
- `src/components/templates/AppShell.test.tsx` — new
- `src/components/ui/tooltip.tsx` — new (shadcn add tooltip)
- `src/components/ui/separator.tsx` — new (shadcn add separator)
- `src/test/setup.ts` — modified: added afterEach cleanup

## Change Log

- 2026-03-21: Story 1.2 implemented — design tokens, AppShell, SideNav, TopBar, route groups, stub pages (14 tests passing, build clean)
