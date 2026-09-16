"""Real customer book: GLEIF LEI registry, Companies House and NSE's debarment list.

Group A: Indian entities whose LEI is issued by London Stock Exchange LEI Ltd.
Group B: UK companies whose direct or ultimate parent is Indian, enriched from Companies House.
Group C: NSE debarment-list companies that also hold an LEI (matched by legal name).

No synthetic data. Companies House officer/PSC personal data stays under data/cache/
(gitignored); data/book/ holds only the committed, public snapshot.
"""

import csv
import gzip
import hashlib
import io
import json
import re
import time
import zipfile
from pathlib import Path

import httpx

from .sources import entity_key

ROOT = Path(__file__).resolve().parents[2]
GLEIF_CACHE = ROOT / "data" / "cache" / "gleif"
CH_CACHE = ROOT / "data" / "cache" / "companies_house"

GLEIF_API = "https://api.gleif.org/api/v1/lei-records"
LSE_LOU = "213800WAVVOPS85N2205"
GOLDEN_LEI_INDEX = "https://goldencopy.gleif.org/api/v2/golden-copies/publishes/lei2/latest"
GOLDEN_RR_INDEX = "https://goldencopy.gleif.org/api/v2/golden-copies/publishes/rr/latest"
CH_API = "https://api.company-information.service.gov.uk"
CH_RA_CODE = "RA000585"  # UK Companies House, per GLEIF's registration-authority code list
CONSOLIDATION_TYPES = {"IS_DIRECTLY_CONSOLIDATED_BY", "IS_ULTIMATELY_CONSOLIDATED_BY"}
NO_CONTROL_STATEMENTS = {"no-individual-or-entity-with-signficant-control", ""}  # CH's own spelling
COMPANY_SUFFIX_RE = re.compile(r"\b(limited|ltd)\b", re.I)
OFFICER_ID_RE = re.compile(r"^/officers/([^/]+)/appointments$")
PUNCT_RE = re.compile(r"[^\w\s]")

GLEIF_MIN_INTERVAL = 1.05  # ponytail: fixed spacing keeps combined group A+C traffic under GLEIF's 60/min
CH_MIN_INTERVAL = 0.55  # ponytail: fixed spacing keeps traffic under CH's 600/5min
_last_gleif_call = [0.0]


def gleif_url(lei: str) -> str:
    return f"https://search.gleif.org/#/record/{lei}"


def _make_row(*, lei, legal_name, other_names, category, status, reg_status, managing_lou,
              registered_as, jurisdiction, city, country, group, extra=None) -> dict:
    kind = "person" if category == "SOLE_PROPRIETOR" else "org"
    details = {
        "lei": lei, "legal_name": legal_name, "other_names": other_names, "category": category,
        "entity_status": status, "registration_status": reg_status, "managing_lou": managing_lou,
        "registered_as": registered_as, "jurisdiction": jurisdiction, "city": city,
        "direct_parent": None, "ultimate_parent": None, "gleif_url": gleif_url(lei),
    }
    details.update(extra or {})
    return {
        "external_id": f"lei:{lei}", "name": legal_name, "kind": kind, "group": group,
        "country": (country or "").lower(), "birth_date": "", "parent_external_id": None,
        "details": details,
    }


def _row_from_api_record(rec: dict, group: str, extra: dict | None = None) -> dict:
    attrs = rec["attributes"]
    entity = attrs["entity"]
    reg = attrs.get("registration") or {}
    address = entity.get("legalAddress") or {}
    return _make_row(
        lei=attrs["lei"], legal_name=entity["legalName"]["name"],
        other_names=[n["name"] for n in entity.get("otherNames") or []],
        category=entity.get("category") or "", status=entity.get("status") or "",
        reg_status=reg.get("status") or "", managing_lou=reg.get("managingLou") or "",
        registered_as=entity.get("registeredAs") or "", jurisdiction=entity.get("jurisdiction") or "",
        city=address.get("city") or "", country=address.get("country") or "", group=group, extra=extra,
    )


# ---------------------------------------------------------------------------
# GLEIF API (group A, group C lookups)
# ---------------------------------------------------------------------------

def _gleif_get(params: dict) -> dict:
    wait = _last_gleif_call[0] + GLEIF_MIN_INTERVAL - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    _last_gleif_call[0] = time.monotonic()  # spacing counts from request start, so response time isn't added on top
    resp = httpx.get(GLEIF_API, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def build_group_a() -> list[dict]:
    rows, page = [], 1
    while True:
        data = _gleif_get({
            "filter[entity.legalAddress.country]": "IN",
            "filter[registration.managingLou]": LSE_LOU,
            "page[size]": 200,
            "page[number]": page,
        })
        rows.extend(_row_from_api_record(rec, "A") for rec in data["data"])
        pagination = data["meta"]["pagination"]
        if pagination["currentPage"] >= pagination["lastPage"]:
            break
        page += 1
    return rows


# ---------------------------------------------------------------------------
# Group C: NSE debarment list entities that hold an LEI
# ---------------------------------------------------------------------------

def nse_active_company_pairs(rows: list[dict]) -> list[tuple[str, str]]:
    """(entity id, name) for companies on NSE's debarment list with at least one active order, taken from the
    committed snapshot so "active" means exactly what screening uses. No PAN is read or needed.
    ponytail: Ltd/Limited in the name stands in for "is a company"; GLEIF's exact legal-name filter only
    matches registered company names anyway, so partnerships and proprietors without the suffix are skipped."""
    return [(entity_key("in_nse_debarred", r["id"]), r["name"]) for r in rows
            if r.get("status") == "active" and COMPANY_SUFFIX_RE.search(_strip_parenthetical(r["name"]))]


def _normalize_name(name: str) -> str:
    name = PUNCT_RE.sub("", name.casefold())
    name = re.sub(r"\bltd\b", "limited", name)
    name = re.sub(r"\bpvt\b", "private", name)
    return " ".join(name.split())


def _strip_parenthetical(name: str) -> str:
    stripped = re.sub(r"\([^)]*\)", "", name)
    return " ".join(stripped.split()).strip(" .,;:-")


def _match_gleif_by_name(name: str) -> dict | None:
    query = " ".join(name.replace(",", " ").split())  # GLEIF reads commas in a filter value as an OR-list separator
    try:
        data = _gleif_get({"filter[entity.legalName]": query, "filter[entity.legalAddress.country]": "IN"})
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 400:  # an unsearchable name skips one company, not the whole build
            return None
        raise
    target = _normalize_name(name)
    for rec in data["data"]:
        if _normalize_name(rec["attributes"]["entity"]["legalName"]["name"]) == target:
            return rec
    return None


def build_group_c(pairs: list[tuple[str, str]], progress=None) -> list[dict]:
    rows = []
    for i, (list_entity_id, name) in enumerate(pairs, 1):
        if progress and i % 50 == 0:
            progress(f"group C: {i}/{len(pairs)} looked up, {len(rows)} LEI holders so far")
        rec = _match_gleif_by_name(name)
        if rec is None:
            stripped = _strip_parenthetical(name)
            if stripped and stripped != name:
                rec = _match_gleif_by_name(stripped)
        if rec is not None:
            rows.append(_row_from_api_record(rec, "C", {"list_entity_id": list_entity_id}))
    return rows


# ---------------------------------------------------------------------------
# Group B: GLEIF golden copy bulk files + Companies House
# ---------------------------------------------------------------------------

def _download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return dest
    with httpx.stream("GET", url, timeout=600, follow_redirects=True) as resp:
        resp.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in resp.iter_bytes(1 << 20):
                f.write(chunk)
    return dest


def _golden_copy_zip(index_url: str, name: str) -> Path:
    meta = httpx.get(index_url, timeout=30).json()
    csv_meta = meta["data"]["full_file"]["csv"]
    return _download(csv_meta["url"], GLEIF_CACHE / f"{name}.csv.zip")


def _iter_zipped_csv(zip_path: Path):
    with zipfile.ZipFile(zip_path) as zf:
        with zf.open(zf.namelist()[0]) as raw:
            yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8"))


def _load_parent_relationships(rr_zip: Path) -> tuple[dict, dict]:
    """child LEI -> parent LEI, for ACTIVE direct/ultimate consolidation relationships."""
    direct, ultimate = {}, {}
    for row in _iter_zipped_csv(rr_zip):
        if row["Relationship.RelationshipStatus"] != "ACTIVE":
            continue
        rtype = row["Relationship.RelationshipType"]
        if rtype not in CONSOLIDATION_TYPES:
            continue
        child, parent = row["Relationship.StartNode.NodeID"], row["Relationship.EndNode.NodeID"]
        (direct if rtype == "IS_DIRECTLY_CONSOLIDATED_BY" else ultimate)[child] = parent
    return direct, ultimate


def _other_names(row: dict) -> list[str]:
    return [row[f"Entity.OtherEntityNames.OtherEntityName.{i}"] for i in range(1, 6)
            if row.get(f"Entity.OtherEntityNames.OtherEntityName.{i}")]


def _entity_from_csv_row(row: dict) -> dict:
    return {
        "legal_name": row["Entity.LegalName"], "other_names": _other_names(row),
        "category": row.get("Entity.EntityCategory") or "", "status": row.get("Entity.EntityStatus") or "",
        "reg_status": row.get("Registration.RegistrationStatus") or "",
        "managing_lou": row.get("Registration.ManagingLOU") or "",
        "registered_as": row.get("Entity.RegistrationAuthority.RegistrationAuthorityEntityID") or "",
        "jurisdiction": row.get("Entity.LegalJurisdiction") or "", "city": row.get("Entity.LegalAddress.City") or "",
        "country": row.get("Entity.LegalAddress.Country") or "",
        "ra_id": row.get("Entity.RegistrationAuthority.RegistrationAuthorityID") or "",
    }


def _scan_entities(lei_zip: Path, child_candidates: set, parent_candidates: set) -> tuple[dict, dict]:
    """One pass over the ~3.4M-row golden copy: full record for GB children that might
    qualify, name+country only for the (far fewer) referenced parents."""
    gb_entities, parent_info = {}, {}
    for row in _iter_zipped_csv(lei_zip):
        lei = row["LEI"]
        if lei in parent_candidates:
            parent_info[lei] = {"legal_name": row["Entity.LegalName"], "country": row.get("Entity.LegalAddress.Country") or ""}
        if lei in child_candidates and row.get("Entity.LegalAddress.Country") == "GB":
            gb_entities[lei] = _entity_from_csv_row(row)
    return gb_entities, parent_info


def _parent_ref(lei: str | None, info: dict | None) -> dict | None:
    if lei is None or info is None:
        return None
    return {"lei": lei, "name": info["legal_name"], "country": info["country"].lower()}


def _gb_candidates(direct_map: dict, ultimate_map: dict, lei_zip: Path) -> list[tuple[str, dict, dict, dict]]:
    child_candidates = set(direct_map) | set(ultimate_map)
    parent_candidates = set(direct_map.values()) | set(ultimate_map.values())
    gb_entities, parent_info = _scan_entities(lei_zip, child_candidates, parent_candidates)
    out = []
    for lei, entity in gb_entities.items():
        if entity["ra_id"] != CH_RA_CODE or not entity["registered_as"]:
            continue
        dp = _parent_ref(direct_map.get(lei), parent_info.get(direct_map.get(lei)))
        up = _parent_ref(ultimate_map.get(lei), parent_info.get(ultimate_map.get(lei)))
        if (dp and dp["country"] == "in") or (up and up["country"] == "in"):
            out.append((lei, entity, dp, up))
    return out


def _group_b_company_row(lei: str, entity: dict, dp: dict | None, up: dict | None) -> dict:
    extra = {"direct_parent": dp, "ultimate_parent": up, "company_number": entity["registered_as"]}
    return _make_row(
        lei=lei, legal_name=entity["legal_name"], other_names=entity["other_names"], category=entity["category"],
        status=entity["status"], reg_status=entity["reg_status"], managing_lou=entity["managing_lou"],
        registered_as=entity["registered_as"], jurisdiction=entity["jurisdiction"], city=entity["city"],
        country=entity["country"], group="B", extra=extra,
    )


def _public_psc(items: list[dict]) -> list[dict]:
    """PSC list safe for the public book: individual PSCs' names are personal data and stay
    out (kind + natures_of_control only); corporate/legal-person PSC names are company names,
    not personal data, and are kept."""
    out = []
    for p in items:
        kind = p.get("kind", "")
        name = "" if kind.startswith("individual-") else p.get("name", "")
        out.append({"kind": kind, "name": name, "natures_of_control": p.get("natures_of_control", [])})
    return out


def _apply_ch_data(row: dict, bundle: dict, dp: dict | None, up: dict | None) -> dict:
    company = bundle.get("company") or {}
    psc_items = (bundle.get("psc") or {}).get("items", [])
    statements = [s.get("statement", "") for s in (bundle.get("psc_statements") or {}).get("items", [])]
    row["details"]["company_status"] = company.get("company_status", "")
    row["details"]["psc"] = _public_psc(psc_items)
    row["details"]["psc_statements"] = statements
    has_parent = bool(dp or up)
    has_ch_control = bool(psc_items) or any(s not in NO_CONTROL_STATEMENTS for s in statements)
    conflict = has_parent and not has_ch_control
    reason = f"GLEIF names {(dp or up)['name']} as parent but Companies House shows no PSC" if conflict else ""
    row["details"]["ownership_conflict"] = {"conflict": conflict, "reason": reason}
    return row


def _ch_fetch(ch_key: str, path: str) -> dict | None:
    """One throttled, 429-retried Companies House GET. None on 404."""
    while True:
        time.sleep(CH_MIN_INTERVAL)
        resp = httpx.get(f"{CH_API}{path}", auth=(ch_key, ""), timeout=30)
        if resp.status_code == 429:
            time.sleep(float(resp.headers.get("Retry-After", 60)))
            continue
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()


def _ch_company_bundle(ch_key: str, number: str) -> dict:
    """All four Companies House endpoints for one company, cached whole to
    data/cache/companies_house/{n}.json so reruns don't re-fetch."""
    cache_path = CH_CACHE / f"{number}.json"
    if cache_path.exists():
        return json.loads(cache_path.read_text())
    bundle = {
        "company": _ch_fetch(ch_key, f"/company/{number}"),
        "officers": _ch_fetch(ch_key, f"/company/{number}/officers"),
        "psc": _ch_fetch(ch_key, f"/company/{number}/persons-with-significant-control"),
        "psc_statements": _ch_fetch(ch_key, f"/company/{number}/persons-with-significant-control-statements"),
    }
    CH_CACHE.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(bundle))
    return bundle


def _officer_id(item: dict) -> str:
    path = (item.get("links") or {}).get("officer", {}).get("appointments", "")
    m = OFFICER_ID_RE.match(path)
    if m:
        return m.group(1)
    material = item.get("name", "") + json.dumps(item.get("date_of_birth", {}), sort_keys=True)
    return hashlib.sha1(material.encode()).hexdigest()


def _birth_date(item: dict) -> str:
    dob = item.get("date_of_birth") or {}
    if not dob.get("year"):
        return ""
    return f"{dob['year']:04d}-{int(dob.get('month') or 1):02d}"


def _officer_rows(officers: list[dict], parent_external_id: str, company_number: str, company_name: str) -> list[dict]:
    rows = []
    for item in officers:
        if item.get("resigned_on"):  # ponytail: current officers only; add resigned history if a use case needs it
            continue
        rows.append({
            "external_id": f"ch-officer:{_officer_id(item)}", "name": item.get("name", ""),
            # country left blank: a UK directorship says nothing about residence, and a wrong country costs score
            "kind": "person", "group": "B", "country": "", "birth_date": _birth_date(item),
            "parent_external_id": parent_external_id,
            "details": {
                "nationality": item.get("nationality", ""), "occupation": item.get("occupation", ""),
                "appointments": [{"company_number": company_number, "company_name": company_name,
                                  "officer_role": item.get("officer_role", ""), "appointed_on": item.get("appointed_on", "")}],
            },
        })
    return rows


def build_group_b(ch_key: str, limit: int | None = None) -> list[dict]:
    rr_zip = _golden_copy_zip(GOLDEN_RR_INDEX, "rr")
    lei_zip = _golden_copy_zip(GOLDEN_LEI_INDEX, "lei2")
    direct_map, ultimate_map = _load_parent_relationships(rr_zip)
    candidates = _gb_candidates(direct_map, ultimate_map, lei_zip)
    if limit is not None:
        candidates = candidates[:limit]

    rows, officers = [], {}
    for lei, entity, dp, up in candidates:
        row = _group_b_company_row(lei, entity, dp, up)
        bundle = _ch_company_bundle(ch_key, entity["registered_as"])
        row = _apply_ch_data(row, bundle, dp, up)
        rows.append(row)
        for officer in _officer_rows((bundle.get("officers") or {}).get("items", []), row["external_id"],
                                     entity["registered_as"], entity["legal_name"]):
            # Companies House gives one officer id per person, so a director of two subsidiaries is one customer
            # with two appointments, screened and alerted once. The first company becomes the parent link.
            seen = officers.get(officer["external_id"])
            if seen:
                seen["details"]["appointments"] += officer["details"]["appointments"]
            else:
                officers[officer["external_id"]] = officer
    return rows + list(officers.values())


# ---------------------------------------------------------------------------
# Snapshot I/O
# ---------------------------------------------------------------------------

BOOK_FILES = {"A": "group_a.jsonl.gz", "B": "group_b_companies.jsonl.gz", "C": "group_c.jsonl.gz"}


def _is_officer_row(row: dict) -> bool:
    return row["external_id"].startswith("ch-officer:")


def _merge_rows(rows: list[dict]) -> list[dict]:
    """One row per external_id. The first group a row is seen in becomes `group`; every
    group it's seen in is recorded in details.groups."""
    merged: dict[str, dict] = {}
    for row in rows:
        existing = merged.get(row["external_id"])
        if existing is None:
            row = dict(row, details=dict(row["details"]))
            row["details"].setdefault("groups", [row["group"]])
            merged[row["external_id"]] = row
        else:
            groups = existing["details"].setdefault("groups", [existing["group"]])
            if row["group"] not in groups:
                groups.append(row["group"])
    return list(merged.values())


def _write_jsonl_gz(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt") as handle:
        for row in rows:
            handle.write(json.dumps(row, sort_keys=True) + "\n")


def _read_jsonl_gz(path: Path) -> list[dict]:
    with gzip.open(path, "rt") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def write_book(data_dir: Path, rows: list[dict], groups: str = "ABC") -> None:
    """Entity/company rows go to the committed data/book/*.jsonl.gz snapshots for the groups built in this run;
    officer rows (personal data) go to data/cache/, which is gitignored."""
    officer_rows = [r for r in rows if _is_officer_row(r)]
    entity_rows = _merge_rows([r for r in rows if not _is_officer_row(r)])
    by_group: dict[str, list[dict]] = {g: [] for g in groups}
    for row in entity_rows:
        by_group.setdefault(row["group"], []).append(row)
    for group in groups:
        _write_jsonl_gz(data_dir / "book" / BOOK_FILES[group], by_group[group])
    if "B" in groups:
        _write_jsonl_gz(data_dir / "cache" / "officers.jsonl.gz", officer_rows)


def load_book(data_dir: Path) -> list[dict]:
    rows = []
    for filename in BOOK_FILES.values():
        path = data_dir / "book" / filename
        if path.exists():
            rows.extend(_read_jsonl_gz(path))
    officers_path = data_dir / "cache" / "officers.jsonl.gz"
    if officers_path.exists():
        rows.extend(_read_jsonl_gz(officers_path))
    return rows
