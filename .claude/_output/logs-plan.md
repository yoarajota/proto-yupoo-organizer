# Log-Driven Tuning Toolkit

## Summary

Build a developer-only, local-first toolkit that turns storage/agent-logs/scouting/ and storage/agent-logs/classification/ into actionable analysis
artifacts for classifier tuning. The first pass should not change product behavior, database schema, or the operator workflow. Its job is to make
each run explainable across missions, quantify review noise, surface threshold opportunities, and shorten the loop from “manual review pain” to a
concrete classifier change.

## Key Changes

- Add a local analysis module and CLI entrypoint that reads both per-run JSON files and summary.jsonl, validates the known log shapes, and produces
  normalized in-memory records for downstream reporting.
- Generate derived reports under a separate ignored local path such as storage/agent-reports/:
  - mission snapshot report for a single run
  - longitudinal aggregate report across many runs
  - top review-reason report
  - duplicate/repetition hotspot report
  - “likely safe auto-accept candidates” report based on current evidence fields, without mutating source data
- Define a stable report schema for derived artifacts:
  - run metadata: mission id, timestamps, seed URL, counts
  - review burden metrics: pending review totals, grouped review reasons, review-rate percentages
  - duplicate metrics: repeated normalized labels, repeated within-shop labels, repeated brand+product pairs
  - confidence slices: auto-accepted vs review distributions by method and reason
  - candidate tuning hints: labels that repeatedly land in review with strong exact alias matches or repeated signal patterns
- Add a small developer-facing command surface in package.json, for example:
  - one command to summarize all classification runs
  - one command to inspect a single mission log
  - one command to emit candidate-tuning recommendations
- Keep all recommendations advisory in v1:
  - no automatic edits to thresholds or alias config
  - no Supabase writes
  - no in-app diagnostics UI yet
- Add a compact tuning ruleset for the analyzer so recommendations are deterministic:
  - flag repeated needs_review product-only exact matches by frequency and shop spread
  - flag repeated brand_product_below_strict_threshold cases near the strict threshold
  - flag embedding-only brand guesses that often fail to gain product support
  - separate high-signal candidates from noisy/ambiguous labels so reports do not over-suggest aggressive automation
- Add a short developer doc describing:
  - how to run the analyzer
  - where reports are written
  - how to interpret each report
  - the intended workflow: collect logs, run analyzer, inspect candidate suggestions, then update classifier rules manually in a later pass

## Public Interfaces / Types

- Add internal-only report/analyzer types for:
  - parsed scouting run
  - parsed classification run
  - aggregate classification summary
  - tuning candidate
- Add internal-only scripts or library entrypoints for:
  - analyzeClassificationLogs(...)
  - analyzeScoutingLogs(...)
  - buildTuningRecommendations(...)
- No external API changes.
- No database schema changes.
- No changes to the existing server action return shapes.

## Test Plan

      - skips or reports malformed files without crashing the whole analysis run
      - computes duplicate/repeated-label hotspots correctly
      - computes review-rate and auto-accept-rate summaries correctly
      - promotes only high-signal repeated cases into recommendation output
      - does not recommend ambiguous product-only labels with weak evidence

- Command tests:
  - single-mission analysis writes the expected report artifact
  - aggregate analysis writes the expected summary artifact
  - empty-log-directory case returns a clear, non-failing message
- Manual scenarios:
  - run a noisy Yupoo mission, then generate a mission report and confirm the report explains why labels landed in review
  - run aggregate analysis on multiple missions and confirm the top recommendation buckets align with observed review pain
  - confirm all outputs stay local under ignored directories and do not affect app behavior

## Assumptions and Defaults

- First pass is developer tooling only, not operator-facing product UX.
- Raw logs remain the source input; derived reports are secondary artifacts written locally and git-ignored.
- Recommendations remain advisory and deterministic; humans still decide whether to change thresholds, aliases, or grouping rules afterward.
- The analyzer should prefer classification logs as the primary tuning source and use scouting logs mainly for mission/source context.
- If no real logs exist yet, the toolkit should still work against fixtures in tests and fail gracefully at runtime with a clear “no logs found”
  result.
