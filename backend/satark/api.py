import json
import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import BaseModel, Field

from .config import get_settings
from .service import AuditConflict, Satark, WorkflowError, screen_dict

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


class ScreenRequest(BaseModel):
    name: str = Field(min_length=2, max_length=256)
    kind: Literal["person", "org"] | None = None
    birth_date: str | None = None
    nationality: str | None = None
    country: str | None = None
    limit: int = Field(default=10, ge=1, le=50)
    min_score: float | None = Field(default=None, ge=0, le=100)


class CustomerRequest(BaseModel):
    name: str = Field(min_length=2, max_length=256)
    kind: Literal["person", "org"] = "person"
    birth_date: str = ""
    nationality: str = ""
    country: str = "in"
    segment: str = "retail"


class UploadRequest(BaseModel):
    csv: str = Field(min_length=1, max_length=2_000_000)
    dry_run: bool = False


class ProposalRequest(BaseModel):
    decision: Literal["confirmed", "discarded"]
    note: str = Field(min_length=10, max_length=2000)


class ReviewRequest(BaseModel):
    approve: bool
    note: str = Field(default="", max_length=2000)


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
        evidence = {"kind": body.kind or "", "birth_date": body.birth_date or "", "nationality": body.nationality or "",
                    "country": (body.country or "").lower()}
        result = core(request).screen(body.name, kind=body.kind, limit=body.limit, min_score=body.min_score, evidence=evidence)
        return screen_dict(result)

    @app.get("/entities")
    def entities(request: Request, q: str = Query("", max_length=200), source: str = "", status: Literal["", "active", "historical"] = "",
                 kind: Literal["", "person", "org"] = "", limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
        return core(request).entities(q=q, source=source, status=status, kind=kind, limit=limit, offset=offset)

    @app.get("/entities/{entity_id}/exposure")
    def exposure(entity_id: str, request: Request):
        found = core(request).exposure(entity_id)
        if not found:
            raise HTTPException(404, f"No watchlist entity with id {entity_id}")
        return found

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
    def customers(request: Request, q: str = "", group: str = "", kind: str = "", limit: int = Query(50, le=2000), offset: int = 0):
        return core(request).customers(q=q, limit=limit, offset=offset, group=group, kind=kind)

    @app.post("/customers")
    def onboard(body: CustomerRequest, request: Request):
        customer, alerts, screening = core(request).onboard(**body.model_dump())
        return {"customer": customer, "alerts": alerts, "screening": screening}

    @app.get("/customers/{customer_id}")
    def customer(customer_id: int, request: Request):
        found = core(request).customer(customer_id)
        if not found:
            raise HTTPException(404, f"No customer {customer_id}")
        return found

    @app.get("/customers/import/template", response_class=Response)
    def import_template():
        from .upload import TEMPLATE

        return Response(TEMPLATE, media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="satark-customers-template.csv"'})

    @app.post("/customers/import")
    def import_customers(body: UploadRequest, request: Request, x_satark_user: str = Header("analyst")):
        return core(request).import_upload(body.csv, actor=x_satark_user, dry_run=body.dry_run)

    @app.post("/customers/rescreen")
    def rescreen(request: Request):
        return core(request).rescreen_all(actor="analyst", trigger="batch")

    @app.get("/alerts")
    def alerts(request: Request, status: str | None = None, limit: int = Query(100, le=500), offset: int = 0):
        return core(request).alerts(status=status, limit=limit, offset=offset)

    def workflow(action, case_id: int):
        try:
            return action()
        except KeyError as exc:
            raise HTTPException(404, f"No case {case_id}") from exc
        except PermissionError as exc:
            raise HTTPException(403, str(exc)) from exc
        except (WorkflowError, AuditConflict) as exc:
            raise HTTPException(409, str(exc)) from exc

    @app.get("/cases")
    def cases(request: Request, status: str | None = None, limit: int = Query(50, le=200), offset: int = 0):
        return core(request).cases(status=status, limit=limit, offset=offset)

    @app.get("/cases/{case_id}")
    def case(case_id: int, request: Request):
        found = core(request).case(case_id)
        if not found:
            raise HTTPException(404, f"No case {case_id}")
        return found

    # ponytail: X-Satark-User is a demo identity header, not authentication.
    @app.post("/cases/{case_id}/proposal")
    def propose(case_id: int, body: ProposalRequest, request: Request, x_satark_user: str = Header(...)):
        return workflow(lambda: core(request).propose(case_id, body.decision, body.note, x_satark_user), case_id)

    @app.post("/cases/{case_id}/review")
    def review(case_id: int, body: ReviewRequest, request: Request, x_satark_user: str = Header(...)):
        return workflow(lambda: core(request).review(case_id, body.approve, body.note, x_satark_user), case_id)

    @app.post("/media/brief")
    def media(body: MediaRequest, request: Request):
        return core(request).media_brief(body.subject, refresh=body.refresh)

    @app.get("/audit")
    def audit(request: Request, limit: int = Query(100, le=500)):
        return core(request).audit_log(limit)

    @app.get("/users")
    def users():
        from .service import ROLES

        return [{"id": user, "role": role} for user, role in ROLES.items()]

    def news_db(request: Request):
        path = core(request).settings.data_dir / "cache" / "news.db"
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @app.get("/news")
    def news(request: Request, limit: int = Query(60, le=500), kind: str = ""):
        from .media.extract import classify
        from .media.feeds import recent

        return [{**item, "category": classify(f"{item['title']} {item['summary']}")} for item in recent(news_db(request), limit=limit, kind=kind)]

    @app.get("/news/search")
    def news_search(request: Request, q: str = Query(min_length=2, max_length=200), limit: int = Query(20, le=100)):
        from dataclasses import asdict as as_dict

        from .media.extract import classify
        from .media.feeds import search

        return [{**as_dict(a), "category": classify(f"{a.title} {a.text}")} for a in search(news_db(request), q, limit)]

    @app.get("/news/feeds")
    def news_feeds(request: Request):
        from .media.feeds import feed_status

        return feed_status(news_db(request))

    @app.post("/news/poll")
    def news_poll(request: Request):
        from .media.feeds import poll

        return poll(news_db(request))

    @app.get("/eval/real")
    def evaluation_real(request: Request):
        from .evaluation import evaluate_real, load_real_cases

        s = core(request)
        return evaluate_real(s.index, load_real_cases(s.settings.data_dir / "eval" / "real_cases.csv"), s.settings.alert_threshold)

    @app.get("/audit/verify")
    def verify_audit(request: Request):
        return core(request).verify_audit()

    @app.get("/eval")
    def evaluation(request: Request):
        path = core(request).settings.reports_dir / "eval.json"
        if not path.exists():
            raise HTTPException(404, "No evaluation report yet. Run `satark eval`.")
        return json.loads(path.read_text())

    return app


app = create_app()
