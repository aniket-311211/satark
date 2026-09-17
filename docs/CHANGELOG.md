# Changelog

What changed in Satark, newest first, and why each change was necessary.

Every entry names the commits that made it. All of this work was committed on 2026-09-17,
so the time of day separates the themes. `docs/build-log.md` holds the longer account of
each step with its measurements. This document does not repeat those measurements.

---

## The recorded walkthrough — 2026-09-17, 23:38 (`18de389`)

The product now records itself. A reader can watch the whole workflow before a single file
is opened. Playwright drives the run against a copy of the database, so every write in the
video is a real write.

- `docs/demo/satark-walkthrough.mp4` runs 3 minutes 46 seconds at 1280x720. It has
  on-screen captions and a synthesised score.
- `docs/demo/stills/` holds 52 stills, one for each beat of the run.
- `docs/demo/README.md` maps each still to what it shows.
- The video covers the benchmark lab on the landing page, then all eight console pages.
- It decides one case under the four-eyes rule. It imports a CSV file and screens it.
- The single cut is the move from the landing page to the console. Headless Chrome stops on
  the cross-document view transition, so that move is a cut and not a sweep.

## The benchmark lab on the landing page — 22:41 (`c76cb05`)

The landing page claimed F1 0.953 against 0.572. A reader had to accept that claim on
trust. Everything below the hero is now four experiments on the project's own measurements,
and then a live matcher.

- `frontend/index.html` replaced four marketing sections with the lab.
- `frontend/landing/lab.css` and `frontend/landing/lab.js` hold the styles and the
  behaviour. The production build puts both into the landing entry.
- Experiment 1 draws the precision, recall and F1 sweep from threshold 50 to 99 for both
  systems. The reader drags the alert line. A slider serves keyboard users. The readout
  states false alarms per 100 alerts and missed listed people per 100.
- Experiment 2 lists the ten name transforms in the benchmark. Each row gives one real case
  and the recall of both systems. The typo row stays visible, because a plain edit distance
  is better than Satark there, 85 against 70.
- Experiment 3 puts one date of birth on a slider against a perfect name match. The verdict
  follows the same rule the API runs.
- Experiment 4 draws the funnel from 1,385 customers to 45 cases. It then shows the 34
  labelled real cases as a grid.
- "Try a name" posts to `/api/screen` and lists the five best matches. If the API does not
  answer, the page shows three recorded runs and says that it is offline.

## The logo, the search crash, the Wire heading and the landing copy — 21:16 to 21:21 (`3d96181`, `f194d17`)

The owner supplied a logo. The command menu crashed on every open. The landing page still
did not state what Satark does.

- The logo became `frontend/public/brand/satark-logo.png`, plus the mark, the favicon and
  the apple-touch icon. `frontend/src/components/satark/mark.tsx` and
  `frontend/app/index.html` use them. The wordmark carries the view transition into the
  console.
- `frontend/src/components/news/masthead.tsx` now prints "SATARK Wire", which agrees with
  the titles of the other pages.
- `frontend/index.html` received readable labels around the figure. It also states in plain
  words why a reader would use Satark.

**Fixed**

- The command menu crashed on every open. `CommandDialog` in
  `frontend/src/components/ui/command.tsx` rendered no `<Command>` root, so the input, the
  list and the items found no store. One wrapper element closed the defect.

## Your own customers, a working Lists page, a seamless front door — 20:47 to 21:01 (`ce07ded` to `1a04c61`)

The owner used the redesign and named five problems. The landing copy did not say what the
product does. The light landing page disagreed with the dark console. The Watchlists page
only repeated static counts. The command bar button collapsed into an unlabelled box. The
planned customer upload did not exist. This theme closed all five.

- **Landing.** `frontend/index.html` moved onto the console's graphite ground with bone
  text. The figure video has a pale backdrop, so a WebGL shader removes that colour and
  keys the figure onto the dark ground. Without WebGL the plain video plays.
- **Import customers** (`f211f67`, `ce49dfb`). `backend/satark/upload.py`,
  `backend/satark/service.py` and `backend/satark/api.py` added `POST /customers/import`. A
  dry run maps loose headers and rejects each bad row with its line number and a reason. An
  import adds the valid rows as customer group D and screens only those customers.
  `frontend/src/components/customer/import-panel.tsx` previews the file, imports it, and
  links every case that results.
- **Satark Lists** (`0287aa7`). `GET /entities` browses all 29,574 listings by name, list,
  status and kind. `GET /entities/{id}/exposure` screens a listing and its aliases back
  against the customer book, and runs the identity check on each hit.
  `frontend/src/pages/watchlists.tsx` became a real working page with `list-selector.tsx`,
  `listing-table.tsx` and `exposure-panel.tsx`. The URL holds the page state.
- **Branded titles** (`ac807e3`). Page titles read "SATARK Overview", "SATARK Queue" and so
  on. The tabs and the command menu use the same short names.
- **The command bar.** The button always prints "Search". Below 1400 px the desk clocks
  disappear, and the button keeps its label.

Checked: 122 backend tests pass, including new tests for the upload parser, the dry run, a
repeated upload and reverse screening. The import also ran end to end in a browser against
a copy of the database. Two rows were rejected with their reasons, the valid rows opened
cases, and one match was auto-cleared by date of birth.

## The Surveillance Terminal redesign — 13:46 to 18:56 (`fa0e96a` to `bce6473`)

The first console was plain, white and generic. The owner asked for new fonts and colours,
more kinds of chart on the Overview, a News desk in the form of a newspaper front page, and
a landing page with the Satark name and a way in. The console became an exchange
trade-surveillance terminal.

- **Design system.** `DESIGN.md` records the world. Graphite panels sit on a near-black
  ground with hairline rules and bone text. Each hue means one thing. Amber is attention,
  cyan is navigation, red to sand is match risk, green is cleared, violet is regulators.
  Archivo sets the words and Martian Mono sets the figures.
- **Shell** (`e1cdaed`). `frontend/src/components/satark/app-shell.tsx` holds a command bar
  with numbered function tabs on keys 1 to 8, a London clock and a Mumbai clock, the demo
  identity, and a status tape. The tape runs the audit chain along the bottom of every page.
- **Overview** (`6c42389`). The page became a monitor wall. New components draw the open
  cases by band, the screening funnel, the identity verdicts, the alert score histogram,
  the customer group against list heatmap, the watchlist board, the matching quality and
  the news pulse.
- **Wire** (`eb1f960`). `frontend/src/pages/news-desk.tsx` became a wire-service front page
  with a nameplate, a regulator ticker, a lead story, a risk desk by adverse-media
  category, regulator and press columns, coverage analytics and a name dossier.
- **Working pages** (`6c42389`). The queue, the case file, the customers, the watchlists,
  the Screen page, the benchmark and the audit page were rebuilt densely. Every state
  prints as a word and not only as a colour.
- **Backend** (`fa0e96a`). `/news` and `/news/search` tag each article with the
  adverse-media category that the brief extractor already uses.
- **Landing** (`3c054f0`). The Satark wordmark and "Let's get started" sit at top centre.
  The nav and the placeholder mark are gone. A click plays a short exit and opens the
  console through a cross-document view transition.

**Fixed** — finish review, rounds 1 and 2 (`20d0f4d`, `b11bcb1`)

An independent reviewer judged the screenshots against the request. Round 1 returned eight
findings. Round 2 confirmed six of them as closed and found two new regressions. The four
open items were then fixed and checked by screenshot. Two rounds was the review budget.

- The Wire sections below the fold still appeared as plain lists. They became desks.
- Datelines came in several formats. There is one format now.
- The desk clocks were hidden at 1440 px.
- Rows of stat tiles repeated figures from the panels below them.
- Tables clipped on phones.
- Tab codes sat beside page titles and acted as eyebrow labels.
- Some colours and line forms broke the rule that one hue means one thing.
- Two pages counted "strong" cases over different sets.
- The two regressions from round 2: the Wire overflowed on phones, and a risk-desk count
  disagreed with the masthead.

## The rebuild on real data — 01:36 to 11:37 (`8e53865` to `1944cec`)

Satark v0.1 matched names well but ran on synthetic ground. The customers were 1,000 Faker
names with 25 watchlist names planted in them, so every alert was manufactured. This block
replaced the ground with real public data, and then built the workflow on top of it.
`docs/build-log.md` steps 0 to 6 hold the measurements.

- **Real watchlists** (`229e19e`). `sources.py` now parses the full OpenSanctions
  FollowTheMoney export instead of the simple CSV. It keeps order dates, revocations, order
  links, PEP terms and family links. Status rules decide whether an order is active,
  revoked or expired. Only active listings raise alerts. The UK Sanctions List joined as a
  fifth source, which gives 29,574 listings.
- **A real customer book** (`12f37cc`). No real bank customer list is public, so the book
  comes from business registries. Group A is the Indian entities whose LEI is issued by
  London Stock Exchange LEI Ltd. Group B is UK subsidiaries of Indian groups with their
  current directors, from GLEIF and Companies House. Group C is companies on the active NSE
  debarment list that also hold an LEI. The book holds 1,385 customers. Personal data stays
  in a local cache and is never committed.
- **The matcher against the real book** (`467ca2d`, `3530b6c`). Screening real customers
  exposed five defects that the synthetic benchmark could not reach. Each one now has a
  regression test. `data/eval/real_cases.csv` holds 34 labelled real pairs, and CI fails if
  any pair regresses. All 34 of 34 pass.
- **A second, independent identity check** (`eede335`). A name match finds a candidate. It
  cannot confirm one. `secondary.check` compares the date of birth, the age of a PEP term
  and the nationality. It reports each check as supports, contradicts, neutral or no data.
  A strong contradiction clears the alert and keeps it visible with its evidence. A
  clearance stands only while the listing is unchanged. Conflicting strong evidence goes to
  a human.
- **Cases, maker-checker and the audit chain** (`4fbd8b4`). Alerts open one case for each
  customer. An analyst proposes a decision with a written rationale, and a different
  reviewer approves it or rejects it. The old single-person endpoint was removed, so nobody
  can bypass the control. Each audit event stores `sha256(prev, actor, action, target,
  detail, time)`. A compare-and-set on the chain head stops two writers from forking the
  chain. `GET /audit/verify` names the first tampered event.
- **Adverse media from an owned index** (`5796521`). The old brief searched Google News RSS,
  an unofficial aggregator with unclear terms. `satark news poll` now fetches 10 allowlisted
  regulator and publisher feeds with conditional GETs. Items go into SQLite with an FTS5
  index, so a brief searches locally and has no call limit.
- **The console and the API** (`5f1f430`, `d048131`, `fcee511`, `9b4b00a`, `b302598`,
  `99a37bf`, `521ecdc`, `1944cec`). The single page of API calls became two surfaces built
  by Vite. A static landing page sits at `/` and the analyst console at `/app/`. New
  endpoints serve chart breakdowns, customer filters, the news wire and the real-case
  results. The console added the Overview, Watchlists, review queue, case file, audit
  trail, customer registry, customer profile, name screening, News desk and Benchmark
  pages.

**Fixed** — the five defects that real data exposed in the matcher

1. **Company acronyms read as a person's initials.** "KSN IMPEX PRIVATE LIMITED" scored 92.4
   against "S K Impex". The normaliser now decides person or organisation before it splits
   a short token into initials. Regression: the pair must stay below 80 in
   `data/eval/real_cases.csv`.
2. **Short names one edit apart.** Director "SINGH, Ankit" scored 90.3 against MP "Shrimati
   Anita Singh". A spelling variant now needs a phonetic key of at least 5 letters.
   Regression: the same file holds this pair below 80.
3. **A hidden active listing.** Alerting kept the top 5 matches before it dropped historical
   listings, so revoked namesakes could hide an active listing. Alerting now scans every
   match above the minimum score. Regression: a fixture of 10 revoked namesakes and 1
   active listing, which fails with the old limit.
4. **Silent suppression.** The date of birth changed the name score, so a contradiction
   removed the alert and gave no visible reason. The date of birth is now a separate,
   visible check, and an auto-clearance writes its own audit event.
5. **One director, several customers.** A director of two subsidiaries was screened twice.
   Directors now merge by Companies House officer id, which gives 400 people from 434
   appointments. Regression: the 34 real cases include these directors.

---

## Not done

- **No real authentication.** Maker-checker identities are a demo header with fixed roles.
- **No identifier matching.** The book holds 0 comparable identifier pairs, because NSE
  listings carry PANs and the GLEIF companies carry CINs.
- **Most director alerts need a human.** The matched NSE and Parliament listings carry no
  date of birth.
- **News history starts at the first poll.** RSS carries only recent items, and there is no
  backfill.
- **The data licence is non-commercial.** OpenSanctions data is CC BY-NC, which suits a
  portfolio and not resale.
