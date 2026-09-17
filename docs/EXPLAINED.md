# Satark, explained in plain words

This document explains the whole project in simple language: what it does, how each part works, why every technical choice was made, and the answers to the questions people ask about it. Read it once end to end, then keep the cheat sheet at the bottom.

---

## 1. The one-paragraph version

Banks have to check their customers against official watchlists: sanctions lists, lists of banned people, and lists of politicians. The check is normally done on the name alone. That works badly for Indian names, because the same person is written ten different ways and thousands of unrelated people share a name. Satark does the check in two steps instead of one. First it compares the names properly, in a way that understands Indian naming. Then it takes any strong name match and asks a second, independent question: *is this actually the same person?* It compares the date of birth and other facts. If they disagree, the alert is closed automatically, with the reason on record. What is left goes to a human, and two different people have to agree before a case is closed. Every decision is written into a tamper-evident log.

---

## 2. How to say it out loud

### The 30-second version

> "Satark is a counterparty screening system. It takes a bank's customer book and checks it against five official watchlists — sanctions, banned organisations and Indian politicians. The interesting part is that it never trusts a name on its own. A name match is only the first check. The second check asks whether the date of birth and other evidence say it is really the same person, and it clears the match automatically when they disagree. I built it on real public data: 29,574 real listings and 1,385 real companies and directors, including Indian companies whose LEIs are issued by London Stock Exchange LEI Ltd."

### The two-minute version

Add the problem and the proof:

> "The reason I built it is that name-only screening fails on Indian names in two directions at once. It misses people, because the same name arrives as Devanagari, as an initial, with an honorific, or with a father's name attached. And it floods you with false alarms, because thousands of people share a name. So I wrote a matcher that understands Indian names — it transliterates Devanagari, strips honorifics like Shri, understands S/O and D/O clauses, and compares names by sound as well as spelling. Then I measured it. On a thousand held-out test names it scores 0.953 F1, against 0.572 for a standard fuzzy matcher. The second check is the part I am most pleased with: a perfect 100-point name match between a customer born in 1955 and an MP born in 1974 gets cleared automatically, with the reason kept on record. And every decision goes through a four-eyes rule and into a hash-chained audit log, because in this domain the decision trail matters as much as the decision."

### The five-minute version

Use the demo. Open https://aniket-311211.github.io/satark/ or the console itself, and walk through in this order:

1. **The front page.** "Rather than claim accuracy, the page lets you test it. Drag this line — that is the score at which a name becomes somebody's work. Watch the false alarms and misses move for both systems."
2. **The second check.** "Same page. This is a real pair from my book: a director born September 1955 and a Member of Parliament born August 1974. The names match at 100. Move the date of birth and the verdict flips. That is the whole thesis of the project in one control."
3. **Overview.** "This is the live state of the book: 1,385 customers, 50 alerts, 2 cleared by evidence, 45 cases waiting."
4. **A case file.** "Both checks side by side. The left is why the names match, drawn as an alignment. The right is what the evidence says, attribute by attribute."
5. **The four-eyes rule.** "I propose a decision with a reason. Now the system refuses to let me approve my own proposal. I switch to a reviewer and it closes, and both events are hashed into the chain at the bottom."
6. **Audit.** "One click verifies the whole chain."

---

## 3. The problem, in plain words

A screening system has one job: given a customer name, find any listed person it might be, and do not bury the analyst in nonsense.

Two things make that hard for India-linked books.

**The same person is written many ways.**

| What arrives | What the list holds |
|---|---|
| संजय वेर्मा | Sanjay Verma |
| Shri. S K Agarwal | Sudhir Kumar Agarwal |
| Srinath Narasimhan D/O Neel Narasimhan | Srinath Narasimhan |
| M. Faisal | Mohammad Faisal |
| Katyal Roma | Roma Katyal |
| Sripal Kr. | Sripal Kumar |

A plain text comparison fails every one of these. Measured: a standard fuzzy matcher finds 2 out of 100 Devanagari names, and 0 out of 100 names with an S/O clause.

**Thousands of different people share a name.** "Rajesh Kumar" is not one person. If you alert on every name that looks similar, an analyst spends the day closing cases about people who were never on a list, and real customers get delayed. Measured: at its best setting the fuzzy matcher flags 25.1% of people who are not on any list. Satark flags 3.4%.

So the goal is not "find similar strings". The goal is **find the right person, and be able to say why**.

---

## 4. What happens, end to end

One customer name goes through this path. Everything in it is a real module in `backend/satark/`.

1. **Normalise** (`names.py`). Turn Devanagari into Latin letters, remove honorifics and relation clauses, expand initials, drop company suffixes like Pvt Ltd, and give each word a phonetic key — a rough spelling of how it sounds.
2. **Find candidates** (`matcher.py`). Instead of comparing against all 44,220 indexed names, look up the phonetic keys in an index and keep the best 400 candidates. This is why a screen takes about 2 milliseconds.
3. **Score** (`matcher.py`). Compare the query and each candidate word by word, pair up the words that match best, and weight rare words more than common ones. The output is a score from 0 to 100 and a list of reasons in plain English.
4. **Band and threshold.** 90 and above is *strong*, 80 and above is *probable*, 70 and above is *possible*. The alert threshold is 80.
5. **Only active listings alert.** An order that was revoked or has expired does not raise an alert. A politician stays a PEP for 12 months after leaving office.
6. **The identity check** (`secondary.py`). Compare the date of birth, the nationality and, for politicians, the age they would have been when they took office. Each check reports *supports*, *contradicts*, *neutral* or *no data*.
7. **Decide what to do.** If a strong check contradicts, the alert is auto-cleared and no case is created, but the alert stays visible with its reason. Otherwise a case opens for a human.
8. **Maker-checker** (`service.py`). An analyst proposes a decision with a written reason. A *different* person with a reviewer role approves it.
9. **Audit** (`models.py`, `service.py`). Every event is hashed together with the event before it, so the trail cannot be edited quietly.

---

## 5. The data, and why it is real

| What | Where it comes from | Size |
|---|---|---|
| Watchlists | OpenSanctions full exports of five lists: NSE/SEBI debarments, Parliament of India, MHA UAPA bans, UN Security Council, UK Sanctions List | 29,574 entries, of which 18,358 are active and 11,216 are historical |
| Customers group A | Indian entities whose LEI was issued by London Stock Exchange LEI Ltd, taken from GLEIF's public Golden Copy | 840 |
| Customers group B | UK subsidiaries of Indian groups, and their current directors, from GLEIF plus the Companies House API | 114 companies, 400 directors |
| Customers group C | Companies on NSE's active debarment list that also hold an LEI | 31 |
| Customers group D | Any CSV you upload in the console | your own |
| News | 10 regulator and publisher feeds, indexed locally | 782 articles |

**Why this matters in an interview:** most portfolio projects use fake data, and fake data hides every real problem. Real data produced five defects in the matcher that synthetic tests never found (section 9). It also produced two findings that are interesting on their own: 26 of the 114 UK subsidiaries have a registry mismatch — GLEIF names an Indian parent while Companies House lists nobody with significant control — and 13 of the 31 debarred companies have let their LEI lapse.

**Know these three terms cold.**

- **LEI** — Legal Entity Identifier. A 20-character code (ISO 17442) that identifies a legal entity in financial transactions. GLEIF governs the system; the codes are issued by accredited bodies called LOUs, and **London Stock Exchange LEI Ltd is one of them**. That is the connection to LSEG: the customer book is built from entities LSEG itself issued identifiers to.
- **PEP** — Politically Exposed Person. Someone in a public position who therefore carries higher bribery and corruption risk. Their family and close associates count too. Being a PEP is not a crime; it is a reason for extra checks.
- **Debarment** — an order from a regulator (here NSE/SEBI) barring a person or firm from the securities market for a period.

---

## 6. The features, one at a time

For each feature: what it is, how it works, and what to say when asked.

### 6.1 The name match (check 1)

**What it is.** A score from 0 to 100 saying how much two names look and sound like the same name, with reasons.

**How it works.**
- Both names are normalised first (Devanagari transliterated, honorifics and relation clauses removed, initials expanded, company suffixes dropped, common spellings canonicalised so every form of Mohammad becomes one form).
- Each word gets a **phonetic key**, a rough spelling by sound. "Verma" and "Varma" key the same.
- The query's words are paired with the listed name's words, best pair first. A pair scores 1.0 if the words are identical, 0.94 if their keys match, 0.7 for an initial that fits a word, and lower for a near spelling.
- Each word carries an **IDF weight**: a rare surname counts far more than "Kumar", which appears everywhere. Middle names count 60%.
- The final score combines how much of the query is explained and how much of the listed name is explained, using a harmonic mean so a match must explain both sides, plus a small contribution from a general fuzzy ratio.

**Say this:** "It is not string distance. It is an alignment: which word in the query corresponds to which word on the list, how strong each pairing is, and how important that word is. That is also why every score comes with reasons — 'Verma sounds like Varma', 'initial S fits Sudhir', 'list name also has: Kumar'."

### 6.2 The identity check (check 2)

**What it is.** An independent second opinion that uses facts other than the name.

**The rules, exactly as implemented.**

| Evidence | Strength | Rule |
|---|---|---|
| Date of birth | strong | Same year and month → **supports**. Same year, different month → **neutral** (a month slip is a common recording error). One year apart → **neutral**. Two or more years apart → **contradicts**. |
| Nationality | weak | The customer's nationality maps to a country code. Present in the listing's countries → supports. Absent → contradicts. Weak evidence never decides on its own, because a listed country can mean jurisdiction rather than nationality. |
| PEP term of office | strong | Only when the listing has terms. If the customer's birth year would make them younger than 25 when the term started, that contradicts, because Article 84 of the Constitution sets 25 as the floor for the Lok Sabha. |

**The verdict.** A strong contradiction with no strong support means **contradicted**, and the alert is auto-cleared. A strong support means **confirmed** — which still goes to a human. Everything else is **inconclusive**.

**Say this:** "Only *contradicted* changes the workflow, and it never deletes anything. The alert stays visible with its evidence, so a reviewer can see what was cleared and why. And a clearance is not permanent: if the list corrects the record, the pair is screened again."

**The likely challenge — "Isn't auto-clearing dangerous?"** Answer: it only fires on a strong contradiction, which in practice means two dates of birth two or more years apart. That is not a judgement call. And nothing is hidden: the cleared alert, the evidence and the timestamp are all on the screen and in the audit log, and a change to the listing re-opens the question. The alternative — folding the date of birth into the name score, which is what the first version did — is genuinely dangerous, because the alert just disappears and nobody can see why. That was defect number 4.

### 6.3 The alert threshold

**What it is.** The score at or above which a name match becomes somebody's work. It is 80.

**Why 80.** The threshold is chosen on a development half of the benchmark and reported on a held-out half. F1 is effectively the same at 77 and 80 (0.9525 and 0.9531), but at 80 the system flags 2.4% of unlisted people instead of 3.4%. It costs a little recall and halves the noise. 80 is also a round number an operations team can reason about.

**Say this:** "The threshold is a business decision, not a technical one, so I made it visible. On the front page you can drag it and watch precision, recall, false alarms and misses move. That is the conversation a compliance team actually has."

### 6.4 Active versus historical listings

**What it is.** An NSE debarment order can be revoked or expire. 11,216 of the 29,574 entries are historical. They stay searchable, but they never raise an alert.

**Why it matters.** Without this, a third of the book alerts on orders that no longer apply. There is also a subtle bug I hit and fixed: alerting used to keep the top 5 matches *before* dropping historical ones, so a real active listing could be pushed out by revoked namesakes. That was defect number 3.

### 6.5 Maker-checker (the four-eyes rule)

**What it is.** The person who proposes a decision cannot approve it. A rationale of at least 10 characters is required, and it goes into the audit trail.

**Why it exists.** It is the standard control in financial crime operations: a single person should not be able to clear a sanctions alert alone. It is also cheap to implement and impossible to fake in a demo — the button is genuinely disabled, and the API rejects it, not just the UI.

**Say this:** "The rule is enforced in the service layer, so it holds for the API too, not only the screen. In the demo you can watch it refuse my own approval and then accept a different reviewer's."

### 6.6 The audit chain

**What it is.** Every event — screened, alert raised, proposed, approved, imported — is stored with a hash of itself plus the hash of the event before it: `sha256(prev, actor, action, target, detail, time)`.

**Why a chain, and not just a table.** A plain log can be edited row by row and nobody can tell. In a chain, changing any event changes every hash after it. `GET /audit/verify` walks the chain and names the first event that does not match.

**The detail that shows engineering care:** writing the chain uses a compare-and-set on the head, so two concurrent writers cannot fork it.

**Honest limit to state first:** "It is tamper-evident, not tamper-proof. Someone with write access to the database could recompute the whole chain. Real systems either write to append-only storage or publish the head hash somewhere external. I would add that next."

### 6.7 Importing your own customers

**What it is.** Upload a CSV in the console. The file is checked first without saving anything (a dry run): every bad row is rejected with its line number and the reason. Then the valid rows join the book as group D and are screened immediately, and any alert becomes a case you can open.

**Details worth knowing.** Columns are `name` (required), `kind`, `date_of_birth`, `nationality`, `country`, `customer_id`. Loose headers are accepted (`full_name` works as `name`). Dates in DD/MM/YYYY are converted. Re-uploading the same `customer_id` updates that customer instead of creating a duplicate. The cap is 2,000 rows.

### 6.8 Reverse screening

**What it is.** The normal direction is customer → list. Reverse screening goes list → customer: open any of the 29,574 listings and see who in *your* book it touches, with the identity check run on each hit.

**Why it matters.** It is the question a real desk asks when a name is in the news: "are we exposed to this person?" It is also a good demonstration that the matcher is symmetric — the same scoring runs in both directions.

### 6.9 The Wire (news) and the grounded dossier

**What it is.** Ten regulator and publisher feeds indexed locally with SQLite FTS5, laid out as a newspaper front page: a lead story, a risk desk that groups stories matching risk keywords, regulator desks, and coverage analytics.

**The part to be proud of — the dossier's refusal.** Ask for a brief on a name and the system will only return an event when the quote appears **verbatim** in the source text and the subject is actually named there. If nothing passes, it says so rather than guessing. You saw that in the demo: "No verified events for Hafiz Muhammad Saeed."

**Say this:** "Adverse media is where these systems hallucinate. I made the grounding check a hard gate: four checks, and a headline that mentions something else is left out rather than summarised into a claim. An empty answer is a correct answer."

### 6.10 The benchmark, and the lab on the front page

**What it is.** A generated benchmark of 2,000 queries built from real list names — 1,000 positives rewritten ten ways and 1,000 negatives — split into a development half and a held-out test half. Plus 34 hand-labelled real cases that CI refuses to regress.

**The lab** puts that benchmark on the landing page as four things a visitor operates: the threshold sweep, the ten transforms, the identity rule, and the real book's funnel.

**Say this:** "I did not want the page to claim accuracy. Claims are cheap. The page hands you the controls and lets you find the weak spot yourself — including the row where I lose."

### 6.11 The console itself

Eight screens, one job each, reachable by number key or ⌘K. Designed as a surveillance terminal: graphite panels, one meaning per colour (amber = attention, cyan = navigation, red-to-sand = match risk, green = cleared, violet = regulators), Archivo for words and Martian Mono for figures, and a status tape carrying the audit chain along the bottom. The system is written down in `DESIGN.md` so it is a system, not a mood.

### 6.12 The MCP server

**What it is.** The screening tools exposed over the Model Context Protocol, so an AI assistant can call `screen_entity`, `explain_match`, `get_record`, `adverse_media_brief` and `list_open_alerts`.

**Say this:** "The same core that serves the console serves an agent. It costs almost nothing once the service layer is clean, and it is where this kind of tool is going — the analyst asks a question in natural language and the model calls the deterministic screening engine underneath, rather than guessing the answer itself."

---

## 7. How the matcher works, step by step

Walk through one real example: the query is **"Shri. S K Agarwal"** and the list holds **"Sudhir Kumar Agarwal"**.

1. **Normalise.** "Shri." is an honorific and is removed. "S" and "K" are recognised as initials. The result is three tokens: `s`, `k`, `agarwal`.
2. **Phonetic keys.** `agarwal` keys to something like `agarwal`; the rules remove an `h` after a consonant, collapse doubled letters and drop a trailing `a`.
3. **Candidates.** The index looks up the key for `agarwal`, collects every listed name containing it, adds near keys found by Jaro-Winkler at 0.88 or above, and keeps the best 400 by IDF weight. A key that appears in too many names is skipped when a rarer key is present — otherwise "Kumar" would drag in half the list.
4. **Align.** `agarwal` pairs with `Agarwal` at 1.0. `s` is an initial and pairs with `Sudhir` at 0.7. `k` pairs with `Kumar` at 0.7.
5. **Weight.** `agarwal` is rare, so it carries a high IDF weight. `kumar` is common, so it carries little. Middle tokens are discounted to 60%.
6. **Score.** Query coverage and list coverage are combined with a harmonic mean, so a match has to explain both names, not just one. Final score: **80.6** — just over the threshold, which is right for an initials-only match.
7. **Explain.** The reasons come out as "initial S fits Sudhir", "initial K fits Kumar", "Agarwal matches exactly".

**Why the harmonic mean matters.** If you only measured how much of the query is explained, then "S K Agarwal" would score highly against a very long listed name that happens to contain Agarwal. Requiring both sides to be explained kills that.

**Why IDF matters.** Without it, "Anand Kumar" matching "Anand Kumar Gupta" and "Rajesh Kumar" matching "Suresh Kumar" would score similarly. Kumar is not evidence.

---

## 8. How we measure it, and what the numbers mean

**The three words, in plain English:**

- **Precision** — of the alerts you raise, how many are real. Low precision means wasted analyst days.
- **Recall** — of the listed people who should have been found, how many you found. Low recall means you missed a sanctioned person.
- **F1** — one number that balances the two (their harmonic mean), so you cannot win by being extreme in one direction.

**The numbers, from the held-out half:**

| System | Threshold | Precision | Recall | F1 | Unlisted people flagged |
|---|---:|---:|---:|---:|---:|
| **Satark** | 77 | 0.965 | 0.940 | **0.953** | 3.4% |
| Satark as shipped | 80 | 0.975 | 0.932 | 0.953 | 2.4% |
| RapidFuzz `token_sort_ratio` | 79 | 0.668 | 0.501 | 0.572 | 25.1% |
| Exact match on normalised names | 100 | 1.000 | 0.002 | 0.004 | 0.0% |

**Recall by the kind of change, Satark against the baseline:** Devanagari 100% / 2%. S/O clause 100% / 0%. Initials 91% / 13%. Middle name dropped 100% / 24%. Abbreviation 98% / 74%. Spelling variant 98% / 86%. Honorific 100% / 94%. Surname first 100% / 91%. Several at once 81% / 55%. **Typo 70% / 85%.**

**Where it loses, and say this before you are asked:** "On plain typos a simple edit distance beats me, 85 to 70. That is deliberate. I only accept close phonetic keys and I require keys of at least five letters, because loosening that produced a real false positive: a UK director called 'SINGH, Ankit' scored 90 against a Member of Parliament called 'Shrimati Anita Singh'. I chose precision. The measured cost is about four points of typo recall."

**Speed.** The median screen takes 1.9 milliseconds against 44,220 indexed names, measured across the 2,000 benchmark queries. In a running API process the same timer reads about 3 milliseconds.

**Honesty about the benchmark.** The list names are real; the rewrites are generated. The Devanagari queries are produced by this repo's own transliterator and read by the same table, so that row is optimistic. Say that before the interviewer does — it is a strength, not a weakness, to have noticed it.

**The 34 real cases.** Hand-labelled pairs from the real book against the real lists: 31 that should match and 3 that should not. All 34 pass, and CI fails the build if any regresses. On the pre-fix normaliser, 2 of them fail.

---

## 9. What real data taught the matcher

These five defects are the best story in the project, because they are the difference between a demo and engineering. Each now has a regression test.

1. **Company acronyms read as people's initials.** "KSN IMPEX PRIVATE LIMITED" scored 92.4 against "S K Impex". Fix: only split a capital cluster into initials for a person.
2. **Short names one edit apart.** "SINGH, Ankit" scored 90.3 against "Shrimati Anita Singh" — after schwa deletion, "Anita" keys to "anit", one edit from "ankit". Fix: require phonetic keys of at least five letters.
3. **A hidden active listing.** The top-5 cut ran before historical listings were dropped, so revoked namesakes could hide a live one. Fix: filter first, then cut.
4. **Silent suppression.** The date of birth was folded into the name score, so a contradiction made the alert vanish with no explanation. Fix: make it a separate, visible check with its own verdict.
5. **One director, several customers.** A director of two subsidiaries was screened twice. Fix: merge directors by Companies House officer id (434 rows became 400).

---

## 10. The stack, and why each piece

### Backend

| Choice | Why | What I say when asked "why not X?" |
|---|---|---|
| **Python 3.12** | The text-processing and data ecosystem is here, and RapidFuzz is a fast C++ library with Python bindings. | "Go or Rust would be faster per call, but 1.9 ms is already far below what matters, and I would have lost the ecosystem." |
| **FastAPI** | Typed request and response models, validation for free, and an OpenAPI page generated from the code. | "Django brings an ORM, an admin and templates I do not need. Flask would mean bolting on validation and docs myself. FastAPI gives me typed contracts, which matters when a frontend and an MCP server consume the same API." |
| **SQLAlchemy 2** | One model layer that runs on SQLite locally and Postgres in Docker without changing code. | "Raw SQL would be fine for this size, but I wanted the switch between SQLite and Postgres to be one environment variable, and it is." |
| **SQLite by default** | Zero setup: clone, seed, run. The whole database is one 25 MB file. | "For a demo, an extra service is a barrier. Postgres is already wired: `SATARK_DATABASE_URL` switches it, and docker compose runs Postgres, Redis and a worker." |
| **RapidFuzz** | Used two ways: as a helper inside the matcher (Jaro-Winkler, ratio, token-set) and as the **baseline** I measure against. | "I did not use it as the engine, because `token_sort_ratio` scores 0.572 F1 on this data. It is excellent at what it does — it just does not know that Shri is an honorific or that a Devanagari string is a name." |
| **A custom matcher** | Indian naming needs transliteration, honorifics, relation clauses, initials, phonetic keys and IDF weighting — plus an explanation for every score. | See section 11, the big one. |
| **SQLite FTS5** | Full-text news search inside the database I already have. | "Elasticsearch for 782 articles would be a second service to run, back up and explain." |
| **Redis Streams** | Watchlist changes are published as events and a worker re-screens affected customers. | "Celery plus a broker is more machinery than one stream needs. And the app runs with no Redis at all — there is an in-process bus, so a clone works without Docker." |
| **LangGraph** | Orchestrates the media-brief steps: fetch, extract, verify. | "The grounding gate is the point, not the framework. LangGraph gives the steps a shape I can inspect; I could have written it as functions." |
| **MCP** | Exposes the same tools to an AI assistant. | "It is where analyst tooling is heading, and once the service layer is clean it costs almost nothing." |
| **Prometheus** | Counters and a latency histogram for screening, alerts, decisions and deltas. | "Because 'is it fast' should be a number, not an opinion." |
| **pytest, 122 tests** | Matcher, normaliser, identity rules, upload parsing, maker-checker, audit chain, and the 34 real cases as a gate. | "The valuable ones are the regression tests: each of the five real defects has a test that fails on the old code." |

### Frontend

| Choice | Why | "Why not X?" |
|---|---|---|
| **React 19 + TypeScript** | A dense, stateful console with tables, filters and URL state. Types matter when the API contract changes. | "Plain JavaScript on a screen with this much state would be a false economy." |
| **Vite, multi-page** | Two entry points: a static landing page at `/` and the console app under `/app/`. The landing page ships as HTML with no framework. | "Next.js would add a server I do not need. There is no SEO requirement for a console, and no server rendering to gain. This way the landing page is a single HTML file and the console is a static bundle — both can be served by any web server." |
| **Tailwind v4 + shadcn/ui** | Design tokens in CSS, and components I own in my own repo rather than a dependency I cannot restyle. | "A component library like MUI would fight the design system. shadcn is copy-in: the code is mine, so the surveillance-terminal look is a few tokens, not a battle." |
| **TanStack Query** | Caching, refetching and loading states for every API call, handled once. | "Hand-rolled `useEffect` fetches turn into a mess of loading flags and stale data." |
| **TanStack Table** | Sorting, filtering and pagination over headless table logic I style myself. | — |
| **Recharts** | The console's standard charts. | "The bespoke ones — the token alignment with leader lines, the landing page's threshold sweep — are hand-drawn SVG, because a chart library fights you the moment the chart is not a standard chart." |
| **cmdk** | The ⌘K command menu. | — |

### Process

- **GitHub Actions**: the test suite plus the real-case gate on every push.
- **Docker**: a backend image, a frontend image built by nginx, and a compose file that runs Postgres, Redis, the API, the worker and optional Prometheus.
- **Documentation**: `DESIGN.md` for the design system, `docs/ARCHITECTURE.md` for the code map, `docs/BENCHMARKS.md` for the numbers, `docs/build-log.md` for every step with its measurements.

---

## 11. The three big "why not" questions

### "Why not just use an LLM?"

Four reasons, in this order:

1. **Determinism.** A screening decision has to be reproducible. The same name on the same list must give the same score today and in an audit two years from now. A model behind an API can change under you.
2. **Explanation.** The system has to say *why* it matched, in terms a reviewer and a regulator accept: "initial S fits Sudhir", "Agarwal matches exactly". A model can produce a fluent explanation that is not the actual reason for the answer.
3. **Cost and speed.** A screen is 1.9 ms locally and costs nothing. Screening 1,385 customers against 29,574 listings is millions of comparisons. That is an unusable bill and an unusable latency for a model call.
4. **It is the wrong tool for the shape of the problem.** Transliteration, honorifics and initials are lexical and phonetic rules, and they are knowable. Where a model *is* the right tool, I used one: reading a news article and extracting an event. And even there I put a hard grounding gate in front of it, because that is exactly where it will invent things.

**The strong closing line:** "The LLM sits where judgement over language is needed, behind a check. The screening engine stays deterministic, because that is what the control has to be."

### "Why not Elasticsearch, or a proper search engine?"

"Elasticsearch would give me fuzzy queries, a phonetic token filter and a scoring model, and for a 10-million-name index I would use it. Three reasons I did not here:

1. **The phonetics are wrong for this data.** The standard phonetic filters — Soundex, Metaphone — are built for English. They do not handle Devanagari, schwa deletion, or the fact that Verma and Varma are the same name.
2. **I still would have written the scoring.** The alignment, the IDF weighting, the initials rule, the reasons — none of that comes free with a search engine. I would be writing the same logic plus operating a cluster.
3. **It does not need it.** 44,220 indexed names fit in memory and screen in about 2 milliseconds. Adding a JVM service to a project that runs with `make seed && make api` would be cost without benefit.

At a real bank's scale — tens of millions of names, sharded, with an index that must not go down — my answer changes. The candidate-generation step is the part I would move to a search engine, and the scoring stays mine."

### "Why not embeddings or a vector database?"

"Because vector similarity blurs exactly the distinction I need to keep. 'Rajesh Kumar' and 'Ramesh Kumar' sit close together in almost any embedding space, and they are different people. I need a system that says *these two strings are the same name written differently*, not *these two names feel similar*. Embeddings also cannot explain themselves, need training data I do not have for Indian name variants, and would still need a threshold I would have to justify. Where I want fuzziness I have it under control: phonetic keys, with a minimum key length I set because a shorter one produced a real false positive."

---

## 12. Questions you are likely to get, with answers

### About the product

**"Who would use this?"**
A compliance or financial crime team at a bank, a broker or an exchange. The people who open the queue every morning and clear alerts.

**"How is it different from World-Check or an off-the-shelf screening tool?"**
"It isn't a competitor — those products have the data coverage, the vendors and the operations behind them. What I built is the control itself, on public data, to understand how it works: the matcher, the second check, the four-eyes rule and the audit trail. If I were adding a commercial source, it would enter through the same `Record` schema as the five lists I already load, and nothing else would change."

**"What is the actual business value of the second check?"**
"False positives are the entire cost of screening. Every one is analyst time and a delayed customer. On my own book, the identity check cleared 2 alerts outright and, more importantly, gave a reason for every remaining one. At a real bank's volumes, a check that clears even a few per cent automatically, with an auditable reason, pays for itself."

**"What happens when the matcher is wrong?"**
"There are two ways to be wrong and they cost differently. A false positive costs time — it lands in the queue and a human closes it. A false negative means a sanctioned person went unnoticed, which is a regulatory failure. That asymmetry is why the threshold sits where it does, and why I report both directions rather than a single accuracy number."

### About the data

**"Is any of this real data, or did you generate it?"**
"All of it is real and public. The lists come from OpenSanctions, the companies from GLEIF's Golden Copy, the directors from the Companies House API, and the news from ten RSS feeds. The only generated thing in the project is the benchmark's name rewrites, and I say so in the documentation."

**"Why those five lists?"**
"They are the ones that matter for an India-linked book and are publicly available: NSE/SEBI debarments for market bans, Parliament of India for PEPs, MHA for UAPA bans, and the UN and UK lists for sanctions."

**"Personal data — did you think about it?"**
"Yes. The directors are real people from a public register. Their records are cached locally and deliberately never committed: `data/cache/` is gitignored. A fresh clone seeds 985 customers, and the 400 directors only appear if you rebuild the book with your own Companies House key. The data is public, but I did not want to be the one republishing it."

**"What licence is the data under?"**
"OpenSanctions is CC BY-NC — non-commercial with attribution, which is fine for a portfolio project and is stated on the front page and in the README. It would need a commercial licence for a real product."

### About the algorithm

**"Walk me through what happens to one name."** — Section 7. Use the "Shri. S K Agarwal" example; it exercises honorifics, initials, IDF weighting and the threshold all at once.

**"Why 80 and not 85 or 75?"** — Section 6.3. Chosen on a dev half, reported on a held-out half, and the page lets you move it.

**"How do you handle two people with the same name and the same date of birth?"**
"The system does not pretend to resolve that. The identity check would report *supports*, the case opens, and a human decides with the registry context on the same screen. That is the correct behaviour — the system's job is to bring the evidence together, not to guess."

**"What if the customer has no date of birth?"**
"Then the check reports *no data* and the case goes to a person. That is the common case in my book: 48 of the alerts are inconclusive because the listing itself has no date of birth. I would rather report 'nothing to compare' than manufacture confidence."

**"Could you improve recall on typos?"**
"Yes, by loosening the phonetic key rule — and I measured what that costs. Dropping the five-letter minimum gains about four points of typo recall and reintroduces a false positive I had already found in real data. If a client's data were noisier, I would make that rule a configurable per-source setting rather than a constant."

### About the engineering

**"How would this scale to 10 million names?"**
"Three things change. Candidate generation moves out of memory into a search engine or an inverted index on disk. Screening moves from request time to a queue with a worker pool — the worker and the event bus are already there for watchlist deltas. And the database moves to Postgres, which is one environment variable because everything goes through SQLAlchemy. The scoring itself does not change; it is already only comparing 400 candidates."

**"What is the slowest part?"**
"Building the index at startup, not screening. Screening is about 2 ms because candidate generation cuts 44,220 names down to 400 before any real scoring."

**"How do you know the code works?"**
"122 tests, and the ones that matter are regression tests: each of the five defects real data exposed has a test that fails on the old code. On top of that, 34 hand-labelled real cases run in CI as a gate — if a change breaks one, the build fails."

**"What is your test strategy for the matcher specifically?"**
"Three layers. Unit tests on the normaliser, where each rule has a case. The generated benchmark for aggregate behaviour, which catches drift. And the 34 real labelled pairs for the specific failures I have seen, which catches regressions."

**"Why is there no authentication?"**
"Because it would be theatre. There is no real user directory here, so I made the identity an explicit demo switch rather than a fake login. The control that actually matters — that the proposer cannot approve — is enforced in the service layer and would sit behind whatever identity provider a real deployment used. I would rather have an honest gap than a login box that proves nothing."

**"What would you do next, with a week?"**
In order: 1) real authentication and roles, 2) publish the audit head hash externally so the chain is tamper-*proof*, not only tamper-evident, 3) identifier matching once a source shares an identifier — today there are zero comparable identifier pairs because NSE carries PANs and GLEIF carries CINs, 4) per-source tuning of the matcher's thresholds, 5) a proper deployment with a read-only demo mode.

### About the process

**"Did you use AI to build this?"**
Answer it straight: "Yes, heavily — I worked with Claude Code the way you would work with a fast pair. What I owned is the part that matters: the problem, the data sources, the rules, the decisions about where to trade precision for recall, and every number in the documentation was measured rather than claimed. The five defects in section 9 came from running it on real data and reading the output, not from the model. I can walk you through any file in this repository and tell you why it is that way."

**"How long did it take?"** Be honest about the real timeline and what that means: the scope was chosen to fit it, which is why there is no authentication and no deployment.

**"What is the part you are proudest of?"**
"The identity check that clears a perfect name match, and the fact that the front page hands you the controls to test my own claims — including the row where a simpler tool beats me."

**"What went wrong?"**
Pick one and tell it properly. The best is defect 4, silent suppression: "The first version folded the date of birth into the name score. It looked better — fewer alerts — but the alert just disappeared and nobody could see why. In this domain an invisible decision is worse than a wrong one, so I split it into two visible checks. The score got 'worse' and the system got correct."

---

## 13. Numbers to remember

| | |
|---|---|
| Watchlist entries | **29,574** — 18,358 active, 11,216 historical |
| Lists | **5** — NSE/SEBI, Parliament of India, MHA, UN, UK |
| Indexed names (with aliases) | **44,220** |
| Customers | **1,385** — A 840, B 514, C 31 (a fresh clone seeds 985) |
| Alerts on the real book | **50** at 80 or above, on 46 customers |
| Auto-cleared by evidence | **2** |
| Cases waiting | **45** |
| Satark F1 / precision / recall at 80 | **0.953 / 0.975 / 0.932** |
| Baseline F1 (RapidFuzz token_sort_ratio) | **0.572** |
| Unlisted people flagged | **2.4%** against **25.1%** |
| Devanagari recall | **100%** against **2%** |
| Typo recall (where I lose) | **70%** against **85%** |
| Real labelled cases | **34 of 34** pass |
| Median screen | **1.9 ms** |
| Backend tests | **122** |
| Registry mismatches found | **26 of 114** UK subsidiaries |
| Lapsed LEIs found | **13 of 31** debarred companies |

---

## 14. The five-minute demo script

1. **Front page, 60s.** "Every claim on this page is something you can operate." Drag the threshold. Point at false alarms and misses moving for both systems.
2. **Identity slider, 45s.** "A 100-point name match, cleared by one date of birth." Move it to 1974 and back.
3. **Overview, 30s.** "The live state: 1,385 customers, 50 alerts, 2 cleared, 45 cases."
4. **Case file, 60s.** Both checks side by side. Read one reason out loud.
5. **Four-eyes, 60s.** Propose, get refused, switch reviewer, approve. Point at the two hashes appearing in the chain.
6. **Audit, 20s.** Re-verify. "Chain intact."
7. **Lists, 30s.** Search a name, show reverse screening: "who in my book does this listing touch?"
8. **Benchmark, 15s.** "And the same numbers, re-run in the console."

If you only get 90 seconds: the threshold drag, the identity slider, and the four-eyes refusal.

---

## 15. Own these weak spots before they are found

Say them yourself. Each one has a good reason attached.

1. **No authentication.** Deliberate: an honest demo switch beats a fake login.
2. **The Devanagari benchmark row is optimistic**, because the same table writes and reads the script.
3. **Typos are better served by a simpler matcher**, and I chose precision knowingly.
4. **The audit chain is tamper-evident, not tamper-proof.**
5. **Most director alerts are inconclusive**, because the matched listings carry no date of birth. The system says so rather than guessing.
6. **News history starts at the first poll**, because RSS only carries recent items.
7. **Not deployed.** It runs locally with two commands, and the walkthrough is recorded.
8. **The data licence is non-commercial**, so this could not be sold as it stands.

---

## 16. Small glossary

- **Alias** — another name a listing is known by. Each one is indexed separately.
- **Band** — the label on a score: strong (90+), probable (80+), possible (70+).
- **Debarment** — a regulator's order barring someone from the market.
- **False positive** — an alert on someone who is not the listed person. Costs time.
- **False negative** — a listed person you failed to find. Costs a regulatory failure.
- **FTS5** — SQLite's built-in full-text search, used for the news index.
- **GLEIF** — the foundation that governs the LEI system.
- **IDF** — inverse document frequency: rare words carry more weight than common ones.
- **Jaro-Winkler** — a string similarity measure that rewards a shared prefix.
- **LEI** — a 20-character code identifying a legal entity, issued by accredited bodies like London Stock Exchange LEI Ltd.
- **Maker-checker** — the four-eyes rule: the proposer cannot approve.
- **MCP** — Model Context Protocol, the interface that lets an AI assistant call tools.
- **PEP** — politically exposed person.
- **Phonetic key** — a rough spelling by sound, so Verma and Varma compare equal.
- **Schwa deletion** — the rule that the inherent "a" in Devanagari is often not pronounced; "राम" is Ram, not Rama.
- **Screening** — checking a name against watchlists.
- **Transliteration** — writing a name from one script in another.
