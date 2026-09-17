# Satark · सतर्क

**Counterparty screening for India-linked companies and the people behind them, on real public data.**

Satark screens a real customer book against five official watchlists and never trusts a name on its own. Every hit gets two separate checks: a **name match**, and an independent **identity check** that can confirm it or clear it. Reviewers work the resulting cases under a four-eyes rule, and every decision lands in a hash-chained audit log.

> Potential matches are leads for a human reviewer, never findings. An independent portfolio project, not affiliated with any exchange, regulator or data vendor. Watchlist data © [OpenSanctions](https://www.opensanctions.org) (CC BY-NC 4.0).

![Satark landing page](docs/screens/landing.png)

---

## What is real here

| | Source | Size |
|---|---|---|
| **Watchlists** | OpenSanctions full exports of NSE/SEBI debarments, Parliament of India, MHA UAPA bans, UN Security Council, UK Sanctions List | 29,574 entries; 9,400 NSE entries are *historical* (revoked or expired orders) and don't alert |
| **Customer book** | **A**: the 840 Indian entities whose LEIs are issued by London Stock Exchange LEI Ltd (GLEIF) · **B**: 114 UK subsidiaries of Indian groups with their 400 current directors (GLEIF Golden Copy + Companies House) · **C**: 31 companies on NSE's active debarment list that hold an LEI | 1,385 customers |
| **News** | An owned full-text index of 10 regulator and publisher feeds (SEBI, RBI, FCA, NCA, The Hindu, BusinessLine, Indian Express, Mint, Times of India, NDTV Profit) | searched locally, no call limits |

Nothing in the book is synthetic. The old Faker book survives only as `satark seed --synthetic`, next to the benchmark.

## Results on the real book

`satark seed` loads everything and screens all 1,385 customers in about 8 seconds:

| Group | Customers | Outcome |
|---|---:|---|
| A · LSE-issued LEIs | 840 | **0 alerts** |
| B · UK subsidiaries + directors | 514 | **17 open alerts** on 14 directors (common-name collisions against listings with no date of birth) · **2 auto-cleared** by date of birth |
| C · debarred LEI holders | 31 | **31 of 31** alert on their own listing |

Also found along the way:
- **26 of the 114 UK subsidiaries have a registry mismatch.** GLEIF names an Indian parent, but Companies House lists no person with significant control. ICICI Bank UK PLC is one of them.
- **13 of the 31 debarred companies have let their LEI lapse.**

## How a hit is judged

```
customer ──► Check 1 · Name match ──────────► score ≥ 80 on an ACTIVE listing?
             (Indian-name normaliser,             │
              phonetic keys, IDF-weighted          ▼
              token alignment)               Check 2 · Identity evidence
                                             date of birth (decisive) · PEP term age (decisive)
                                             nationality (supporting only)
                                                   │
                     contradicted ◄────────────────┼────────────► confirmed / inconclusive
                     auto-cleared, kept visible,   │              case opened for review
                     audited                       ▼
                                  analyst proposes ─► a different reviewer approves
                                  (hash-chained audit log, verifiable)
```

- **Name match** is a pure name score. It uses Hindi-aware Devanagari transliteration with schwa deletion, strips honorifics, relation clauses (S/O, D/O) and firm suffixes, applies an Indic phonetic key, and aligns tokens with IDF weights. Every score comes with plain-English reasons.
- **Identity evidence** compares independent attributes and shows each check as *supports*, *contradicts*, *neutral* or *no data*.
  - A birth-year gap of two or more years clears the match.
  - A month slip or a one-year gap is neutral.
  - Conflicting strong evidence goes to a human.
  - A clearance is re-evaluated when the listing changes.
- **Only active listings alert.** An order is revoked or expired per its own text. A politician stays a PEP for 12 months after leaving office (FCA FG17/6).
- **Maker-checker:** the person who proposes a decision can't approve it.
- **Audit:** events chain with `sha256(prev, actor, action, target, detail, time)`, and a compare-and-set on the head means concurrent writers can't fork the chain. `GET /audit/verify` names the first tampered event.

## What real data taught the matcher

The matcher scored F1 0.94 on synthetic variants. Real customers still found five defects, each now covered by a regression test:

1. **Company acronyms read as a person's initials.** "KSN IMPEX PRIVATE LIMITED" scored 92.4 against "S K Impex".
2. **Short names one edit apart.** Director "SINGH, Ankit" scored 90.3 against MP "Shrimati Anita Singh".
3. **A hidden active listing.** Alerting kept only the top 5 matches *before* dropping historical ones, so a common name's active listing could hide behind its revoked namesakes.
4. **Silent suppression.** Date of birth was folded into the name score, so a contradiction dropped the alert without anyone seeing why. It's now a separate, visible check.
5. **One director, several customers.** A director of two subsidiaries was screened twice. Directors are now merged by Companies House officer id.

`data/eval/real_cases.csv` holds 34 labelled real pairs, and CI fails if any regresses. The gate fails 0/2 on the pre-fix normaliser.

Every step with its measurements: **[docs/build-log.md](docs/build-log.md)**.

## Benchmark

`satark eval` builds 2,000 queries from real list names: 1,000 positives rewritten ten ways and 1,000 negatives. Thresholds are picked on a dev half; everything below is from the held-out test half.

| System | Threshold | Precision | Recall | F1 | Unlisted people flagged |
|---|---:|---:|---:|---:|---:|
| **Satark** | 77 | **0.965** | **0.940** | **0.953** | **3.4%** |
| Satark at the production threshold | 80 | 0.975 | 0.932 | 0.953 | |
| RapidFuzz `token_sort_ratio` | 79 | 0.668 | 0.501 | 0.572 | 25.1% |
| Exact (normalised) | 100 | 1.000 | 0.002 | 0.004 | 0.0% |

| Query type | Satark recall | RapidFuzz recall |
|---|---:|---:|
| Devanagari script | 100% | 2% |
| S/O · D/O clause | 100% | 0% |
| Initials | 91% | 13% |
| Middle name dropped | 100% | 24% |
| Typo | 70% | 85% |

RapidFuzz wins on typos because Satark only accepts close phonetic keys; loosening that costs precision. The variants are synthetic, and the Devanagari ones come from this repo's own generator, so treat the script results as optimistic. Median screening latency is 1.9 ms against 44,220 indexed names.

## The console

![Satark case file](docs/screens/case-file.png)

| Screen | What it does |
|---|---|
| **Landing** `/` | One static page: a translucent figure scrubbed by mouse travel, with the project's real numbers around it |
| **Overview** | Screening sieve by group, watchlist active vs historical, the matching-quality snapshot |
| **Review queue** | Cases by status with band, identity verdict and lists hit, plus auto-cleared alerts |
| **Case file** | Name match and Identity evidence side by side, the listing with its SEBI/NSE order documents, maker-checker actions, the case's audit chain |
| **Customers** | All 1,385 with registry status, ownership, PSCs and cases |
| **News desk** | A subject brief that shows each extracted event inside its source headline with four grounding checks; a wire that leads with regulator orders, with full-text search; feed health |
| **Benchmark · Audit · ⌘K screen** | Threshold sweeps and the 34 real cases; chain verification; screen any name with both checks |

## Run it

Needs Python 3.11+ and Node 20.19+.

```bash
make install     # venv + backend + frontend deps
make seed        # load the five lists and the real customer book, screen everyone
make api         # http://127.0.0.1:8000/docs
make web         # http://localhost:5173 (landing) · http://localhost:5173/app/ (console)
make news        # poll the ten feeds into the local index
make test        # backend test suite
make eval        # synthetic benchmark + quality gate
make eval-real   # the 34 real labelled cases
```

Rebuilding the customer book from source is optional: the committed snapshots are enough. `make book` re-fetches GLEIF, and for group B it needs a free Companies House key in `.env` as `SATARK_COMPANIES_HOUSE_KEY`. Director details are personal data, so they're cached locally in `data/cache/` and never committed.

The full stack (Postgres, Redis Streams worker, nginx) runs with `docker compose up --build -d`, then `docker compose exec api satark seed`.

## MCP server

`make mcp-config` prints a Claude Desktop config block. Tools:

- `screen_entity` returns both checks per match
- `explain_match`
- `get_record`
- `adverse_media_brief`
- `list_open_alerts`

## Limits, stated plainly

- **No real authentication.** Maker-checker identities are a demo header with fixed roles.
- **Identifier matching is not built.** Across the whole book there are 0 comparable identifier pairs: NSE listings carry PANs, while GLEIF companies carry CINs.
- **Most director alerts need a human.** The matched NSE and Parliament entries have no date of birth.
- **News history starts at the first poll.** RSS carries only recent items. PIB and Business Standard are excluded because they only answer a spoofed browser.
- **Non-commercial data licence.** OpenSanctions data is CC BY-NC, fine for a portfolio and not for resale.

## Stack

Python 3.12 · FastAPI · SQLAlchemy 2 · SQLite / PostgreSQL · Redis Streams · RapidFuzz · LangGraph · SQLite FTS5 · MCP · Prometheus · React 19 · TypeScript · Vite · Tailwind v4 · shadcn/ui · TanStack Query & Table · Recharts · GitHub Actions · pytest
