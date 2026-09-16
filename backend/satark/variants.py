import random
import re

from faker import Faker

CONSONANTS = [
    ("ksh", "क्ष"), ("chh", "छ"), ("shr", "श्र"), ("sh", "श"), ("ch", "च"), ("kh", "ख"),
    ("gh", "घ"), ("jh", "झ"), ("th", "थ"), ("dh", "ध"), ("ph", "फ"), ("bh", "भ"), ("k", "क"),
    ("g", "ग"), ("j", "ज"), ("t", "त"), ("d", "द"), ("n", "न"), ("p", "प"), ("b", "ब"),
    ("m", "म"), ("y", "य"), ("r", "र"), ("l", "ल"), ("v", "व"), ("w", "व"), ("s", "स"),
    ("h", "ह"), ("f", "फ़"), ("z", "ज़"), ("q", "क़"), ("c", "क"), ("x", "क्स"),
]
VOWELS = [
    ("aa", "आ", "ा"), ("ai", "ऐ", "ै"), ("au", "औ", "ौ"), ("ee", "ई", "ी"), ("ii", "ई", "ी"),
    ("oo", "ऊ", "ू"), ("a", "अ", ""), ("i", "इ", "ि"), ("u", "उ", "ु"), ("e", "ए", "े"), ("o", "ओ", "ो"),
]
VIRAMA = "्"

SPELLING_SWAPS = [
    (r"shr", "sr"), (r"sr", "shr"), (r"sh", "s"), (r"v", "w"), (r"w", "v"), (r"ee", "i"),
    (r"i(?=[^aeiou]|$)", "ee"), (r"oo", "u"), (r"u(?=[^aeiou])", "oo"), (r"endra$", "ender"),
    (r"ender$", "endra"), (r"ph", "f"), (r"f", "ph"), (r"ksh", "x"), (r"z", "j"),
    (r"a$", ""), (r"(?<=[^aeiou])v$", "va"), (r"y", "i"), (r"th", "t"), (r"dh", "d"),
]
HONORIFICS = ["Shri", "Smt.", "Mr.", "Dr.", "Late", "Shri.", "Kumari"]
TRANSFORMS = [
    "honorific", "initials", "reorder", "drop_middle", "spelling", "typo",
    "devanagari", "relation", "abbreviation", "combo",
]


def _consonant_at(word: str, i: int) -> tuple[str, str] | None:
    return next(((lat, dev) for lat, dev in CONSONANTS if word.startswith(lat, i)), None)


def _vowel_at(word: str, i: int) -> tuple[str, str, str] | None:
    return next(((lat, ind, mat) for lat, ind, mat in VOWELS if word.startswith(lat, i)), None)


def _schwa_context(word: str, i: int) -> bool:
    cons = _consonant_at(word, i)
    if not cons:
        return False
    after = i + len(cons[0])
    return after < len(word) and _vowel_at(word, after) is not None


def latin_to_devanagari(text: str) -> str:
    words = []
    for word in re.sub(r"[^a-z ]", "", text.lower()).split():
        out = []
        i = 0
        prev_consonant = False
        cluster = 0
        vowels_seen = 0
        last_consonant = ""
        while i < len(word):
            cons = _consonant_at(word, i)
            if cons:
                lat, dev = cons
                after = i + len(lat)
                nxt_is_cons = after < len(word) and _vowel_at(word, after) is None
                if lat == "n" and not prev_consonant and nxt_is_cons and out:
                    out.append("ं")
                    i += 1
                    continue
                if prev_consonant:
                    out.append(VIRAMA)
                    cluster += 1
                else:
                    cluster = 0
                out.append(dev)
                prev_consonant = True
                last_consonant = lat
                i = after
                continue
            vowel = _vowel_at(word, i)
            if vowel is None:
                i += 1
                continue
            lat, independent, matra = vowel
            after = i + len(lat)
            final = after == len(word)
            if prev_consonant:
                if lat == "a" and final and len(out) > 1 and (cluster == 0 or last_consonant != "r"):
                    out.append("ा")
                elif lat == "a" and not final and vowels_seen > 0 and cluster == 0 and _schwa_context(word, after):
                    out.append("ा")
                elif lat == "i" and final:
                    out.append("ी")
                else:
                    out.append(matra)
            else:
                out.append(independent)
            vowels_seen += 1
            prev_consonant = False
            i = after
        words.append("".join(out))
    return " ".join(words)


class VariantMaker:
    def __init__(self, seed: int = 7):
        self.rng = random.Random(seed)
        self.faker = Faker("en_IN")
        self.faker.seed_instance(seed)

    def tokens(self, name: str) -> list[str]:
        return [t for t in re.split(r"\s+", re.sub(r"[.,]", " ", name)) if t]

    def apply(self, name: str, transform: str) -> str | None:
        parts = self.tokens(name)
        if len(parts) < 2:
            return None
        rng = self.rng
        if transform == "honorific":
            return f"{rng.choice(HONORIFICS)} {' '.join(parts)}"
        if transform == "initials":
            return " ".join([f"{p[0].upper()}." for p in parts[:-1]] + [parts[-1]])
        if transform == "reorder":
            return " ".join([parts[-1], *parts[:-1]])
        if transform == "drop_middle":
            return " ".join([parts[0], parts[-1]]) if len(parts) >= 3 else None
        if transform == "spelling":
            order = list(range(len(parts)))
            rng.shuffle(order)
            for idx in order:
                token = parts[idx].lower()
                swaps = [(p, r) for p, r in SPELLING_SWAPS if re.search(p, token)]
                if swaps and len(token) >= 4:
                    pattern, repl = rng.choice(swaps)
                    changed = re.sub(pattern, repl, token, count=1)
                    if changed != token and len(changed) >= 3:
                        parts[idx] = changed.capitalize()
                        return " ".join(parts)
            return None
        if transform == "typo":
            candidates = [i for i, p in enumerate(parts) if len(p) >= 6]
            if not candidates:
                return None
            idx = rng.choice(candidates)
            token = parts[idx]
            pos = rng.randrange(1, len(token) - 1)
            kind = rng.choice(["delete", "swap", "double"])
            if kind == "delete":
                token = token[:pos] + token[pos + 1:]
            elif kind == "swap":
                token = token[:pos] + token[pos + 1] + token[pos] + token[pos + 2:]
            else:
                token = token[:pos] + token[pos] + token[pos:]
            parts[idx] = token
            return " ".join(parts)
        if transform == "devanagari":
            return latin_to_devanagari(" ".join(parts))
        if transform == "relation":
            return f"{' '.join(parts)} {rng.choice(['S/O', 'D/O', 'W/O'])} {self.faker.first_name_male()} {parts[-1]}"
        if transform == "abbreviation":
            mapping = {"mohammad": "Md.", "mohammed": "Mohd.", "muhammad": "Md.", "kumar": "Kr.", "prasad": "Pd."}
            hits = [i for i, p in enumerate(parts) if p.lower() in mapping]
            if not hits:
                return None
            idx = rng.choice(hits)
            parts[idx] = mapping[parts[idx].lower()]
            return " ".join(parts)
        if transform == "combo":
            first, second = rng.sample(["honorific", "spelling", "reorder", "initials", "typo"], 2)
            step = self.apply(name, first)
            return self.apply(step, second) if step else None
        raise ValueError(transform)

    def random_person(self) -> str:
        return f"{self.faker.first_name()} {self.faker.last_name()}"

    def surname(self) -> str:
        return self.faker.last_name()
