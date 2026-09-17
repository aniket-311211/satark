---
name: Satark console
description: Counterparty screening as a trade-surveillance terminal. The static landing page at / keeps its own world.
colors:
  bar: "oklch(13.2% 0.009 255)"
  ground: "oklch(16.4% 0.011 255)"
  panel: "oklch(20.2% 0.013 255)"
  sunken: "oklch(24.6% 0.015 255)"
  rule: "oklch(29.5% 0.017 255)"
  rule-strong: "oklch(41% 0.02 255)"
  bone: "oklch(91.8% 0.013 85)"
  bone-2: "oklch(76% 0.012 85)"
  bone-3: "oklch(64% 0.011 85)"
  amber: "oklch(80% 0.145 72)"
  amber-soft: "oklch(31% 0.055 72)"
  cyan: "oklch(79% 0.1 208)"
  cyan-soft: "oklch(30% 0.045 208)"
  violet: "oklch(76% 0.11 295)"
  violet-soft: "oklch(29% 0.045 295)"
  band-strong: "oklch(69% 0.2 29)"
  band-strong-soft: "oklch(29% 0.075 29)"
  band-probable: "oklch(78% 0.12 42)"
  band-probable-soft: "oklch(30% 0.05 42)"
  band-possible: "oklch(85% 0.07 95)"
  band-possible-soft: "oklch(30% 0.03 95)"
  cleared: "oklch(81% 0.14 160)"
  cleared-soft: "oklch(29% 0.05 160)"
typography:
  headline:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.012em"
    fontVariation: "\"wdth\" 112"
  title:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.35
    fontVariation: "\"wdth\" 112"
  body:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    letterSpacing: "0.07em"
    fontVariation: "\"wdth\" 78"
  figure:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "\"tnum\", \"zero\""
    fontVariation: "\"wdth\" 88"
  data:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    fontFeature: "\"tnum\", \"zero\""
    fontVariation: "\"wdth\" 88"
rounded:
  sm: "1.2px"
  md: "1.6px"
  lg: "2px"
spacing:
  hairline: "1px"
  wall-gap: "12px"
  panel-pad: "12px"
  page-x: "24px"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.bar}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 14px"
  button-outline:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bone}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 14px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bone}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "4px 10px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bone}"
    rounded: "{rounded.sm}"
    padding: "12px"
  command-bar:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.bone-2}"
    height: "48px"
  status-tape:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.bone-2}"
    height: "32px"
  chip-band-strong:
    backgroundColor: "{colors.band-strong-soft}"
    textColor: "{colors.band-strong}"
    rounded: "{rounded.sm}"
    height: "22px"
    padding: "0 6px"
  filter-active:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.amber}"
    rounded: "{rounded.sm}"
    height: "28px"
---

# Design System: Satark console

## Overview

**Creative North Star: "The Surveillance Terminal"**

The console is modelled on the screens trade-surveillance and market-data desks live in. Every name is an instrument, and every hit prints like a quote with its evidence on the tape beside it. Graphite glass panels sit on a near-black ground, divided by hairlines. The look is set by flat functional colour and tabular figures, never by decoration. The scene that set it: an analyst on a bank's financial-crime desk works a queue across a full shift, on two monitors under office strip lights.

There are two speeds on one grammar. The story screens (Overview, News desk) are monitor walls: many small, dense panels that orient a skimming reviewer in seconds. The working screens (Review queue, Case file, Customers, Audit) are dense tables and side-by-side checks that reward focus. The landing page at `/` is a separate, pinned world (the rose-paper iridescent figure). The console deliberately does not share it, and the two meet only through a view-transition morph of the wordmark.

The owner rejected the previous look as plain, white and generic. Paper-white grounds, soft cards and a single decorative accent are the anti-reference.

**Key Characteristics:**
- Near-black graphite ground with raised panels and 1px hairline rules.
- Flat functional colour: each hue means exactly one thing.
- Archivo on its width axis for words; Martian Mono only for figures, codes and hashes.
- Square 2px corners everywhere; no pills.
- A command bar of numbered function tabs on top, and a status tape running the audit chain along the bottom.
- State shown in line form as well as colour.

## Colors

A dark neutral field carrying a full palette of flat signal colours, each with exactly one job.

### Primary
- **Function-Key Amber** (`amber`): attention, current selection, focus rings, text selection, the caret, the queue count, the pending or awaiting-review state, and the primary action button. If amber is on screen, something wants the analyst.

### Secondary
- **Terminal Cyan** (`cyan`): links, navigation affordances, and the neutral data series in charts (Satark's own series, funnel bars).
- **Regulator Violet** (`violet`): regulators only (SEBI, RBI, FCA, NCA) in the News desk, feed tables and news pulse.

### Tertiary
- **Match-Risk Ramp** (`band-strong` red, `band-probable` coral, `band-possible` sand, each with a `-soft` fill): name-match risk bands, the heatmap intensity, and nothing else.
- **Cleared Green** (`cleared`, `cleared-soft`): cleared by identity evidence, verified checks, passed real cases, an intact audit chain.

### Neutral
- **Bar Black** (`bar`): the command bar, the status tape and the navigation sheet, the darkest chrome.
- **Graphite Ground** (`ground`): the page field.
- **Glass Panel** (`panel`): panels, tables, inputs.
- **Sunken Graphite** (`sunken`): hover rows, meter tracks, skeletons, quiet fills.
- **Hairline** (`rule`) and **Strong Rule** (`rule-strong`): dividers, panel edges, the gap colour of the hairline wall; outline buttons and input hover.
- **Bone** (`bone`), **Bone 2** (`bone-2`), **Bone 3** (`bone-3`): primary text, secondary text, and quiet labels or axis ticks. Bone 3 is never used for essential small text.

### Named Rules
**The One Meaning Rule.** A colour names a state, never a decoration. Amber is attention, cyan is navigation, the red-to-sand ramp is match risk, green is cleared, violet is a regulator. Reusing a hue for something else (such as the risk red for news categories) is a defect.

**The No Glow Rule.** Colour is flat. No gradients, no outer glow, no neon edges. The terminal reads as instrument glass, not a sci-fi prop.

## Typography

**Display and Body Font:** Archivo Variable (with system-ui)
**Figure and Data Font:** Martian Mono Variable (with ui-monospace)

**Character:** One grotesque carries everything with words in it, pushed wider for headings and condensed for labels along its width axis. The mono is reserved for measurement, so a number always looks like a reading.

### Hierarchy
- **Display** (Archivo 700–800, wide caps, 40–72px): only the News desk nameplate "SATARK WIRE" and the "SATARK" wordmark (15px, 0.16em tracking, width 125).
- **Headline** (600, 26px, width 112, -0.012em): page titles. Only a record identifier (CASE-033) may precede one, in amber mono; screens are never labelled with their tab code.
- **Title** (600, 17px, width 112): section headings and lead story heads (larger on the News desk lead).
- **Body** (400, 13–14px, 1.5): descriptions, takeaways, table text. Prose stays within 68–80ch.
- **Label** (600, 11.5px, 0.07em, uppercase, width 78): panel labels, column heads, field names.
- **Figure** (Martian Mono, 13px in reading lines, up to 72px for the Open Cases numeral, width 88, tabular with slashed zero): every stat.
- **Data** (Martian Mono, 11–13px): scores, IDs, LEIs, hashes, times, counts in tables.

### Named Rules
**The Reading Rule.** Monospace is for things that are measured or identified: scores, counts, dates in data, IDs, hashes. Never set names, nationalities or sentences in mono.

**The No Eyebrow Rule.** Panel labels label panels. No kicker text above page or section headings, and no italics anywhere.

## Layout

A top command bar (48px) and a bottom status tape (32px) frame a centred page (max 1480px, 24px side padding, 16px on phones).

- **Walls.** Screens compose as 12-column walls of separate panels on a 12px gap.
- **Page top.** Every page opens with its header and a hairline below it.
- **Reading lines.** Summaries are one dense reading line, not rows of stat tiles: a hairline-divided strip of condensed-caps labels with mono figures. They come before tables and never repeat a figure a panel below already shows.
- **Phones.** Walls collapse to one column in reading order. Data tables become stacked records (the first column as the title, the rest as labelled fields), and wide matrices carry a swipe cue.
- **News.** Desks are front-page sections side by side under column rules: a lead with its standfirst, two secondaries, and an "In brief" rail.
- **Command bar by width.** Function tabs show codes below 1280px and short names from 1280px. They collapse into a left sheet below 1024px. Desk clocks appear from 1280px; the search collapses to an icon between 1024 and 1535px.

## Elevation & Depth

Flat. Depth is tonal layering only: bar black below ground, ground below panel, panel below sunken hover. Hairline borders separate every plane. There are no box shadows on panels, buttons or menus beyond the component library's popovers.

### Named Rules
**The Glass-Not-Card Rule.** A panel is a pane of instrument glass with a hairline edge and a label strip. Panels sit side by side on the wall; they are never nested, and they never float on a shadow.

## Shapes

Square instrument corners: every radius resolves to 1.2–2px from a 0.125rem base, including buttons, chips, inputs and filters. The shapes that recur:
- 1px rules;
- 2px amber underline for the active tab;
- solid, dashed and struck line forms for state;
- square group-code boxes (A, B, C) in cyan outline.

### Named Rules
**The Line-Form Rule.** State is legible without colour: a solid 2px rule for open, a dashed amber rule for awaiting review, a green check or struck word for cleared, quiet bone-3 for historical. Icons and words always travel with the colour.

## Components

### Buttons
- **Shape:** square (2px).
- **Primary:** amber fill with bar-black text, 36px high, 14px horizontal padding; the one action a screen wants (Open the review queue, Screen, Run brief, Propose).
- **Hover / Focus:** hover dims the fill to 80%; focus shows a 2px amber outline offset 2px; active presses down 1px.
- **Outline:** panel fill with a strong-rule border, bone text; secondary actions (Screen this name, Poll feeds now).
- **Ghost:** transparent, sunken on hover.

### Chips
- **Style:** 22px high, 6px padding, 12px medium text, square corners.
  - Bands use the soft fill with band-coloured text and a signal icon.
  - Verdicts use cleared green, strong red or a quiet sunken fill.
  - List tags are outlined bone.
- **State:** filter facets are outlined panels; the selected facet turns amber-soft with amber text and border.

### Cards / Containers
- **Corner Style:** 2px.
- **Background:** panel on ground.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px rule, with a 36px label strip divided by a rule (condensed-caps label, optional mono meta, actions right).
- **Internal Padding:** 12px.

### Inputs / Fields
- **Style:** 32px high, 1px strong-rule border, transparent over the panel, square corners, amber caret, bone-3 placeholder.
- **Focus:** border turns amber with an amber ring.
- **Error / Disabled:** error uses a band-strong border and message; disabled is 50% opacity.

### Navigation
- **Command bar:** bar black, 48px.
  - Left: the wordmark (it doubles as the logo slot for the owner's future logo file).
  - Then numbered function tabs: a mono key digit (amber when active), a short name or code, the queue count in an amber tag, and a 2px amber underline on the active tab.
  - Right: the ⌘K field (on the ground colour), desk clocks and the demo-identity select.
- **Keyboard:** keys 1–8 switch tabs outside text fields.
- **Phones:** a menu button opens a left sheet with the full labels.

### Status Tape
The signature component, a 32px bar pinned to the bottom of every console screen:
- On the left, chain state (green "Chain intact" with the head hash, or red "Chain broken") and live counts.
- On the right, the latest audit events scroll leftward in mono (time, action in amber, target, actor).
- It pauses on hover and stands still under reduced motion.

### Monitor Wall (Overview)
- A reading line of live figures.
- An Open Cases numeral with its band split and the awaiting-review count in dashed amber.
- A screening funnel whose steps each say why the count changed.
- Identity-evidence verdict bar, alert score histogram with the threshold, group-by-list heatmap on the risk ramp, watchlist board, matching quality and news pulse.

### Wire Front Page (News desk)
- A "SATARK WIRE" nameplate with live counts, and one ticker of regulator headlines.
- A lead story with standfirst, secondary stories, and a risk desk grouping stories the keyword rules tagged, labelled as such.
- Regulator desks in violet and press desks as front-page sections, coverage analytics, the name dossier as clippings, full-text search, and feed health.
- Every dateline in one format: "17 Sep 2026 · 09:13", with only the time in mono.

## Do's and Don'ts

### Do:
- **Do** give every figure its context: a split, a threshold, a comparison, or a one-line takeaway computed from live data.
- **Do** use amber for exactly one primary action per screen, plus attention states.
- **Do** keep numbers tabular in Martian Mono and words in Archivo.
- **Do** build walls from 12px-gapped panels, and summarise with one dense reading line rather than rows of stat tiles.
- **Do** label every chart with an `aria-label` and a text takeaway, and pair every state colour with an icon or word.
- **Do** limit motion to 150–250ms state transitions, plus the tape (and the News desk ticker).

### Don't:
- **Don't** use white or cream grounds, soft rounded cards, or pill buttons in the console.
- **Don't** add gradients, glows, glass blur or shadows to panels.
- **Don't** reuse the match-risk ramp or amber for unrelated categories.
- **Don't** set names or prose in monospace.
- **Don't** nest panels, put a kicker or eyebrow above a heading, or prefix a screen title with its tab code.
- **Don't** clip tables on phones; render stacked records.
- **Don't** invent metrics or trends: the data holds one seeding day, so there are no time series of cases or alerts.
- **Don't** use the double-circle mark; it is not Satark's logo. The wordmark holds the slot until the owner supplies one.
