---
paths: "**/*.{ts,tsx}"
---

# No Inline Server Actions in Client Components

Inline `"use server"` functions inside Client Components are **not allowed** by Next.js.

## Rule

- If a file has `"use client"` at the top → it MUST NOT contain any function or closure with `"use server"` inside its body.
- Server Actions must live in dedicated module files (e.g. `src/actions/*.ts`) where `"use server"` appears at the **top of the file**.
- Inline `"use server"` is only valid inside **Server Components** (files without `"use client"`).

## Bad — will throw a Next.js build error

```tsx
"use client";

export function MyForm() {
  async function submit(data: FormData) {
    "use server"; // ❌ not allowed inside a Client Component
    await db.save(data);
  }
  return <form action={submit}>...</form>;
}
```

## Good — extract to a separate actions file

```ts
// src/actions/my-feature.ts
"use server";

export async function submit(data: FormData) {
  await db.save(data); // ✅ Server Action in its own module
}
```

```tsx
// src/components/MyForm.tsx
"use client";
import { submit } from "@/actions/my-feature";

export function MyForm() {
  return <form action={submit}>...</form>; // ✅
}
```

## Good — inline is fine in a Server Component

```tsx
// No "use client" → this is a Server Component
export default function Page() {
  async function submit(data: FormData) {
    "use server"; // ✅ allowed in Server Components
    await db.save(data);
  }
  return <form action={submit}>...</form>;
}
```

## Where to put new Server Actions

Place all extracted Server Actions in `src/actions/<domain>.ts` with `"use server"` as the first line of the file.
