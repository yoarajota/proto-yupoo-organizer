# Yupoo Autonomous Sourcing Agent Layer (Technical Spec)

## 1. Context

The current sourcing workflow is manual and slow. The requested feature is an autonomous agent layer in this app that:
- Scans Yupoo home and extracts categories.
- Finds suppliers for specific product intents.
- Generates structured English message suggestions to request prices.
- Supports catalogue workflows (both outbound catalogue requests and internal catalogue summaries).
- Optimizes for faster sourcing cycle time.

This spec is based on approved decisions:
- Channel integration: deferred in v1 (suggestion-only)
- Language: English
- Primary objective: faster sourcing
- Catalogue scope: both outbound request + internal summary
- Scraping stack: Crawlee
- Orchestration: pg_cron

## 2. Objective and Success Criteria

### Objective
Reduce the time from sourcing brief creation to first valid supplier quote by introducing a semi-autonomous agent workflow with human approval gates for outbound message suggestions.

### Primary KPI
- Time from brief creation to first valid quote (target: reduce vs current baseline)

### Supporting KPIs
- Time from brief creation to first outbound-ready message suggestion batch
- Suppliers contacted per 10 minutes
- Reply parsing latency (message received to normalized offer)

## 3. Scope

### In Scope (v1)
- Yupoo category discovery from home and category pages.
- Product-intent-to-supplier matching and ranking.
- English outbound message suggestion generation (structured, deterministic templates).
- Human approval queue for final copy/export.
- Inbound reply parsing into normalized offer data.
- Catalogue support:
  - Outbound catalogue request templates.
  - Internal catalogue summary extraction from supplier responses.

### Out of Scope (v1)
- Direct channel integrations and sending automation (WhatsApp/email/WeChat/etc).
- Multilingual messaging.
- Fully autonomous sending without human approval.
- Price-optimization-first policies (speed is prioritized).

## 4. Users and Actors

- Sourcing operator: creates briefs, reviews ranked suppliers, approves outgoing messages.
- Agent layer (system): crawls, matches, drafts, parses, and recommends next actions.

## 5. Functional Requirements

### FR-1: Sourcing Mission Creation
- Operator can create a sourcing mission with product intent, constraints, and destination context.
- Mission status lifecycle must be persisted.

### FR-2: Yupoo Discovery (Scout Agent)
- System crawls Yupoo home and linked category pages using Crawlee.
- Extracts category hierarchy and candidate supplier references.
- Stores discovered records with timestamp and extraction confidence.

### FR-3: Supplier Matching (Match Agent)
- System maps mission intent to discovered categories/suppliers.
- Produces ranked shortlist with relevance rationale.
- Prioritizes freshness and response-likelihood signals when available.

### FR-4: Outbound Message Suggestion Generation (Outreach Agent)
- System generates English outbound message suggestions per shortlisted supplier.
- Suggestions use deterministic structured templates (no LLM requirement for v1).
- Each suggestion includes:
  - Product intent
  - Price ask
  - MOQ ask
  - Lead time ask
  - Catalogue request
- Suggestions are queued for human approval before manual use/export.

### FR-5: Catalogue Workflows
- Outbound: include explicit request for latest catalogue in outreach template.
- Inbound: parse incoming catalogue details from text/media metadata into internal summary fields.

### FR-6: Reply Parsing and Offer Normalization (Negotiation/Extraction Agent)
- Parse supplier replies and extract:
  - Unit price or price range
  - MOQ
  - Lead time
  - Shipping or terms notes
- Persist normalized offers linked to mission and supplier.

### FR-7: Next-Reply Recommendation
- Generate a suggested follow-up response optimized for speed to valid quote closure.
- Keep human-in-the-loop for approval in v1.

### FR-8: Auditability
- Persist every generated suggestion, parsed extraction, and approval action with timestamps.

## 6. Non-Functional Requirements

- Performance: prioritize low mission-to-outbound latency.
- Reliability: retries and idempotency for crawl and parse jobs.
- Explainability: ranking outputs must include reason fields.
- Observability: mission-level metrics and stage durations are queryable.
- Safety: v1 does not perform automated sending; outputs are suggestions only.

## 7. Constraints

- Channel integration is deferred in v1; only channel-ready suggestions are generated.
- Language is English only.
- Speed is the primary optimization axis.
- Scope is limited to Yupoo-based discovery for v1.
- Crawl implementation uses Crawlee.
- Job orchestration uses pg_cron.

## 8. Proposed Architecture

Semi-autonomous pipeline with four logical agents:
1. Scout Agent: discovery and category extraction.
2. Match Agent: intent matching and supplier ranking.
3. Outreach Agent: structured message suggestion generation and approval queue preparation.
4. Negotiation/Extraction Agent: inbound parsing and follow-up recommendations.

Execution pattern:
- Planner orchestrates mission stages.
- pg_cron schedules and triggers worker jobs for crawl/match/generate/parse tasks.
- Crawlee powers Yupoo crawling and extraction workers.
- If runtime isolation is needed, Crawlee workers can run as a dedicated containerized scraping service.
- Human approval checkpoint gates manual outbound execution.

## 9. Data Model Additions (Proposed)

### sourcing_missions
- id
- created_by
- product_intent
- objective (default: speed)
- status
- created_at
- updated_at

### discovered_categories
- id
- source_url
- category_path
- extracted_at
- confidence

### discovered_suppliers
- id
- supplier_key
- source_url
- category_refs
- last_seen_at
- confidence

### mission_supplier_matches
- id
- mission_id
- supplier_id
- rank_score
- rank_reasons (json)
- created_at

### outreach_suggestions
- id
- mission_id
- supplier_id
- channel_hint (whatsapp)
- language (en)
- message_text
- status (pending_approval/approved/exported)
- created_at
- approved_by
- approved_at

### supplier_messages
- id
- mission_id
- supplier_id
- direction (outbound/inbound)
- channel
- body
- received_or_sent_at

### normalized_offers
- id
- mission_id
- supplier_id
- unit_price
- currency
- moq
- lead_time
- terms_notes
- extraction_confidence
- extracted_at

### catalogue_summaries
- id
- mission_id
- supplier_id
- catalogue_requested_at
- catalogue_received_at
- summary_text
- summary_confidence

## 10. Workflow State Machine (Mission)

1. created
2. scanning
3. matching
4. suggestions_ready
5. awaiting_approval
6. approved_for_outreach
7. replies_received
8. offers_normalized
9. completed

Failure/exception states:
- blocked_needs_input
- failed_retrying
- failed_terminal

## 11. API and Action Surface (Proposed)

- createSourcingMission(input)
- runMissionDiscovery(missionId)
- runMissionMatching(missionId)
- generateOutreachSuggestions(missionId)
- approveSuggestion(suggestionId)
- exportApprovedSuggestion(suggestionId)
- ingestInboundMessage(payload)
- parseInboundOffers(missionId)
- suggestFollowUp(missionId, supplierId)
- getMissionMetrics(missionId)

## 12. Message Template Requirements (English, Channel-Ready)

Each suggestion must include:
- Buyer intent sentence.
- Product specification summary.
- Direct asks: price, MOQ, lead time.
- Catalogue request line.
- Requested response format to accelerate parsing.

## 13. Telemetry and Measurement

Track at mission level:
- t_brief_to_first_suggestion_batch
- t_brief_to_first_valid_quote
- suppliers_contacted_per_10m
- t_inbound_to_offer_normalized

Track at stage level:
- discovery_duration
- matching_duration
- suggestion_generation_duration
- parse_duration

## 14. Risks and Mitigations

- Risk: low-quality extraction from noisy supplier replies.
  - Mitigation: confidence fields + manual correction path.
- Risk: outbound quality inconsistency.
  - Mitigation: strict template schema + approval gate.
- Risk: crawl instability.
  - Mitigation: Crawlee retries/backoff + resilient parsers.
- Risk: orchestration drift or duplicate stage execution.
  - Mitigation: pg_cron schedule governance + idempotent mission-stage handlers.

## 15. Assumptions

- Existing app can support background jobs/actions for asynchronous mission stages.
- Operators can manually use/export approved suggestions in their outreach channel.
- Yupoo pages required for discovery are reachable and parseable.

## 16. Acceptance Criteria

1. Operator can create a mission and trigger discovery.
2. System stores extracted Yupoo categories and candidate suppliers.
3. System produces a ranked shortlist for a mission.
4. System generates English structured outbound suggestions including catalogue request.
5. Suggestions require explicit approval before manual use/export.
6. Inbound replies are parsed into normalized offers.
7. Catalogue summaries are persisted when responses include catalogue information.
8. KPI metrics are queryable for each mission.

## 17. Delivery Slices (Implementation Plan)

1. Mission model + state machine + metrics scaffolding.
2. Scout agent with Crawlee-based Yupoo category extraction persistence.
3. Match agent ranking pipeline.
4. Structured outreach suggestion generation + approval/export queue.
5. Inbound parsing + normalized offers + catalogue summaries.
6. pg_cron job scheduling + stage reliability hardening + KPI dashboards/reporting endpoints.

## 18. Pipeline Entry Note

This spec is intended as direct input for the pipeline workflow.
