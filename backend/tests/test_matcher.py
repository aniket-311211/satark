from satark.matcher import MatchIndex, Record


def top(index, query, **kwargs):
    result = index.screen(query, **kwargs)
    return result.matches[0] if result.matches else None


def test_exact_list_entry_scores_strong(index):
    match = top(index, "Rajiv Sanghvi")
    assert match and match.entity_name.endswith("Rajiv Ramniklal Sanghvi") and match.band == "strong"


def test_devanagari_query_finds_latin_listing(index):
    match = top(index, "संभाजी राव शिंदे")
    assert match and match.entity_name == "Sambhaji Rao Shinde" and match.score >= 90


def test_initials_and_reordering(index):
    match = top(index, "Sanghvi R.")
    assert match and "Sanghvi" in match.entity_name
    assert any("initial" in r for r in match.reasons)


def test_surname_swap_stays_below_alert_threshold(index):
    result = index.screen("Rajiv Mehrotra Sanghvi Kapoor", min_score=0)
    assert all(m.score < 90 for m in result.matches)
    assert not index.screen("Vaibhav Kulkarni", min_score=76).matches or all(
        "Gandhi" not in m.entity_name for m in index.screen("Vaibhav Kulkarni", min_score=76).matches
    )


def test_name_score_ignores_everything_but_the_name():
    idx = MatchIndex([Record(id="x1", name="Arjun Mehta", schema="Person", dataset="t", source="t", birth_date="1970-01-01")])
    assert idx.screen("Arjun Mehta", min_score=0).matches[0].score == 100.0  # date of birth is the secondary check's job


def test_subset_keeps_global_weights(index):
    entity_id = top(index, "Hafiz Saeed").entity_id
    subset = index.subset([entity_id])
    assert subset.total == index.total
    assert subset.screen("Hafiz Saeed").matches[0].entity_id == entity_id


def test_reasons_are_human_readable(index):
    match = top(index, "Dr Umashankar Srivastava")
    assert match
    assert any("sounds like" in r or "matches exactly" in r for r in match.reasons)


def test_latency_is_interactive(index):
    result = index.screen("Mohammad Irfan Shaikh")
    assert result.latency_ms < 250


def test_real_case_gate_semantics():
    from satark.evaluation import evaluate_real

    idx = MatchIndex([
        Record(id="t:1", name="S K Impex", schema="LegalEntity", dataset="t", source="t"),
        Record(id="t:2", name="Classic Credit Ltd", schema="LegalEntity", dataset="t", source="t"),
    ])
    cases = [
        {"query": "Classic Credit Limited", "kind": "org", "entity_id": "t:2", "expected": "match"},
        {"query": "KSN IMPEX PRIVATE LIMITED", "kind": "org", "entity_id": "t:1", "expected": "no_match"},
        {"query": "Classic Credit Ltd", "kind": "org", "entity_id": "", "expected": "no_match"},  # any entity counts
    ]
    result = evaluate_real(idx, cases, threshold=80)
    assert result["passed"] == 2 and result["failures"][0]["query"] == "Classic Credit Ltd"


def test_short_names_one_edit_apart_are_not_spelling_variants():
    idx = MatchIndex([
        Record(id="t:1", name="Shrimati Anita Singh", schema="Person", dataset="t", source="t"),
        Record(id="t:2", name="Rakesh Sharma", schema="Person", dataset="t", source="t"),
    ])
    assert not idx.screen("SINGH, Ankit", kind="person", min_score=80).matches
    assert idx.screen("Rakesh Sharmaa", kind="person", min_score=80).matches  # longer names keep spelling tolerance
