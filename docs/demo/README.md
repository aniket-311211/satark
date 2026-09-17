# Walkthrough

| File | Length | Size | What it is |
|---|---|---:|---|
| [`satark-demo.mp4`](satark-demo.mp4) | 1 min 17 s | 4.4 MB | The demo: the front page, then all eight console screens in order, one feature at a time |
| [`satark-walkthrough.mp4`](satark-walkthrough.mp4) | 3 min 46 s | 8.7 MB | The long form, with the four-eyes decision and a live CSV import in full |
| [`threshold.gif`](threshold.gif) | 12 s | 1.5 MB | The looping still the README opens with |

Both videos are 1280×720 with on-screen captions. The music is *The Mountain* (lofi, Pixabay licence), the same track under both, looped once in the walkthrough. Both play in the browser at [aniket-311211.github.io/satark](https://aniket-311211.github.io/satark/).

The run is scripted with Playwright (`Discover → Rehearse → Record`): a cursor overlay, a caption bar, and a still saved at every beat. It runs against a **copy of the database**, so the maker-checker decision and the CSV import in the video are real writes — nothing in it is a mock-up. The only cut is the hand-off from the landing page to the console: headless Chrome freezes on the cross-document view transition, so it is recorded as a cut rather than the sweep you get in a real browser.

## What it covers

**The benchmark lab, on the front page**

| Still | |
|---|---|
| [01](stills/01-landing-hero.png) | The front page: the figure, the wordmark, "Let's get started" |
| [02](stills/02-lab-header.png) | The lab header and its reading line: 29,574 entries, 1,000 held-out names, F1 0.953 against 0.572, 34/34 real cases |
| [03](stills/03-lab-threshold-recall.png)–[05](stills/05-lab-threshold-80.png) | Experiment 1: the metric switched to Recall, the alert line dragged down to 65 and back to 80, with false alarms and misses per 100 moving underneath |
| [06](stills/06-lab-variant-devanagari.png)–[07](stills/07-lab-variant-typo.png) | Experiment 2: Devanagari (Satark 96.7, fuzzy below 50) and the honest Typo row, where the fuzzy matcher wins 85–70 |
| [08](stills/08-lab-identity-before.png)–[10](stills/10-lab-identity-cleared.png) | Experiment 3: the same 100-point name match cleared, then confirmed, by moving one date of birth |
| [11](stills/11-lab-funnel.png)–[12](stills/12-lab-real-cases.png) | Experiment 4: the funnel from 1,385 customers to 45 cases, and the 34 hand-labelled cases |
| [13](stills/13-lab-try-a-name.png) | "Try a name": Hafiz Muhammad Saeed against the live API — three lists, 100.0 each |
| [14](stills/14-lab-screens.png) | The eight console screens, each with its own live figure |

**The console**

| Still | |
|---|---|
| [15](stills/15-console-overview.png)–[17](stills/17-console-overview-lower.png) | Overview: open cases by band, the screening funnel, identity-evidence verdicts, the score histogram, the group × list heatmap, matching quality, news pulse |
| [18](stills/18-console-command-menu.png) | ⌘K from any screen |
| [19](stills/19-console-queue.png)–[21](stills/21-console-queue-awaiting.png) | Queue: the band strip, the Strong filter, the awaiting-review view |
| [22](stills/22-console-case-head.png)–[24](stills/24-console-case-alerts.png) | A case file: registry record, check 1 (name match, drawn as token alignment) and check 2 (identity evidence), then every alert with its listing |
| [25](stills/25-console-case-proposal.png)–[26](stills/26-console-case-proposed.png) | An analyst proposes "discard as false positive" with a rationale — and is then told the four-eyes rule needs a different reviewer |
| [27](stills/27-console-case-review.png)–[28](stills/28-console-case-closed.png) | Switched to a second reviewer: approved and closed, with both events hashed into the audit chain |
| [29](stills/29-console-customers.png)–[31](stills/31-console-customer-detail.png) | Customers: the registry board, a profile with its ownership diagram and registry context |
| [32](stills/32-console-import-empty.png)–[34](stills/34-console-import-result.png) | Import: a dry run that rejects two bad rows by line and reason, then 5 customers imported, screened on upload, 6 alerts opened with links to their cases |
| [35](stills/35-console-lists.png)–[37](stills/37-console-lists-exposure-detail.png) | Lists: 29,574 listings, Vijay Mallya's NSE record, and reverse screening against the book |
| [38](stills/38-console-wire.png)–[40](stills/40-console-wire-desks.png) | Wire: the front page, the keyword-tagged risk desk, the regulator and press desks |
| [41](stills/41-console-wire-dossier.png), [41b](stills/41b-console-wire-dossier-brief.png) | The name dossier, and its refusal: an event counts only when its quote appears verbatim in the source and the subject is named there, so an unmatched name returns nothing rather than a guess |
| [42](stills/42-console-screen-query.png)–[44](stills/44-console-screen-explain.png) | Screen: राजीव संघवी typed in Devanagari, matched to a debarred NSE entity, with the score explained |
| [45](stills/45-console-benchmark.png)–[48](stills/48-console-benchmark-cases.png) | Benchmark: F1 by threshold, recall by query type, Satark's own misses, and the real labelled cases |
| [49](stills/49-console-audit.png)–[51](stills/51-console-audit-events.png) | Audit: the chain re-verified, with the decision just made in it |

## Re-recording it

The scripts live outside the repository (they are throwaway harness code). The shape is the one in the `ui-demo` skill: discover the real fields on every page, rehearse every selector until they all resolve, then record with `recordVideo` at 1280×720. Two traps cost a take each and are worth remembering:

- an invisible full-screen overlay (a title card faded to `opacity: 0`) swallows every click that follows unless it is also `pointer-events: none`;
- `button:has-text("Screen")` matched the command bar's own "find a customer or **screen** a name" before the Screen page's submit button, which silently opened ⌘K over everything.

The audio is muxed in afterwards with ffmpeg: the track is laid under the finished picture at -6 dB, with a fade in and a fade out, and looped when the picture runs longer than the track.
