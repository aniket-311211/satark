from collections.abc import Callable
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .extract import ExtractedEvent, heuristic_extract, llm_extract, verify
from .feeds import Article, fetch_news


class MediaState(TypedDict, total=False):
    subject: str
    articles: list[Article]
    events: list[ExtractedEvent]
    extractor: str
    errors: list[str]
    trace: list[str]


def build_media_graph(
    api_key: str = "",
    model: str = "claude-haiku-4-5",
    max_items: int = 12,
    fetcher: Callable[[str, int], list[Article]] = fetch_news,
):
    def fetch(state: MediaState) -> MediaState:
        try:
            articles = fetcher(state["subject"], max_items)
            return {"articles": articles, "trace": [*state.get("trace", []), f"fetch: {len(articles)} headlines"]}
        except Exception as exc:
            return {"articles": [], "errors": [*state.get("errors", []), f"news fetch failed: {exc}"], "trace": [*state.get("trace", []), "fetch: failed"]}

    def extract(state: MediaState) -> MediaState:
        articles = state.get("articles", [])
        if not articles:
            return {"events": [], "extractor": "none", "trace": [*state.get("trace", []), "extract: nothing to read"]}
        if api_key:
            try:
                events = llm_extract(state["subject"], articles, api_key, model)
                return {"events": events, "extractor": f"claude:{model}", "trace": [*state.get("trace", []), f"extract: {len(events)} events via {model}"]}
            except Exception as exc:
                errors = [*state.get("errors", []), f"LLM extraction failed, used keyword rules: {exc}"]
                events = heuristic_extract(state["subject"], articles)
                return {"events": events, "extractor": "keyword-rules", "errors": errors, "trace": [*state.get("trace", []), f"extract: {len(events)} events via rules"]}
        events = heuristic_extract(state["subject"], articles)
        return {"events": events, "extractor": "keyword-rules", "trace": [*state.get("trace", []), f"extract: {len(events)} events via rules"]}

    def check(state: MediaState) -> MediaState:
        events = verify(state["subject"], state.get("articles", []), state.get("events", []))
        passed = sum(1 for e in events if e.verified)
        return {"events": events, "trace": [*state.get("trace", []), f"verify: {passed}/{len(events)} passed grounding checks"]}

    graph = StateGraph(MediaState)
    graph.add_node("fetch", fetch)
    graph.add_node("extract", extract)
    graph.add_node("verify", check)
    graph.add_edge(START, "fetch")
    graph.add_edge("fetch", "extract")
    graph.add_edge("extract", "verify")
    graph.add_edge("verify", END)
    return graph.compile()
