import heapq
import math
import re
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Iterable

from rapidfuzz import fuzz, process
from rapidfuzz.distance import JaroWinkler

from .names import NormalizedName, Token, normalize, split_parenthetical

BANDS = ((90, "strong"), (80, "probable"), (70, "possible"))


@dataclass
class Record:
    id: str
    name: str
    schema: str
    dataset: str
    source: str
    aliases: list[str] = field(default_factory=list)
    birth_date: str = ""
    countries: str = ""
    program: str = ""
    sanctions: str = ""
    status: str = "active"


@dataclass
class IndexedName:
    entity_id: str
    display: str
    norm: NormalizedName


@dataclass
class Pair:
    query: str
    listed: str
    how: str
    sim: float


@dataclass
class Match:
    entity_id: str
    entity_name: str
    matched_name: str
    source: str
    dataset: str
    schema: str
    score: float
    band: str
    components: dict
    pairs: list[Pair]
    reasons: list[str]
    status: str = "active"


@dataclass
class ScreenResult:
    query: str
    normalized: str
    kind: str
    notes: list[str]
    matches: list[Match]
    candidates_scored: int
    latency_ms: float


def band_for(score: float) -> str:
    for threshold, label in BANDS:
        if score >= threshold:
            return label
    return "weak"


def years(value: str) -> set[str]:
    return set(re.findall(r"(?:19|20)\d{2}", value or ""))


def token_similarity(q: Token, c: Token) -> tuple[float, str]:
    if q.initial and c.initial:
        return (1.0, "initial") if q.text == c.text else (0.0, "")
    if q.initial:
        return (0.7, "initial") if c.text.startswith(q.text) else (0.0, "")
    if c.initial:
        return (0.7, "initial") if q.text.startswith(c.text) else (0.0, "")
    if q.text == c.text:
        return 1.0, "exact"
    if q.key == c.key:
        return 0.94, "phonetic"
    jw = JaroWinkler.normalized_similarity(q.key, c.key)
    ratio = fuzz.ratio(q.key, c.key) / 100
    if q.key[0] == c.key[0] and jw >= 0.88 and ratio >= 0.84 and min(len(q.key), len(c.key)) >= 4:
        return round(0.9 * min(jw, ratio + 0.05), 3), "spelling"
    return 0.0, ""


class MatchIndex:
    def __init__(self, records: Iterable[Record], stats: tuple[Counter, int] | None = None):
        self.records: dict[str, Record] = {}
        self.names: list[IndexedName] = []
        self.postings: dict[str, set[int]] = defaultdict(set)
        for record in records:
            self._add(record)
        if stats is None:
            self.df = Counter()
            for name in self.names:
                self.df.update(set(name.norm.keys))
            self.total = max(len(self.names), 1)
        else:
            self.df, self.total = stats
        self.vocab = list(self.postings.keys())
        self.max_df = max(50, int(self.total * 0.02))
        weights = [self.weight(k) for k in self.vocab] or [1.0]
        self.initial_weight = 0.5 * sorted(weights)[len(weights) // 2]

    def _add(self, record: Record) -> None:
        self.records[record.id] = record
        seen: set[str] = set()
        variants: list[str] = []
        for raw in [record.name, *record.aliases]:
            base, extras = split_parenthetical(raw)
            variants.extend([base, *extras])
        for variant in variants:
            if not variant.strip():
                continue
            norm = normalize(variant, record.schema)
            if not norm.keys or norm.text in seen:
                continue
            seen.add(norm.text)
            idx = len(self.names)
            self.names.append(IndexedName(record.id, variant, norm))
            for key in set(norm.keys):
                self.postings[key].add(idx)

    def weight(self, key: str) -> float:
        return math.log((self.total + 1) / (self.df.get(key, 0) + 1)) + 1.0

    def subset(self, entity_ids: Iterable[str]) -> "MatchIndex":
        chosen = [self.records[i] for i in entity_ids if i in self.records]
        return MatchIndex(chosen, stats=(self.df, self.total))

    def _token_weight(self, token: Token) -> float:
        return self.initial_weight if token.initial else self.weight(token.key)

    def _weights(self, tokens: list[Token]) -> list[float]:
        weights = [self._token_weight(t) for t in tokens]
        if len(tokens) >= 3:
            weights = [w if i in (0, len(tokens) - 1) else 0.6 * w for i, w in enumerate(weights)]
        return weights

    def _candidates(self, query: NormalizedName, cap: int) -> list[int]:
        full = [t for t in query.tokens if not t.initial]
        scores: dict[int, float] = defaultdict(float)
        rare_exists = any(len(self.postings.get(t.key, ())) <= self.max_df for t in full)
        for token in full:
            keys = {token.key: 1.0}
            if len(token.key) >= 4 and self.vocab:
                for choice, sim, _ in process.extract(
                    token.key, self.vocab, scorer=JaroWinkler.normalized_similarity, score_cutoff=0.88, limit=6
                ):
                    keys.setdefault(choice, sim)
            for key, sim in keys.items():
                posting = self.postings.get(key)
                if not posting or (len(posting) > self.max_df and rare_exists and len(full) > 1):
                    continue
                w = self.weight(key) * sim
                for idx in posting:
                    scores[idx] += w
        return [idx for idx, _ in heapq.nlargest(cap, scores.items(), key=lambda kv: kv[1])]

    def _score_name(self, query: NormalizedName, name: IndexedName) -> tuple[float, dict, list[Pair], list[str]]:
        q_tokens, c_tokens = query.tokens, name.norm.tokens
        options = []
        for i, q in enumerate(q_tokens):
            for j, c in enumerate(c_tokens):
                sim, how = token_similarity(q, c)
                if sim > 0:
                    options.append((sim, i, j, how))
        options.sort(key=lambda o: (-o[0], o[3] == "initial"))
        used_q, used_c, aligned = set(), set(), []
        for sim, i, j, how in options:
            if i in used_q or j in used_c:
                continue
            used_q.add(i)
            used_c.add(j)
            aligned.append((i, j, sim, how))
        q_weights = self._weights(q_tokens)
        c_weights = self._weights(c_tokens)
        q_cov = sum(q_weights[i] * sim for i, _, sim, _ in aligned) / (sum(q_weights) or 1)
        c_cov = sum(c_weights[j] * sim for _, j, sim, _ in aligned) / (sum(c_weights) or 1)
        name_sim = 0.0 if q_cov + c_cov == 0 else 2 * q_cov * c_cov / (q_cov + c_cov)
        token_set = fuzz.token_set_ratio(query.text, name.norm.text) / 100
        score = 100 * (0.85 * name_sim + 0.15 * token_set)
        pairs = [Pair(q_tokens[i].text, c_tokens[j].text, how, sim) for i, j, sim, how in sorted(aligned)]
        reasons = []
        for pair in pairs:
            if pair.how == "exact":
                reasons.append(f"'{pair.query}' matches exactly")
            elif pair.how == "phonetic":
                reasons.append(f"'{pair.query}' sounds like '{pair.listed}'")
            elif pair.how == "initial" and len(pair.query) == 1:
                reasons.append(f"initial '{pair.query.upper()}' fits '{pair.listed}'")
            elif pair.how == "initial":
                reasons.append(f"'{pair.query}' fits listed initial '{pair.listed.upper()}'")
            else:
                reasons.append(f"'{pair.query}' is a spelling variant of '{pair.listed}'")
        order = [j for _, j, _, _ in sorted(aligned)]
        if order != sorted(order):
            reasons.append("name order differs")
        missing_q = [q_tokens[i].text for i in range(len(q_tokens)) if i not in used_q]
        missing_c = [c_tokens[j].text for j in range(len(c_tokens)) if j not in used_c]
        if missing_q:
            reasons.append(f"not on list name: {', '.join(missing_q)}")
        if missing_c:
            reasons.append(f"list name also has: {', '.join(missing_c)}")
        reasons.extend(f"list name {note}" for note in name.norm.notes if "honorific" in note or "suffix" in note)
        components = {
            "name_similarity": round(name_sim, 3),
            "token_set": round(token_set, 3),
            "query_coverage": round(q_cov, 3),
            "list_coverage": round(c_cov, 3),
        }
        return score, components, pairs, reasons

    def screen(
        self,
        query: str,
        kind: str | None = None,
        birth_date: str | None = None,
        country: str | None = None,
        limit: int = 10,
        min_score: float = 70.0,
        candidate_cap: int = 400,
    ) -> ScreenResult:
        started = time.perf_counter()
        norm = normalize(query)
        if kind in ("person", "org"):
            norm.kind = kind
        best: dict[str, Match] = {}
        candidates = self._candidates(norm, candidate_cap) if norm.keys else []
        for idx in candidates:
            name = self.names[idx]
            record = self.records[name.entity_id]
            score, components, pairs, reasons = self._score_name(norm, name)
            if name.norm.kind != norm.kind:
                score *= 0.85
                reasons.append(f"entity type differs ({name.norm.kind} on list)")
            query_years, list_years = years(birth_date or ""), years(record.birth_date)
            if query_years and list_years:
                if query_years & list_years:
                    score = min(100.0, score + 4)
                    reasons.append("birth year matches")
                else:
                    score *= 0.75
                    reasons.append("birth year differs")
            if country and record.countries and country.lower() not in record.countries.lower().split(";"):
                score *= 0.95
                reasons.append("country differs")
            score = round(score, 1)
            current = best.get(record.id)
            if score >= min_score and (current is None or score > current.score):
                best[record.id] = Match(
                    entity_id=record.id,
                    entity_name=record.name,
                    matched_name=name.display,
                    source=record.source,
                    dataset=record.dataset,
                    schema=record.schema,
                    score=score,
                    band=band_for(score),
                    components=components,
                    pairs=pairs,
                    reasons=reasons,
                    status=record.status,
                )
        matches = sorted(best.values(), key=lambda m: -m.score)[:limit]
        return ScreenResult(
            query=query,
            normalized=norm.text,
            kind=norm.kind,
            notes=norm.notes,
            matches=matches,
            candidates_scored=len(candidates),
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
        )
