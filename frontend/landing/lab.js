// The benchmark lab below the landing figure. Every number is Satark's own: the held-out benchmark
// (docs/build-log.md, `satark eval`, seed 7), real examples from that run, the 34 real labelled cases,
// and the real book's last full screening. "Try a name" calls the live API and falls back to recorded results.

const SWEEP = {
  // threshold 50..99 → [precision, recall, f1], held-out test half (1,000 names)
  satark: [[.5223,.98,.6815],[.5309,.978,.6882],[.5414,.978,.697],[.5587,.978,.7112],[.5684,.978,.719],[.5828,.976,.7299],[.601,.9741,.7433],[.6236,.9721,.7598],[.6408,.9721,.7724],[.6644,.9721,.7893],[.683,.9721,.8023],[.7064,.9701,.8175],[.73,.9661,.8316],[.7423,.9661,.8395],[.7598,.9661,.8506],[.7866,.9641,.8664],[.8125,.9601,.8801],[.8262,.9581,.8872],[.8389,.9561,.8937],[.8628,.9541,.9062],[.8819,.9541,.9166],[.8951,.9541,.9237],[.9155,.9521,.9335],[.9297,.9501,.9398],[.9348,.9441,.9394],[.9498,.9441,.9469],[.9613,.9421,.9516],[.9652,.9401,.9525],[.9671,.9381,.9524],[.9731,.9381,.9553],[.9749,.9321,.9531],[.9747,.9242,.9488],[.9807,.9142,.9463],[.9804,.8982,.9375],[.9799,.8762,.9252],[.9818,.8603,.917],[.9835,.8323,.9016],[.9849,.7824,.8721],[.9869,.7545,.8552],[.9892,.7285,.8391],[.9917,.7166,.832],[.9915,.7006,.8211],[.9913,.6846,.8099],[.997,.6587,.7933],[.9969,.6367,.7771],[.9967,.6028,.7512],[.9965,.5729,.7275],[.9959,.489,.656],[.9953,.4212,.5919],[.9951,.4032,.5739]],
  fuzzy: [[.4418,.7884,.5663],[.4418,.7884,.5663],[.4412,.7864,.5653],[.4412,.7864,.5653],[.4406,.7844,.5642],[.4406,.7844,.5642],[.4406,.7844,.5642],[.44,.7824,.5632],[.4387,.7784,.5612],[.4381,.7764,.5601],[.4376,.7705,.5582],[.4348,.7585,.5527],[.434,.7545,.551],[.4327,.7445,.5473],[.4331,.7365,.5455],[.4351,.7226,.5431],[.4301,.7066,.5347],[.4439,.6786,.5367],[.4395,.6667,.5297],[.4443,.6527,.5287],[.461,.6367,.5348],[.4787,.6267,.5428],[.4875,.6248,.5477],[.5119,.5988,.552],[.5286,.5908,.558],[.5449,.5808,.5623],[.5741,.5569,.5653],[.6216,.5409,.5784],[.637,.5289,.578],[.6676,.501,.5724],[.6775,.499,.5747],[.7405,.4671,.5728],[.7817,.4431,.5656],[.7947,.4172,.5471],[.8167,.3912,.529],[.8318,.3653,.5076],[.8731,.3433,.4928],[.895,.3234,.4751],[.9074,.2934,.4434],[.9231,.2635,.4099],[.938,.2415,.3841],[.955,.2116,.3464],[.9588,.1856,.311],[.962,.1517,.2621],[.9692,.1257,.2226],[.9655,.1118,.2004],[.9623,.1018,.1841],[.9783,.0898,.1645],[.9706,.0659,.1234],[.9677,.0599,.1128]],
};

// one real benchmark case per variant, scored by both systems; recall is over the 100 test names of that variant
const VARIANTS = [
  { key: "devanagari", label: "Devanagari script", query: "संजय वेर्मा", listed: "Sanjay Verma", s: 96.7, f: null, rs: 1.0, rf: 0.0179 },
  { key: "relation", label: "S/O · D/O clause", query: "Srinath Narasimhan D/O Neel Narasimhan", listed: "Srinath Narasimhan", s: 100, f: 64.3, rs: 1.0, rf: 0.0 },
  { key: "initials", label: "Initials", query: "M. Faisal", listed: "Mohammad Faisal", s: 88.2, f: 69.6, rs: 0.9074, rf: 0.1296 },
  { key: "combo", label: "Several at once", query: "Shri. S K Agarwal", listed: "Sudhir Kumar Agarwal", s: 80.6, f: null, rs: 0.8085, rf: 0.5532 },
  { key: "drop_middle", label: "Middle name dropped", query: "Trivendra Rawat", listed: "Trivendra Singh Rawat", s: 94.2, f: 83.3, rs: 1.0, rf: 0.2353 },
  { key: "abbreviation", label: "Abbreviation (Kr., Md.)", query: "Sripal Kr.", listed: "Sripal Kumar", s: 100, f: 85.7, rs: 0.9783, rf: 0.7391 },
  { key: "spelling", label: "Spelling variant", query: "Rajes Das", listed: "Rajesh Das", s: 96.6, f: 75.0, rs: 0.9767, rf: 0.8605 },
  { key: "honorific", label: "Honorific (Mr., Shri)", query: "Mr. Lipika Bhaduri", listed: "Lipika Bhaduri", s: 100, f: 91.4, rs: 1.0, rf: 0.9388 },
  { key: "reorder", label: "Surname first", query: "Katyal Roma", listed: "Roma Katyal", s: 100, f: 100, rs: 1.0, rf: 0.9074 },
  { key: "typo", label: "Typo", query: "Nityananda Prradhan", listed: "Nityananda Pradhan", s: 97.3, f: 97.3, rs: 0.6957, rf: 0.8478 },
];

const FUNNEL = [
  { label: "Customers screened", value: 1385, note: "The whole book: 840 Indian entities with LSE-issued LEIs, 514 UK subsidiaries and their directors, 31 debarred LEI holders." },
  { label: "Hit an active listing", value: 46, note: "1,339 customers had no name match at 80 or above against any active listing. Revoked orders and former PEPs don't count." },
  { label: "Alerts raised", value: 50, note: "46 customers raised 50 alerts: a customer can match more than one list." },
  { label: "Cleared by evidence", value: 2, tone: "g", note: "Two alerts were cleared automatically because the dates of birth were years apart. They stay on record with their reason." },
  { label: "Cases for review", value: 45, note: "The remaining 48 alerts grouped into 45 cases, one per customer, waiting for an analyst and a second reviewer." },
];

const LISTS = { in_nse_debarred: "NSE", in_sansad: "Parliament", in_mha_banned: "MHA", un_sc_sanctions: "UN", gb_fcdo_sanctions: "UK" };
const BAND = (score) => (score >= 90 ? "strong" : score >= 80 ? "probable" : "possible");
const VERDICT = { contradicted: "Cleared by evidence", confirmed: "Identity agrees", inconclusive: "No decisive evidence" };

// recorded from the live API (POST /screen) for when the console's API isn't running
const RECORDED = {
  "राजीव संघवी": { normalized: "raajeev sanghvee", latency_ms: 3.2, matches: [
    { matched_name: "Rajiv Sanghvi", entity_name: "Mr. Rajiv Ramniklal Sanghvi", source: "in_nse_debarred", score: 91.3, band: "strong", status: "historical", verdict: "inconclusive" },
    { matched_name: "Rajiv Sanghvi-HUF", entity_name: "Rajiv Ramniklal Sanghvi HUF", source: "in_nse_debarred", score: 77.6, band: "possible", status: "historical", verdict: "inconclusive" }] },
  "KUMAR, Anand": { birth: "1955-09", normalized: "kumar anand", latency_ms: 2.97, matches: [
    { matched_name: "Anand Kumar", entity_name: "Anand Kumar", source: "in_sansad", score: 100, band: "strong", status: "active", verdict: "contradicted", summary: "Cleared by date of birth: customer born 1955-09, listed person born 1974-08-07." },
    { matched_name: "Anand Kumar Agarwal", entity_name: "Anand Kumar Agarwal", source: "in_nse_debarred", score: 81.3, band: "probable", status: "historical", verdict: "inconclusive" },
    { matched_name: "Mr. Anand Kumar Gupta", entity_name: "Mr. Anand Kumar Gupta", source: "in_nse_debarred", score: 80.8, band: "probable", status: "active", verdict: "inconclusive" },
    { matched_name: "Mr. Anand Kumar Jha", entity_name: "Mr. Anand Kumar Jha", source: "in_nse_debarred", score: 75.9, band: "possible", status: "historical", verdict: "inconclusive" }] },
  "Hafiz Muhammad Saeed": { normalized: "hafiz mohammad saeed", latency_ms: 3.11, matches: [
    { matched_name: "HAFIZ MUHAMMAD SAEED", entity_name: "HAFIZ MUHAMMAD SAEED", source: "gb_fcdo_sanctions", score: 100, band: "strong", status: "active", verdict: "inconclusive" },
    { matched_name: "Hafiz Muhammad Saeed", entity_name: "Hafiz Muhammad Saeed", source: "in_mha_banned", score: 100, band: "strong", status: "active", verdict: "inconclusive" },
    { matched_name: "HAFIZ MUHAMMAD SAEED", entity_name: "HAFIZ MUHAMMAD SAEED", source: "un_sc_sanctions", score: 100, band: "strong", status: "active", verdict: "inconclusive" },
    { matched_name: "Hafiz Talha Saeed", entity_name: "Hafiz Talha Saeed", source: "in_mha_banned", score: 78.4, band: "possible", status: "active", verdict: "inconclusive" }] },
};

const REAL = (() => {
  const noMatch = [
    ["KSN IMPEX PRIVATE LIMITED", 73.1, "An LSE-issued LEI holder once scored 92.4 against S K Impex: the acronym KSN was read as personal initials."],
    ["GRS EXPORTS", 63.5, "Once scored 82.2 against S. G. Global Exports: the acronym GRS was read as personal initials."],
    ["SINGH, Ankit", 0, "A UK director once scored 90.3 against MP Shrimati Anita Singh: a four-letter key treated as a spelling variant."],
  ];
  const match = [
    ["KARVY STOCK BROKING LIMITED", 100], ["PATEL WEALTH ADVISORS PRIVATE LIMITED", 100], ["NETIZEN ENGINEERING PRIVATE LIMITED", 100],
    ["FAZE THREE LIMITED", 100], ["ADD-SHOP E-RETAIL LIMITED", 100], ["ECONO TRADE (INDIA) LTD", 100],
    ["CITI SECURITIES AND FINANCIAL SERVICES PRIVATE LIMITED", 100], ["JAR GOLD RETAIL PRIVATE LIMITED", 100],
    ["GAMESA INVESTMENT MANAGEMENT PRIVATE LIMITED", 100], ["DEEP INDUSTRIAL FINANCE LIMITED", 100], ["MISHTANN FOODS LIMITED", 100],
    ["INDIAN AGRI SERVICES PRIVATE LIMITED", 100], ["MAURIA UDYOG LTD", 100], ["TRAFIKSOL ITS TECHNOLOGIES LIMITED", 100],
    ["ASMITA PATEL GLOBAL SCHOOL OF TRADING PRIVATE LIMITED", 100], ["AVADHUT SATHE TRADING ACADEMY PRIVATE LIMITED", 100],
    ["RELIANCE UNICORN ENTERPRISES PRIVATE LIMITED", 100], ["PANCARD CLUBS LIMITED", 100], ["NCS SUGARS LIMITED", 100],
    ["MOHANBIR HI-TECH BUILD PRIVATE LIMITED", 100], ["PHI MANAGEMENT SOLUTIONS PRIVATE LIMITED", 100], ["SYNOPTICS TECHNOLOGIES LIMITED", 100],
    ["RAVINDRA BHARTI EDUCATION INSTITUTE PRIVATE LIMITED", 100], ["MEDYBIZ PRIVATE LIMITED", 100], ["GENSOL ENGINEERING LIMITED", 100],
    ["GO AUTO PRIVATE LIMITED", 100], ["RELIANCE BUSINESS BROADCAST NEWS HOLDINGS LIMITED", 100],
    ["SITARAM MAHARAJ SAKHAR KARKHANA (KHARDI) LIMITED", 85.3], ["GENSOL CONSULTANTS PRIVATE LIMITED", 100],
    ["KALAHRIDHAAN TRENDZ LIMITED", 100], ["MONDAL CONSTRUCTION COMPANY LIMITED", 100],
  ];
  return [
    ...noMatch.map(([query, score, note]) => ({ query, score, note, expected: "no_match" })),
    ...match.map(([query, score]) => ({ query, score, expected: "match", note: "Holds a GLEIF LEI under the same legal name as an active NSE debarment." })),
  ];
})();

// lucide paths, drawn at the text's size
const icon = (d) => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px">${d}</svg>`;
const ICON = {
  check: icon('<path d="M20 6 9 17l-5-5"/>'),
  x: icon('<path d="M18 6 6 18M6 6l12 12"/>'),
  shield: icon('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
  fingerprint: icon('<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>'),
  dashed: icon('<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>'),
};

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pct = (v) => `${Math.round(v * 100)}`;
const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}, parent) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
};

/* ── Experiment 1: drag the alert threshold ─────────────────────────────── */
function thresholdLab() {
  const svg = $("#sweep");
  if (!svg) return;
  const W = 800, H = 340, L = 58, R = 24, T = 18, B = 40; // L and R leave room for the axis labels at phone type sizes
  const x = (t) => L + ((t - 50) / 49) * (W - L - R);
  const y = (v) => T + (1 - v) * (H - T - B);
  const METRIC = { f1: 2, precision: 0, recall: 1 };
  const LABEL = { f1: "F1", precision: "Precision", recall: "Recall" };
  let metric = "f1", threshold = 80;

  for (const v of [0, .25, .5, .75, 1]) {
    svgEl("line", { class: "grid", x1: L, x2: W - R, y1: y(v), y2: y(v) }, svg);
    svgEl("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" }, svg).textContent = v.toFixed(2);
  }
  for (const t of [50, 60, 70, 80, 90, 99]) svgEl("text", { x: x(t), y: H - 12, "text-anchor": "middle" }, svg).textContent = t;
  const lineF = svgEl("path", { class: "fuzzy" }, svg);
  const lineS = svgEl("path", { class: "satark" }, svg);
  const thr = svgEl("line", { class: "thr", y1: T - 4, y2: H - B }, svg);
  const flag = svgEl("rect", { class: "thr-flag", width: 38, height: 24, y: 0, rx: 2 }, svg);
  const flagText = svgEl("text", { class: "thr-text", y: 17, "text-anchor": "middle" }, svg);
  const dotF = svgEl("circle", { class: "dot-f", r: 6 }, svg);
  const dotS = svgEl("circle", { class: "dot-s", r: 6 }, svg);
  const path = (rows) => rows.map((r, i) => `${i ? "L" : "M"}${x(50 + i).toFixed(1)},${y(r[METRIC[metric]]).toFixed(1)}`).join("");

  const range = $("#thr-range");
  const out = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  function render() {
    lineS.setAttribute("d", path(SWEEP.satark));
    lineF.setAttribute("d", path(SWEEP.fuzzy));
    const i = threshold - 50, s = SWEEP.satark[i], f = SWEEP.fuzzy[i], m = METRIC[metric];
    thr.setAttribute("x1", x(threshold)); thr.setAttribute("x2", x(threshold));
    flag.setAttribute("x", x(threshold) - 19); flagText.setAttribute("x", x(threshold)); flagText.textContent = threshold;
    dotS.setAttribute("cx", x(threshold)); dotS.setAttribute("cy", y(s[m]));
    dotF.setAttribute("cx", x(threshold)); dotF.setAttribute("cy", y(f[m]));
    range.value = threshold;
    out("#thr-value", threshold);
    out("#s-p", s[0].toFixed(3)); out("#s-r", s[1].toFixed(3)); out("#s-f1", s[2].toFixed(3));
    out("#f-p", f[0].toFixed(3)); out("#f-r", f[1].toFixed(3)); out("#f-f1", f[2].toFixed(3));
    const fa = [(1 - s[0]), (1 - f[0])], miss = [(1 - s[1]), (1 - f[1])];
    for (const [id, v] of [["#fa-s", fa[0]], ["#fa-f", fa[1]], ["#miss-s", miss[0]], ["#miss-f", miss[1]]]) {
      const bar = $(`${id} .fill`); if (bar) bar.style.width = `${Math.min(100, v * 100)}%`;
      out(`${id} .mono`, pct(v));
    }
    svg.setAttribute("aria-label", `${LABEL[metric]} by alert threshold from 50 to 99. At ${threshold}, Satark ${s[m].toFixed(3)}, fuzzy baseline ${f[m].toFixed(3)}.`);
    $("#thr-takeaway").innerHTML =`At <b>${threshold}</b>, Satark raises <b>${pct(fa[0])} false alarms per 100 alerts</b> and misses <b>${pct(miss[0])} in 100</b> listed names. The fuzzy matcher raises <b>${pct(fa[1])}</b> and misses <b>${pct(miss[1])}</b>. ${threshold < 70 ? "Lower thresholds catch more, and flood the queue." : threshold > 90 ? "Higher thresholds look precise, and quietly miss listed people." : "Satark ships at 80: near its best F1, with a margin of recall."}`;
  }

  const fromPointer = (e) => {
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    threshold = Math.round(Math.min(99, Math.max(50, 50 + ((px - L) / (W - L - R)) * 49)));
    render();
  };
  let dragging = false;
  svg.addEventListener("pointerdown", (e) => { dragging = true; svg.setPointerCapture(e.pointerId); fromPointer(e); });
  svg.addEventListener("pointermove", (e) => { if (dragging) fromPointer(e); });
  svg.addEventListener("pointerup", () => { dragging = false; });
  range.addEventListener("input", () => { threshold = Number(range.value); render(); });
  for (const b of document.querySelectorAll("[data-metric]")) {
    b.addEventListener("click", () => {
      metric = b.dataset.metric;
      for (const o of document.querySelectorAll("[data-metric]")) o.setAttribute("aria-pressed", String(o === b));
      out("#metric-name", LABEL[metric]);
      render();
    });
  }
  render();
}

/* ── Experiment 2: name variants ─────────────────────────────────────────── */
function variantLab() {
  const list = $("#variants");
  const grid = $("#recall-grid");
  if (!list || !grid) return;
  let current = VARIANTS[0].key;
  list.innerHTML = VARIANTS.map((v) => `<li><button type="button" data-v="${v.key}" aria-pressed="false"><span>${esc(v.label)}</span><span class="mono">${pct(v.rs)}%</span></button></li>`).join("");
  grid.innerHTML = VARIANTS.map((v) => `
    <button type="button" class="recall-row" data-v="${v.key}" aria-label="${esc(v.label)}: Satark catches ${pct(v.rs)} in 100, fuzzy baseline ${pct(v.rf)}">
      <span>${esc(v.label)}</span>
      <span class="bars">
        <span class="bar s"><span><b style="width:${v.rs * 100}%"></b></span><span class="mono">${pct(v.rs)}</span></span>
        <span class="bar f"><span><b style="width:${v.rf * 100}%"></b></span><span class="mono">${pct(v.rf)}</span></span>
      </span>
    </button>`).join("");

  const gauge = (id, score) => {
    const fill = $(`${id} .fill`), out = $(`${id} .out`);
    fill.style.width = `${score ?? 0}%`;
    const caught = score !== null && score >= 80;
    out.innerHTML = `<span class="mono">${score === null ? "&lt; 50" : score.toFixed(1)}</span><span class="${caught ? "caught" : "missed"}">${caught ? ICON.check : ICON.x} ${caught ? "caught" : "missed"}</span>`;
  };
  function select(key) {
    current = key;
    const v = VARIANTS.find((o) => o.key === key);
    for (const b of document.querySelectorAll("#variants button")) b.setAttribute("aria-pressed", String(b.dataset.v === key));
    for (const r of document.querySelectorAll(".recall-row")) r.classList.toggle("on", r.dataset.v === key);
    $("#morph-query").textContent = v.query;
    $("#morph-listed").textContent = v.listed;
    gauge("#g-s", v.s);
    gauge("#g-f", v.f);
    $("#variant-takeaway").innerHTML = `<b>${esc(v.label)}</b>: across 100 test names, Satark catches <b>${pct(v.rs)}</b> and the fuzzy matcher <b>${pct(v.rf)}</b>.` +
      (v.rs < v.rf ? " Typos are the one place a plain edit distance wins: Satark only accepts close phonetic keys, to keep false alarms down." : "");
  }
  list.addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (b) select(b.dataset.v); });
  grid.addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (b) select(b.dataset.v); });
  select(current);
}

/* ── Experiment 3: identity evidence, the date-of-birth rule ─────────────── */
// Mirrors backend/satark/secondary.py: same year with the same month supports; same year, different month is neutral
// (a common data-entry slip); one year apart is neutral; two or more years apart contradicts, and clears the alert.
function identityLab() {
  const year = $("#dob-year"), month = $("#dob-month"), svg = $("#timeline");
  if (!year || !month || !svg) return;
  const LISTED = { year: 1974, month: 8 };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const W = 700, H = 92, L = 30, R = 30, MIN = 1940, MAX = 2005; // L and R leave room for the end-year labels
  const x = (y) => L + ((y - MIN) / (MAX - MIN)) * (W - L - R);
  for (const t of [1940, 1950, 1960, 1970, 1980, 1990, 2000]) svgEl("text", { x: x(t), y: H - 6, "text-anchor": "middle" }, svg).textContent = t;
  svgEl("line", { class: "axis", x1: L, x2: W - R, y1: 58, y2: 58 }, svg);
  svgEl("rect", { class: "zone", x: x(LISTED.year - 1), width: x(LISTED.year + 2) - x(LISTED.year - 1), y: 22, height: 36 }, svg);
  // the band is where the rule never contradicts: inside it the check either supports (same year and month) or stays neutral
  svgEl("text", { x: x(LISTED.year + 0.5), y: 16, "text-anchor": "middle" }, svg).textContent = "within 1 year: never contradicts";
  const gap = svgEl("line", { class: "gap", y1: 44, y2: 44 }, svg);
  svgEl("line", { class: "listed", x1: x(LISTED.year + 0.6), x2: x(LISTED.year + 0.6), y1: 26, y2: 58 }, svg);
  svgEl("circle", { class: "listed-dot", cx: x(LISTED.year + 0.6), cy: 26, r: 4 }, svg);
  const cust = svgEl("line", { class: "cust", x1: 0, x2: 0, y1: 30, y2: 58 }, svg);
  const custDot = svgEl("circle", { r: 5, cy: 30, fill: "var(--l-cyan)" }, svg);

  function render() {
    const y = Number(year.value), m = Number(month.value), apart = Math.abs(y - LISTED.year);
    $("#dob-year-out").textContent = y;
    const cx = x(y + (m - 0.5) / 12);
    cust.setAttribute("x1", cx); cust.setAttribute("x2", cx); custDot.setAttribute("cx", cx);
    gap.setAttribute("x1", Math.min(cx, x(LISTED.year + 0.6))); gap.setAttribute("x2", Math.max(cx, x(LISTED.year + 0.6)));
    let verdict, why;
    if (apart >= 2) {
      verdict = "contradicted";
      why = `Born ${y} against ${LISTED.year}: ${apart} years apart, so not the same person. The perfect name match is cleared automatically and kept on record with this reason.`;
    } else if (apart === 1) {
      verdict = "inconclusive";
      why = `One year apart could be a data-entry slip, so the check stays neutral. The alert goes to a reviewer with that evidence attached.`;
    } else if (m !== LISTED.month) {
      verdict = "inconclusive";
      why = `Same year, but ${MONTHS[m - 1]} against ${MONTHS[LISTED.month - 1]}. A different month in the same year is treated as neutral, a common slip, so a person decides.`;
    } else {
      verdict = "confirmed";
      why = `Same year and month as the listing. The identity agrees, so the case opens for review with that evidence: a reviewer still makes the call.`;
    }
    const box = $("#verdict");
    box.className = `verdict ${verdict}`;
    $("#v-icon").innerHTML = verdict === "contradicted" ? ICON.shield : verdict === "confirmed" ? ICON.fingerprint : ICON.dashed;
    $("#v-word").textContent = VERDICT[verdict];
    $("#v-why").textContent = why;
    svg.setAttribute("aria-label", `Customer born ${MONTHS[m - 1]} ${y}; listed person born August ${LISTED.year}. ${VERDICT[verdict]}.`);
  }
  year.addEventListener("input", render);
  month.addEventListener("change", render);
  render();
}

/* ── Experiment 4: the real book and the 34 real cases ──────────────────── */
function bookLab() {
  const funnel = $("#funnel"), cases = $("#cases");
  if (!funnel || !cases) return;
  const max = FUNNEL[0].value;
  funnel.innerHTML = FUNNEL.map((s, i) => `
    <li><button type="button" data-i="${i}" aria-pressed="${i === 1}">
      <span class="caps">${esc(s.label)}</span>
      <span class="track"><span class="fill ${s.tone ?? ""}" data-w="${Math.max(0.6, Math.sqrt(s.value / max) * 100)}"></span></span>
      <span class="mono">${s.value.toLocaleString("en-IN")}</span>
    </button></li>`).join("");
  const note = $("#funnel-note");
  const pick = (i) => {
    for (const b of funnel.querySelectorAll("button")) b.setAttribute("aria-pressed", String(Number(b.dataset.i) === i));
    note.textContent = FUNNEL[i].note;
  };
  funnel.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) pick(Number(b.dataset.i)); });
  funnel.addEventListener("mouseover", (e) => { const b = e.target.closest("button"); if (b) pick(Number(b.dataset.i)); });
  pick(1);
  const grow = () => { for (const f of funnel.querySelectorAll(".fill")) f.style.width = `${f.dataset.w}%`; };
  if (reduced() || !("IntersectionObserver" in window)) grow();
  else new IntersectionObserver((entries, obs) => { if (entries.some((e) => e.isIntersecting)) { grow(); obs.disconnect(); } }, { threshold: 0.1 }).observe(funnel);

  cases.innerHTML = REAL.map((c, i) => `<button type="button" data-i="${i}" data-kind="${c.expected}" class="${c.expected === "no_match" ? "nm" : ""}" aria-pressed="false" aria-label="${esc(c.query)}: ${c.expected === "match" ? "should match" : "should not match"}, scored ${c.score}, passed"></button>`).join("");
  const detail = $("#case-detail");
  const show = (i) => {
    const c = REAL[i];
    for (const b of cases.querySelectorAll("button")) b.setAttribute("aria-pressed", String(Number(b.dataset.i) === i));
    const passes = c.expected === "match" ? c.score >= 80 : c.score < 80;
    detail.innerHTML = `
      <p class="q">${esc(c.query)}</p>
      <div class="row"><span>${c.expected === "match" ? "Should match" : "Should not match"}</span><span>score <span class="mono">${c.score.toFixed(1)}</span> against <span class="mono">80</span></span>
      <span class="${passes ? "caught" : "missed"}">${passes ? ICON.check : ICON.x} ${passes ? "passes" : "fails"}</span></div>
      <p>${esc(c.note)}</p>`;
  };
  cases.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) show(Number(b.dataset.i)); });
  cases.addEventListener("mouseover", (e) => { const b = e.target.closest("button"); if (b) show(Number(b.dataset.i)); });
  for (const f of document.querySelectorAll("[data-cases]")) {
    f.addEventListener("click", () => {
      for (const o of document.querySelectorAll("[data-cases]")) o.setAttribute("aria-pressed", String(o === f));
      for (const b of cases.querySelectorAll("button")) b.hidden = f.dataset.cases !== "all" && b.dataset.kind !== f.dataset.cases;
    });
  }
  show(0);
}

/* ── Try a name: the live matcher, or a recorded run when the API isn't up ─ */
function tryName() {
  const form = $("#try"), results = $("#results");
  if (!form || !results) return;
  const input = $("#try-name"), kind = $("#try-kind"), dob = $("#try-dob"), go = $("#try-go");

  const render = (name, data, live) => {
    const rows = (data.matches ?? []).slice(0, 5);
    const meta = `<div class="res-meta"><span class="src">${live ? "Live from the Satark API" : "Recorded run (start the API with make api to screen live)"}</span>
      <span>normalised to <span class="mono">${esc(data.normalized ?? "")}</span></span>${data.latency_ms ? `<span><span class="mono">${Number(data.latency_ms).toFixed(1)}</span> ms</span>` : ""}</div>`;
    if (!rows.length) {
      results.innerHTML = `${meta}<p class="res-empty">No listing scores 70 or more against “${esc(name)}”. Nothing to review.</p>`;
      return;
    }
    results.innerHTML = `${meta}<ul class="res-list">${rows.map((m) => {
      const band = m.band ?? BAND(m.score);
      const verdict = m.verdict ?? m.secondary?.verdict;
      const color = band === "strong" ? "var(--l-red)" : band === "probable" ? "var(--l-probable)" : "var(--l-possible)";
      return `<li>
        <span class="nm">${esc(m.matched_name)}<small>${m.status === "historical" ? "Historical listing, won't alert" : "Active listing"}${m.entity_name && m.entity_name !== m.matched_name ? ` · ${esc(m.entity_name)}` : ""}</small></span>
        <span class="list-tag">${esc(LISTS[m.source] ?? m.source)}</span>
        <span class="score"><span class="mono">${m.score.toFixed(1)}</span><span class="track"><span class="fill" style="width:${m.score}%;background:${color}"></span><span class="tick"></span></span></span>
        <span class="ev ${verdict === "contradicted" ? "cleared" : ""}"><span class="band ${band}">${band[0].toUpperCase() + band.slice(1)}</span> ${verdict ? VERDICT[verdict] : ""}</span>
      </li>`;
    }).join("")}</ul>`;
  };

  async function screen(name, extra = {}) {
    go.disabled = true;
    results.setAttribute("aria-busy", "true");
    try {
      const body = { name, limit: 5, ...extra };
      const res = await fetch("/api/screen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(String(res.status));
      render(name, await res.json(), true);
    } catch {
      const recorded = RECORDED[name];
      if (recorded) render(name, recorded, false);
      else results.innerHTML = `<p class="res-empty">The live matcher runs with the console's API. Start it with <span class="mono">make api</span>, or try one of the recorded names above.</p>`;
    } finally {
      go.disabled = false;
      results.removeAttribute("aria-busy");
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (name.length < 2) { input.focus(); return; }
    const extra = {};
    if (kind.value) extra.kind = kind.value;
    if (dob && dob.value.trim()) extra.birth_date = dob.value.trim();
    screen(name, extra);
  });
  for (const p of document.querySelectorAll("[data-preset]")) {
    p.addEventListener("click", () => {
      const name = p.dataset.preset;
      input.value = name;
      kind.value = RECORDED[name]?.birth ? "person" : "";
      if (dob) dob.value = RECORDED[name]?.birth ?? "";
      screen(name, RECORDED[name]?.birth ? { kind: "person", birth_date: RECORDED[name].birth, nationality: "British" } : {});
    });
  }
}

thresholdLab();
variantLab();
identityLab();
bookLab();
tryName();
