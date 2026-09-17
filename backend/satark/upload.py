"""Parse an uploaded customer file (CSV) into book rows that `Satark.import_book` understands.

Headers are matched loosely (name / full_name, date_of_birth / dob ...). A row with a problem is rejected with a
reason rather than guessed at, so an analyst can fix the file and upload it again. Re-uploading the same customer
(same customer_id, or same name and date of birth) updates it instead of creating a duplicate.
"""

import csv
import hashlib
import io
import re

MAX_ROWS = 2000
GROUP = "D"  # the book's fourth group: customers the analyst uploaded

HEADERS = {
    "name": ("name", "full_name", "customer_name", "legal_name", "company_name"),
    "kind": ("kind", "type", "entity_type", "customer_type"),
    "birth_date": ("date_of_birth", "birth_date", "dob", "incorporation_date"),
    "nationality": ("nationality", "citizenship"),
    "country": ("country", "country_code", "jurisdiction"),
    "customer_id": ("customer_id", "id", "external_id", "reference", "ref"),
}
PERSON = {"person", "individual", "natural", "natural_person", "p"}
ORG = {"org", "organisation", "organization", "company", "entity", "legal_entity", "business", "o"}

TEMPLATE = "customer_id,name,kind,date_of_birth,nationality,country\nC-1001,\"SHARMA, Priya\",person,1984-06-12,Indian,IN\nC-1002,Acme Exports Private Limited,org,,,IN\n"


def _key(header: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", header.strip().lower()).strip("_")


def _date(value: str) -> str | None:
    """YYYY, YYYY-MM or YYYY-MM-DD; DD/MM/YYYY and DD-MM-YYYY are converted. None means unreadable."""
    value = value.strip()
    if not value:
        return ""
    if re.fullmatch(r"\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?", value):
        return value
    m = re.fullmatch(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", value)
    if m and 1 <= int(m[1]) <= 31 and 1 <= int(m[2]) <= 12:
        return f"{m[3]}-{int(m[2]):02d}-{int(m[1]):02d}"
    return None


def parse_customer_csv(text: str) -> tuple[list[dict], list[dict]]:
    """Returns (rows, errors). Each error is {"line": n, "name": ..., "reason": ...}; line numbers count the header as 1."""
    reader = csv.reader(io.StringIO(text.lstrip("﻿")))
    try:
        header = next(reader)
    except StopIteration:
        return [], [{"line": 1, "name": "", "reason": "The file is empty."}]
    columns = {}
    for index, raw in enumerate(header):
        for field, aliases in HEADERS.items():
            if _key(raw) in aliases and field not in columns:
                columns[field] = index
    if "name" not in columns:
        return [], [{"line": 1, "name": "", "reason": "No name column. Add a header called name (see the template)."}]

    rows, errors, seen = [], [], set()
    for line, record in enumerate(reader, start=2):
        if not any(cell.strip() for cell in record):
            continue
        get = lambda field: record[columns[field]].strip() if field in columns and columns[field] < len(record) else ""  # noqa: E731
        name = " ".join(get("name").split())
        if len(rows) >= MAX_ROWS:
            errors.append({"line": line, "name": name, "reason": f"Over the {MAX_ROWS}-row limit for one upload."})
            continue
        if len(name) < 2:
            errors.append({"line": line, "name": name, "reason": "Name is missing or too short."})
            continue
        if len(name) > 256:
            errors.append({"line": line, "name": name[:60], "reason": "Name is longer than 256 characters."})
            continue
        kind_raw = get("kind").lower().replace(" ", "_")
        kind = "person" if not kind_raw or kind_raw in PERSON else "org" if kind_raw in ORG else None
        if kind is None:
            errors.append({"line": line, "name": name, "reason": f"Kind '{get('kind')}' isn't person or org."})
            continue
        birth_date = _date(get("birth_date"))
        if birth_date is None:
            errors.append({"line": line, "name": name, "reason": f"Date '{get('birth_date')}' isn't YYYY, YYYY-MM, YYYY-MM-DD or DD/MM/YYYY."})
            continue
        country = get("country").lower()
        if country and not re.fullmatch(r"[a-z]{2}", country):
            errors.append({"line": line, "name": name, "reason": f"Country '{get('country')}' isn't a two-letter code such as IN or GB."})
            continue
        customer_id = get("customer_id")
        fingerprint = customer_id or hashlib.sha1(f"{name.lower()}|{birth_date}".encode()).hexdigest()[:12]
        external_id = f"upload:{fingerprint}"
        if external_id in seen:
            errors.append({"line": line, "name": name, "reason": "Duplicate of an earlier row in this file."})
            continue
        seen.add(external_id)
        details = {"source": "upload", **({"customer_id": customer_id} if customer_id else {}),
                   **({"nationality": get("nationality")} if get("nationality") else {})}
        rows.append({"external_id": external_id, "name": name, "kind": kind, "group": GROUP, "country": country,
                     "birth_date": birth_date, "parent_external_id": None, "details": details, "line": line})
    return rows, errors
