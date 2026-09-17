# Benchmarks

This document gives the method, the numbers and the commands for Satark's name-matching benchmark against two baselines.

## 1. What the benchmark measures

The benchmark measures one thing: **name matching accuracy**.

It answers one question. A name arrives in a form that the watchlist does not hold. Does the system still find the listed person?

Three systems answer that question on the same queries:

| System | What it does |
|---|---|
| **Satark** | `MatchIndex.screen`: Devanagari transliteration, honorific and relation-clause removal, Indic phonetic keys, IDF-weighted token alignment |
| **RapidFuzz** | `rapidfuzz.fuzz.token_sort_ratio` over the same names, lowercased and stripped of punctuation |
| **Exact** | String equality on the same normalised text |

### What the benchmark does not measure

- **The identity check is not in these numbers.** The benchmark scores names only. Date of birth, PEP term age and nationality play no part. `evaluate()` calls `index.screen()` and never calls `secondary_check()`.
- **The queries are generated, not harvested.** A program rewrites real list names. No real customer sent these queries.
- **The Devanagari queries come from this repo's own transliterator.** `variants.latin_to_devanagari` writes them. `names.normalize` reads them. Both use the same table of consonants and vowels. Treat the Devanagari result as optimistic.
- **Alerting rules are not in these numbers.** The benchmark ignores active and historical status. It ignores the top-5 cut that alerting applies.

The list names are real. The transforms are real patterns in Indian name data. The pairing of the two is synthetic.

## 2. How the benchmark is built

`backend/satark/evaluation.py` builds the query set. `satark eval` runs it.

### The query set

`build_cases()` produces **2,000 queries** from the real watchlist snapshots.

| Part | Count | Source |
|---|---:|---|
| Positives | 1,000 | 100 per transform, from real list names, ten transforms |
| Negatives · random person | 500 | Faker `en_IN` names that match no indexed key |
| Negatives · surname swap | 500 | A real list name with its last token replaced |
| **Total** | **2,000** | |

Positives come only from the four India-relevant lists: NSE debarments, Parliament of India, MHA UAPA bans and the UN Security Council. The transforms are Indian-name transforms. The UK Sanctions List stays in the index as extra distractors. A source name qualifies when it is a person, has 2 to 4 name keys, and has no key shorter than 3 letters.

Both negative kinds are checked against the index keys. A generated negative that matches a real key is discarded.

### The ten transforms

`backend/satark/variants.py` holds the rules.

| Transform | What it changes in the name |
|---|---|
| `devanagari` | Writes the whole name in Devanagari script, with schwa deletion |
| `relation` | Appends `S/O`, `D/O` or `W/O` and a relative's name |
| `initials` | Replaces every token except the last with its initial |
| `combo` | Applies two of honorific, spelling, reorder, initials and typo |
| `drop_middle` | Keeps the first and last token, removes the middle |
| `abbreviation` | Shortens Kumar to Kr., Mohammad to Md., Prasad to Pd. |
| `spelling` | Applies one Indic spelling swap, such as `sh`→`s` or `v`→`w` |
| `honorific` | Adds Shri, Smt., Mr., Dr., Late or Kumari before the name |
| `reorder` | Moves the last token to the front |
| `typo` | Deletes, doubles or swaps one letter inside a token |

### Seed, split and threshold selection

- **Seed 7.** `random.Random(7)` orders the people. `VariantMaker(7)` writes the variants. `Faker` is seeded with 7. The same seed gives the same 2,000 queries.
- **Split.** `random.Random(8)` shuffles the 2,000 case indices. The first half is the **dev** set (1,000 queries). The second half is the **test** set (1,000 queries).
- **Threshold selection.** Each system gets its own threshold. The threshold is the one with the best F1 **on the dev half**. A tie goes to the lower threshold. Satark and RapidFuzz are swept from 50 to 99. Exact has one operating point, 100.
- **Reporting.** Every number below comes from the **test half**, at the threshold that the dev half selected.

The dev half selects the threshold. The test half scores it. A system cannot select a threshold that flatters its own report.

## 3. Results

### Systems at their selected threshold

All rows are the test half. `reports/eval.json` holds the full report.

| System | Threshold | Precision | Recall | F1 | Unlisted people flagged |
|---|---:|---:|---:|---:|---:|
| **Satark** (dev-selected) | 77 | 0.9652 | 0.9401 | 0.9525 | 3.4% |
| **Satark** (production) | 80 | 0.9749 | 0.9321 | 0.9531 | 2.4% * |
| RapidFuzz | 79 | 0.6676 | 0.5010 | 0.5724 | 25.1% |
| Exact | 100 | 1.0000 | 0.0020 | 0.0040 | 0.0% |

"Unlisted people flagged" is the false positive rate over the negatives in the test half. RapidFuzz flags one unlisted person in four. Satark flags one in thirty.

\* The report stores this rate only at each system's selected threshold. The 2.4% is derived from the sweep. The test half holds 501 positives and 499 negatives. Precision 0.9749 with recall 0.9321 gives 467 true positives and 12 false positives. 12 of 499 is 2.4%. Every other cell in this table is printed in `reports/eval.json`.

Exact match is the control. It proves the queries are hard. Exact match finds 1 of 501 listed people in the test half.

### Recall per transform

Each system runs at its own selected threshold. Each row holds about 100 test queries.

| Transform | Satark recall | RapidFuzz recall |
|---|---:|---:|
| Devanagari script | 100% | 2% |
| S/O · D/O clause | 100% | 0% |
| Initials | 91% | 13% |
| Several at once | 81% | 55% |
| Middle name dropped | 100% | 24% |
| Abbreviation (Kr., Md.) | 98% | 74% |
| Spelling variant | 98% | 86% |
| Honorific (Mr., Shri) | 100% | 94% |
| Surname first | 100% | 91% |
| **Typo** | **70%** | **85%** |

On the negatives, Satark rejects 98.8% of random names and 94.4% of surname swaps. RapidFuzz rejects 84.4% and 65.5%.

### One real scored example per transform

Each row is a real case from the seed-7 run. Both systems scored the same query against the same listed name.

| Transform | Query | Listed name | Satark | RapidFuzz |
|---|---|---|---:|---:|
| Devanagari script | संजय वेर्मा | Sanjay Verma | 96.7 | below 50 |
| S/O · D/O clause | Srinath Narasimhan D/O Neel Narasimhan | Srinath Narasimhan | 100.0 | 64.3 |
| Initials | M. Faisal | Mohammad Faisal | 88.2 | 69.6 |
| Several at once | Shri. S K Agarwal | Sudhir Kumar Agarwal | 80.6 | below 50 |
| Middle name dropped | Trivendra Rawat | Trivendra Singh Rawat | 94.2 | 83.3 |
| Abbreviation (Kr., Md.) | Sripal Kr. | Sripal Kumar | 100.0 | 85.7 |
| Spelling variant | Rajes Das | Rajesh Das | 96.6 | 75.0 |
| Honorific (Mr., Shri) | Mr. Lipika Bhaduri | Lipika Bhaduri | 100.0 | 91.4 |
| Surname first | Katyal Roma | Roma Katyal | 100.0 | 100.0 |
| Typo | Nityananda Prradhan | Nityananda Pradhan | 97.3 | 97.3 |

"below 50" means RapidFuzz returned no result. `FuzzyBaseline` uses a score cutoff of 50.

`.impeccable/examples.py` regenerates this table.

## 4. Where Satark loses

**Satark loses on typos. RapidFuzz catches 85 of 100 typo queries. Satark catches 70.**

The cause is in the design. Satark accepts a spelling variant only when the two phonetic keys are close and the key is at least 5 letters long. A deleted or doubled letter often moves the key too far. RapidFuzz measures raw edit distance, so one wrong letter costs it almost nothing.

The 5-letter rule was added on purpose. Before it, the 4-letter key `anit` counted as a spelling variant of `ankit`. A real UK director named "SINGH, Ankit" then scored 90.3 against the MP "Shrimati Anita Singh". That is a strong-band false positive on real data.

The measured cost of that rule, at threshold 80:

| Measure | Before the rule | After the rule |
|---|---:|---:|
| Precision | 0.9711 | 0.9749 |
| Recall | 0.9381 | 0.9321 |
| F1 | 0.9543 | 0.9531 |
| Typo recall | 0.74 | 0.70 |

Satark trades typo recall for precision. A looser rule catches more typos and raises more false alerts. The typo row stands in the report and on the landing page.

## 5. The threshold

Satark ships at **80**. The dev half selected 77.

| Threshold | Satark P | Satark R | Satark F1 | RapidFuzz P | RapidFuzz R | RapidFuzz F1 |
|---:|---:|---:|---:|---:|---:|---:|
| 50 | 0.5223 | 0.9800 | 0.6815 | 0.4418 | 0.7884 | 0.5663 |
| 60 | 0.6830 | 0.9721 | 0.8023 | 0.4376 | 0.7705 | 0.5582 |
| 70 | 0.8819 | 0.9541 | 0.9166 | 0.4610 | 0.6367 | 0.5348 |
| **80** | **0.9749** | **0.9321** | **0.9531** | 0.6775 | 0.4990 | 0.5747 |
| 90 | 0.9917 | 0.7166 | 0.8320 | 0.9380 | 0.2415 | 0.3841 |
| 99 | 0.9951 | 0.4032 | 0.5739 | 0.9677 | 0.0599 | 0.1128 |

`frontend/landing/lab.js` holds the full sweep, one row per threshold from 50 to 99.

Three reasons to ship at 80:

1. **F1 is flat between 77 and 80.** Satark scores 0.9525 at 77 and 0.9531 at 80. The choice costs no measurable F1.
2. **Precision is worth more than recall to a review queue.** At 80 Satark flags 2.4% of unlisted people. At 77 it flags 3.4%. Every false alert costs a reviewer time. A missed name still reaches the queue through a second list or a later delta.
3. **80 is the band edge.** `band_for` calls 80 and above "probable" and 90 and above "strong". The alert threshold and the band edge are the same number, so a reviewer reads one scale.

Below 70 the queue floods. Above 90 the system misses listed people in silence. Satark scores recall 0.7166 at threshold 90.

The test half prefers 79 slightly, at F1 0.9553. The dev half chose 77. This gap is the cost of an honest split. The document reports the dev-selected threshold and does not use the test half to pick a better one.

## 6. The 34 real labelled cases

The synthetic benchmark cannot catch a defect that only real data shows. `data/eval/real_cases.csv` holds **34 hand-labelled pairs**. Each pair is a real customer name and a real listing.

| Group | Count | Label | Source |
|---|---:|---|---|
| Debarred LEI holders | 31 | `match` | A GLEIF LEI holder whose legal name equals an active NSE debarment |
| Acronym false positives | 2 | `no_match` | Real GLEIF entities from the LSE-issued LEI book |
| Short-name false positive | 1 | `no_match` | A real Companies House director against a real MP |

**Result: 34 of 34 pass** at threshold 80. `.impeccable/bench-real.json` holds the run.

A `match` case must reach 80 for its own entity. A `no_match` case must stay below 80. `evaluate_real` ignores active and historical status, because this gate guards name matching only.

### The three `no_match` cases

| Query | Listed name | Score before | Score now | Defect the case fixed |
|---|---|---:|---:|---|
| KSN IMPEX PRIVATE LIMITED | S K Impex | 92.4 | 73.1 | An organisation acronym was split into personal initials |
| GRS EXPORTS | S. G. Global Exports | 82.2 | 63.5 | The same defect, second instance |
| SINGH, Ankit | Shrimati Anita Singh | 90.3 | 0.0 | A 4-letter phonetic key counted as a spelling variant |

The three cases cover two defects. The first two are the same defect in two companies. The third is the 5-letter key rule of section 4.

### The CI gate

```
satark eval --real --gate
```

The command exits 1 when any labelled case fails. `.github/workflows/ci.yml` runs it on every push and every pull request, next to `satark eval --gate`.

The synthetic gate has its own floors in `cli.py`: precision 0.93, recall 0.90, F1 0.92.

The real-case gate was checked against the old code. On the pre-fix name normaliser the two acronym cases both fail.

`satark eval --export-decisions` appends every approved maker-checker decision to the same file. A confirmed alert becomes a `match`. A discarded alert becomes a `no_match`. The reviewers' work grows the gate.

## 7. Latency and index size

Two different numbers exist. Both come from the same clock: the timer inside `MatchIndex.screen`, which `matcher.py` writes to `ScreenResult.latency_ms`.

| Measurement | Value | Where it comes from |
|---|---:|---|
| Benchmark, median (p50) | 1.91 ms | 2,000 benchmark queries in one process, `reports/eval.json` |
| Benchmark, p95 | 4.59 ms | the same run |
| Benchmark, maximum | 6.74 ms | the same run |
| API `POST /screen` | 2.97 to 3.20 ms | three recorded live calls, `frontend/landing/lab.js` |

The 1.91 ms figure is the matcher alone, in a tight loop, with a warm index. The 3 ms figure is the same matcher timer inside a running API process. Neither number includes HTTP transport or the identity check.

| Index | Size |
|---|---:|
| Watchlist entities | 29,574 |
| Indexed names (names plus aliases) | 44,220 |

The 44,220 indexed names include the UK Sanctions List. No positive query comes from that list. Its names act as distractors.

## 8. How to reproduce

```bash
make install     # venv, backend and frontend dependencies
make eval        # the 2,000-query benchmark, with the quality gate
make eval-real   # the 34 real labelled cases, with the CI gate
```

`make eval` runs `satark eval --gate` in `backend/`. It writes the report to **`reports/eval.json`** and prints the systems table, the per-transform recall and the latency to standard output.

`make eval-real` runs `satark eval --real --gate`. It prints the pass count and every failure.

The seed is **7** by default. To change the query set or its size:

```bash
satark eval --seed 7 --positives 1000 --negatives 1000
```

The same seed gives the same 2,000 queries on any machine. The run takes a few seconds.

### Where these numbers appear

Three surfaces read the same report. None of them holds a second copy of the method.

| Surface | Reads |
|---|---|
| Console → Benchmark screen | `GET /eval` (serves `reports/eval.json`) and `GET /eval/real` (runs the 34 cases live) |
| Landing page benchmark lab | `frontend/landing/lab.js`, copied from the same report |
| `README.md` | the same report, rounded to 3 decimal places |

---

## Numbers corrected against the repo

- **Satark at 80, "unlisted people flagged".** The brief and `README.md` both leave this cell blank. `docs/build-log.md` line 57 gives 2.2%, but that line describes an earlier state of the matcher. The current value is 2.4%, derived from the sweep as the systems table explains.
- **`docs/build-log.md` line 57 also reports the flagged rate at threshold 77 as 4.2%.** That is the same superseded step. The current rate at 77 is 3.4%, and `README.md` agrees.
- **`docs/build-log.md` carries superseded accuracy figures.** Line 120 reports threshold 80 at P 0.971, R 0.938, F1 0.954. Line 51 reports P 0.976, R 0.910, F1 0.942. Both come from steps before the 5-letter key rule. The current values are P 0.9749, R 0.9321, F1 0.9531. Line 165 records that change. This document uses the current values.
- **F1 rounding.** The brief and `README.md` give Satark F1 0.953 at both 77 and 80. The report gives 0.9525 at 77 and 0.9531 at 80. Both round to 0.953. This document prints the report values to 4 decimal places.

Every other number in this document matched the repo. The brief's tables were correct in every other cell.

## Could not verify

- **The benchmark was not re-run.** This worktree has no `.venv`. The numbers come from `reports/eval.json` and `.impeccable/bench.json`, which are identical and were generated at 2026-09-16T23:04:45Z with seed 7.
- **The per-transform recall figures for RapidFuzz in `README.md` are stated to 0 decimal places.** The report gives 4. The two agree after rounding.
