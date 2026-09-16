from dataclasses import asdict
from functools import lru_cache

from .service import Satark

try:
    from mcp.server.mcpserver import MCPServer as Server
except ImportError:
    from mcp.server.fastmcp import FastMCP as Server

mcp = Server(
    "satark",
    instructions=(
        "Satark screens people and organisations against Indian and UN watchlists (NSE debarred entities, "
        "Parliament members as PEPs, MHA banned organisations, UN Security Council sanctions). Results are "
        "potential matches for human review, never findings. Always show the score band and reasons."
    ),
)


@lru_cache
def core() -> Satark:
    service = Satark()
    service.ensure_ready()
    return service


@mcp.tool()
def screen_entity(name: str, kind: str | None = None, birth_date: str | None = None, country: str | None = None, limit: int = 5) -> dict:
    """Screen a person or organisation name (Latin or Devanagari) against the watchlists.

    kind is "person" or "org"; birth_date may be a year or ISO date; country is an ISO-2 code such as "in".
    Returns potential matches with a 0-100 score, a band (strong/probable/possible) and plain-English reasons."""
    result = core().screen(name, kind=kind, birth_date=birth_date, country=country, limit=limit, trigger="mcp")
    return {
        "query": result.query,
        "normalized_as": result.normalized,
        "normalization_steps": result.notes,
        "alert_threshold": core().settings.alert_threshold,
        "matches": [
            {
                "entity_id": m.entity_id, "listed_name": m.entity_name, "matched_on": m.matched_name,
                "list": m.source, "score": m.score, "band": m.band, "reasons": m.reasons,
            }
            for m in result.matches
        ],
        "disclaimer": "Potential matches only. A reviewer must confirm identity before any action.",
    }


@mcp.tool()
def explain_match(name: str, entity_id: str) -> dict:
    """Explain token by token how a name compares with one watchlist entity."""
    service = core()
    subset = service.index.subset([entity_id])
    if not subset.records:
        return {"error": f"Unknown entity_id {entity_id}"}
    result = service.screen(name, index=subset, min_score=0, limit=1, trigger="mcp")
    if not result.matches:
        return {"entity_id": entity_id, "score": 0, "explanation": "No shared name tokens."}
    match = result.matches[0]
    return {
        "entity_id": entity_id, "listed_name": match.entity_name, "matched_on": match.matched_name,
        "score": match.score, "band": match.band, "components": match.components,
        "token_pairs": [asdict(p) for p in match.pairs], "reasons": match.reasons, "query_steps": result.notes,
    }


@mcp.tool()
def get_record(entity_id: str) -> dict:
    """Fetch the full watchlist record (list, authority, aliases, programme, dates) for an entity_id."""
    return core().entity(entity_id) or {"error": f"Unknown entity_id {entity_id}"}


@mcp.tool()
def adverse_media_brief(subject: str, refresh: bool = False) -> dict:
    """Search Indian news headlines for adverse coverage of a subject and return grounded, source-linked events.

    Each event lists the headline, publisher, URL, a verbatim quote and the grounding checks it passed."""
    return core().media_brief(subject, refresh=refresh, actor="mcp")


@mcp.tool()
def list_open_alerts(limit: int = 10) -> dict:
    """List the newest open screening alerts waiting for analyst review."""
    data = core().alerts(status="open", limit=limit)
    return {
        "total_open": data["total"],
        "alerts": [
            {
                "alert_id": a["id"], "customer": a["customer"]["name"] if a["customer"] else None,
                "listed_name": a["entity"]["name"] if a["entity"] else a["matched_name"],
                "list": a["entity"]["source_label"] if a["entity"] else None,
                "score": a["score"], "band": a["band"], "trigger": a["trigger"],
            }
            for a in data["items"]
        ],
    }


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
