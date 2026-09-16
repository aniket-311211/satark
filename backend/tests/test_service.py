from satark.media.extract import heuristic_extract, verify
from satark.media.feeds import Article, parse_feed

FEED = """<?xml version="1.0"?><rss><channel>
<item><title>SEBI bars Rajiv Sanghvi from securities market for two years - Mint</title>
<link>https://example.com/a</link><pubDate>Mon, 07 Sep 2026 10:00:00 GMT</pubDate><source url="https://livemint.com">Mint</source>
<description>&lt;a href="x"&gt;SEBI bars Rajiv Sanghvi from securities market for two years&lt;/a&gt;</description></item>
<item><title>Rajiv Kapoor opens new cafe in Pune - Pune Times</title>
<link>https://example.com/b</link><pubDate>Mon, 07 Sep 2026 09:00:00 GMT</pubDate><source url="https://x.com">Pune Times</source>
<description>cafe</description></item>
</channel></rss>"""


def test_feed_parsing_strips_publisher():
    articles = parse_feed(FEED, 10)
    assert articles[0].title == "SEBI bars Rajiv Sanghvi from securities market for two years"
    assert articles[0].publisher == "Mint"


def test_keyword_extraction_and_grounding():
    articles = parse_feed(FEED, 10)
    events = verify("Rajiv Sanghvi", articles, heuristic_extract("Rajiv Sanghvi", articles))
    assert len(events) == 1
    assert events[0].category == "market_abuse"
    assert events[0].verified


def test_hallucinated_quote_fails_verification():
    from satark.media.extract import ExtractedEvent

    articles = [Article("SEBI bars Rajiv Sanghvi", "u", "Mint", "", "SEBI bars Rajiv Sanghvi")]
    event = ExtractedEvent(0, "fraud", "alleged fraud", "Sanghvi arrested for Rs 500 crore fraud", True)
    assert not verify("Rajiv Sanghvi", articles, [event])[0].verified


def test_onboarding_raises_alert_and_decision_is_audited(service):
    customer, alerts, screening = service.onboard("Shri Rajiv R. Sanghvi", actor="tester")
    assert alerts, screening
    decided = service.decide(alerts[0]["id"], "confirmed", "same PAN on file", "tester")
    assert decided["status"] == "confirmed"
    actions = [a["action"] for a in service.audit_log()]
    assert "alert.decision" in actions and "customer.onboard" in actions


def test_delta_rescreen_catches_devanagari_listing(service):
    customer, _, _ = service.onboard("Ananya Deshpande Kulkarni", actor="tester")
    before = service.alerts(status="open")["total"]
    result = service.simulate_delta(customer_id=customer["id"], style="devanagari")
    assert any("ऀ" <= ch <= "ॿ" for ch in result["listed_name"])
    after = service.alerts(status="open")
    assert after["total"] == before + 1
    assert after["items"][0]["trigger"] == "watchlist_delta"


def test_media_brief_uses_injected_fetcher(service):
    brief = service.media_brief("Rajiv Sanghvi", refresh=True, fetcher=lambda subject, limit: parse_feed(FEED, limit))
    assert brief["extractor"] == "keyword-rules"
    assert brief["events"][0]["verified"]
    cached = service.media_brief("Rajiv Sanghvi")
    assert cached["cached"]


def test_api_screen_and_alert_flow(client):
    response = client.post("/screen", json={"name": "राजीव संघवी"})
    assert response.status_code == 200
    body = response.json()
    assert body["matches"] and body["matches"][0]["band"] in ("strong", "probable")
    onboard = client.post("/customers", json={"name": "Hafiz Muhammad Saeed"}).json()
    assert onboard["alerts"]
    alert_id = onboard["alerts"][0]["id"]
    assert client.post(f"/alerts/{alert_id}/decision", json={"decision": "escalated", "note": "sanctions hit"}).status_code == 200
    assert client.get("/metrics").text.count("satark_screenings_total") >= 1
    assert client.get("/watchlists").json()[0]["entities"] > 1000
