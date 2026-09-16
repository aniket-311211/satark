from satark.secondary import check


def dob_check(result):
    return next(c for c in result["checks"] if c["check"] == "date_of_birth")


def nat_check(result):
    return next(c for c in result["checks"] if c["check"] == "nationality")


def pep_check(result):
    return next((c for c in result["checks"] if c["check"] == "pep_term_age"), None)


# --- date_of_birth branches ---

def test_dob_same_year_and_month_supports():
    r = check({"birth_date": "1978-12-02"}, {"birth_date": "1978-12-02"})
    c = dob_check(r)
    assert c["result"] == "supports" and c["strength"] == "strong"


def test_dob_year_only_same_supports():
    r = check({"birth_date": "1978-12"}, {"birth_date": "1978"})
    assert dob_check(r)["result"] == "supports"


def test_dob_month_differs_is_neutral_not_a_clearance():
    r = check({"birth_date": "1978-12"}, {"birth_date": "1978-03"})
    assert dob_check(r)["result"] == "neutral" and r["verdict"] == "inconclusive"


def test_dob_one_year_apart_is_neutral():
    r = check({"birth_date": "1980"}, {"birth_date": "1981"})
    c = dob_check(r)
    assert c["result"] == "neutral"
    assert "within a year" in c["detail"]


def test_dob_far_apart_contradicts():
    r = check({"birth_date": "1978-12"}, {"birth_date": "1981-03-05"})
    assert dob_check(r)["result"] == "contradicts"
    assert r["verdict"] == "contradicted"


def test_dob_multiple_listed_dates_one_matches_wins():
    r = check({"birth_date": "1978-12"}, {"birth_date": "1990-01;1978-12-02;1981-05"})
    c = dob_check(r)
    assert c["result"] == "supports"
    assert c["listed"] == "1978-12-02"


def test_dob_missing_both_sides_is_no_data():
    r = check({}, {})
    c = dob_check(r)
    assert c["result"] == "no_data"


def test_dob_missing_listed_only_is_no_data():
    r = check({"birth_date": "1974"}, {})
    assert dob_check(r)["result"] == "no_data"


# --- nationality branches ---

def test_nationality_demonym_maps_and_supports():
    r = check({"nationality": "Indian"}, {"countries": "in;gb"})
    n = nat_check(r)
    assert n["result"] == "supports" and n["strength"] == "weak"


def test_nationality_country_fallback_when_no_nationality():
    r = check({"country": "in"}, {"countries": "in"})
    assert nat_check(r)["result"] == "supports"


def test_nationality_unknown_demonym_is_no_data():
    r = check({"nationality": "Martian"}, {"countries": "in"})
    assert nat_check(r)["result"] == "no_data"


def test_nationality_mismatch_contradicts_but_weak():
    r = check({"nationality": "British"}, {"countries": "in"})
    n = nat_check(r)
    assert n["result"] == "contradicts" and n["strength"] == "weak"


# --- pep_term_age branches ---

def test_pep_term_age_under_25_contradicts():
    entity = {"details": {"terms": [{"post": "MP", "start": "1977", "end": "1980"}]}}
    r = check({"birth_date": "1965"}, entity)
    p = pep_check(r)
    assert p["result"] == "contradicts" and p["strength"] == "strong"
    assert r["verdict"] == "contradicted"


def test_pep_term_age_25_or_more_is_neutral():
    entity = {"details": {"terms": [{"post": "MP", "start": "1977"}]}}
    r = check({"birth_date": "1950"}, entity)
    assert pep_check(r)["result"] == "neutral"


def test_pep_term_age_omitted_when_no_terms():
    r = check({"birth_date": "1950"}, {"details": {}})
    assert pep_check(r) is None


def test_pep_term_age_no_data_without_birth_year():
    entity = {"details": {"terms": [{"post": "MP", "start": "1977"}]}}
    r = check({}, entity)
    assert pep_check(r)["result"] == "no_data"


def test_pep_term_age_takes_earliest_of_several_terms():
    entity = {"details": {"terms": [{"post": "MP", "start": "1999"}, {"post": "MLA", "start": "1977"}]}}
    r = check({"birth_date": "1965"}, entity)
    assert pep_check(r)["result"] == "contradicts"


# --- verdict precedence ---

def test_weak_contradiction_never_clears_the_alert():
    r = check({"birth_date": "1978-12", "nationality": "British"}, {"birth_date": "1978-12", "countries": "in"})
    assert r["verdict"] == "confirmed"


def test_conflicting_strong_evidence_goes_to_a_human_not_auto_clear():
    entity = {"birth_date": "1978-12", "details": {"terms": [{"post": "MP", "start": "1977"}]}}
    r = check({"birth_date": "1978-12-02"}, entity)
    assert dob_check(r)["result"] == "supports"
    assert pep_check(r)["result"] == "contradicts"
    assert r["verdict"] == "inconclusive" and r["summary"].startswith("Conflicting evidence")


def test_term_age_does_not_apply_to_organisations():
    r = check({"kind": "org", "birth_date": "2010"}, {"details": {"terms": [{"post": "MP", "start": "1977"}]}})
    assert pep_check(r) is None


def test_summary_names_the_decisive_dob_check():
    r = check({"birth_date": "1978-12"}, {"birth_date": "1981-03-05"})
    assert "date of birth" in r["summary"].lower()


def test_summary_names_the_decisive_pep_check():
    entity = {"details": {"terms": [{"post": "MP", "start": "1977"}]}}
    r = check({"birth_date": "1965"}, entity)
    assert "PEP term age" in r["summary"]


def test_summary_mentions_missing_evidence_when_inconclusive():
    r = check({"birth_date": "1974"}, {"nationality": "", "countries": "in"})
    assert r["verdict"] == "inconclusive"
    assert "no date of birth" in r["summary"]


# --- real examples measured on the live matcher ---

def test_real_example_singh_abhishek_contradicted():
    r = check({"birth_date": "1978-12"}, {"birth_date": "1981-03-05"})
    assert r["verdict"] == "contradicted"


def test_real_example_kumar_anand_contradicted():
    r = check({"birth_date": "1955-09"}, {"birth_date": "1974-08-07"})
    assert r["verdict"] == "contradicted"


def test_real_example_krishan_gopal_contradicted():
    r = check({"birth_date": "1972-01"}, {"birth_date": "1959-11-10"})
    assert r["verdict"] == "contradicted"


def test_real_example_rai_rajesh_inconclusive_with_weak_support():
    r = check({"birth_date": "1974", "nationality": "Indian"}, {"countries": "in"})
    assert r["verdict"] == "inconclusive"
    assert nat_check(r)["result"] == "supports"


def test_real_example_british_director_vs_in_listing_stays_inconclusive():
    r = check({"nationality": "British"}, {"countries": "in"})
    assert r["verdict"] == "inconclusive"
    assert nat_check(r)["result"] == "contradicts"


def test_date_of_birth_does_not_apply_to_organisations():
    r = check({"kind": "org", "country": "in"}, {"birth_date": "", "countries": "in"})
    assert r["verdict"] == "inconclusive" and "organisation" in r["summary"]
