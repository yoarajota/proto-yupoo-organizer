# Proto Yupoo Organizer

Inventory and supplier management tool for product sourcing workflows.

## Features

- Product catalog with image similarity detection (pHash matching)
- Supplier management with inquiry history
- Active inquiries tracking with product photos
- Source library with filtering
- Group-based organization
- Supabase authentication and real-time data

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict)
- **Database:** Supabase (PostgreSQL + Auth)
- **Validation:** Zod schemas
- **Testing:** Vitest (unit) + Playwright (e2e)
- **UI:** shadcn/ui + TailwindCSS

## Getting Started

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Testing

```bash
npm test          # unit tests
npx playwright test  # e2e tests
```
