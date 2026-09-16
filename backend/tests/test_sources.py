import json
from datetime import date

from satark.sources import parse_ftm, row_hash, to_record

TODAY = date(2024, 6, 1)


def ent(eid, schema="LegalEntity", name="Entity", target=True, referents=None, **props):
    return json.dumps({
        "id": eid, "schema": schema, "caption": name, "referents": referents or [],
        "first_seen": "2024-01-01T00:00:00", "last_change": "2024-01-01T00:00:00",
        "properties": {"name": [name], **props}, "target": target,
    })


def sanction(sid, entity_id, **props):
    return json.dumps({
        "id": sid, "schema": "Sanction", "caption": "Sanction", "referents": [],
        "first_seen": "2024-01-01T00:00:00", "last_change": "2024-01-01T00:00:00",
        "properties": {"entity": [entity_id], **props}, "target": False,
    })


def occupancy(oid, holder, post, **props):
    return json.dumps({
        "id": oid, "schema": "Occupancy", "caption": "Occupancy", "referents": [],
        "first_seen": "2024-01-01T00:00:00", "last_change": "2024-01-01T00:00:00",
        "properties": {"holder": [holder], "post": [post], **props}, "target": False,
    })


def family(fid, person, relative, relationship):
    return json.dumps({
        "id": fid, "schema": "Family", "caption": "Family", "referents": [],
        "first_seen": "2024-01-01T00:00:00", "last_change": "2024-01-01T00:00:00",
        "properties": {"person": [person], "relative": [relative], "relationship": [relationship]}, "target": False,
    })


def test_revoked_order_marks_entity_historical():
    lines = [ent("e1", name="Revoked Co"), sanction("s1", "e1", date=["2020-01-01"], duration=["REVOKED"], authority=["NSE"])]
    rows = parse_ftm(lines, "in_nse_debarred", today=TODAY)
    assert rows[0]["status"] == "historical"
    assert rows[0]["details"]["orders"][0]["status"] == "revoked"


def test_order_expired_by_end_date():
    lines = [ent("e2", name="Expired Co"),
              sanction("s2", "e2", date=["2018-01-01"], endDate=["2019-01-01"], duration=["some note"], authority=["NSE"])]
    rows = parse_ftm(lines, "in_nse_debarred", today=TODAY)
    assert rows[0]["details"]["orders"][0]["status"] == "expired"
    assert rows[0]["status"] == "historical"


def test_active_order_with_no_end():
    lines = [ent("e3", name="Active Co"), sanction("s3", "e3", date=["2023-01-01"], duration=["TILL FURTHER ORDERS"], authority=["NSE"])]
    rows = parse_ftm(lines, "in_nse_debarred", today=TODAY)
    assert rows[0]["details"]["orders"][0]["status"] == "active"
    assert rows[0]["status"] == "active"


def test_five_years_duration_elapsed_expires():
    lines = [ent("e4", name="Old Debar Co"), sanction("s4", "e4", date=["2015-01-01"], duration=["5 years"], authority=["NSE"])]
    rows = parse_ftm(lines, "in_nse_debarred", today=TODAY)
    assert rows[0]["details"]["orders"][0]["status"] == "expired"
    assert rows[0]["status"] == "historical"


def test_five_years_duration_not_yet_elapsed_stays_active():
    lines = [ent("e4b", name="Recent Debar Co"), sanction("s4b", "e4b", date=["2023-01-01"], duration=["5 years"], authority=["NSE"])]
    rows = parse_ftm(lines, "in_nse_debarred", today=TODAY)
    assert rows[0]["details"]["orders"][0]["status"] == "active"
    assert rows[0]["status"] == "active"


def test_pep_former_over_a_year_out_is_historical():
    lines = [
        ent("p1", schema="Person", name="Former MP"),
        ent("pos1", schema="Position", name="Member of Lok Sabha"),
        occupancy("o1", "p1", "pos1", startDate=["2014-01-01"], endDate=["2019-01-01"], status=["ended"]),
    ]
    rows = parse_ftm(lines, "in_sansad", today=TODAY)
    assert rows[0]["status"] == "historical"
    assert rows[0]["details"]["terms"][0]["post"] == "Member of Lok Sabha"


def test_pep_former_within_a_year_stays_active():
    lines = [
        ent("p2", schema="Person", name="Recently Former MP"),
        ent("pos1", schema="Position", name="Member of Lok Sabha"),
        occupancy("o2", "p2", "pos1", startDate=["2014-01-01"], endDate=["2024-01-01"], status=["ended"]),
    ]
    rows = parse_ftm(lines, "in_sansad", today=TODAY)
    assert rows[0]["status"] == "active"


def test_current_pep_is_active():
    lines = [
        ent("p3", schema="Person", name="Sitting MP"),
        ent("pos1", schema="Position", name="Member of Lok Sabha"),
        occupancy("o3", "p3", "pos1", startDate=["2019-01-01"], status=["current"]),
    ]
    rows = parse_ftm(lines, "in_sansad", today=TODAY)
    assert rows[0]["status"] == "active"


def test_relative_name_resolves_from_non_target_person():
    lines = [
        ent("p4", schema="Person", name="MP With Family"),
        ent("rel1", schema="Person", name="Mother Of MP", target=False),
        family("f1", "p4", "rel1", "mother"),
    ]
    rows = parse_ftm(lines, "in_sansad", today=TODAY)
    assert rows[0]["details"]["relatives"] == [{"name": "Mother Of MP", "relationship": "mother"}]


def test_identifier_fields_never_appear_in_row():
    lines = [ent("e5", name="Identified Co", taxNumber=["AAAAA1111A"], idNumber=["X123"], email=["a@b.com"],
                  phone=["+911234567890"], passportNumber=["P1234567"], registrationNumber=["REG999"])]
    rows = parse_ftm(lines, "in_nse_debarred", today=TODAY)
    blob = json.dumps(rows[0])
    for leaked in ("AAAAA1111A", "X123", "a@b.com", "+911234567890", "P1234567", "REG999"):
        assert leaked not in blob


def test_sanction_resolves_through_referent_id():
    lines = [ent("NK-1", name="Merged Co", referents=["ref-1"]), sanction("s6", "ref-1", date=["2023-01-01"], authority=["NSE"])]
    rows = parse_ftm(lines, "in_nse_debarred", today=TODAY)
    assert rows[0]["id"] == "NK-1"
    assert len(rows[0]["details"]["orders"]) == 1


def test_row_hash_changes_when_status_changes():
    base = {"name": "A", "aliases": "", "birth_date": "", "countries": "", "sanctions": "", "schema": "Person",
            "status": "active", "details": {}}
    changed = {**base, "status": "historical"}
    assert row_hash(base) != row_hash(changed)


def test_row_hash_changes_when_details_change():
    base = {"name": "A", "aliases": "", "birth_date": "", "countries": "", "sanctions": "", "schema": "Person",
            "status": "historical", "details": {}}
    revoked = {**base, "details": {"orders": [{"status": "revoked"}]}}
    assert row_hash(base) != row_hash(revoked)


def test_to_record_passes_through_status():
    row = {"id": "x1", "name": "A", "schema": "Person", "dataset": "in_nse_debarred", "aliases": "", "birth_date": "",
           "countries": "", "program_ids": "", "sanctions": "", "status": "historical"}
    record = to_record(row, "in_nse_debarred")
    assert record.status == "historical"
