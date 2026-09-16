import logging
import random
import threading
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from . import metrics
from .config import Settings, get_settings
from .events import DELTA_STREAM, EventBus, MemoryBus, make_bus
from .matcher import MatchIndex, Record, ScreenResult
from .media.graph import build_media_graph
from .models import Alert, AuditEvent, Customer, IngestRun, MediaEvent, WatchlistEntity, make_session_factory
from .sources import SOURCE_BY_KEY, SOURCES, entity_key, fetch_remote, load_custom_csv, load_snapshot, row_hash, write_snapshot
from .variants import VariantMaker, latin_to_devanagari

log = logging.getLogger("satark")

DEMO_SOURCE = "demo_feed"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def entity_dict(entity: WatchlistEntity) -> dict:
    source = SOURCE_BY_KEY.get(entity.source)
    return {
        "id": entity.id,
        "name": entity.name,
        "aliases": entity.aliases,
        "schema": entity.schema,
        "source": entity.source,
        "source_label": source.label if source else "Demo delta feed",
        "category": source.category if source else "demo",
        "authority": source.authority if source else "Synthetic event for demonstrations",
        "birth_date": entity.birth_date,
        "countries": entity.countries,
        "sanctions": entity.sanctions,
        "program": entity.program,
        "dataset": entity.dataset,
        "first_seen": entity.first_seen,
        "last_change": entity.last_change,
        "active": entity.active,
    }


def alert_dict(alert: Alert, customer: Customer | None, entity: WatchlistEntity | None) -> dict:
    return {
        "id": alert.id,
        "score": alert.score,
        "band": alert.band,
        "matched_name": alert.matched_name,
        "reasons": alert.reasons,
        "components": alert.components,
        "trigger": alert.trigger,
        "status": alert.status,
        "decided_by": alert.decided_by,
        "note": alert.note,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
        "decided_at": alert.decided_at.isoformat() if alert.decided_at else None,
        "customer": customer_dict(customer) if customer else None,
        "entity": entity_dict(entity) if entity else None,
    }


def customer_dict(customer: Customer) -> dict:
    return {
        "id": customer.id,
        "name": customer.name,
        "kind": customer.kind,
        "birth_date": customer.birth_date,
        "country": customer.country,
        "segment": customer.segment,
        "synthetic": customer.synthetic,
        "created_at": customer.created_at.isoformat() if customer.created_at else None,
        "last_screened_at": customer.last_screened_at.isoformat() if customer.last_screened_at else None,
    }


def media_dict(event: MediaEvent) -> dict:
    return {
        "id": event.id, "subject": event.subject, "category": event.category, "headline": event.headline,
        "summary": event.summary, "quote": event.quote, "url": event.url, "publisher": event.publisher,
        "published_at": event.published_at, "verified": event.verified, "checks": event.checks,
        "extractor": event.extractor, "created_at": event.created_at.isoformat() if event.created_at else None,
    }


def screen_dict(result: ScreenResult) -> dict:
    return asdict(result)


class Satark:
    def __init__(self, settings: Settings | None = None, bus: EventBus | None = None):
        self.settings = settings or get_settings()
        self.Session = make_session_factory(self.settings.database_url)
        self.bus = bus or make_bus(self.settings.redis_url)
        self.index = MatchIndex([])
        self.index_built_at: datetime | None = None
        self.lock = threading.RLock()
        if isinstance(self.bus, MemoryBus):
            self.bus.subscribe(DELTA_STREAM, self.handle_delta)

    def audit(self, session, actor: str, action: str, target: str = "", **detail) -> None:
        session.add(AuditEvent(actor=actor, action=action, target=target, detail=detail))

    def rebuild_index(self) -> MatchIndex:
        with self.Session() as session:
            rows = session.scalars(select(WatchlistEntity).where(WatchlistEntity.active.is_(True))).all()
            records = [
                Record(
                    id=r.id, name=r.name, schema=r.schema, dataset=r.dataset, source=r.source, aliases=list(r.aliases or []),
                    birth_date=r.birth_date, countries=r.countries, program=r.program, sanctions=r.sanctions,
                )
                for r in rows
            ]
            counts = dict(session.execute(
                select(WatchlistEntity.source, func.count()).where(WatchlistEntity.active.is_(True)).group_by(WatchlistEntity.source)
            ).all())
        index = MatchIndex(records)
        with self.lock:
            self.index = index
            self.index_built_at = utcnow()
        for source, count in counts.items():
            metrics.ENTITIES.labels(source=source).set(count)
        return index

    def ensure_ready(self, bootstrap: bool = True, wait_seconds: int = 120) -> None:
        deadline = time.monotonic() + wait_seconds
        while True:
            with self.Session() as session:
                existing = session.scalar(select(func.count()).select_from(WatchlistEntity))
            if existing:
                self.rebuild_index()
                return
            if bootstrap:
                try:
                    self.ingest(mode="snapshot", actor="bootstrap")
                    return
                except IntegrityError:
                    log.info("another process loaded the watchlists first; reusing them")
                    continue
            if time.monotonic() > deadline:
                raise RuntimeError("watchlists were never loaded; start the API or run `satark ingest`")
            time.sleep(2)

    def _apply_rows(self, session, source: str, rows: list[dict], mode: str) -> dict:
        existing = {e.id: e for e in session.scalars(select(WatchlistEntity).where(WatchlistEntity.source == source))}
        seen, added, changed = set(), [], []
        for row in rows:
            digest = row_hash(row)
            key = entity_key(source, row["id"])
            seen.add(key)
            entity = existing.get(key)
            values = dict(
                source=source, schema=row["schema"], name=row["name"],
                aliases=[a.strip() for a in row.get("aliases", "").split(";") if a.strip()],
                birth_date=row.get("birth_date", ""), countries=row.get("countries", ""),
                sanctions=row.get("sanctions", ""), program=row.get("program_ids", ""),
                dataset=row.get("dataset", ""), first_seen=row.get("first_seen", ""),
                last_change=row.get("last_change", ""), row_hash=digest, active=True, updated_at=utcnow(),
            )
            if entity is None:
                session.add(WatchlistEntity(id=key, **values))
                added.append(key)
            elif entity.row_hash != digest or not entity.active:
                for key, value in values.items():
                    setattr(entity, key, value)
                changed.append(key)
        removed = [eid for eid, e in existing.items() if eid not in seen and e.active]
        for eid in removed:
            existing[eid].active = False
        session.add(IngestRun(source=source, mode=mode, total=len(rows), added=len(added), changed=len(changed), removed=len(removed)))
        return {"source": source, "total": len(rows), "added": added, "changed": changed, "removed": removed, "initial": not existing}

    def ingest(self, mode: str = "snapshot", sources: list[str] | None = None, actor: str = "system", update_snapshot: bool = False) -> list[dict]:
        keys = sources or [s.key for s in SOURCES]
        summaries = []
        with self.Session() as session:
            for key in keys:
                rows = fetch_remote(key) if mode == "remote" else load_snapshot(self.settings.data_dir, key)
                if mode == "remote" and update_snapshot:
                    write_snapshot(self.settings.data_dir, key, rows)
                summaries.append(self._apply_rows(session, key, rows, mode))
            self.audit(session, actor, "watchlist.ingest", ",".join(keys), mode=mode,
                       summary=[{k: (len(v) if isinstance(v, list) else v) for k, v in s.items()} for s in summaries])
            session.commit()
        self.rebuild_index()
        for summary in summaries:
            ids = summary["added"] + summary["changed"]
            if ids and not summary["initial"]:
                self.bus.publish(DELTA_STREAM, {"entity_ids": ids, "source": summary["source"], "reason": f"{mode} ingest"})
        return [{k: (len(v) if isinstance(v, list) else v) for k, v in s.items()} for s in summaries]

    def ingest_custom(self, path: Path, key: str, actor: str = "system") -> dict:
        rows = load_custom_csv(path, key)
        with self.Session() as session:
            summary = self._apply_rows(session, key, rows, "custom")
            self.audit(session, actor, "watchlist.ingest", key, mode="custom", total=len(rows))
            session.commit()
        self.rebuild_index()
        ids = summary["added"] + summary["changed"]
        if ids:
            self.bus.publish(DELTA_STREAM, {"entity_ids": ids, "source": key, "reason": "custom list"})
        return {k: (len(v) if isinstance(v, list) else v) for k, v in summary.items()}

    def screen(self, name: str, kind: str | None = None, birth_date: str | None = None, country: str | None = None,
               limit: int = 10, min_score: float | None = None, trigger: str = "manual", index: MatchIndex | None = None) -> ScreenResult:
        idx = index or self.index
        with metrics.SCREEN_LATENCY.time():
            result = idx.screen(name, kind=kind, birth_date=birth_date, country=country, limit=limit,
                                min_score=self.settings.min_score if min_score is None else min_score)
        metrics.SCREENINGS.labels(trigger=trigger).inc()
        return result

    def _raise_alerts(self, session, customer: Customer, result: ScreenResult, trigger: str) -> list[Alert]:
        created = []
        open_pairs = set(session.execute(
            select(Alert.entity_id).where(Alert.customer_id == customer.id, Alert.status == "open")
        ).scalars())
        for match in result.matches:
            if match.score < self.settings.alert_threshold or match.entity_id in open_pairs:
                continue
            alert = Alert(
                customer_id=customer.id, entity_id=match.entity_id, score=match.score, band=match.band,
                matched_name=match.matched_name, reasons=match.reasons, components=match.components, trigger=trigger,
            )
            session.add(alert)
            created.append(alert)
            metrics.ALERTS.labels(trigger=trigger, band=match.band).inc()
        customer.last_screened_at = utcnow()
        return created

    def onboard(self, name: str, kind: str = "person", birth_date: str = "", country: str = "in",
                segment: str = "retail", actor: str = "analyst", synthetic: bool = False) -> tuple[dict, list[dict], dict]:
        with self.Session() as session:
            customer = Customer(name=name, kind=kind, birth_date=birth_date, country=country, segment=segment, synthetic=synthetic)
            session.add(customer)
            session.flush()
            result = self.screen(name, kind=kind, birth_date=birth_date, country=country, trigger="onboarding")
            alerts = self._raise_alerts(session, customer, result, "onboarding")
            self.audit(session, actor, "customer.onboard", f"customer:{customer.id}", name=name, alerts=len(alerts))
            session.commit()
            entities = {e.id: e for e in session.scalars(select(WatchlistEntity).where(WatchlistEntity.id.in_([a.entity_id for a in alerts])))}
            return customer_dict(customer), [alert_dict(a, customer, entities.get(a.entity_id)) for a in alerts], screen_dict(result)

    def rescreen_all(self, actor: str = "system", trigger: str = "batch") -> dict:
        created = 0
        with self.Session() as session:
            customers = session.scalars(select(Customer)).all()
            for customer in customers:
                result = self.screen(customer.name, kind=customer.kind, birth_date=customer.birth_date,
                                     country=customer.country, trigger=trigger, limit=5)
                created += len(self._raise_alerts(session, customer, result, trigger))
            self.audit(session, actor, "customers.rescreen", "all", customers=len(customers), alerts=created)
            session.commit()
        return {"customers": len(customers), "alerts": created}

    def handle_delta(self, payload: dict) -> dict:
        ids = payload.get("entity_ids", [])
        if any(i not in self.index.records for i in ids):
            self.rebuild_index()
        subset = self.index.subset(ids)
        created = 0
        with self.Session() as session:
            customers = session.scalars(select(Customer)).all()
            for customer in customers:
                result = self.screen(customer.name, kind=customer.kind, birth_date=customer.birth_date,
                                     country=customer.country, trigger="watchlist_delta", index=subset, limit=5)
                created += len(self._raise_alerts(session, customer, result, "watchlist_delta"))
            self.audit(session, "rescreen-worker", "watchlist.delta.handled", payload.get("source", ""),
                       entities=len(ids), customers=len(customers), alerts=created, bus=self.bus.kind)
            session.commit()
        metrics.DELTAS.inc()
        log.info("delta %s entities → %s alerts", len(ids), created)
        return {"entities": len(ids), "customers": len(customers), "alerts": created}

    def simulate_delta(self, actor: str = "analyst", customer_id: int | None = None, style: str | None = None) -> dict:
        maker = VariantMaker(random.randrange(1_000_000))
        with self.Session() as session:
            query = select(Customer).where(Customer.kind == "person")
            customer = session.get(Customer, customer_id) if customer_id else None
            if customer is None:
                people = session.scalars(query).all()
                if not people:
                    raise ValueError("Seed or onboard customers first")
                customer = random.choice(people)
            style = style or random.choice(["devanagari", "initials", "honorific", "spelling"])
            listed = latin_to_devanagari(customer.name) if style == "devanagari" else maker.apply(customer.name, style)
            listed = listed or customer.name
            count = session.scalar(select(func.count()).select_from(WatchlistEntity).where(WatchlistEntity.source == DEMO_SOURCE)) or 0
            entity_id = f"{DEMO_SOURCE}:demo-{count + 1:04d}-{random.randrange(16**6):06x}"
            row = {"name": listed, "aliases": "", "birth_date": "", "countries": "in", "sanctions": "Demo regulatory order", "schema": "Person"}
            session.add(WatchlistEntity(
                id=entity_id, source=DEMO_SOURCE, schema="Person", name=listed, aliases=[], countries="in",
                sanctions="Synthetic order published by the demo delta feed", program="DEMO", dataset="Demo delta feed",
                first_seen=utcnow().date().isoformat(), last_change=utcnow().isoformat(timespec="seconds"), row_hash=row_hash(row),
            ))
            self.audit(session, actor, "watchlist.simulate_delta", entity_id, listed_name=listed, style=style, seeded_from=f"customer:{customer.id}")
            session.commit()
            customer_name = customer.name
        self.rebuild_index()
        event_id = self.bus.publish(DELTA_STREAM, {"entity_ids": [entity_id], "source": DEMO_SOURCE, "reason": f"simulated {style} listing"})
        return {"entity_id": entity_id, "listed_name": listed, "style": style, "seeded_from": customer_name, "event_id": event_id, "bus": self.bus.kind}

    def decide(self, alert_id: int, decision: str, note: str, actor: str) -> dict:
        if decision not in ("confirmed", "discarded", "escalated"):
            raise ValueError("decision must be confirmed, discarded or escalated")
        with self.Session() as session:
            alert = session.get(Alert, alert_id)
            if alert is None:
                raise KeyError(alert_id)
            previous = alert.status
            alert.status, alert.note, alert.decided_by, alert.decided_at = decision, note, actor, utcnow()
            self.audit(session, actor, "alert.decision", f"alert:{alert_id}", previous=previous, decision=decision, note=note)
            session.commit()
            metrics.DECISIONS.labels(decision=decision).inc()
            return alert_dict(alert, session.get(Customer, alert.customer_id), session.get(WatchlistEntity, alert.entity_id))

    def alerts(self, status: str | None = None, limit: int = 100, offset: int = 0) -> dict:
        with self.Session() as session:
            query = select(Alert).order_by(Alert.created_at.desc(), Alert.score.desc())
            count_query = select(func.count()).select_from(Alert)
            if status:
                query = query.where(Alert.status == status)
                count_query = count_query.where(Alert.status == status)
            rows = session.scalars(query.limit(limit).offset(offset)).all()
            customers = {c.id: c for c in session.scalars(select(Customer).where(Customer.id.in_({a.customer_id for a in rows})))}
            entities = {e.id: e for e in session.scalars(select(WatchlistEntity).where(WatchlistEntity.id.in_({a.entity_id for a in rows})))}
            return {"total": session.scalar(count_query), "items": [alert_dict(a, customers.get(a.customer_id), entities.get(a.entity_id)) for a in rows]}

    def customers(self, q: str = "", limit: int = 50, offset: int = 0) -> dict:
        with self.Session() as session:
            query = select(Customer).order_by(Customer.id.desc())
            count_query = select(func.count()).select_from(Customer)
            if q:
                query = query.where(Customer.name.ilike(f"%{q}%"))
                count_query = count_query.where(Customer.name.ilike(f"%{q}%"))
            rows = session.scalars(query.limit(limit).offset(offset)).all()
            open_counts = dict(session.execute(
                select(Alert.customer_id, func.count()).where(Alert.status == "open", Alert.customer_id.in_([c.id for c in rows])).group_by(Alert.customer_id)
            ).all())
            return {"total": session.scalar(count_query), "items": [{**customer_dict(c), "open_alerts": open_counts.get(c.id, 0)} for c in rows]}

    def entity(self, entity_id: str) -> dict | None:
        with self.Session() as session:
            entity = session.get(WatchlistEntity, entity_id)
            return entity_dict(entity) if entity else None

    def audit_log(self, limit: int = 100) -> list[dict]:
        with self.Session() as session:
            rows = session.scalars(select(AuditEvent).order_by(AuditEvent.at.desc()).limit(limit)).all()
            return [{"id": r.id, "actor": r.actor, "action": r.action, "target": r.target, "detail": r.detail, "at": r.at.isoformat()} for r in rows]

    def watchlists(self) -> list[dict]:
        with self.Session() as session:
            counts = dict(session.execute(
                select(WatchlistEntity.source, func.count()).where(WatchlistEntity.active.is_(True)).group_by(WatchlistEntity.source)
            ).all())
            runs = {}
            for run in session.scalars(select(IngestRun).order_by(IngestRun.at.desc())):
                runs.setdefault(run.source, run)
        items = []
        for source in [*SOURCES, None]:
            key = source.key if source else DEMO_SOURCE
            if source is None and key not in counts:
                continue
            run = runs.get(key)
            items.append({
                "key": key,
                "label": source.label if source else "Demo delta feed",
                "category": source.category if source else "demo",
                "authority": source.authority if source else "Synthetic listings for demos",
                "entities": counts.get(key, 0),
                "last_run": None if run is None else {
                    "mode": run.mode, "total": run.total, "added": run.added, "changed": run.changed,
                    "removed": run.removed, "at": run.at.isoformat(),
                },
            })
        return items

    def media_brief(self, subject: str, refresh: bool = False, actor: str = "analyst", fetcher=None) -> dict:
        subject = subject.strip()
        with self.Session() as session:
            stored = session.scalars(select(MediaEvent).where(MediaEvent.subject == subject).order_by(MediaEvent.created_at.desc())).all()
        if stored and not refresh:
            return {"subject": subject, "cached": True, "extractor": stored[0].extractor, "trace": [], "errors": [],
                    "headlines_read": None, "events": [media_dict(e) for e in stored]}
        kwargs = {"api_key": self.settings.anthropic_api_key, "model": self.settings.llm_model, "max_items": self.settings.media_max_items}
        if fetcher:
            kwargs["fetcher"] = fetcher
        state = build_media_graph(**kwargs).invoke({"subject": subject, "trace": [], "errors": []})
        articles = state.get("articles", [])
        with self.Session() as session:
            for old in session.scalars(select(MediaEvent).where(MediaEvent.subject == subject)):
                session.delete(old)
            rows = []
            for event in state.get("events", []):
                article = articles[event.article_index]
                row = MediaEvent(
                    subject=subject, category=event.category, headline=article.title, summary=event.summary,
                    quote=event.quote, url=article.url, publisher=article.publisher, published_at=article.published,
                    verified=event.verified, checks=event.checks, extractor=state.get("extractor", "none"),
                )
                session.add(row)
                rows.append(row)
                metrics.MEDIA.labels(extractor=row.extractor.split(":")[0], verified=str(event.verified).lower()).inc()
            self.audit(session, actor, "media.brief", subject, headlines=len(articles), events=len(rows),
                       verified=sum(1 for r in rows if r.verified), extractor=state.get("extractor"), errors=state.get("errors", []))
            session.commit()
        rows.sort(key=lambda r: (not r.verified, r.category))
        return {"subject": subject, "cached": False, "extractor": state.get("extractor"), "trace": state.get("trace", []),
                "errors": state.get("errors", []), "headlines_read": len(articles), "events": [media_dict(r) for r in rows]}

    def stats(self) -> dict:
        with self.Session() as session:
            by_status = dict(session.execute(select(Alert.status, func.count()).group_by(Alert.status)).all())
            by_trigger = dict(session.execute(select(Alert.trigger, func.count()).group_by(Alert.trigger)).all())
            customers = session.scalar(select(func.count()).select_from(Customer))
            entities = session.scalar(select(func.count()).select_from(WatchlistEntity).where(WatchlistEntity.active.is_(True)))
        return {
            "entities": entities,
            "indexed_names": len(self.index.names),
            "customers": customers,
            "alerts_by_status": by_status,
            "alerts_by_trigger": by_trigger,
            "alert_threshold": self.settings.alert_threshold,
            "bus": self.bus.kind,
            "stream_lag": self.bus.lag(DELTA_STREAM, "rescreen") if hasattr(self.bus, "lag") else 0,
            "database": self.settings.database_url.split(":", 1)[0],
            "index_built_at": self.index_built_at.isoformat() if self.index_built_at else None,
            "llm_enabled": bool(self.settings.anthropic_api_key),
        }
