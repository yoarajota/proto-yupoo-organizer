# Debug Session

## Symptom

After clicking `Run Discovery`, the mission transitions to `scanning` but does not advance to `classifying_categories`, `failed_retrying`, or another terminal/next state.

## Hypotheses

| ID  | Hypothesis | Confidence | Status |
| --- | ---------- | ---------- | ------ |
| H-1 | The Next worker endpoint is reachable and running, but the discovery stage hangs inside Yupoo scraping with no timeout, so the queue processor never reaches success/failure DB updates. | high | active |
| H-2 | The worker stage finishes, but final mission status update fails silently or is overwritten, leaving `sourcing_missions.status = scanning`. | medium | active |
| H-3 | The Edge Function process is killed or interrupted after setting `scanning` and before its failure handler writes `failed_retrying`. | medium | active |
| H-4 | The queue message is being retried concurrently by multiple consumers, and a later retry resets the mission back to `scanning`. | low | active |

## Investigation Log

### [2026-05-08T23:16:22-03:00] Initial code boundary scan

- Action: Inspected queue processor and stage runner status transitions.
- Result: `mission-queue` sets mission status to `scanning` before calling the worker. It should set `failed_retrying` inside a catch if `dispatchMissionStage` or downstream execution throws. The worker discovery runner should set `classifying_categories` after discovery succeeds.
- Eliminated: None.
- Narrowed: The stuck state is likely between `mission-queue` setting running state and either the worker returning or the failure handler completing.

## Current Focus

Test H-1: determine whether discovery has an unbounded network/scrape path that can keep the worker request open indefinitely.

## Binary Search Position

Boundary established: enqueue worked and queue consumer reached `processMessage` far enough to set `scanning`. Unknown whether execution is inside worker, after worker, or interrupted before catch.

## Confirmed Root Cause

TBD

## Fix Applied

TBD

### [2026-05-08T23:18:00-03:00] Checked discovery scraper time budget

- Action: Inspected `src/lib/yupoo/scout.ts` and `src/lib/mission-stage-runner.ts`.
- Result: Each Yupoo fetch has a 15s timeout, but queued discovery calls `scrapeYupooDiscovery(seedUrl)` with the default 24 request limit. Worst-case discovery can take about 6 minutes before the worker returns. The Edge Function marks `scanning` before waiting for the worker, so a long worker run or Edge Function timeout can leave the mission stuck in `scanning` without reaching success/failure updates.
- Eliminated: H-2 is less likely as the final status update code exists and throws on DB errors.
- Narrowed: H-1/H-3 are the leading causes: unbounded-for-Edge discovery duration leaves queue processor waiting or interrupted after setting `scanning`.

## Current Focus

Apply a bounded local/queued worker execution budget: cap discovery request count and add worker callback timeout in the Edge Function so failures are written before runtime termination.

### [2026-05-08T23:19:00-03:00] Applied bounded worker execution

- Action: Added `MISSION_DISCOVERY_MAX_REQUESTS` handling in the Next worker stage runner and `MISSION_WORKER_TIMEOUT_MS` handling in the Edge Function worker callback.
- Result: Queued discovery now defaults to 6 Yupoo requests instead of 24, and the Edge Function aborts worker callbacks after 120s so it can write `failed_retrying` instead of waiting indefinitely.
- Eliminated: H-2 remains unlikely; tests confirm queue and worker route behavior still passes.
- Narrowed: H-1/H-3 addressed by bounding the worker and making timeout explicit.

## Confirmed Root Cause

Queued discovery could run longer than the Edge Function's practical execution window because it allowed up to 24 sequential 15s fetches. Since the queue processor sets `scanning` before waiting for the worker response, an overlong worker call could leave the mission in `scanning` without a success/failure status update.

## Fix Applied

Added `MISSION_DISCOVERY_MAX_REQUESTS` with a default of 6 for the Next worker, and `MISSION_WORKER_TIMEOUT_MS` with a default of 120000 for the Edge Function callback. Updated env examples and README. Verified focused lint and tests pass.
