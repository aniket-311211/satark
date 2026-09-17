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

## Step 1 — Full watchlist records, with revocations and PEP terms

**Why:** the simple CSV export reduced each listing to a name, so a debarment revoked in 2018 screened exactly like one issued last week.

**What changed:** `sources.py` now parses the full OpenSanctions FollowTheMoney export (`entities.ftm.json`) and keeps what an analyst needs:

- `details.orders`: date, end date, authority, duration, order text, and a link to the NSE/SEBI order PDF
- `details.terms`: posts held, with start and end dates
- `details.relatives`: family links for Parliament members

Identifiers (PAN, registration numbers, addresses, email) are never stored. The UK Sanctions List was added as a fifth source.

**Status rules** (each is a `# ponytail:` heuristic with its limit named in the code):

- An order is **revoked** if its duration or text says so. Real variants: "REVOKED", "Revoked 20072018", "DEBARMENT REVOKED", "PAN REVOKED" and a misspelt "DEBARREMENT REVOKED".
- It is **expired** if its end date has passed, if "N years / N months" from the order date has elapsed, or if it says "completed". Bare numbers such as "24" are months, confirmed against order texts reading "period of two years".
- Otherwise it is **active**, including "TILL FURTHER ORDERS".
- An entity is **active** if any order is active. With no orders, it is also active.
- A Parliament member is **active** while in office and for 365 days after (UK FCA FG17/6 treats a former PEP as a PEP for at least 12 months). With no term data, the member is active, the conservative choice.
- Only **active** entries raise alerts. Historical entries still appear in screening results.
- **Known gap:** two NSE records read "Debarred till <date>" in free text and default to active.

**Snapshots** (JSON lines, gzip, 2.3 MB total, built 2026-09-17):

| List | Screened entries | Active | Historical | Detail carried |
|---|---:|---:|---:|---|
| NSE debarred (SEBI orders) | 14,435 | 5,035 | 9,400 | 16,059 orders: 9,669 revoked, 5,594 active, 796 expired |
| Lok Sabha & Rajya Sabha | 8,368 | 6,552 | 1,816 | terms for 2,672 people, relatives for 2,546 |
| MHA banned organisations | 146 | 146 | 0 | listing orders |
| UN Security Council | 1,005 | 1,005 | 0 | listing orders |
| UK Sanctions List (FCDO) | 5,620 | 5,620 | 0 | persons and organisations (664 vessels excluded) |

**Benchmark after adding the UK list.** Positives still come from the four India-relevant lists, because the variants are Indian-name transforms. The UK list's names stay in the index as extra distractors (29,574 entities, 44,220 indexed names). The gate passes:

- dev-selected threshold 77: P 0.960, R 0.946, F1 0.953
- production threshold 80: P 0.971, R 0.938, F1 0.954
- RapidFuzz at 80: P 0.678, R 0.499, F1 0.575

## Step 2 — A real customer book from public registries

**Why:** a screening system tested on names it planted itself proves little. No real bank customer list is public, and using one would breach India's DPDP Act and banking secrecy. So the book is built from *business* registries instead: the KYB (know-your-business) side of screening, where the data is public.

| Group | What | Source | Built |
|---|---|---|---|
| **A** | Indian legal entities whose LEI is issued by **London Stock Exchange LEI Ltd** (LOU `213800WAVVOPS85N2205`) | GLEIF API, no key | 840 entities in 16 s |
| **B** | UK companies whose direct or ultimate parent is Indian, with their **current officers** and **persons with significant control** | GLEIF Golden Copy bulk files (504 MB entities, 24 MB relationships) joined locally, then the Companies House API (free key) | 114 companies, 400 unique officers (434 appointments), 628 s |
| **C** | Companies on NSE's **active** debarment list that also hold an LEI | Block 1 snapshot → GLEIF exact legal-name lookup | 31 LEI holders among 779 active debarred companies, 1,844 s |

**Group B details:**
- The join keeps only ACTIVE `IS_DIRECTLY/ULTIMATELY_CONSOLIDATED_BY` relationships, where the child is registered with Companies House (RA000585) and the parent's legal address is in India.
- Largest Indian parents: HCL Technologies (5), Tata Motors Passenger Vehicles (4), Samvardhana Motherson, TVS Supply Chain, Tata Steel and Tata Consumer Products (3 each).
- Companies House status: 111 active, 2 in liquidation, 1 dissolved.
- Officers: 198 Indian nationals, 137 British.

**Registry mismatches (26 of 114).** GLEIF records an Indian parent, but Companies House lists no person with significant control. Examples: ICICI Bank UK PLC, Kotak Mahindra (UK) Limited, Tata Steel Europe Limited, SPP Pumps Limited (parent Kirloskar Brothers). A mismatch is a reason to review ownership evidence, not a finding: the UK PSC regime has exemptions a parent may legitimately use. The case file surfaces it so an analyst decides.

**Privacy.** Committed snapshots (`data/book/`) hold only company-level public registry data. Officer rows and raw Companies House responses (names, birth month and year, nationality) stay in `data/cache/`, which is gitignored and rebuilt locally with your own key. Individual PSC names are dropped even from the cache-derived company rows. Officer rows carry no country: a UK directorship says nothing about residence, and a wrong country would cost score.

**Bugs found while building:**
- GLEIF's API treats a comma inside a filter value as a list separator, so the debarred company "New Leader Trading Co. Pvt. Ltd.," returned HTTP 400 and aborted the run. Commas are now stripped from the query, and one unsearchable name skips that company instead of failing the build.
- The company filter looked for "Limited" anywhere in the listing, so "Dinesh Sharma (having address at Risk Capital & Technology Finance Corporation Limited, …)" counted as a company. After the bracket was stripped for the retry, it matched an unrelated sole proprietor named Dinesh Sharma in Jaipur. The suffix check now ignores bracketed text. The fix can only remove candidates, so the existing results were re-filtered (32 → 31) rather than re-running 30 minutes of lookups.
- The GLEIF throttle waited 1.05 s *after* each ~0.9 s response, doubling the run to 31 minutes. It now spaces requests from their start and prints progress every 50 lookups.
- The half-finished group C test expected "Foo" to match "FOO LIMITED", contradicting the exact-name rule. The fixture was corrected, not the rule.


**Group C highlights.** Karvy Stock Broking, Gensol Engineering, Pancard Clubs and Reliance Unicorn Enterprises are among the 31. 13 of the 31 LEIs have **lapsed**: a company under a live SEBI debarment that has also stopped renewing its LEI is a signal worth showing next to the order.

## Step 3c — Screening the real book, and what it exposed

`satark seed` loads the five lists and the 1,385-customer book (840 + 514 + 31), then screens everyone. It takes about 8 s.

| Group | Customers | Alerts | What they are |
|---|---:|---:|---|
| A: LSE-issued Indian LEIs | 840 | **0** | clean after the acronym fix |
| B: UK subsidiaries + directors | 114 companies + 400 people | **17** on 13 directors | name-only collisions on common Indian names ("Rajesh Rai", "Amit Gupta", "Abhishek Singh") against listings with no date of birth. This is the work maker-checker review exists for |
| C: debarred LEI holders | 31 | **31** | every known positive alerts on its own listing |

Screening real people found three more defects the synthetic benchmark couldn't:

1. **Alert scan truncated before the status filter.** Alerting took the top 5 matches and *then* dropped historical entries. A common name with many revoked NSE listings could push its one active listing out of view, a silent false negative. Alerting now scans every match above the minimum score. The regression test (10 revoked namesakes + 1 active listing) fails with the old limit and passes with the fix.
2. **Short names one edit apart.** After schwa deletion "Anita" keys to `anit`, one insertion away from `ankit`. UK director "SINGH, Ankit" scored **90.3 (strong)** against MP "Shrimati Anita Singh". Spelling variants now need keys of at least 5 letters. Measured at threshold 80: precision 0.9711 → 0.9749, recall 0.9381 → 0.9321, F1 0.9543 → 0.9531; typo recall falls 0.74 → 0.70. That's a deliberate precision-over-recall trade on a rule that produced a strong-band false positive in production-like data.
3. **One director, many customers.** A person who directs two UK subsidiaries was two customers with two alerts. Companies House gives one officer id per person, so directors are now merged across appointments: 434 → 400 people.

**Regression gate on real data.** `data/eval/real_cases.csv` holds 34 labelled pairs: the 2 acronym false positives and the short-name false positive (must stay below 80), plus the 31 debarred LEI holders (must reach 80). `satark eval --real --gate` runs in CI next to the synthetic gate. It was confirmed to **fail 0/2 on the pre-fix name normaliser** and passes 34/34 now.

**Learning loop.** `satark eval --export-decisions` appends every approved maker-checker decision to the same file: confirmed → `match`, discarded → `no_match`, noting the case and approver. Analysts' work becomes regression tests.

## Step 5 — Secondary matching: a second, independent check

**Why:** name matching can't be exact on its own. "RAI, Rajesh" against "Shri Rajesh Rai" is a perfect name match (100) and still may be a different person. Screening vendors separate *finding* candidates (name) from *confirming or clearing* them (independent attributes). Before this step, Satark hid that second judgement inside the name score: a birth-year mismatch multiplied the score by 0.75, so the pair silently never alerted and nobody saw why.

**What changed:**

- **Check 1: name match.** `MatchIndex.screen` returns a pure name score. The birth-year and country adjustments were removed; person vs organisation stays, because it's a property of the name.
- **Check 2: identity evidence.** `secondary.check(customer, entity)` returns a verdict, a one-line summary, and each check with `supports` / `contradicts` / `neutral` / `no_data`:

| Check | Strength | Rule |
|---|---|---|
| Date of birth | strong | Same year (months equal or unknown) supports. Same year with a different month is neutral (a common data-entry slip). ±1 year is neutral. 2+ years apart contradicts. With several listed dates, the most favourable wins. Doesn't apply to organisations |
| PEP term age | strong | Only for listings with term dates. If the earliest term began before the customer would have been 25 (the Lok Sabha minimum age, Article 84), it contradicts |
| Nationality / country | weak | Recorded, never decisive: a country on a list can mean jurisdiction, not citizenship |

- **Verdicts.** Any strong contradiction → `contradicted`. A strong support → `confirmed` (a reviewer still decides). Otherwise → `inconclusive`.
- **Alerting.** A `contradicted` alert is stored as `auto_cleared` by `secondary-check`, with its evidence, no case, and a hash-chained `alert.auto_cleared` audit event, so the clearance is visible and reviewable. Everything else joins the customer's case with the evidence attached. `/screen` and the MCP `screen_entity` tool return both checks per match when a date of birth, nationality or country is supplied.

**Measured on the real book** (re-screened from scratch):

| Outcome | Count | Example |
|---|---:|---|
| Open, inconclusive | 48 | "RAI, Rajesh" vs "Shri Rajesh Rai" (100): the listing has no date of birth |
| **Auto-cleared** | **2** | "KUMAR, Anand, Dr" (born 1955-09) vs MP "Anand Kumar" (born 1974-08-07), name score **100**; "PATEL, Prayasvin" (born 1958-04) vs MP "Praveen Patel" (born 1979-01-25), 87.1 |
| Confirmed | 0 | none of the book's matches share a date of birth |

**What it can't do here, and why:**

- **Identifier matching was measured and not built.** Across all 1,385 customers there are 0 comparable identifier pairs. NSE listings carry PANs but no LEIs, only 605 carry a registration number (39 of them CINs), and every GLEIF company in the book carries a CIN. A check that always returns "no data" would be dead code. It becomes worthwhile when customers arrive with PANs, e.g. an uploaded KYC file.
- **17 of 19 director alerts stay inconclusive** because the matched NSE and Parliament entries carry no date of birth. That's a property of the source lists, and it's exactly the work maker-checker review is for.

The synthetic benchmark is unchanged (it has no dates of birth): dev threshold 77, P 0.965, R 0.940, F1 0.953. The real-case gate stays at 34/34.

**Independent review before commit.** A reviewer agent read the uncommitted change and found:

| Finding | Severity | Resolution |
|---|---|---|
| New open alerts relied on the column default, which applies only at flush. The last alert of a batch was uncounted in audit details and rescreen summaries (onboarding 3 alerts logged `alerts: 2`) | bug | status set explicitly |
| An auto-clearance was permanent: if the list later corrected a date of birth, the stale clearance would keep hiding a true match | compliance risk | a clearance stands only while the listing is unchanged (`WatchlistEntity.updated_at`); after a delta the pair is re-evaluated |
| A term-age contradiction could auto-clear a pair whose date of birth *agrees*, i.e. an inconsistent listing | compliance risk | conflicting strong evidence is now `inconclusive` ("Conflicting evidence, needs review") and goes to a human |
| The term-age check could run for organisations | minor | not applied to organisations |

The regression test fails with either service fix reverted and passes with both. After the fixes: 117 tests pass, the real book still screens to 48 open and 2 auto-cleared, the real-case gate is 34/34, and the audit chain verifies.

## Step 6 — The console and the landing page

The old frontend was one page of API calls. It's now two surfaces built by Vite as a multi-page app: a static landing page at `/`, and the analyst console at `/app/`.

**Landing.** One HTML file, no framework. A translucent figure (a video) scrubs forwards and backwards with mouse travel, gated so it only seeks when the change is big enough to show. The numbers pinned around it are the project's own measurements: 29,574 list entries, 9,400 revoked, 1,385 customers, and a name score of 100 cleared by a 19-year birth-date gap.

**Console.** React 19, TypeScript, Tailwind v4 with shadcn/ui, TanStack Query for server state and TanStack Table for every list, Recharts for charts, and lazy routes so charts load only on the pages that draw them.

| Page | What it shows |
|---|---|
| Overview | Alerts per 100 customers by group, what the identity check did with them, active vs historical entries per list |
| Review queue | Cases with band, identity verdict and lists hit; auto-cleared alerts in their own tab |
| Case file | Check 1 and Check 2 side by side for each alert, the listing, maker-checker actions under the demo identity, the case's own audit events |
| Customers / profile | The 1,385-row book with group and kind facets; registry facts, ownership with the GLEIF-vs-PSC mismatch called out, directors, cases |
| Screen a name | Any name, with optional date of birth and nationality, through both checks |
| News desk | Subject brief (the event's quote marked inside its headline, four grounding checks), a regulator-first wire with full-text search, feed health |
| Benchmark | Systems table, threshold sweep, recall per name transform, the misses, the 34 real cases |
| Audit trail | Chain verification and every event |

**Design rules.** One accent colour (stamp blue) used for links and selection. Risk bands and verdicts always carry an icon and a word, never colour alone. Tabular figures for every number. No cards around sections, no gradients, no emoji.

**Checked by screenshot** at 390 px and 1440 px for every route. No horizontal page scroll and no console errors (the only error is a missing favicon). `tsc` and `vite build` are clean. The console bundle is 138 kB gzipped, and the chart chunk (104 kB gzipped) loads only on chart pages.

**Defects found while checking:**

| Defect | Fix |
|---|---|
| Chips and active filters were invisible: `ink`, `paper` and `rule` had no Tailwind colour tokens | tokens added and every colour class audited |
| A data field named `transform` leaked into Recharts' SVG `transform` attribute | field renamed |
| The exact-match sweep has one point (threshold 100), which crashed the chart caption | the caption explains exact's fixed operating point |
| The news wire rendered 300 items (about 20,000 px) and opened on general business stories | capped at 40, with a filter that opens on regulator orders |
| On phones the top-bar search didn't shrink, and the Watchlists authority column collapsed to one letter per line | `min-w-0` on the search; a minimum width so the table scrolls |
| Chart legend swatches pointed at CSS variables that exist only inside the chart | the swatches read the chart config directly |

**Not verified by screenshot:** an *unverified* news event (quote struck through, "not found in source"). With the keyword extractor, the current corpus can't produce one: the quote is the headline, and the full-text search guarantees the subject is present. That path is code-reviewed only. It becomes reachable with the LLM extractor.

## Step 7: Redesign as a surveillance terminal

The first console read as plain, white and generic. The owner asked for:
- new fonts and colours;
- more kinds of charts on the Overview;
- a News desk that reads like a newspaper front page rather than a list;
- on the landing page: the Satark name, a "Let's get started" button, and no top-left nav or placeholder mark.

**How the direction was chosen.** The redesign ran through the impeccable skill.
1. A product record came first (`PRODUCT.md`).
2. Three short questions settled the audience (story pages for skimmers, dense pages for analysts), the News desk form (front page), and scope (the console diverges; the landing only gets the listed fixes).
3. A seeded direction roll produced the options, and the owner locked **Surveillance Terminal**: the console as an exchange trade-surveillance screen.
4. The visual system is recorded in [DESIGN.md](../DESIGN.md).

**What changed:**

| Area | Change |
|---|---|
| World | Graphite panels on a near-black ground, hairline rules, bone text; flat colour where each hue means one thing (amber attention, cyan navigation, red-to-sand match risk, green cleared, violet regulators); Archivo on its width axis for words, Martian Mono for figures; square 2px corners |
| Shell | A command bar with numbered function tabs (keys 1–8), London and Mumbai clocks, the demo identity, and a status tape that runs the audit chain along the bottom of every screen |
| Overview | A monitor wall: live counts; open cases by band; a screening funnel that says why each count changes; identity verdicts; alert score histogram; group × list heatmap; watchlist board; matching quality; news pulse |
| News desk | A wire-service front page: nameplate, regulator ticker, lead story, risk desk by adverse-media category, regulator and press columns, coverage analytics, name dossier, search, feed health |
| Working pages | The queue, case file, customers, watchlists, screen, benchmark and audit screens rebuilt densely, with state shown in line form as well as colour |
| Backend | `/news` and `/news/search` tag each article with the adverse-media keyword category the brief extractor already uses (tested) |
| Landing | Wordmark and "Let's get started" at top centre, no nav or mark; clicking plays a short exit and hands over through a cross-document view transition, with the wordmark morphing into the console's |

**Built by a swarm.** Five agents worked in parallel from written briefs: landing, overview, news desk, working screens, and the remaining screens. A coordinator owned the tokens, the shell and the shared components, then checked every page by screenshot at 1440 and 390 px before committing.

**Defects found while checking:**

| Defect | Fix |
|---|---|
| At 1280 px the function tabs ran into the search box | short tab names and a narrower search below 1536 px |
| The funnel put "auto-cleared" between "alerts raised" and "open alerts", so its arrows read as nonsense | each step now states why the count changed |
| The Overview counted 7 risk-tagged stories and the News desk 29 | both count the same loaded windows |
| SEBI and FCA publish dates don't parse, which broke newest-first sorting | sort falls back to fetch time |
| The lead story printed an entire article body | clamped to four lines |
| Nationality wrapped mid-word, and names were set in monospace | words use Archivo; mono only for dates and codes |
| The news agent removed the manual feed poll to avoid writing during its checks | restored |

`tsc` and `vite build` are clean, 118 backend tests pass, and no route scrolls horizontally at 1440 or 390 px. The design detector flags one intentional case: the landing page clips overflow to hold its single-screen hero.
