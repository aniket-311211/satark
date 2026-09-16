import re
import unicodedata
from dataclasses import dataclass, field

HONORIFICS = {
    "mr", "mrs", "ms", "miss", "mister", "smt", "shrimati", "srimati", "kumari", "kum", "km",
    "dr", "prof", "late", "adv", "advocate", "er", "capt", "col", "lt", "gen", "maj",
    "justice", "hon", "honble", "sir", "sh", "janab", "sardar", "thiru", "tmt", "selvi",
}
LEADING_HONORIFICS = {"shri", "shree", "sri", "sree"}
RELATION_MARKERS = {"s/o", "d/o", "w/o", "c/o", "h/o", "so", "do", "wo"}
RELATION_PHRASES = ("son of", "daughter of", "wife of", "husband of", "care of")
ORG_WORDS = {
    "ltd", "limited", "pvt", "private", "llp", "inc", "corp", "corporation", "company", "co",
    "enterprises", "industries", "securities", "finance", "financial", "capital", "traders",
    "trading", "investments", "investment", "holdings", "agency", "agencies", "associates",
    "exports", "impex", "infra", "infrastructure", "projects", "ventures", "consultants",
    "services", "solutions", "technologies", "group", "bank", "trust", "foundation", "front",
    "organisation", "organization", "army", "movement", "party", "council", "brokers",
    "broking", "stock", "shares", "fund", "mutual", "commodities", "realty", "developers", "huf",
}
ORG_NOISE = {"ltd", "limited", "pvt", "private", "llp", "inc", "corp", "co", "the", "and", "of", "m/s", "ms", "huf"}
CANONICAL = {
    **dict.fromkeys(["mohd", "md", "mohammed", "muhammad", "mohamed", "mohammad", "muhammed", "mohamad"], "mohammad"),
    **dict.fromkeys(["syed", "sayed", "saiyed", "sayyed", "saiyad"], "syed"),
    **dict.fromkeys(["sheikh", "shaikh", "shaik", "shekh"], "shaikh"),
    **dict.fromkeys(["kr", "kumaar"], "kumar"),
    **dict.fromkeys(["pd", "prashad", "parsad"], "prasad"),
    **dict.fromkeys(["chandr"], "chandra"),
    **dict.fromkeys(["raav"], "rao"),
}
GUJARATI_SUFFIXES = ("bhai", "ben")

DEVANAGARI_CONSONANTS = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "chh", "ज": "j",
    "झ": "jh", "ञ": "n", "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t",
    "थ": "th", "द": "d", "ध": "dh", "न": "n", "प": "p", "फ": "ph", "ब": "b", "भ": "bh",
    "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh", "ष": "sh", "स": "s", "ह": "h",
}
NUKTA_FORMS = {"ड": "r", "ढ": "rh", "फ": "f", "ज": "z", "क": "q", "ग": "g", "ख": "kh"}
DEVANAGARI_VOWELS = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ऋ": "ri", "ए": "e",
    "ऐ": "ai", "ओ": "o", "औ": "au",
}
DEVANAGARI_MATRAS = {
    "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri", "े": "e", "ै": "ai",
    "ो": "o", "ौ": "au",
}
VIRAMA, NUKTA, ANUSVARA, CHANDRABINDU, VISARGA = "्", "़", "ं", "ँ", "ः"
LABIALS = ("p", "b", "m")

PHONETIC_RULES = [
    ("ksh", "ks"), ("x", "ks"), ("shh", "s"), ("sch", "s"), ("sh", "s"), ("chh", "c"),
    ("ch", "c"), ("ph", "f"), ("bh", "b"), ("dh", "d"), ("th", "t"), ("kh", "k"), ("gh", "g"),
    ("jh", "j"), ("q", "k"), ("ck", "k"), ("w", "v"), ("z", "j"), ("ee", "i"), ("ii", "i"),
    ("iy", "i"), ("oo", "u"), ("uu", "u"), ("aa", "a"), ("au", "o"), ("ou", "o"), ("ei", "e"),
    ("ai", "e"), ("ay", "e"),
]


@dataclass
class Syllable:
    consonant: str | None
    vowel: str
    kind: str
    nasal: bool = False
    after_virama: bool = False


def has_devanagari(text: str) -> bool:
    return any("ऀ" <= ch <= "ॿ" for ch in text)


def _syllables(word: str) -> list[Syllable]:
    units: list[Syllable] = []
    chars = list(word)
    i = 0
    after_virama = False
    while i < len(chars):
        ch = chars[i]
        if ch in DEVANAGARI_CONSONANTS:
            roman = DEVANAGARI_CONSONANTS[ch]
            if i + 1 < len(chars) and chars[i + 1] == NUKTA:
                roman = NUKTA_FORMS.get(ch, roman)
                i += 1
            units.append(Syllable(roman, "a", "inherent", after_virama=after_virama))
            after_virama = False
        elif ch in DEVANAGARI_MATRAS and units:
            units[-1].vowel, units[-1].kind = DEVANAGARI_MATRAS[ch], "matra"
        elif ch == VIRAMA and units:
            units[-1].vowel, units[-1].kind = "", "none"
            after_virama = True
        elif ch in DEVANAGARI_VOWELS:
            units.append(Syllable(None, DEVANAGARI_VOWELS[ch], "independent"))
            after_virama = False
        elif ch in (ANUSVARA, CHANDRABINDU) and units:
            units[-1].nasal = True
        elif ch == VISARGA and units:
            units[-1].vowel += "h"
        i += 1
    return units


def _delete_schwas(units: list[Syllable]) -> None:
    n = len(units)
    if n > 1:
        last = units[-1]
        if last.kind == "inherent" and not last.after_virama and units[-2].kind != "none" and not last.nasal:
            last.vowel, last.kind = "", "none"
    for i in range(n - 2, 0, -1):
        unit, prev, nxt = units[i], units[i - 1], units[i + 1]
        if (
            unit.kind == "inherent"
            and not unit.nasal
            and not unit.after_virama
            and prev.kind != "none"
            and nxt.consonant is not None
            and nxt.kind != "none"
        ):
            unit.vowel, unit.kind = "", "none"


def devanagari_to_latin(text: str) -> str:
    words = []
    for word in text.split():
        units = _syllables(word)
        _delete_schwas(units)
        out = []
        for idx, unit in enumerate(units):
            out.append((unit.consonant or "") + unit.vowel)
            if unit.nasal:
                nxt = units[idx + 1].consonant if idx + 1 < len(units) else None
                out.append("m" if nxt and nxt.startswith(LABIALS) else "n")
        words.append("".join(out))
    return " ".join(w for w in words if w)


def strip_accents(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def phonetic_key(token: str) -> str:
    key = token.lower()
    if key.startswith("shri") or key.startswith("shree"):
        key = "sri" + key[5 if key.startswith("shree") else 4:]
    for src, dst in PHONETIC_RULES:
        key = key.replace(src, dst)
    key = re.sub(r"(?<=[^aeiou])h", "", key)
    key = re.sub(r"(.)\1+", r"\1", key)
    key = re.sub(r"nder$", "ndr", key)
    if len(key) > 3 and key.endswith("a"):
        key = key[:-1]
    return key


def skeleton(key: str) -> str:
    return key[:1] + re.sub(r"[aeiou]", "", key[1:])


@dataclass
class Token:
    text: str
    key: str
    initial: bool = False


@dataclass
class NormalizedName:
    original: str
    tokens: list[Token]
    kind: str
    notes: list[str] = field(default_factory=list)

    @property
    def text(self) -> str:
        return " ".join(t.text for t in self.tokens)

    @property
    def keys(self) -> list[str]:
        return [t.key for t in self.tokens if not t.initial]


def split_parenthetical(name: str) -> tuple[str, list[str]]:
    extras = [m.strip() for m in re.findall(r"\(([^)]*)\)", name) if m.strip()]
    base = re.sub(r"\([^)]*\)", " ", name).strip()
    return base, extras


def guess_kind(tokens: list[str], schema: str | None = None) -> str:
    if schema == "Person":
        return "person"
    if schema in {"Organization", "Company"}:
        return "org"
    return "org" if any(t in ORG_WORDS for t in tokens) else "person"


def normalize(name: str, schema: str | None = None) -> NormalizedName:
    notes: list[str] = []
    raw = unicodedata.normalize("NFKC", name or "").strip()
    if has_devanagari(raw):
        latin = devanagari_to_latin(raw)
        notes.append(f"transliterated Devanagari → '{latin}'")
        raw = latin
    stripped = strip_accents(raw)
    if stripped != raw:
        notes.append("removed diacritics")
    lowered = stripped.lower()
    for phrase in RELATION_PHRASES:
        if phrase in lowered:
            lowered = lowered.split(phrase)[0]
            notes.append(f"dropped relation clause '{phrase} …'")
    lowered = re.sub(r"(?<=\w)-(?=\w)", " ", lowered)
    stripped = re.sub(r"(?<=\w)-(?=\w)", " ", stripped)
    parts = re.split(r"\s+", lowered.replace("&", " and "))
    cut = next((i for i, p in enumerate(parts) if p.strip(".,") in RELATION_MARKERS and i > 0), None)
    if cut is not None:
        notes.append(f"dropped relation clause '{parts[cut]} …'")
        parts = parts[:cut]
    original_case = re.split(r"\s+", stripped)
    # ponytail: guess kind from the raw parts *before* the initials heuristic runs, so an
    # org's all-caps acronym (e.g. "KSN") doesn't get shredded into initials before we know
    # it's an org. guess_kind only looks at ORG_WORDS membership, which survives untouched
    # through the plain `[^a-z0-9]` strip below, so pre-scanning here is safe.
    kind = guess_kind([re.sub(r"[^a-z0-9]", "", p) for p in parts], schema)
    words: list[tuple[str, bool]] = []
    for idx, part in enumerate(parts):
        if part == "m/s":
            notes.append("dropped firm prefix 'M/s'")
            continue
        source = original_case[idx] if idx < len(original_case) else part
        if re.fullmatch(r"(?:[a-z]\.){2,}[a-z]?\.?", part):
            letters = [c for c in part if c.isalpha()]
            words.extend((c, True) for c in letters)
            notes.append(f"expanded initials '{source}'")
            continue
        clean = re.sub(r"[^a-z0-9]", "", part)
        if not clean:
            continue
        if (
            kind != "org"
            and clean not in HONORIFICS
            and re.fullmatch(r"[B-DF-HJ-NP-TV-Z]{2,3}", re.sub(r"[^A-Za-z]", "", source))
        ):
            words.extend((c, True) for c in clean)
            notes.append(f"split initials '{source}'")
            continue
        words.append((clean, len(clean) == 1))
    while (len(words) > 1 and words[0][0] in HONORIFICS) or (len(words) > 2 and words[0][0] in LEADING_HONORIFICS):
        notes.append(f"removed honorific '{words[0][0]}'")
        words.pop(0)
    kept: list[tuple[str, bool]] = []
    for word, initial in words:
        if word in HONORIFICS and len(words) > 2 and not initial:
            notes.append(f"removed honorific '{word}'")
            continue
        if kind == "org" and word in ORG_NOISE:
            notes.append(f"ignored legal suffix '{word}'")
            continue
        kept.append((word, initial))
    tokens: list[Token] = []
    for word, initial in kept:
        canon = CANONICAL.get(word, word)
        if canon != word:
            notes.append(f"canonicalised '{word}' → '{canon}'")
        if kind == "person" and not initial:
            for suffix in GUJARATI_SUFFIXES:
                if canon.endswith(suffix) and len(canon) - len(suffix) >= 3:
                    notes.append(f"removed Gujarati suffix '-{suffix}' from '{canon}'")
                    canon = canon[: -len(suffix)]
                    break
        tokens.append(Token(canon, canon if initial else phonetic_key(canon), initial))
    return NormalizedName(original=name, tokens=tokens, kind=kind, notes=notes)
