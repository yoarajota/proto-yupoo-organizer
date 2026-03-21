---
name: No arbitrary Tailwind values
description: User requires all Tailwind values be defined in theme config — no arbitrary values like text-[10px] or w-[240px]
type: feedback
---

Never use arbitrary Tailwind CSS values (e.g. `text-[10px]`, `w-[240px]`, `text-[11px]`, `gap-[6px]`). All sizing, spacing, typography, and color values must be defined as named tokens in `tailwind.config` and referenced by name.

**Why:** Arbitrary values bypass the theme system, making global changes (scaling, rebranding, responsive adjustments) require grep-and-replace instead of a single config edit. They also signal inconsistency in the design token model.

**How to apply:** When writing or reviewing any Tailwind code for this project, flag and replace arbitrary values with theme-defined tokens. If a required value doesn't exist in the theme, add it to `tailwind.config` first, then use the named token.
