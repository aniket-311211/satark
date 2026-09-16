# Build log

How Satark went from a synthetic demo to a screening workflow on real public data. Each step lists what changed, why, and what was measured. Commits are referenced so every claim can be checked against the code.

## Step 0 — Baseline (`8e53865`)

Satark v0.1 had solid matching internals but ran on synthetic ground:

- **Watchlists** came from OpenSanctions `targets.simple.csv`, one row per name. The rich parts of each record (order dates, revocations, order PDFs, PEP terms, family links) were discarded.
- **Customers** were 1,000 Faker `en_IN` names with 25 watchlist names deliberately planted, so every alert was manufactured.
- **Adverse media** searched Google News RSS, an unofficial aggregator.
- **Decisions** were single-person, and the audit log was a plain table.
- **Quality** was a synthetic benchmark: F1 0.942, CI gate at P ≥ 0.93 / R ≥ 0.90 / F1 ≥ 0.92, 35 tests passing.

Before changing anything, the real data was measured:

| Finding | Evidence |
|---|---|
| ~60% of NSE-debarred entities (8,694 of 14,435) have **every** order marked revoked, yet were screened as active | parsed `duration` of 16,059 Sanction records in `in_nse_debarred/entities.ftm.json` |
| London Stock Exchange LEI Ltd (LOU `213800WAVVOPS85N2205`) manages **840** Indian LEIs | GLEIF API, `filter[registration.managingLou]` + `filter[entity.legalAddress.country]=IN` |
| Screening those 840 real entities gave **2 alerts, both false positives** | "KSN IMPEX PRIVATE LIMITED" → "S K Impex" (92.4); "GRS EXPORTS" → "S. G. Global Exports" (82.2) |
| Companies House and GLEIF disagree about who controls ICICI Bank UK PLC | PSC statement "no individual or entity with significant control"; GLEIF ultimate parent ICICI Bank Limited |

## Step 4 — Cases, maker-checker, hash-chained audit (`4fbd8b4`)

**Why:** in a regulated screening team, one person must not be able to clear their own alert, and the record of who decided what must be tamper-evident.

- **Cases.** Alerts open (or join) one case per customer. Only matches against *active* list entries raise alerts.
- **Four-eyes rule.** An analyst proposes `confirmed` or `discarded` with a written rationale. A reviewer who is not the proposer approves (closing the case and its alerts) or rejects (reopening it). The old single-person decision endpoint was removed rather than kept alongside, so the control can't be bypassed.
- **Hash-chained audit.** Each event stores `prev_hash` and `sha256(prev, actor, action, target, detail, timestamp)`. A one-row `audit_head` advances by compare-and-set: two processes that read the same head can't both append, and the second gets `AuditConflict` instead of forking the chain. `GET /audit/verify` recomputes the chain and names the first tampered event.
- **Tests:** happy path, rejection, self-approval refused, rationale required, tampering detected, concurrent writers.
- **Not done:** identity is a demo `X-Satark-User` header with fixed roles (`analyst`, `reviewer`, `reviewer2`), not authentication.

## Step 3a — Organisation acronyms were being read as personal initials (`467ca2d`)

**Found on real data, invisible to the synthetic benchmark.** Screening the 840 LSE-issued Indian LEIs produced two alerts, and both were wrong:

| Customer (GLEIF) | Matched listing (NSE) | Score |
|---|---|---|
| KSN IMPEX PRIVATE LIMITED | S K Impex (Mahendrakumar Bishnoi) | 92.4 strong |
| GRS EXPORTS | S. G. Global Exports Ltd. (formerly Tinna Exports Ltd.) | 82.2 probable |

**Root cause.** `names.normalize` splits a 2–3 letter all-consonant capitalised token into initials, so "RK Sharma" becomes R, K. But it decided person vs organisation only *after* that loop. "KSN" was split into K, S, N and aligned with the listed "S K". Every positive in the synthetic benchmark is a person name, so the bug never showed up there.

**Fix.** Guess the kind first, then skip the initials split for organisations (a few lines).

**Measured** on the same four lists and the same held-out test half:

| | Precision | Recall | F1 |
|---|---|---|---|
| Before, threshold 80 | 0.976 | 0.910 | 0.942 |
| After, threshold 80 | 0.971 | 0.938 | 0.954 |
| After, dev-selected threshold 77 | 0.958 | 0.946 | 0.952 |

- The 840 real entities: 2 alerts → 0.
- Person-initial queries ("R.K. Sharma", "Sanghvi R.", "M K Gandhi") score identically before and after.
- The benchmark's own dev-selected threshold moved from 80 to 77. Its headline "unlisted people flagged" rate therefore reads 4.2% (was 2.2%), while the like-for-like comparison at 80 improves. Both are reported rather than picking the flattering one.
- **Residual, not fixed:** `token_similarity` still lets a single listed initial match any longer token starting with the same letter (0.7 credit). The decoy now scores 74.2, below the gate; tightening that rule was measured to lower it to ~68 with no benchmark change. It's left as a known follow-up.

## Step 3b — Adverse media from an owned index of vetted feeds

**Why:** the old brief searched Google News RSS, an unofficial aggregator with unclear terms and throttling. The goal was news that is genuine, free, open, and can be searched without call limits.

**Options tested on 2026-09-17:**

| Option | Result |
|---|---|
| GDELT DOC 2.0 API | Rejected every request from this network ("one request every 5 seconds"), and only covers a rolling 3 months |
| Commercial news APIs (free tiers) | Daily call caps |
| ED, CBI | Publish no RSS feed (404) |
| Economic Times | 404 |
| Moneycontrol | 403 |
| PIB, Business Standard | 403 to an identifying client, 200 only to a browser user agent. Not spoofed, so excluded |
| **Allowlisted regulator + publisher RSS feeds** | **10 feeds working** |

**Design: own the index.** `satark news poll` fetches the allowlist with conditional GETs (ETag / Last-Modified) and an identifying user agent. Items go into SQLite with an FTS5 full-text index, which ships with Python's `sqlite3`, so there's no new dependency. A brief searches locally: unlimited calls, sub-millisecond, and every hit comes from a source on the allowlist:

- **Regulators:** SEBI, RBI (India); FCA, National Crime Agency (UK)
- **Publishers:** The Hindu Business, Hindu BusinessLine, Indian Express Business, Mint Companies, Times of India Business, NDTV Profit

**First real poll:** all 10 feeds OK, 475 articles, 3.6 s. Phrase search ran in 0.2–0.7 ms ("Tata Sons": 5 hits, "Paytm": 1).

**Trade-off:** RSS carries only recent items, so history accrues from the first poll; there's no backfill. For listed entities, the primary evidence is the regulator's own order (Step 1), not news coverage.
