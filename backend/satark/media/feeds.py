import html
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import feedparser
import httpx

USER_AGENT = "satark/0.2 (+https://github.com/aniket-311211/satark)"
POLL_STALE_AFTER = timedelta(minutes=30)
_POLL_LIMIT = 1000  # feeds carry a few dozen items at most; this is just a safety cap


@dataclass
class Article:
    title: str
    url: str
    publisher: str
    published: str
    text: str


@dataclass
class Feed:
    name: str
    url: str
    kind: str  # "regulator" | "publisher"
    country: str  # "in" | "gb"


# ponytail: allowlist only. GDELT rejected every request from this network; commercial APIs cap
# daily calls. Owning the index means unlimited local search over sources we chose ourselves.
# feeds only carry recent items, so history accrues from the first poll onward; there is no backfill.
# PIB and Business Standard answer 403 to an identifying client and 200 only to a browser user agent; we don't spoof one.
FEEDS = (
    Feed("SEBI", "https://www.sebi.gov.in/sebirss.xml", "regulator", "in"),
    Feed("RBI", "https://www.rbi.org.in/pressreleases_rss.xml", "regulator", "in"),
    Feed("FCA", "https://www.fca.org.uk/news/rss.xml", "regulator", "gb"),
    Feed("NCA", "https://www.nationalcrimeagency.gov.uk/news?format=feed&type=rss", "regulator", "gb"),
    Feed("The Hindu Business", "https://www.thehindu.com/business/feeder/default.rss", "publisher", "in"),
    Feed("Hindu BusinessLine", "https://www.thehindubusinessline.com/feeder/default.rss", "publisher", "in"),
    Feed("Indian Express Business", "https://indianexpress.com/section/business/feed/", "publisher", "in"),
    Feed("Mint Companies", "https://www.livemint.com/rss/companies", "publisher", "in"),
    Feed("Times of India Business", "https://timesofindia.indiatimes.com/rssfeeds/1898055.cms", "publisher", "in"),
    Feed("NDTV Profit", "https://feeds.feedburner.com/ndtvprofit-latest", "publisher", "in"),
)


def parse_feed(content: bytes | str, limit: int, publisher: str = "") -> list[Article]:
    feed = feedparser.parse(content)
    articles = []
    for entry in feed.entries[:limit]:
        source = (entry.get("source") or {}).get("title", "") or publisher
        title = html.unescape(entry.get("title", "")).strip()
        if source and title.endswith(f" - {source}"):
            title = title[: -len(source) - 3].strip()
        summary = re.sub(r"<[^>]+>", " ", html.unescape(entry.get("summary", "")))
        summary = re.sub(r"\s+", " ", summary).strip()
        text = title if not summary or summary.startswith(title) else f"{title}. {summary}"
        articles.append(Article(title=title, url=entry.get("link", ""), publisher=source, published=entry.get("published", ""), text=text))
    return articles


def _connect(db_path: str | Path) -> sqlite3.Connection:
    con = sqlite3.connect(db_path)
    con.executescript("""
        CREATE TABLE IF NOT EXISTS articles (
            url TEXT PRIMARY KEY, title TEXT, summary TEXT, publisher TEXT,
            kind TEXT, country TEXT, published TEXT, fetched_at TEXT
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
            title, summary, content='articles', content_rowid='rowid'
        );
        CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
            INSERT INTO articles_fts(rowid, title, summary) VALUES (new.rowid, new.title, new.summary);
        END;
        CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
            INSERT INTO articles_fts(articles_fts, rowid, title, summary) VALUES ('delete', old.rowid, old.title, old.summary);
        END;
        CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
            INSERT INTO articles_fts(articles_fts, rowid, title, summary) VALUES ('delete', old.rowid, old.title, old.summary);
            INSERT INTO articles_fts(rowid, title, summary) VALUES (new.rowid, new.title, new.summary);
        END;
        CREATE TABLE IF NOT EXISTS feeds (
            url TEXT PRIMARY KEY, etag TEXT, last_modified TEXT, polled_at TEXT, status TEXT, items INTEGER
        );
    """)
    return con


def _http_fetch(url: str, headers: dict, timeout: float) -> tuple[int, httpx.Headers, bytes]:
    response = httpx.get(url, headers=headers, timeout=timeout, follow_redirects=True)
    return response.status_code, response.headers, response.content


def poll(db_path: str | Path, feeds: tuple[Feed, ...] = FEEDS, timeout: float = 20.0, fetch=None) -> list[dict]:
    fetch = fetch or _http_fetch
    con = _connect(db_path)
    results = []
    try:
        for feed in feeds:
            results.append(_poll_one(con, feed, timeout, fetch))
            con.commit()
    finally:
        con.close()
    return results


def _poll_one(con: sqlite3.Connection, feed: Feed, timeout: float, fetch) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    cached = con.execute("SELECT etag, last_modified FROM feeds WHERE url = ?", (feed.url,)).fetchone()
    etag, last_modified = cached if cached else (None, None)
    headers = {"User-Agent": USER_AGENT}
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    try:
        status, resp_headers, content = fetch(feed.url, headers, timeout)
    except Exception as exc:  # one bad feed must not stop the others
        return _record_feed_status(con, feed, etag, last_modified, now, f"error: {exc}")
    if status == 304:
        return _record_feed_status(con, feed, etag, last_modified, now, "not modified")
    if status != 200:
        return _record_feed_status(con, feed, etag, last_modified, now, f"http {status}")

    articles = parse_feed(content, _POLL_LIMIT, publisher=feed.name)
    new = sum(_upsert_article(con, feed, article, now) for article in articles)
    new_etag = resp_headers.get("etag") or etag
    new_last_modified = resp_headers.get("last-modified") or last_modified
    return _record_feed_status(con, feed, new_etag, new_last_modified, now, "ok", len(articles), new)


def _upsert_article(con: sqlite3.Connection, feed: Feed, article: Article, fetched_at: str) -> bool:
    if not article.url:
        return False
    is_new = con.execute("SELECT 1 FROM articles WHERE url = ?", (article.url,)).fetchone() is None
    con.execute(
        "INSERT INTO articles(url, title, summary, publisher, kind, country, published, fetched_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(url) DO UPDATE SET "
        "title=excluded.title, summary=excluded.summary, publisher=excluded.publisher, kind=excluded.kind, "
        "country=excluded.country, published=excluded.published, fetched_at=excluded.fetched_at",
        (article.url, article.title, article.text, feed.name, feed.kind, feed.country, article.published, fetched_at),
    )
    return is_new


def _record_feed_status(con: sqlite3.Connection, feed: Feed, etag, last_modified, polled_at: str, status: str, items: int = 0, new: int = 0) -> dict:
    con.execute(
        "INSERT INTO feeds(url, etag, last_modified, polled_at, status, items) VALUES (?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(url) DO UPDATE SET etag=excluded.etag, last_modified=excluded.last_modified, "
        "polled_at=excluded.polled_at, status=excluded.status, items=excluded.items",
        (feed.url, etag, last_modified, polled_at, status, items),
    )
    total = con.execute("SELECT COUNT(*) FROM articles WHERE publisher = ?", (feed.name,)).fetchone()[0]
    return {"name": feed.name, "status": status, "new": new, "total": total}


def _fts_phrase(subject: str) -> str:
    tokens = re.findall(r"[A-Za-z0-9]+", subject)  # ponytail: punctuation-only tokens (e.g. from "(UK)") just drop out
    if not tokens:
        return ""
    return '"' + " ".join(tokens).replace('"', '""') + '"'


def search(db_path: str | Path, subject: str, limit: int = 12) -> list[Article]:
    phrase = _fts_phrase(subject)
    if not phrase:
        return []
    con = _connect(db_path)
    try:
        rows = con.execute(
            "SELECT a.title, a.url, a.publisher, a.published, a.summary FROM articles_fts f "
            "JOIN articles a ON a.rowid = f.rowid WHERE articles_fts MATCH ? "
            "ORDER BY bm25(articles_fts) ASC, a.fetched_at DESC LIMIT ?",
            (phrase, limit),
        ).fetchall()
    finally:
        con.close()
    return [Article(title=r[0], url=r[1], publisher=r[2], published=r[3], text=r[4]) for r in rows]


def fetch_news(subject: str, limit: int = 12, timeout: float = 20.0) -> list[Article]:
    from ..config import get_settings

    db_path = Path(get_settings().data_dir) / "cache" / "news.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = _connect(db_path)
    try:
        newest = con.execute("SELECT MAX(polled_at) FROM feeds").fetchone()[0]
        empty = con.execute("SELECT COUNT(*) FROM articles").fetchone()[0] == 0
    finally:
        con.close()
    stale = empty or newest is None or datetime.fromisoformat(newest) < datetime.now(timezone.utc) - POLL_STALE_AFTER
    if stale:
        try:
            poll(db_path, timeout=timeout)
        except Exception:
            if empty:
                raise
    return search(db_path, subject, limit)
