import json
import random
import re
import statistics
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from rapidfuzz import fuzz, process

from .matcher import MatchIndex, Record
from .names import normalize
from .variants import TRANSFORMS, VariantMaker


@dataclass
class Case:
    query: str
    target: str | None
    kind: str
    transform: str
    base: str


def plain(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", text.lower())).strip()


class ExactBaseline:
    name = "exact"

    def __init__(self, index: MatchIndex):
        self.lookup: dict[str, set[str]] = defaultdict(set)
        for record in index.records.values():
            for raw in [record.name, *record.aliases]:
                self.lookup[plain(raw)].add(record.id)

    def search(self, query: str) -> list[tuple[str, float]]:
        return [(entity_id, 100.0) for entity_id in self.lookup.get(plain(query), ())]


class FuzzyBaseline:
    name = "rapidfuzz"

    def __init__(self, index: MatchIndex):
        self.choices: list[str] = []
        self.owners: list[str] = []
        for record in index.records.values():
            for raw in {plain(n) for n in [record.name, *record.aliases]}:
                self.choices.append(raw)
                self.owners.append(record.id)

    def search(self, query: str) -> list[tuple[str, float]]:
        best: dict[str, float] = {}
        for _, score, idx in process.extract(plain(query), self.choices, scorer=fuzz.token_sort_ratio, limit=10, score_cutoff=50):
            owner = self.owners[idx]
            best[owner] = max(best.get(owner, 0.0), score)
        return sorted(best.items(), key=lambda kv: -kv[1])


class SatarkSystem:
    name = "satark"

    def __init__(self, index: MatchIndex):
        self.index = index
        self.latencies: list[float] = []

    def search(self, query: str) -> list[tuple[str, float]]:
        result = self.index.screen(query, limit=10, min_score=40)
        self.latencies.append(result.latency_ms)
        return [(m.entity_id, m.score) for m in result.matches]


def eligible_people(index: MatchIndex) -> list[Record]:
    people = []
    for record in index.records.values():
        norm = normalize(record.name, record.schema)
        if norm.kind != "person" or len(norm.keys) < 2 or len(norm.keys) > 4:
            continue
        if any(len(k) < 3 for k in norm.keys):
            continue
        people.append(record)
    return people


def clean_display(name: str) -> str:
    norm = normalize(name)
    return " ".join(t.text.capitalize() for t in norm.tokens if not t.initial)


def build_cases(index: MatchIndex, positives: int, negatives: int, seed: int) -> list[Case]:
    rng = random.Random(seed)
    maker = VariantMaker(seed)
    people = eligible_people(index)
    rng.shuffle(people)
    known = {tuple(n.norm.keys) for n in index.names}
    cases: list[Case] = []
    per_transform = max(1, positives // len(TRANSFORMS))
    pool = iter(people)
    for transform in TRANSFORMS:
        made = 0
        while made < per_transform:
            record = next(pool, None)
            if record is None:
                break
            base = clean_display(record.name)
            variant = maker.apply(base, transform)
            if not variant:
                continue
            cases.append(Case(variant, record.id, "positive", transform, base))
            made += 1
    half = negatives // 2
    attempts = 0
    while sum(1 for c in cases if c.transform == "random_person") < half and attempts < negatives * 20:
        attempts += 1
        name = maker.random_person()
        if tuple(normalize(name).keys) in known:
            continue
        cases.append(Case(name, None, "negative", "random_person", name))
    attempts = 0
    while sum(1 for c in cases if c.transform == "surname_swap") < negatives - half and attempts < negatives * 20:
        attempts += 1
        record = rng.choice(people)
        parts = clean_display(record.name).split()
        surname = maker.surname()
        if normalize(surname).keys == normalize(parts[-1]).keys:
            continue
        name = " ".join([*parts[:-1], surname])
        if tuple(normalize(name).keys) in known:
            continue
        cases.append(Case(name, None, "negative", "surname_swap", clean_display(record.name)))
    return cases


def run_system(system, cases: list[Case]) -> list[list[tuple[str, float]]]:
    return [system.search(case.query) for case in cases]


def metrics_at(cases: list[Case], outputs: list[list[tuple[str, float]]], threshold: float) -> dict:
    tp = fn = fp = tn = top1 = 0
    wrong_hits = 0
    for case, results in zip(cases, outputs):
        above = [(eid, s) for eid, s in results if s >= threshold]
        if case.kind == "positive":
            if any(eid == case.target for eid, _ in above):
                tp += 1
                if above and max(above, key=lambda kv: kv[1])[0] == case.target:
                    top1 += 1
            else:
                fn += 1
            if any(eid != case.target for eid, _ in above):
                wrong_hits += 1
        else:
            if above:
                fp += 1
            else:
                tn += 1
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "threshold": threshold,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "false_positive_rate": round(fp / (fp + tn), 4) if fp + tn else 0.0,
        "top1_accuracy": round(top1 / (tp + fn), 4) if tp + fn else 0.0,
        "extra_hits_on_positives": round(wrong_hits / (tp + fn), 4) if tp + fn else 0.0,
        "tp": tp, "fn": fn, "fp": fp, "tn": tn,
    }


def per_transform_recall(cases: list[Case], outputs, threshold: float) -> dict:
    buckets: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for case, results in zip(cases, outputs):
        hit = any(eid == case.target and s >= threshold for eid, s in results) if case.kind == "positive" else not any(s >= threshold for _, s in results)
        buckets[case.transform][0] += int(hit)
        buckets[case.transform][1] += 1
    return {k: round(v[0] / v[1], 4) for k, v in sorted(buckets.items())}


def evaluate(index: MatchIndex, positives: int = 1000, negatives: int = 1000, seed: int = 7) -> dict:
    started = time.time()
    cases = build_cases(index, positives, negatives, seed)
    rng = random.Random(seed + 1)
    order = list(range(len(cases)))
    rng.shuffle(order)
    split = len(order) // 2
    dev_ids, test_ids = set(order[:split]), set(order[split:])
    systems = [ExactBaseline(index), FuzzyBaseline(index), SatarkSystem(index)]
    report_systems = {}
    sweeps = {}
    misses = []
    for system in systems:
        outputs = run_system(system, cases)
        dev_cases = [c for i, c in enumerate(cases) if i in dev_ids]
        dev_out = [o for i, o in enumerate(outputs) if i in dev_ids]
        test_cases = [c for i, c in enumerate(cases) if i in test_ids]
        test_out = [o for i, o in enumerate(outputs) if i in test_ids]
        grid = [100.0] if system.name == "exact" else [float(t) for t in range(50, 100)]
        dev_curve = [metrics_at(dev_cases, dev_out, t) for t in grid]
        best = max(dev_curve, key=lambda m: (round(m["f1"], 3), -m["threshold"]))
        test = metrics_at(test_cases, test_out, best["threshold"])
        test["per_transform"] = per_transform_recall(test_cases, test_out, best["threshold"])
        report_systems[system.name] = test
        sweeps[system.name] = [
            {k: m[k] for k in ("threshold", "precision", "recall", "f1")} for m in (metrics_at(test_cases, test_out, t) for t in grid)
        ]
        if system.name == "satark":
            latencies = sorted(system.latencies)
            test["latency_ms"] = {
                "p50": round(statistics.median(latencies), 2),
                "p95": round(latencies[int(len(latencies) * 0.95) - 1], 2),
                "max": round(latencies[-1], 2),
            }
            for case, results in zip(test_cases, test_out):
                hit = any(eid == case.target and s >= best["threshold"] for eid, s in results)
                if case.kind == "positive" and not hit and len(misses) < 15:
                    top = results[0] if results else None
                    misses.append({"query": case.query, "expected": case.base, "transform": case.transform, "top_score": top[1] if top else None})
    counts = defaultdict(int)
    for case in cases:
        counts[f"{case.kind}:{case.transform}"] += 1
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seed": seed,
        "watchlist_entities": len(index.records),
        "indexed_names": len(index.names),
        "cases": {"total": len(cases), "dev": len(dev_ids), "test": len(test_ids), "by_type": dict(sorted(counts.items()))},
        "method": "Each system gets its own threshold: best F1 on the dev half (ties go to the lower threshold). All numbers are from the held-out test half.",
        "systems": report_systems,
        "sweeps": sweeps,
        "satark_misses": misses,
        "seconds": round(time.time() - started, 1),
    }


def write_report(report: dict, reports_dir: Path) -> Path:
    reports_dir.mkdir(parents=True, exist_ok=True)
    path = reports_dir / "eval.json"
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    return path


def format_table(report: dict) -> str:
    lines = [f"{'system':<10} {'thr':>5} {'prec':>6} {'recall':>7} {'f1':>6} {'fpr':>6} {'top1':>6}"]
    for name, m in report["systems"].items():
        lines.append(
            f"{name:<10} {m['threshold']:>5.0f} {m['precision']:>6.3f} {m['recall']:>7.3f} {m['f1']:>6.3f} {m['false_positive_rate']:>6.3f} {m['top1_accuracy']:>6.3f}"
        )
    return "\n".join(lines)
