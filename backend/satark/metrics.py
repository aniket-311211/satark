from prometheus_client import Counter, Gauge, Histogram

SCREEN_LATENCY = Histogram(
    "satark_screen_latency_seconds",
    "Time to screen one name against the watchlist index",
    buckets=(0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1.0),
)
SCREENINGS = Counter("satark_screenings_total", "Names screened", ["trigger"])
ALERTS = Counter("satark_alerts_created_total", "Alerts raised", ["trigger", "band"])
DECISIONS = Counter("satark_alert_decisions_total", "Analyst decisions", ["decision"])
DELTAS = Counter("satark_watchlist_delta_events_total", "Watchlist delta events handled")
ENTITIES = Gauge("satark_watchlist_entities", "Active watchlist entities", ["source"])
MEDIA = Counter("satark_media_events_total", "Adverse media events stored", ["extractor", "verified"])
