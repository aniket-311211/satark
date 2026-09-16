"""Identity-evidence cross-check: independent customer/entity attributes vs the name match."""
import re

DEMONYMS = {
    "indian": "in", "british": "gb", "american": "us", "german": "de", "french": "fr",
    "irish": "ie", "pakistani": "pk", "chinese": "cn", "singaporean": "sg", "canadian": "ca",
    "australian": "au", "sri lankan": "lk", "bangladeshi": "bd", "nepali": "np",
    "nepalese": "np", "emirati": "ae", "russian": "ru", "japanese": "jp", "dutch": "nl",
    "swiss": "ch", "italian": "it", "spanish": "es", "kenyan": "ke", "south african": "za",
}
LOK_SABHA_MIN_AGE = 25  # ponytail: Article 84 floor for the Lok Sabha; Rajya Sabha's 30 is stricter, 25 is conservative
DATE_RE = re.compile(r"^(\d{4})(?:-(\d{2}))?")  # ponytail: lenient - ignores a garbage day/suffix, only year/month matter
RANK = {"supports": 0, "neutral": 1, "contradicts": 2}
LABELS = {"date_of_birth": "date of birth", "pep_term_age": "PEP term age"}


def _parse_date(value: str) -> tuple[int, int | None] | None:
    m = DATE_RE.match((value or "").strip())
    if not m:
        return None
    return int(m.group(1)), (int(m.group(2)) if m.group(2) else None)


def _dob_compare(c_year: int, c_month: int | None, l_year: int, l_month: int | None) -> tuple[str, str]:
    diff = abs(c_year - l_year)
    if diff == 0:
        if c_month is None or l_month is None or c_month == l_month:
            return "supports", "birth year and month agree"
        # A month slip is too common a data-entry error to auto-clear a name match on; only the year is decisive.
        return "neutral", f"same year, different month ({c_month:02d} vs {l_month:02d}): could be a recording difference"
    if diff == 1:
        # ponytail: fixed +/-1 year tolerance for a recording slip, not a calibrated window
        return "neutral", "within a year: could be a recording difference"
    return "contradicts", f"born {c_year}, listed as born {l_year}"


def _check_dob(customer: dict, entity: dict) -> dict:
    c_raw = (customer.get("birth_date") or "").strip()
    l_raw = (entity.get("birth_date") or "").strip()
    if customer.get("kind") == "org":
        return {"check": "date_of_birth", "customer": "", "listed": l_raw, "result": "no_data", "strength": "strong",
                "detail": "does not apply to an organisation, and the lists share no company identifiers with the registries"}
    c_parsed = _parse_date(c_raw)
    listed = [(v, _parse_date(v)) for v in l_raw.split(";") if v.strip()]
    listed = [(v, p) for v, p in listed if p]
    if not c_parsed or not listed:
        detail = "no birth date on file for the customer" if not c_parsed else "the listing has no date of birth"
        return {"check": "date_of_birth", "customer": c_raw, "listed": l_raw, "result": "no_data",
                "strength": "strong", "detail": detail}
    c_year, c_month = c_parsed
    best = None
    for raw, (l_year, l_month) in listed:
        result, detail = _dob_compare(c_year, c_month, l_year, l_month)
        if best is None or RANK[result] < RANK[best[0]]:
            best = (result, detail, raw)
    result, detail, listed_raw = best
    return {"check": "date_of_birth", "customer": c_raw, "listed": listed_raw, "result": result,
            "strength": "strong", "detail": detail}


def _check_nationality(customer: dict, entity: dict) -> dict:
    nat_raw = (customer.get("nationality") or "").strip()
    country = (customer.get("country") or "").strip().lower()
    listed_countries = [c for c in (entity.get("countries") or "").lower().split(";") if c]
    customer_val = nat_raw or customer.get("country") or ""
    if nat_raw:
        code = DEMONYMS.get(nat_raw.lower())
        if code is None:
            return {"check": "nationality", "customer": customer_val, "listed": entity.get("countries", ""),
                    "result": "no_data", "strength": "weak", "detail": "nationality not recognised"}
    else:
        code = country or None
    if not code or not listed_countries:
        missing = "no nationality or country on file" if not code else "listing has no countries"
        return {"check": "nationality", "customer": customer_val, "listed": entity.get("countries", ""),
                "result": "no_data", "strength": "weak", "detail": missing}
    result = "supports" if code in listed_countries else "contradicts"
    note = "a country on the list can mean jurisdiction, not nationality"
    detail = f"{'matches' if result == 'supports' else 'not among'} listed countries ({note})"
    return {"check": "nationality", "customer": customer_val, "listed": entity.get("countries", ""),
            "result": result, "strength": "weak", "detail": detail}


def _check_pep_term_age(customer: dict, entity: dict) -> dict | None:
    if customer.get("kind") == "org":
        return None
    terms = (entity.get("details") or {}).get("terms") or []
    starts = [(p[0], t) for t in terms if (p := _parse_date(str(t.get("start") or "")))]
    if not starts:
        return None
    start_year, term = min(starts, key=lambda x: x[0])
    listed_val = f"{term.get('post', '')} ({term.get('start', '')})".strip()
    c_raw = (customer.get("birth_date") or "").strip()
    c_parsed = _parse_date(c_raw)
    if not c_parsed:
        return {"check": "pep_term_age", "customer": c_raw, "listed": listed_val, "result": "no_data",
                "strength": "strong", "detail": "no birth date on file to check against listed term dates"}
    age = start_year - c_parsed[0]
    if age < LOK_SABHA_MIN_AGE:
        detail = (f"earliest listed term began in {start_year}, when this customer would have been {age}; "
                  f"members of the Lok Sabha must be at least {LOK_SABHA_MIN_AGE}")
        return {"check": "pep_term_age", "customer": c_raw, "listed": listed_val, "result": "contradicts",
                "strength": "strong", "detail": detail}
    return {"check": "pep_term_age", "customer": c_raw, "listed": listed_val, "result": "neutral",
            "strength": "strong", "detail": f"age {age} at earliest term is consistent, but not evidence"}


def _summarize(checks: list[dict]) -> tuple[str, str]:
    decisive = next((c for c in checks if c["strength"] == "strong" and c["result"] == "contradicts"), None)
    support = next((c for c in checks if c["strength"] == "strong" and c["result"] == "supports"), None)
    if decisive and support:
        # e.g. the date of birth agrees but the listed term dates are impossible for that birth year: the listing is
        # internally inconsistent, which is not evidence of a different person, so a human decides.
        return "inconclusive", (f"Conflicting evidence, needs review: {LABELS[support['check']]} agrees but "
                                f"{LABELS[decisive['check']]} contradicts ({decisive['detail']}).")
    if decisive:
        label = LABELS[decisive["check"]]
        if decisive["check"] == "date_of_birth":
            summary = f"Cleared by {label}: customer born {decisive['customer']}, listed person born {decisive['listed']}."
        else:
            summary = f"Cleared by {label}: {decisive['detail']}."
        return "contradicted", summary

    decisive = next((c for c in checks if c["strength"] == "strong" and c["result"] == "supports"), None)
    if decisive:
        summary = f"Date of birth agrees ({decisive['customer']} vs {decisive['listed']}); a reviewer still decides."
        return "confirmed", summary

    dob, nat = checks[0], checks[1]
    if dob["result"] == "no_data":
        summary = f"No independent evidence: {dob['detail']}."
    else:  # neutral (±1 year)
        summary = f"Inconclusive: date of birth is close but not exact ({dob['customer']} vs {dob['listed']}) - {dob['detail']}."
    if nat["result"] == "supports":
        summary += " Nationality is consistent, though that is weak evidence."
    elif nat["result"] == "contradicts":
        summary += " Nationality differs, though that is weak evidence and may reflect jurisdiction, not citizenship."
    return "inconclusive", summary


def check(customer: dict, entity: dict) -> dict:
    customer, entity = customer or {}, entity or {}
    checks = [_check_dob(customer, entity), _check_nationality(customer, entity)]
    pep = _check_pep_term_age(customer, entity)
    if pep:
        checks.append(pep)
    verdict, summary = _summarize(checks)
    return {"verdict": verdict, "summary": summary, "checks": checks}
