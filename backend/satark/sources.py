import csv
import gzip
import hashlib
import io
from dataclasses import dataclass
from pathlib import Path

import httpx

from .matcher import Record

OPEN_SANCTIONS_URL = "https://data.opensanctions.org/datasets/latest/{slug}/targets.simple.csv"
SNAPSHOT_COLUMNS = [
    "id", "schema", "name", "aliases", "birth_date", "countries", "sanctions",
    "program_ids", "dataset", "first_seen", "last_change",
]


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
]
SOURCE_BY_KEY = {s.key: s for s in SOURCES}


def entity_key(source: str, raw_id: str) -> str:
    return raw_id if raw_id.startswith(f"{source}:") else f"{source}:{raw_id}"


def row_hash(row: dict) -> str:
    material = "|".join(row.get(k, "") for k in ("name", "aliases", "birth_date", "countries", "sanctions", "schema"))
    return hashlib.sha1(material.encode()).hexdigest()


def parse_rows(text: str) -> list[dict]:
    return [{k: (row.get(k) or "").strip() for k in SNAPSHOT_COLUMNS} for row in csv.DictReader(io.StringIO(text))]


def snapshot_path(data_dir: Path, key: str) -> Path:
    return data_dir / "snapshot" / f"{key}.csv.gz"


def load_snapshot(data_dir: Path, key: str) -> list[dict]:
    with gzip.open(snapshot_path(data_dir, key), "rt", newline="") as handle:
        return parse_rows(handle.read())


def fetch_remote(key: str, timeout: float = 60.0) -> list[dict]:
    response = httpx.get(OPEN_SANCTIONS_URL.format(slug=key), follow_redirects=True, timeout=timeout)
    response.raise_for_status()
    return parse_rows(response.text)


def write_snapshot(data_dir: Path, key: str, rows: list[dict]) -> None:
    path = snapshot_path(data_dir, key)
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=SNAPSHOT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


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
    )
