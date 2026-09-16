from satark.media.feeds import Feed, poll, search

RSS_FEED = """<?xml version="1.0"?><rss><channel>
<item><title>SEBI bars Rajiv Sanghvi from securities market for two years</title>
<link>https://sebi.example/a</link><pubDate>Mon, 07 Sep 2026 10:00:00 GMT</pubDate>
<description>SEBI bars Rajiv Sanghvi from securities market for two years</description></item>
<item><title>Rajiv Kapoor opens new cafe in Pune</title>
<link>https://sebi.example/b</link><pubDate>Mon, 07 Sep 2026 09:00:00 GMT</pubDate>
<description>cafe</description></item>
</channel></rss>"""

ATOM_FEED = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<entry>
<title>FCA fines Vertex Capital for anti-money laundering failures</title>
<link href="https://fca.example/1"/>
<id>https://fca.example/1</id>
<published>2026-09-07T10:00:00Z</published>
<summary>The FCA today fined Vertex Capital Plc one million pounds.</summary>
</entry>
</feed>"""

FEED_A = Feed("SEBI", "https://sebi.example/rss.xml", "regulator", "in")
FEED_B = Feed("FCA", "https://fca.example/rss.xml", "regulator", "gb")
FEED_DEAD = Feed("Dead", "https://dead.example/rss.xml", "publisher", "in")


def fake_fetch(responses):
    def fetch(url, headers, timeout):
        return responses[url]
    return fetch


def test_poll_indexes_rss_and_atom(tmp_path):
    db = tmp_path / "news.db"
    fetch = fake_fetch({
        FEED_A.url: (200, {}, RSS_FEED.encode()),
        FEED_B.url: (200, {}, ATOM_FEED.encode()),
    })
    results = poll(db, feeds=(FEED_A, FEED_B), fetch=fetch)
    assert {r["name"]: r["status"] for r in results} == {"SEBI": "ok", "FCA": "ok"}
    assert {r["name"]: r["new"] for r in results} == {"SEBI": 2, "FCA": 1}
    assert {r["name"]: r["total"] for r in results} == {"SEBI": 2, "FCA": 1}


def test_phrase_search_hits_right_article_not_partial_token_lookalike(tmp_path):
    db = tmp_path / "news.db"
    poll(db, feeds=(FEED_A, FEED_B), fetch=fake_fetch({
        FEED_A.url: (200, {}, RSS_FEED.encode()),
        FEED_B.url: (200, {}, ATOM_FEED.encode()),
    }))

    hits = search(db, "Rajiv Sanghvi")
    assert [a.title for a in hits] == ["SEBI bars Rajiv Sanghvi from securities market for two years"]
    assert hits[0].publisher == "SEBI"

    fca_hits = search(db, "Vertex Capital")
    assert fca_hits and fca_hits[0].publisher == "FCA"


def test_not_modified_keeps_old_rows(tmp_path):
    db = tmp_path / "news.db"
    poll(db, feeds=(FEED_A,), fetch=fake_fetch({FEED_A.url: (200, {"etag": "v1"}, RSS_FEED.encode())}))
    before = search(db, "Rajiv Sanghvi")
    assert len(before) == 1

    def not_modified(url, headers, timeout):
        assert headers.get("If-None-Match") == "v1"
        return 304, {}, b""

    results = poll(db, feeds=(FEED_A,), fetch=not_modified)
    assert results[0]["status"] == "not modified"
    assert results[0]["total"] == 2
    after = search(db, "Rajiv Sanghvi")
    assert after == before


def test_failing_feed_does_not_block_others(tmp_path):
    db = tmp_path / "news.db"

    def fetch(url, headers, timeout):
        if url == FEED_DEAD.url:
            raise TimeoutError("no route to host")
        return 200, {}, ATOM_FEED.encode()

    results = poll(db, feeds=(FEED_DEAD, FEED_B), fetch=fetch)
    statuses = {r["name"]: r["status"] for r in results}
    assert statuses["Dead"].startswith("error:")
    assert statuses["FCA"] == "ok"
    assert search(db, "Vertex Capital")


def test_non_200_status_recorded_without_raising(tmp_path):
    db = tmp_path / "news.db"
    results = poll(db, feeds=(FEED_A,), fetch=fake_fetch({FEED_A.url: (403, {}, b"")}))
    assert results[0]["status"] == "http 403"
    assert results[0]["total"] == 0


def test_punctuation_in_subject_is_stripped_before_matching(tmp_path):
    db = tmp_path / "news.db"
    poll(db, feeds=(FEED_A,), fetch=fake_fetch({FEED_A.url: (200, {}, RSS_FEED.encode())}))
    hits = search(db, "Rajiv, Sanghvi.")
    assert hits and hits[0].publisher == "SEBI"


def test_all_punctuation_subject_returns_empty_without_raising(tmp_path):
    db = tmp_path / "news.db"
    poll(db, feeds=(FEED_A,), fetch=fake_fetch({FEED_A.url: (200, {}, RSS_FEED.encode())}))
    assert search(db, "...") == []
    assert search(db, "()") == []
    assert search(db, "M/s. (India) & Co.") is not None
