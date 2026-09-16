import json
import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import BaseModel, Field

from .config import get_settings
from .service import Satark, screen_dict

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


class ScreenRequest(BaseModel):
    name: str = Field(min_length=2, max_length=256)
    kind: Literal["person", "org"] | None = None
    birth_date: str | None = None
    country: str | None = None
    limit: int = Field(default=10, ge=1, le=50)
    min_score: float | None = Field(default=None, ge=0, le=100)


class CustomerRequest(BaseModel):
    name: str = Field(min_length=2, max_length=256)
    kind: Literal["person", "org"] = "person"
    birth_date: str = ""
    country: str = "in"
    segment: str = "retail"


class DecisionRequest(BaseModel):
    decision: Literal["confirmed", "discarded", "escalated"]
    note: str = Field(default="", max_length=2000)
    actor: str = Field(default="analyst", max_length=64)


class DeltaRequest(BaseModel):
    customer_id: int | None = None
    style: Literal["devanagari", "initials", "honorific", "spelling"] | None = None


class MediaRequest(BaseModel):
    subject: str = Field(min_length=3, max_length=256)
    refresh: bool = False


def create_app(service: Satark | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.satark = service or Satark()
        app.state.satark.ensure_ready()
        yield

    app = FastAPI(title="Satark", version="0.1.0", lifespan=lifespan,
                  description="India-first KYC screening, adverse media and watchlist monitoring")
    settings = get_settings()
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","), allow_methods=["*"], allow_headers=["*"])

    def core(request: Request) -> Satark:
        return request.app.state.satark

    @app.get("/health")
    def health(request: Request):
        s = core(request)
        return {"status": "ok", "indexed_names": len(s.index.names), "bus": s.bus.kind}

    @app.get("/metrics")
    def prometheus_metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.get("/stats")
    def stats(request: Request):
        return core(request).stats()

    @app.post("/screen")
    def screen(body: ScreenRequest, request: Request):
        result = core(request).screen(body.name, kind=body.kind, birth_date=body.birth_date, country=body.country,
                                      limit=body.limit, min_score=body.min_score)
        return screen_dict(result)

    @app.get("/entities/{entity_id}")
    def entity(entity_id: str, request: Request):
        found = core(request).entity(entity_id)
        if not found:
            raise HTTPException(404, f"No watchlist entity with id {entity_id}")
        return found

    @app.get("/watchlists")
    def watchlists(request: Request):
        return core(request).watchlists()

    @app.post("/watchlists/refresh")
    def refresh(request: Request, mode: Literal["snapshot", "remote"] = "remote"):
        try:
            return core(request).ingest(mode=mode, actor="analyst")
        except Exception as exc:
            raise HTTPException(502, f"Watchlist refresh failed: {exc}") from exc

    @app.post("/watchlists/simulate-delta")
    def simulate(body: DeltaRequest, request: Request):
        try:
            return core(request).simulate_delta(customer_id=body.customer_id, style=body.style)
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from exc

    @app.get("/customers")
    def customers(request: Request, q: str = "", limit: int = Query(50, le=200), offset: int = 0):
        return core(request).customers(q=q, limit=limit, offset=offset)

    @app.post("/customers")
    def onboard(body: CustomerRequest, request: Request):
        customer, alerts, screening = core(request).onboard(**body.model_dump())
        return {"customer": customer, "alerts": alerts, "screening": screening}

    @app.post("/customers/rescreen")
    def rescreen(request: Request):
        return core(request).rescreen_all(actor="analyst", trigger="batch")

    @app.get("/alerts")
    def alerts(request: Request, status: str | None = None, limit: int = Query(100, le=500), offset: int = 0):
        return core(request).alerts(status=status, limit=limit, offset=offset)

    @app.post("/alerts/{alert_id}/decision")
    def decide(alert_id: int, body: DecisionRequest, request: Request):
        try:
            return core(request).decide(alert_id, body.decision, body.note, body.actor)
        except KeyError as exc:
            raise HTTPException(404, f"No alert {alert_id}") from exc

    @app.post("/media/brief")
    def media(body: MediaRequest, request: Request):
        return core(request).media_brief(body.subject, refresh=body.refresh)

    @app.get("/audit")
    def audit(request: Request, limit: int = Query(100, le=500)):
        return core(request).audit_log(limit)

    @app.get("/eval")
    def evaluation(request: Request):
        path = core(request).settings.reports_dir / "eval.json"
        if not path.exists():
            raise HTTPException(404, "No evaluation report yet. Run `satark eval`.")
        return json.loads(path.read_text())

    return app


app = create_app()
