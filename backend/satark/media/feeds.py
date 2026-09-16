import html
import re
from dataclasses import dataclass

import feedparser
import httpx

NEWS_URL = "https://news.google.com/rss/search"
RISK_TERMS = ["fraud", "SEBI", "ED", "CBI", "arrested", "\"money laundering\"", "scam", "penalty", "raid", "chargesheet", "debarred", "FIR"]


@dataclass
class Article:
    title: str
    url: str
    publisher: str
    published: str
    text: str


def build_query(subject: str) -> str:
    return f"\"{subject}\" ({' OR '.join(RISK_TERMS)})"


def parse_feed(content: bytes | str, limit: int) -> list[Article]:
    feed = feedparser.parse(content)
    articles = []
    for entry in feed.entries[:limit]:
        publisher = (entry.get("source") or {}).get("title", "")
        title = html.unescape(entry.get("title", "")).strip()
        if publisher and title.endswith(f" - {publisher}"):
            title = title[: -len(publisher) - 3].strip()
        summary = re.sub(r"<[^>]+>", " ", html.unescape(entry.get("summary", "")))
        summary = re.sub(r"\s+", " ", summary).strip()
        text = title if not summary or summary.startswith(title) else f"{title}. {summary}"
        articles.append(Article(title=title, url=entry.get("link", ""), publisher=publisher, published=entry.get("published", ""), text=text))
    return articles


def fetch_news(subject: str, limit: int = 12, timeout: float = 20.0) -> list[Article]:
    params = {"q": build_query(subject), "hl": "en-IN", "gl": "IN", "ceid": "IN:en"}
    response = httpx.get(NEWS_URL, params=params, timeout=timeout, follow_redirects=True, headers={"User-Agent": "satark/0.1"})
    response.raise_for_status()
    return parse_feed(response.content, limit)
