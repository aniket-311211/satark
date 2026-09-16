import json
import re
from dataclasses import dataclass, field

from ..names import CANONICAL, normalize, phonetic_key, strip_accents
from .feeds import Article

CATEGORIES = {
    "terrorism": ["terror", "uapa", "nia ", "militant", "banned outfit"],
    "money_laundering": ["money laundering", "pmla", "hawala", "enforcement directorate", "ed attaches", "ed raids", "ed arrests"],
    "market_abuse": ["insider trading", "front running", "front-running", "price manipulation", "pump and dump", "sebi bars", "sebi order", "debarred", "securities market"],
    "fraud": ["fraud", "scam", "cheating", "forgery", "ponzi", "embezzl", "defraud", "duped", "siphon"],
    "corruption": ["bribe", "bribery", "corruption", "disproportionate assets", "kickback", "lokayukta", "cbi books", "cbi registers"],
    "tax_evasion": ["tax evasion", "gst evasion", "income tax raid", "black money", "benami"],
    "regulatory_action": ["penalty", "fined", "show cause", "show-cause", "barred", "ban on", "rbi imposes", "sebi imposes"],
    "other_crime": ["arrested", "fir ", "chargesheet", "charge sheet", "custody", "absconding", "warrant", "booked", "convicted"],
}
CATEGORY_NAMES = [*CATEGORIES.keys()]

EXTRACTION_TOOL = {
    "name": "record_adverse_media",
    "description": "Record adverse media events about the screened subject found in the supplied headlines.",
    "input_schema": {
        "type": "object",
        "properties": {
            "events": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "article_index": {"type": "integer", "description": "Index of the article the event comes from"},
                        "category": {"type": "string", "enum": CATEGORY_NAMES},
                        "summary": {"type": "string", "description": "One neutral sentence: what is alleged, by whom, and the status"},
                        "quote": {"type": "string", "description": "Exact, verbatim span copied from the article text that supports the event"},
                        "subject_is_named": {"type": "boolean", "description": "True only if the article clearly refers to this subject, not a namesake"},
                    },
                    "required": ["article_index", "category", "summary", "quote", "subject_is_named"],
                },
            }
        },
        "required": ["events"],
    },
}

SYSTEM_PROMPT = (
    "You assist a financial-crime analyst screening a customer in India. For each supplied article, decide whether it "
    "reports an adverse allegation, investigation, order or conviction involving the subject. Ignore articles about other "
    "people with similar names, generic market news and positive coverage. Quote verbatim from the article text only. "
    "Summaries must be neutral and say 'alleged' unless a conviction or final order is reported. Return no event when unsure."
)


@dataclass
class ExtractedEvent:
    article_index: int
    category: str
    summary: str
    quote: str
    subject_is_named: bool
    checks: dict = field(default_factory=dict)
    verified: bool = False


def classify(text: str) -> str | None:
    lowered = f" {text.lower()} "
    for category, terms in CATEGORIES.items():
        if any(term in lowered for term in terms):
            return category
    return None


def mentions_subject(subject: str, text: str) -> bool:
    subject_keys = normalize(subject).keys
    words = re.findall(r"[a-z]+", strip_accents(text.lower()))
    text_keys = {phonetic_key(CANONICAL.get(w, w)) for w in words}
    if not subject_keys:
        return False
    hits = sum(1 for key in subject_keys if key in text_keys)
    return hits >= min(2, len(subject_keys)) and subject_keys[-1] in text_keys


def heuristic_extract(subject: str, articles: list[Article]) -> list[ExtractedEvent]:
    events = []
    for idx, article in enumerate(articles):
        category = classify(article.text)
        if not category:
            continue
        events.append(ExtractedEvent(
            article_index=idx,
            category=category,
            summary=f"Headline links {subject} to {category.replace('_', ' ')}: {article.title}",
            quote=article.title,
            subject_is_named=mentions_subject(subject, article.text),
        ))
    return events


def llm_extract(subject: str, articles: list[Article], api_key: str, model: str) -> list[ExtractedEvent]:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    listing = "\n".join(
        f"[{i}] publisher={a.publisher!r} date={a.published!r}\ntext: {a.text}" for i, a in enumerate(articles)
    )
    response = client.messages.create(
        model=model,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        tools=[EXTRACTION_TOOL],
        tool_choice={"type": "tool", "name": EXTRACTION_TOOL["name"]},
        messages=[{"role": "user", "content": f"Subject: {subject}\n\nArticles:\n{listing}"}],
    )
    payload = next((block.input for block in response.content if block.type == "tool_use"), {"events": []})
    if isinstance(payload, str):
        payload = json.loads(payload)
    events = []
    for item in payload.get("events", []):
        if not isinstance(item.get("article_index"), int) or not 0 <= item["article_index"] < len(articles):
            continue
        events.append(ExtractedEvent(
            article_index=item["article_index"],
            category=item.get("category", "other_crime"),
            summary=item.get("summary", ""),
            quote=item.get("quote", ""),
            subject_is_named=bool(item.get("subject_is_named")),
        ))
    return events


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[‘’“”\"']", "", text.lower())).strip()


def verify(subject: str, articles: list[Article], events: list[ExtractedEvent]) -> list[ExtractedEvent]:
    for event in events:
        article = articles[event.article_index]
        event.checks = {
            "quote_in_source": bool(event.quote) and squash(event.quote) in squash(article.text),
            "subject_in_source": mentions_subject(subject, article.text),
            "extractor_says_subject": event.subject_is_named,
            "category_known": event.category in CATEGORIES,
        }
        event.verified = all(event.checks.values())
    return events
