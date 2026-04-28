# Debug Session

## Symptom

Some Yupoo category preview images are not being captured by `extractCategoryPreviewImageUrls`, even though they appear in the category page HTML.

## Hypotheses

| ID  | Hypothesis                             | Confidence | Status |
| --- | -------------------------------------- | ---------- | ------ |
| H-1 | The extractor is scoped to the wrong container (`.categories__children` only) and some previews live elsewhere. | high | active |
| H-2 | The extractor requires both `album__absolute` and `album__img` on the same `div`/`img`, but some pages split those classes across wrapper and child elements. | high | active |
| H-3 | The extractor reads too few URL-bearing attributes (`src`, `data-src`, `data-original`, `data-image`, inline `style`) and misses other Yupoo variants. | medium | active |

## Investigation Log

### [step-1] Read parser and tests for preview extraction

- Action: Inspected `src/lib/yupoo/scout.ts` and `src/lib/yupoo/scout.test.ts`.
- Result: `extractCategoryPreviewImageUrls` only searches inside `div.categories__children`, only matches `<div>` and `<img>`, and only accepts elements that have both `album__absolute` and `album__img` on the same tag. Tests cover only that exact structure.
- Eliminated: None.
- Narrowed: Failures are most likely caused by real Yupoo markup diverging from the narrow test fixture shape.

## Current Focus

Confirm which HTML pattern differs from the extractor assumptions: container, class placement, or image attribute.

## Binary Search Position

Parser narrowed to one function; current boundary is between the tested synthetic HTML shape and the real Yupoo page shape.

## Confirmed Root Cause

TBD

## Fix Applied

TBD
