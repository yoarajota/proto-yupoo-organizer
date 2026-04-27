# Debug Session

## Symptom

Running scripts/create-admin-user.ts fails with Node ESM error: ERR_UNKNOWN_FILE_EXTENSION (.ts).

## Hypotheses

| ID  | Hypothesis                             | Confidence | Status |
| --- | -------------------------------------- | ---------- | ------ |
| H-1 | TypeScript runner missing/ts-node error | medium     | active |
| H-2 | Env vars missing in .env.local          | medium     | active |
| H-3 | Supabase not running or URL mismatch    | low        | active |

## Investigation Log

### [step-1] Reproduced failure with ts-node

- Action: Ran pnpm dlx ts-node --files scripts/create-admin-user.ts.
- Result: TypeError ERR_UNKNOWN_FILE_EXTENSION for .ts.
- Eliminated: None.
- Narrowed: Failure is in TypeScript runtime loader (ESM handling), before script logic runs.

## Current Focus

Select a TS runner that supports ESM (tsx or ts-node/esm).

## Binary Search Position

Fails at TS runtime loader; not reaching script execution.

## Confirmed Root Cause

TBD

## Fix Applied

TBD
