import csv
import gzip
import hashlib
import json
import re
from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import httpx

from .matcher import Record

FTM_URL = "https://data.opensanctions.org/datasets/latest/{slug}/entities.ftm.json"
TARGET_SCHEMAS = {"Person", "Organization", "Company", "LegalEntity", "PublicBody"}
DURATION_RE = re.compile(r"(\d+)\s*(year|month)", re.I)
PEP_HORIZON_DAYS = 365  # ponytail: UK FCA FG17/6 - treat a former PEP as current for 12 months after leaving office
LIST_CAP = 25  # ponytail: real data tops out at 16 orders / 6 terms per entity; this is just a safety net


@dataclass(frozen=True)
class Source:
    key: str
    label: str
    category: str
    authority: str


SOURCES = [
    Source("in_nse_debarred", "NSE debarred entities", "regulatory", "National Stock Exchange of India / SEBI orders"),
    Source("in_sansad", "Lok Sabha & Rajya Sabha members", "pep", "Parliament of India"),
    Source("in_mha_banned", "MHA banned organisations & individuals", "terrorism", "Ministry of Home Affairs (UAPA)"),
    Source("un_sc_sanctions", "UN Security Council sanctions", "sanctions", "United Nations Security Council"),
    Source("gb_fcdo_sanctions", "UK Sanctions List", "sanctions", "UK Foreign, Commonwealth & Development Office"),
]
SOURCE_BY_KEY = {s.key: s for s in SOURCES}


def entity_key(source: str, raw_id: str) -> str:
    return raw_id if raw_id.startswith(f"{source}:") else f"{source}:{raw_id}"


def row_hash(row: dict) -> str:
    material = "|".join(row.get(k, "") for k in ("name", "aliases", "birth_date", "countries", "sanctions", "schema", "status"))
    material += "|" + json.dumps(row.get("details") or {}, sort_keys=True)
    return hashlib.sha1(material.encode()).hexdigest()


# --- FollowTheMoney entity parsing -----------------------------------------

def _prop(props: dict, key: str) -> str:
    values = props.get(key) or []
    return (values[0] or "").strip() if values else ""


def _prop_list(props: dict, keys: tuple) -> list:
    out, seen = [], set()
    for key in keys:
        for v in props.get(key) or []:
            v = (v or "").strip()
            if v and v not in seen:
                seen.add(v)
                out.append(v)
    return out


def _parse_date(text: str) -> date | None:
    for fmt in ("%Y-%m-%d", "%Y-%m"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _add_months(start: date, months: int) -> date:
    total = start.month - 1 + months
    year = start.year + total // 12
    month = total % 12 + 1
    return date(year, month, min(start.day, monthrange(year, month)[1]))


def _duration_end(order_date: str, duration: str) -> date | None:
    start = _parse_date(order_date)
    if not start:
        return None
    pairs = DURATION_RE.findall(duration)
    if pairs:
        months = sum(int(n) * (12 if unit.lower().startswith("year") else 1) for n, unit in pairs)
        return _add_months(start, months)
    if duration.strip().isdigit():
        # ponytail: bare NSE duration numbers are months (verified: "24" pairs with "period of two years" in the order text)
        return _add_months(start, int(duration.strip()))
    return None


def _order_status(order_date: str, end_date: str, duration: str, description: str, today: date) -> str:
    if "revok" in f"{duration} {description}".lower():
        return "revoked"
    if "complete" in duration.lower():
        return "expired"
    end = _parse_date(end_date)
    if end:
        return "expired" if end < today else "active"
    computed = _duration_end(order_date, duration)
    if computed and computed < today:
        return "expired"
    return "active"


def _pick_url(urls: list) -> str:
    for u in urls:
        if u.lower().endswith(".pdf"):
            return u
    return urls[0] if urls else ""


def _build_order(props: dict, today: date) -> dict:
    order_date = _prop(props, "date") or _prop(props, "listingDate") or _prop(props, "startDate")
    end_date = _prop(props, "endDate")
    duration = _prop(props, "duration")
    description = _prop(props, "description") or _prop(props, "reason")
    status = _order_status(order_date, end_date, duration, description, today)
    order = {
        "date": order_date, "end_date": end_date, "authority": " ".join(props.get("authority") or []),
        "duration": duration, "description": description[:200], "source_url": _pick_url(props.get("sourceUrl") or []),
        "program": _prop(props, "program"), "status": status,
    }
    return {k: v for k, v in order.items() if v}


def _entity_status(orders: list) -> str:
    if not orders:
        return "active"
    return "active" if any(o.get("status") == "active" for o in orders) else "historical"


def _pep_status(terms: list, today: date) -> str:
    if not terms:
        return "active"
    for term in terms:
        end = _parse_date(term.get("end", ""))
        if not end or (today - end).days <= PEP_HORIZON_DAYS:
            return "active"
    return "historical"


def parse_ftm(lines, key: str, today: date | None = None) -> list[dict]:
    today = today or date.today()
    entities = [json.loads(line) for line in lines if line and line.strip()]

    referents, names = {}, {}
    for e in entities:
        props = e.get("properties") or {}
        names[e["id"]] = e.get("caption") or _prop(props, "name") or e["id"]
        for r in e.get("referents") or []:
            referents[r] = e["id"]

    def resolve(raw_id: str) -> str:
        return referents.get(raw_id, raw_id)

    orders_by, terms_by, relatives_by = {}, {}, {}
    for e in entities:
        props = e.get("properties") or {}
        schema = e["schema"]
        if schema == "Sanction":
            eid = resolve(_prop(props, "entity"))
            if eid:
                orders_by.setdefault(eid, []).append(_build_order(props, today))
        elif schema == "Occupancy":
            holder = resolve(_prop(props, "holder"))
            if holder:
                post_id = resolve(_prop(props, "post"))
                term = {"post": names.get(post_id, post_id), "start": _prop(props, "startDate"),
                         "end": _prop(props, "endDate"), "status": _prop(props, "status")}
                terms_by.setdefault(holder, []).append({k: v for k, v in term.items() if v})
        elif schema == "Family":
            person = resolve(_prop(props, "person"))
            relative_name = names.get(resolve(_prop(props, "relative")), "")
            if person and relative_name:
                relatives_by.setdefault(person, []).append(
                    {"name": relative_name, "relationship": _prop(props, "relationship")})

    rows = []
    for e in entities:
        if not e.get("target") or e["schema"] not in TARGET_SCHEMAS:
            continue
        props = e.get("properties") or {}
        eid = e["id"]
        primary = e.get("caption") or _prop(props, "name")
        aliases = [a for a in _prop_list(props, ("name", "alias", "weakAlias", "previousName")) if a != primary][:LIST_CAP]
        orders = orders_by.get(eid, [])[:LIST_CAP]
        terms = terms_by.get(eid, [])[:LIST_CAP]
        relatives = relatives_by.get(eid, [])[:LIST_CAP]
        details = {k: v for k, v in (("orders", orders), ("terms", terms), ("relatives", relatives)) if v}
        status = _pep_status(terms, today) if key == "in_sansad" else _entity_status(orders)
        programs = sorted({o["program"] for o in orders if o.get("program")})
        rows.append({
            "id": eid, "schema": e["schema"], "name": primary, "aliases": ";".join(aliases),
            "birth_date": _prop(props, "birthDate"), "countries": ";".join(_prop_list(props, ("country", "jurisdiction"))),
            "sanctions": ";".join(sorted(set(props.get("topics") or []))), "program_ids": ";".join(programs),
            "dataset": key, "first_seen": (e.get("first_seen") or "")[:10], "last_change": e.get("last_change") or "",
            "status": status, "details": details,
        })
    return rows


# --- fetch / snapshot --------------------------------------------------------

def snapshot_path(data_dir: Path, key: str) -> Path:
    return data_dir / "snapshot" / f"{key}.jsonl.gz"


def load_snapshot(data_dir: Path, key: str) -> list[dict]:
    with gzip.open(snapshot_path(data_dir, key), "rt", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def write_snapshot(data_dir: Path, key: str, rows: list[dict]) -> None:
    path = snapshot_path(data_dir, key)
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def fetch_remote(key: str, timeout: float = 120.0) -> list[dict]:
    lines = []
    with httpx.stream("GET", FTM_URL.format(slug=key), follow_redirects=True, timeout=timeout) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            if line:
                lines.append(line)
    return parse_ftm(lines, key)


def load_custom_csv(path: Path, key: str) -> list[dict]:
    rows = []
    with open(path, newline="", encoding="utf-8") as handle:
        for i, row in enumerate(csv.DictReader(handle)):
            name = (row.get("name") or "").strip()
            if not name:
                continue
            rows.append({
                "id": row.get("id") or f"{key}-{i + 1}",
                "schema": row.get("schema") or "LegalEntity",
                "name": name,
                "aliases": row.get("aliases", ""),
                "birth_date": row.get("birth_date", ""),
                "countries": row.get("countries", ""),
                "sanctions": row.get("sanctions", ""),
                "program_ids": row.get("program_ids", ""),
                "dataset": row.get("dataset") or key,
                "first_seen": "",
                "last_change": "",
                "status": "active",
                "details": {},
            })
    return rows


def to_record(row: dict, source: str) -> Record:
    return Record(
        id=entity_key(source, row["id"]),
        name=row["name"],
        schema=row["schema"],
        dataset=row["dataset"],
        source=source,
        aliases=[a.strip() for a in row.get("aliases", "").split(";") if a.strip()],
        birth_date=row.get("birth_date", ""),
        countries=row.get("countries", ""),
        program=row.get("program_ids", ""),
        sanctions=row.get("sanctions", ""),
        status=row.get("status", "active"),
    )
