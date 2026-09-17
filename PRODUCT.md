# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Compliance analysts and reviewers** screening counterparties (companies and their directors) against watchlists. Their job is to work a queue of cases: read why a name matched, weigh independent identity evidence, propose a decision with a rationale, and have a second reviewer approve it.
- **Portfolio reviewers**: engineers and hiring managers in financial-markets data and risk intelligence, who open the public repository and the console to judge whether this is a credible, working product on real data. They skim; they don't operate.

Both matter, split by page: Overview and News desk tell the story at a glance; Review queue, Case file and Customers are dense working screens.

## Product Purpose
Satark screens a real customer book of India-linked companies and directors against five official watchlists, then never trusts a name on its own. Every hit gets two separate checks: a name match, and an independent identity check that can confirm it or clear it. Success means fewer false positives reach a human, every clearance stays visible, and every decision is auditable.

## Positioning
- Built for Indian names: Devanagari transliteration, honorifics, S/O and D/O relation clauses, and phonetic keys, measured against a baseline (F1 0.953 vs RapidFuzz 0.572 on a held-out synthetic benchmark).
- Runs on real public registries (GLEIF, Companies House, NSE/SEBI, Parliament of India, MHA, UN, UK sanctions) rather than a synthetic book.
- Keeps name similarity and identity evidence as two visibly separate checks.

## Operating Context
- Maker-checker workflow: an analyst proposes, a different reviewer approves (a demo identity switcher, not real authentication).
- A hash-chained audit trail is verified on demand.
- News comes from an owned full-text index of 10 regulator and publisher feeds (SEBI, RBI, FCA, NCA, and Indian business press).
- The console runs locally at /app/ beside a static landing page at /.

## Capabilities and Constraints
- Views: Overview, Review queue, Case file, Customers and customer profile, Watchlists, News desk, Screen a name, Benchmark, Audit trail, and a ⌘K command menu.
- Stack: React 19, TypeScript, Vite multi-page app, Tailwind v4, shadcn/ui, TanStack Query and Table, Recharts.
- Matches are leads for review, never findings.
- No real authentication.
- Identifier matching is not built (0 comparable identifier pairs in the book).
- News history starts at the first poll.

## Brand Commitments
- The name is Satark (सतर्क, "alert/vigilant").
- The double-circle mark is not the Satark logo and must not be used. The owner will supply a logo file; until then, use a wordmark and leave a clean slot.
- The landing page keeps its iridescent-figure hero from the owner's master prompt. The console gets its own visual identity, independent of the landing page.
- The News desk should read like the front page of a financial newspaper, not a list.

## Evidence on Hand
- Real measurements: 29,574 list entries (9,400 historical/revoked), 1,385 customers (A 840 / B 514 / C 31), 45 open cases, 2 auto-cleared alerts, 26 registry ownership mismatches, 34/34 real labelled cases passing, benchmark tables in data/eval and docs/build-log.md.
- Live APIs: /stats, /cases, /customers, /watchlists, /news, /news/search, /news/feeds, /eval, /eval/real, /audit, /audit/verify.
- Screenshots: docs/screens/.
- No testimonials, customers, users, or commercial claims exist; none may be invented.

## Product Principles
1. A name match is a lead, not a verdict: always show why, and what the independent evidence says.
2. Nothing disappears silently: cleared and historical items stay visible and audited.
3. Real data, stated limits: every number comes from the live system, and gaps are named.
4. Two-speed product: the story pages orient in seconds, the working pages reward focus.

## Accessibility & Inclusion
- Risk bands and verdicts never rely on colour alone.
- Keyboard-operable tables and command menu.
- WCAG AA contrast.
