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


def test_onboarding_opens_a_case_and_maker_checker_closes_it(service):
    import pytest

    from satark.service import WorkflowError

    _, alerts, screening = service.onboard("Hafiz Muhammad Saeed", actor="analyst")
    assert alerts, screening
    case_id = alerts[0]["case_id"]
    with pytest.raises(WorkflowError):
        service.propose(case_id, "confirmed", "too short", "analyst")
    service.propose(case_id, "confirmed", "UN listing matches name and nationality", "analyst")
    with pytest.raises(PermissionError):
        service.review(case_id, True, "self-approval", "analyst")
    rejected = service.review(case_id, False, "check the date of birth first", "reviewer")
    assert rejected["status"] == "open" and not rejected["proposed_by"]
    service.propose(case_id, "confirmed", "date of birth on file matches the UN listing", "reviewer")
    with pytest.raises(PermissionError):
        service.review(case_id, True, "four eyes", "reviewer")
    closed = service.review(case_id, True, "agreed", "reviewer2")
    assert closed["status"] == "closed" and closed["decision"] == "confirmed"
    detail = service.case(case_id)
    assert all(a["status"] == "confirmed" for a in detail["alerts"])
    assert [e["action"] for e in detail["audit"]] == ["case.proposed", "case.rejected", "case.proposed", "case.approved"]


def test_audit_chain_detects_tampering(service):
    from satark.models import AuditEvent

    service.onboard("Hafiz Muhammad Saeed", actor="analyst")
    assert service.verify_audit()["ok"]
    with service.Session() as session:
        event = session.query(AuditEvent).order_by(AuditEvent.id.desc()).first()
        event.detail = {**event.detail, "alerts": 0}
        session.commit()
        tampered_id = event.id
    report = service.verify_audit()
    assert not report["ok"] and report["broken_at"] == tampered_id


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
    case_id = onboard["alerts"][0]["case_id"]
    proposal = {"decision": "confirmed", "note": "UN sanctions listing, same name"}
    assert client.post(f"/cases/{case_id}/proposal", json=proposal).status_code == 422
    assert client.post(f"/cases/{case_id}/proposal", json=proposal, headers={"X-Satark-User": "analyst"}).status_code == 200
    assert client.post(f"/cases/{case_id}/review", json={"approve": True}, headers={"X-Satark-User": "analyst"}).status_code == 403
    assert client.post(f"/cases/{case_id}/review", json={"approve": True}, headers={"X-Satark-User": "reviewer"}).json()["status"] == "closed"
    assert client.get("/audit/verify").json()["ok"]
    assert client.get("/metrics").text.count("satark_screenings_total") >= 1
    nse = client.get("/watchlists").json()[0]
    assert nse["entities"] > 1000 and nse["active"] + nse["historical"] == nse["entities"] and nse["historical"] > 0


def test_concurrent_audit_writers_cannot_fork_the_chain(service):
    import pytest

    from satark.service import AuditConflict

    head_both_writers_read = service.verify_audit()["head"]
    with service.Session() as first:
        service.audit(first, "worker-a", "test.write")
        first.commit()
    with service.Session() as second:
        second.scalar = lambda *args, **kwargs: head_both_writers_read  # read before the first writer committed
        with pytest.raises(AuditConflict):
            service.audit(second, "worker-b", "test.write")
    assert service.verify_audit()["ok"]


def test_import_book_links_parents_and_alerts_only_on_active_entries(service):
    rows = [
        {"external_id": "lei:PARENT", "name": "Classic Holdings Limited", "kind": "org", "group": "A", "country": "in",
         "birth_date": "", "parent_external_id": None, "details": {"lei": "PARENT"}},
        {"external_id": "ch-officer:0001:o1", "name": "Hafiz Muhammad Saeed", "kind": "person", "group": "B", "country": "",
         "birth_date": "", "parent_external_id": "lei:PARENT", "details": {"officer_role": "director"}},
    ]
    assert service.import_book(rows)["added"] == 2
    assert service.import_book(rows)["updated"] == 2  # idempotent upsert by external_id
    officer = next(c for c in service.customers(q="Saeed")["items"] if c["external_id"] == "ch-officer:0001:o1")
    parent = next(c for c in service.customers(q="Classic Holdings")["items"])
    assert officer["parent_id"] == parent["id"] and officer["group"] == "B"
    service.rescreen_all(actor="tester", trigger="onboarding")
    alerts = service.alerts(status="open")["items"]
    assert alerts and all(a["entity"]["status"] == "active" for a in alerts)
    assert service.cases(status="open")["total"] == 1
    profile = service.customer(parent["id"])
    assert [c["external_id"] for c in profile["children"]] == ["ch-officer:0001:o1"] and profile["parent"] is None
    assert service.customer(officer["id"])["cases"][0]["status"] == "open"


def test_active_listing_alerts_even_behind_many_historical_namesakes(tmp_path):
    from satark.config import Settings
    from satark.matcher import MatchIndex, Record
    from satark.service import Satark

    app = Satark(settings=Settings(database_url=f"sqlite:///{tmp_path / 't.db'}", redis_url="", reports_dir=tmp_path))
    namesakes = [Record(id=f"t:old{i}", name="Abhishek Gupta", schema="Person", dataset="t", source="t", status="historical") for i in range(10)]
    app.index = MatchIndex([*namesakes, Record(id="t:live", name="Abhishek Gupta", schema="Person", dataset="t", source="t")])
    _, alerts, _ = app.onboard("GUPTA, Abhishek", actor="analyst")
    assert [a["entity_id"] for a in alerts] == ["t:live"]


def test_secondary_check_clears_a_perfect_name_match_with_a_different_date_of_birth(service):
    from satark.models import WatchlistEntity

    with service.Session() as session:
        session.add(WatchlistEntity(id="in_sansad:test-mp", source="in_sansad", schema="Person", name="Abhishek Singh", aliases=[],
                                    birth_date="1981-03-05", countries="in", row_hash="x", status="active", details={}))
        session.commit()
    service.rebuild_index()
    _, alerts, screening = service.onboard("SINGH, Abhishek", birth_date="1978-12", nationality="Indian", actor="analyst")
    listed = next(a for a in alerts if a["entity_id"] == "in_sansad:test-mp")
    assert listed["score"] == 100.0 and listed["status"] == "auto_cleared" and listed["case_id"] is None
    assert listed["secondary"]["verdict"] == "contradicted" and "1981" in listed["secondary"]["summary"]
    assert "alert.auto_cleared" in [e["action"] for e in service.audit_log()] and service.verify_audit()["ok"]

    _, alerts, _ = service.onboard("Abhishek Singh", birth_date="1981-03", actor="analyst")
    same = next(a for a in alerts if a["entity_id"] == "in_sansad:test-mp")
    assert same["status"] == "open" and same["case_id"] and same["secondary"]["verdict"] == "confirmed"


def test_auto_clearance_is_revisited_when_the_listing_is_corrected(service):
    from satark.models import WatchlistEntity
    from satark.service import utcnow

    with service.Session() as session:
        session.add(WatchlistEntity(id="in_sansad:test-mp2", source="in_sansad", schema="Person", name="Anand Kumar", aliases=[],
                                    birth_date="1974-08-07", countries="in", row_hash="x", status="active", details={}))
        session.commit()
    service.rebuild_index()
    customer, alerts, _ = service.onboard("KUMAR, Anand", birth_date="1955-09", actor="analyst")
    assert next(a for a in alerts if a["entity_id"] == "in_sansad:test-mp2")["status"] == "auto_cleared"
    audit = next(e for e in service.audit_log() if e["action"] == "customer.onboard")
    assert audit["detail"]["alerts"] == sum(a["status"] == "open" for a in alerts)  # counts include the last alert of the batch

    assert service.rescreen_all(actor="tester")["auto_cleared"] == 0  # unchanged listing: the clearance stands
    with service.Session() as session:
        entity = session.get(WatchlistEntity, "in_sansad:test-mp2")
        entity.birth_date, entity.updated_at = "1955-09-14", utcnow()  # the list corrects its date of birth
        session.commit()
    service.handle_delta({"entity_ids": ["in_sansad:test-mp2"], "source": "in_sansad"})
    reopened = [a for a in service.alerts(status="open")["items"] if a["entity_id"] == "in_sansad:test-mp2"]
    assert len(reopened) == 1 and reopened[0]["secondary"]["verdict"] == "confirmed"
