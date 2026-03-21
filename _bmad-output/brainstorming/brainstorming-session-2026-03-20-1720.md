---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'App to organize Yupoo market research for Brazilian importers'
session_goals: 'Identify features and approaches to automate/organize product price research across multiple Yupoo stores, reduce manual WhatsApp outreach friction, and detect same-supplier stores via photo similarity'
selected_approach: 'user-selected'
techniques_used: ['Decision Tree Mapping']
ideas_generated: 18
session_active: false
workflow_completed: true
---

# Brainstorming Session Results

**Facilitator:** Jota_
**Date:** 2026-03-20

## Session Overview

**Topic:** App to organize Yupoo market research for Brazilian importers
**Goals:** Identify features and approaches to automate/organize product price research across multiple Yupoo stores, reduce manual WhatsApp outreach friction, and detect same-supplier stores via photo similarity

## Technique Selection

**Approach:** User-Selected Techniques
**Selected Techniques:**
- **Decision Tree Mapping** — Map all possible decision paths and outcomes to reveal hidden opportunities and risks. Applied to the full Yupoo research workflow from brand discovery to price confirmation.

**Selection Rationale:** User chose structured thinking to map the real workflow before designing solutions.

---

## Technique Execution Results

### Decision Tree Mapping — 18 Decision Nodes

**[Decision #1]**: The Lost Thread
_Concept_: You send a WhatsApp message about a product to a Yupoo shop. The reply comes hours or days later due to timezone gap. By then, context is lost — which product, which shop, what you were comparing it to.
_Novelty_: Even with just a few conversations, zero structure means losing track. The problem isn't volume — it's that there's no "research object" tying conversations together.

**[Decision #2]**: The Variant Discovery Problem
_Concept_: You start looking for a specific product, but during the search you discover different shops stock different variants (colorways, sizes, models) others don't carry. Research scope expands mid-session unexpectedly.
_Novelty_: App needs to handle "product family" tracking, not just exact-match price comparison. A shop isn't just cheaper — it might have exclusive options.

**[Decision #3]**: The Inbound Enrichment Drop
_Concept_: Sellers don't just reply with a price — they send photos, new product info, sometimes alternative suggestions. This valuable data lands in WhatsApp and dies there.
_Novelty_: The reply itself is a research artifact. Capturing seller replies (price + photos + notes) transforms WhatsApp from a dead-end into a data source.

**[Decision #4]**: The Manual Duplicate Hunt
_Concept_: User visually scans photos across shops to guess if they share a factory supplier, then cross-references WhatsApp history to see if they already contacted that supplier. This is 100% mental RAM.
_Novelty_: Image similarity matching (perceptual hashing) could automatically flag "this shop uses photos you've seen before" — eliminating duplicate-detection tax entirely.

**[Decision #5]**: The Negotiation Elasticity Signal
_Concept_: Price isn't the final answer — what matters is how much a seller is willing to move from their opening price. A seller who quotes high but negotiates hard might be better than one who quotes low and won't budge.
_Novelty_: App could track opening price vs. final agreed price across sellers over time, building a "negotiation elasticity" profile per shop.

**[Decision #6]**: The Trust Capital Problem
_Concept_: Importers don't just want the cheapest price — they want reliable, responsive suppliers to return to repeatedly. Trust is built through responsiveness, price consistency, and reliability. This knowledge lives only in the importer's head.
_Novelty_: App could build a "trust score" per supplier based on behavioral signals: response time, price consistency, negotiation reliability.

**[Decision #7]**: The Bookmark CRM
_Concept_: Trusted supplier knowledge currently lives in browser bookmarks — no notes, no price history, no contact info, no last-interaction date. Just a URL.
_Novelty_: Even replacing bookmarks with a structured card (shop name + WhatsApp + last price + trust notes + product categories) would be a massive upgrade with near-zero learning curve.

**[Decision #8]**: Photo as Product Identity
_Concept_: Product identity in this ecosystem is visual, not textual. The same item has no consistent name across shops — only its photos are stable. The photo IS the product ID.
_Novelty_: App's data model should be photo-first: drop a photo, app creates a Product card, then attach suppliers/prices/inquiry status to that photo. No typing product names ever.

**[Decision #9]**: The Brand Research Archive
_Concept_: Before reaching a supplier, user had to find them somewhere — Reddit, Discord, a friend's tip. That source is lost the moment the tab closes. No memory of where a supplier came from or when they were found.
_Novelty_: App stores not just the supplier, but the discovery source — "found via Reddit r/reps, March 2026" — so user can return to the same source for new brands later.

**[Decision #10]**: The Source Reuse Problem
_Concept_: A Reddit thread or Discord server is a living source — people keep posting new shop recommendations over time. User either remembers to go back or doesn't.
_Novelty_: App lets user save a source (URL + context) tagged with multiple brands — so researching a new brand starts with checking saved sources before going to Reddit manually.

**[Decision #11]**: The Multi-Platform Source Hunt
_Concept_: Brand research is scattered across Reddit, Discord, WhatsApp groups, and other forums. Each platform has different communities with different supplier knowledge. Currently visited manually with no memory of what was found where.
_Novelty_: Sources stored with platform tags (Reddit/Discord/WhatsApp/etc.) + brand tags — "find suppliers for Brand X" becomes "check saved sources tagged Brand X" first.

**[Decision #12]**: The Supplier Brand Sprawl
_Concept_: A supplier contacted for Brand X reveals they also carry Brand Y and Z. This valuable intelligence gets buried in WhatsApp or forgotten entirely.
_Novelty_: Supplier cards track all brands they carry — turning a single inquiry into a multi-brand asset. Over time builds a map of "which suppliers cover which brands."

**[Decision #13]**: The Scam Signal Filter
_Concept_: Community posts serve as a passive vetting layer. A single credible scam report is enough to disqualify a supplier. This judgment happens in the user's head while reading and is never recorded.
_Novelty_: App lets user attach a "red flag" note to a supplier when a scam report is seen — with the source link. Months later, the warning is still there.

**[Decision #14]**: The Intent Signal Choreography
_Concept_: The inquiry has two distinct phases — price discovery (neutral) and negotiation (active buying signals). Mixing them too early weakens negotiation position. This choreography is entirely manual and instinctive.
_Novelty_: App tracks which phase each inquiry is in — helping manage multiple parallel negotiations without accidentally sending wrong signals to the wrong supplier.

**[Decision #15]**: Manual Logging as Feature, Not Bug
_Concept_: The act of logging an inquiry is deliberate — user chooses what matters. Keeps the app lightweight, avoids complexity of WhatsApp integration or data privacy concerns.
_Novelty_: Intentional friction of manual entry is acceptable if the payoff (organized context, no lost threads) is immediate and visible.

**[Decision #16]**: Shared Source Library
_Concept_: Users contribute sources (Reddit threads, Discord servers, forum links) to a shared pool tagged by brand and platform. Friends-only, trust is implicit — no moderation needed.
_Novelty_: Turns individual bookmark folders into collective intelligence. If a friend already found the best Discord for Brand X, you don't hunt for it yourself.

**[Decision #17]**: Collaborative Price Intelligence
_Concept_: Suppliers, inquiries, and prices are all shared among the friend group. If a friend already got a price quote from Supplier X for Product Y last week, you don't need to ask again.
_Novelty_: Transforms redundant parallel research into a shared knowledge base. Group collectively builds pricing intelligence over time.

**[Decision #18]**: Price as Historical Reference
_Concept_: Shared prices aren't "the price" — they're a benchmark. Knowing Supplier X quoted a certain amount to a friend last month tells you the expected range and when you're being overcharged.
_Novelty_: Shifts the power dynamic — you enter every WhatsApp inquiry already knowing the expected range, not starting blind.

---

### Session Setup

User is a Brazilian importer who researches products on Yupoo (Chinese marketplace). The workflow is painful:
- Browse Yupoo stores
- Identify product of interest
- Contact seller on WhatsApp: send link + photo + ask price
- Repeat across many stores (which often share the same factory/supplier)
- Compare prices across stores manually

Key insight: stores using identical photos likely share the same supplier/factory. This is a visual deduplication signal that could be automated.

Goal: an app that dramatically reduces the QOF (Quality of F*cking-life — how boring and repetitive this process is).

---

## Idea Organization and Prioritization

### Thematic Organization

**Theme 1: Product Identity**
*Photo is the universal identifier — not names, not links*
- #8 Photo as Product ID — Drop a photo, create a Product card. Suppliers, prices, inquiries attach to it.
- #2 Variant Discovery — Product families, not exact matches. A shop might have exclusive options.
- #4 Manual Duplicate Hunt → Photo similarity flagging to auto-detect same-factory suppliers.

**Theme 2: Supplier Intelligence**
*From browser bookmarks to structured relationship data*
- #7 Bookmark CRM → Structured supplier cards (WhatsApp, last price, trust notes, brands carried)
- #6 Trust Capital → Behavioral trust score: response time, price consistency, negotiation reliability
- #12 Brand Sprawl → Supplier cards track all brands they carry
- #13 Scam Signal Filter → Red flag notes with source link, persisted forever
- #5 Negotiation Elasticity → Track opening price vs. final price per supplier over time

**Theme 3: Inquiry Tracking**
*Replacing WhatsApp chaos with structured research objects*
- #1 Lost Thread → Product Inquiry object: product + supplier + status + price + context
- #3 Inbound Enrichment → Capture seller replies (price + photos + notes) per inquiry
- #14 Intent Choreography → Inquiry status: sent / price received / negotiating / decided / ghosted
- #15 Manual Logging → Intentional, lightweight — no WhatsApp integration needed

**Theme 4: Source & Discovery Layer**
*The layer above suppliers — where do you find them?*
- #9 Brand Research Archive → Store discovery sources with platform + brand tags
- #10 Source Reuse → Check saved sources before going to Reddit manually
- #11 Multi-Platform Hunt → Sources tagged by platform (Reddit/Discord/WhatsApp/etc.)

**Theme 5: Collaborative Intelligence**
*Friends sharing research, not duplicating it*
- #16 Shared Source Library → Collective sources, everyone contributes
- #17 Collaborative Price Intelligence → Shared inquiries and prices across the group
- #18 Price as Historical Reference → Benchmarks, not binding — enter negotiations informed

### Breakthrough Concepts

- **Photo = Product ID** — No typing ever. The visual ecosystem gets a visual data model.
- **Shared price history** — Turns a solo research grind into group intelligence.
- **Source layer** — "Where to find Yupoo suppliers by brand" as a first-class feature — nobody else has this.

### Prioritization Results

| Priority | Theme | Core Feature | Why |
|----------|-------|-------------|-----|
| 1 | Inquiry Tracking | Product Inquiry object with status | Biggest daily pain — context loss on WhatsApp replies |
| 2 | Supplier Intelligence | Supplier cards replacing bookmarks | Immediate upgrade with near-zero learning curve |
| 3 | Product Identity | Photo-first data model | Core architecture — everything else depends on it |
| 4 | Collaborative Intelligence | Shared prices + sources | Multiplies value for the friend group |
| 5 | Source & Discovery | Source library with brand/platform tags | Powerful but less urgent than core tracking |

### Action Plans

**Priority 1 — Inquiry Tracker**
- Next steps: Define the Inquiry data model (photo + supplier + status + price + notes + date)
- Build the status flow: Sent → Price Received → Negotiating → Decided/Ghosted
- UI: Card per product showing all suppliers contacted and their status
- Success metric: Zero "which shop was this again?" moments

**Priority 2 — Supplier Cards**
- Next steps: Define supplier card fields (name, Yupoo URL, WhatsApp, brands, trust notes, red flag)
- Import: Let user add suppliers manually from a Yupoo URL
- Success metric: Browser bookmarks folder becomes empty

**Priority 3 — Photo-First Product Model**
- Next steps: Photo upload → creates Product card
- Photo similarity check: flag when a new supplier uses a photo already in the system
- Success metric: Never type a product name

**Priority 4 — Collaborative Features**
- Next steps: Auth (friends-only group), shared supplier pool, shared inquiry history
- Price shown as "last quoted: [amount] by [friend] on [date]"
- Success metric: Group contacts each supplier once, not three times

**Priority 5 — Source Library**
- Next steps: Save URL + platform tag + brand tags + notes
- Show saved sources when starting research on a brand
- Success metric: Reddit/Discord visited with purpose, not from scratch every time

---

## Session Summary and Insights

**Key Achievements:**
- 18 decision nodes mapped covering the complete Yupoo research workflow
- Full data model emerged: Sources → Brands → Suppliers → Products (photo) → Inquiries → Prices
- Core architectural insight: photo-first identity, not text-first
- Scope clearly bounded: stops at price confirmed, no shipping/customs/middlemen

**Breakthrough Insights:**
- The problem isn't too many conversations — it's zero structure even with few conversations
- Trusted supplier relationships are the real asset being managed, not just prices
- The app is a graph: sources → suppliers → brands → products → inquiries
- Shared price history shifts negotiation power back to the buyer

**Scope Boundaries Confirmed:**
- Desktop-first, web app
- Friends-only group with auth (small scale, no public marketplace)
- Manual logging — no WhatsApp integration
- Stops at price confirmation (no post-purchase workflow)
- No external API scraping of Yupoo

**Recommended First Build (MVP):**
Photo-first Product card + Supplier card + Inquiry status tracker.
These three together eliminate the core QOF problem immediately.
