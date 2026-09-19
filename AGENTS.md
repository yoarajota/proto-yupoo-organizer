<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions

- **Package manager:** pnpm. Build-script approvals live in `pnpm-workspace.yaml` (`allowBuilds`); pnpm 11 ignores the `pnpm` field in `package.json`.
- **Supabase CLI:** not installed globally. Use `npx supabase@latest <command>`.
- **Generated types:** `src/types/database.ts` comes from `npx supabase@latest gen types typescript --local > src/types/database.ts` (stdout only). Regenerate after every migration, or `pnpm build` fails on stale table types.
- **Components:** Atomic Design under `src/components/` (`atoms` → `molecules` → `organisms` → `templates`; `ui` holds shadcn primitives). Classify a component before creating it; build an organism from existing molecules and atoms, and keep atom-level styling out of templates.
- **Tailwind:** no arbitrary values (`w-[313px]`, `text-[#abc]`). Define tokens in the Tailwind theme (`@theme` in `src/app/globals.css`, `tailwind.config.ts`) and use those.
- **Server actions:** live in `src/actions/*.ts` with `"use server"` at the top of the file. A file with `"use client"` must never contain an inline `"use server"` function (see `.agent/rules/no-inline-server-actions-in-client-components.md`).
- **Naming:** kebab-case for directories, actions, schemas and utilities; PascalCase for components; tests sit next to their source as `<file>.test.ts[x]`.
- **Verification before merge:** `pnpm exec tsc --noEmit`, `pnpm test:run`, `pnpm build` (CI runs these).
- **Docs:** see `docs/architecture.md` and `docs/data-model.md`.
