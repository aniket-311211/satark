import csv
import gzip
import io
import json
import zipfile

from satark import book

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _lei_record(lei, name, country="IN", category="GENERAL", status="ACTIVE", registered_as="U12345MH2020PTC000001"):
    return {
        "attributes": {
            "lei": lei,
            "entity": {
                "legalName": {"name": name},
                "otherNames": [{"name": name + " OLD"}],
                "legalAddress": {"country": country, "city": "MUMBAI"},
                "registeredAs": registered_as,
                "jurisdiction": country,
                "category": category,
                "status": status,
            },
            "registration": {"status": "ISSUED", "managingLou": book.LSE_LOU},
        },
    }


def _write_csv_zip(path, header, rows):
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=header)
    writer.writeheader()
    writer.writerows(rows)
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("data.csv", buf.getvalue())


# ---------------------------------------------------------------------------
# row construction
# ---------------------------------------------------------------------------

def test_row_from_api_record_org():
    row = book._row_from_api_record(_lei_record("LEI0001", "ACME PRIVATE LIMITED"), "A")
    assert row == {
        "external_id": "lei:LEI0001", "name": "ACME PRIVATE LIMITED", "kind": "org", "group": "A",
        "country": "in", "birth_date": "", "parent_external_id": None,
        "details": {
            "lei": "LEI0001", "legal_name": "ACME PRIVATE LIMITED", "other_names": ["ACME PRIVATE LIMITED OLD"],
            "category": "GENERAL", "entity_status": "ACTIVE", "registration_status": "ISSUED",
            "managing_lou": book.LSE_LOU, "registered_as": "U12345MH2020PTC000001", "jurisdiction": "IN",
            "city": "MUMBAI", "direct_parent": None, "ultimate_parent": None,
            "gleif_url": "https://search.gleif.org/#/record/LEI0001",
        },
    }


def test_row_from_api_record_sole_proprietor_is_person():
    row = book._row_from_api_record(_lei_record("LEI0002", "A TRADER", category="SOLE_PROPRIETOR"), "A")
    assert row["kind"] == "person"


def test_row_from_api_record_extra_merges_into_details():
    row = book._row_from_api_record(_lei_record("LEI0003", "X LTD"), "C", {"list_entity_id": "NK-abc"})
    assert row["details"]["list_entity_id"] == "NK-abc"


# ---------------------------------------------------------------------------
# group A: pagination over the GLEIF search API
# ---------------------------------------------------------------------------

def test_build_group_a_paginates(monkeypatch):
    page1 = {
        "data": [_lei_record("LEI0001", "ONE LTD"), _lei_record("LEI0002", "TWO LTD")],
        "meta": {"pagination": {"currentPage": 1, "lastPage": 2}},
    }
    page2 = {
        "data": [_lei_record("LEI0003", "THREE LTD")],
        "meta": {"pagination": {"currentPage": 2, "lastPage": 2}},
    }
    calls = []

    def fake_get(params):
        calls.append(params["page[number]"])
        return page1 if params["page[number]"] == 1 else page2

    monkeypatch.setattr(book, "_gleif_get", fake_get)
    rows = book.build_group_a()
    assert [r["external_id"] for r in rows] == ["lei:LEI0001", "lei:LEI0002", "lei:LEI0003"]
    assert calls == [1, 2]


# ---------------------------------------------------------------------------
# group C: NSE debarment pair derivation + name matching
# ---------------------------------------------------------------------------

def _ftm_line(rec):
    return json.dumps(rec) + "\n"


def test_nse_active_company_pairs_uses_snapshot_status():
    rows = [
        {"id": "NK-1", "name": "Debarred Co Ltd", "status": "active"},
        {"id": "NK-2", "name": "Some Person", "status": "active"},  # no company suffix
        {"id": "NK-3", "name": "Revoked Co Limited", "status": "historical"},
        # a person whose listing mentions a company only in the bracketed address: not a company
        {"id": "NK-4", "name": "Dinesh Sharma(having address at Risk Capital Finance Corporation Limited, New Delhi)", "status": "active"},
    ]
    assert book.nse_active_company_pairs(rows) == [("in_nse_debarred:NK-1", "Debarred Co Ltd")]


def test_normalize_name_equivalences():
    assert book._normalize_name("Citi Sec. Pvt. Ltd.") == book._normalize_name("Citi Sec Private Limited")


def test_strip_parenthetical():
    assert book._strip_parenthetical("Wealthit Global (India) Ltd.") == "Wealthit Global Ltd"
    assert book._strip_parenthetical("Wealthit Global (India)") == "Wealthit Global"


def test_build_group_c_matches_normalized_name_and_retries_without_parens(monkeypatch):
    calls = []

    def fake_get(params):
        name = params["filter[entity.legalName]"]
        calls.append(name)
        if name == "Foo Ltd (India)":
            return {"data": []}  # no hit on the raw name
        return {"data": [_lei_record("LEI0009", "FOO LIMITED")]}

    monkeypatch.setattr(book, "_gleif_get", fake_get)
    rows = book.build_group_c([("NK-9", "Foo Ltd (India)")])
    assert len(rows) == 1
    assert rows[0]["details"]["list_entity_id"] == "NK-9"
    assert calls == ["Foo Ltd (India)", "Foo Ltd"]


def test_build_group_c_skips_no_match(monkeypatch):
    monkeypatch.setattr(book, "_gleif_get", lambda params: {"data": []})
    assert book.build_group_c([("NK-9", "Nobody Ltd")]) == []


# ---------------------------------------------------------------------------
# group B: golden-copy relationship + entity parsing
# ---------------------------------------------------------------------------

RR_HEADER = ["Relationship.StartNode.NodeID", "Relationship.EndNode.NodeID",
             "Relationship.RelationshipType", "Relationship.RelationshipStatus"]
LEI_HEADER = ["LEI", "Entity.LegalName", "Entity.LegalAddress.Country", "Entity.LegalAddress.City",
              "Entity.RegistrationAuthority.RegistrationAuthorityID",
              "Entity.RegistrationAuthority.RegistrationAuthorityEntityID",
              "Entity.EntityCategory", "Entity.EntityStatus", "Entity.LegalJurisdiction",
              "Registration.RegistrationStatus", "Registration.ManagingLOU"]


def test_load_parent_relationships_filters_status_and_type(tmp_path):
    rows = [
        {"Relationship.StartNode.NodeID": "CHILD1", "Relationship.EndNode.NodeID": "PARENT1",
         "Relationship.RelationshipType": "IS_DIRECTLY_CONSOLIDATED_BY", "Relationship.RelationshipStatus": "ACTIVE"},
        {"Relationship.StartNode.NodeID": "CHILD1", "Relationship.EndNode.NodeID": "PARENT2",
         "Relationship.RelationshipType": "IS_ULTIMATELY_CONSOLIDATED_BY", "Relationship.RelationshipStatus": "ACTIVE"},
        {"Relationship.StartNode.NodeID": "CHILD2", "Relationship.EndNode.NodeID": "PARENT3",
         "Relationship.RelationshipType": "IS_DIRECTLY_CONSOLIDATED_BY", "Relationship.RelationshipStatus": "INACTIVE"},
        {"Relationship.StartNode.NodeID": "CHILD3", "Relationship.EndNode.NodeID": "PARENT4",
         "Relationship.RelationshipType": "IS_FUND-MANAGED_BY", "Relationship.RelationshipStatus": "ACTIVE"},
    ]
    zpath = tmp_path / "rr.csv.zip"
    _write_csv_zip(zpath, RR_HEADER, rows)
    direct, ultimate = book._load_parent_relationships(zpath)
    assert direct == {"CHILD1": "PARENT1"}
    assert ultimate == {"CHILD1": "PARENT2"}


def test_gb_candidates_filters_ra_and_parent_country(tmp_path):
    direct_map = {"CHILD_OK": "PARENT_IN", "CHILD_BAD_RA": "PARENT_IN"}
    ultimate_map = {"CHILD_US_PARENT": "PARENT_US"}
    rows = [
        {"LEI": "CHILD_OK", "Entity.LegalName": "GOOD UK CO", "Entity.LegalAddress.Country": "GB",
         "Entity.RegistrationAuthority.RegistrationAuthorityID": book.CH_RA_CODE,
         "Entity.RegistrationAuthority.RegistrationAuthorityEntityID": "04663024"},
        {"LEI": "CHILD_BAD_RA", "Entity.LegalName": "BAD RA UK CO", "Entity.LegalAddress.Country": "GB",
         "Entity.RegistrationAuthority.RegistrationAuthorityID": "RA000615",
         "Entity.RegistrationAuthority.RegistrationAuthorityEntityID": "SC123456"},
        {"LEI": "CHILD_US_PARENT", "Entity.LegalName": "US PARENTED UK CO", "Entity.LegalAddress.Country": "GB",
         "Entity.RegistrationAuthority.RegistrationAuthorityID": book.CH_RA_CODE,
         "Entity.RegistrationAuthority.RegistrationAuthorityEntityID": "05555555"},
        {"LEI": "PARENT_IN", "Entity.LegalName": "INDIAN PARENT LTD", "Entity.LegalAddress.Country": "IN"},
        {"LEI": "PARENT_US", "Entity.LegalName": "US PARENT INC", "Entity.LegalAddress.Country": "US"},
        {"LEI": "IRRELEVANT", "Entity.LegalName": "NOT INVOLVED", "Entity.LegalAddress.Country": "GB"},
    ]
    zpath = tmp_path / "lei2.csv.zip"
    _write_csv_zip(zpath, LEI_HEADER, rows)
    candidates = book._gb_candidates(direct_map, ultimate_map, zpath)
    assert [lei for lei, *_ in candidates] == ["CHILD_OK"]
    lei, entity, dp, up = candidates[0]
    assert entity["registered_as"] == "04663024"
    assert dp == {"lei": "PARENT_IN", "name": "INDIAN PARENT LTD", "country": "in"}
    assert up is None


# ---------------------------------------------------------------------------
# Companies House enrichment
# ---------------------------------------------------------------------------

def test_apply_ch_data_flags_conflict_when_no_psc_but_gleif_parent():
    row = book._group_b_company_row(
        "LEI_ICICI", {"legal_name": "ICICI BANK UK PLC", "other_names": [], "category": "GENERAL",
                      "status": "ACTIVE", "reg_status": "ISSUED", "managing_lou": "LOU1",
                      "registered_as": "04663024", "jurisdiction": "GB", "city": "LONDON", "country": "GB"},
        {"lei": "LEI_ICICI_PARENT", "name": "ICICI BANK LIMITED", "country": "in"}, None,
    )
    bundle = {
        "company": {"company_status": "active"},
        "psc": {"items": []},
        "psc_statements": {"items": [{"statement": "no-individual-or-entity-with-signficant-control"}]},
    }
    row = book._apply_ch_data(row, bundle, {"name": "ICICI BANK LIMITED"}, None)
    assert row["details"]["ownership_conflict"]["conflict"] is True
    assert "ICICI BANK LIMITED" in row["details"]["ownership_conflict"]["reason"]


def test_apply_ch_data_no_conflict_when_psc_present():
    row = book._group_b_company_row(
        "LEI_X", {"legal_name": "X UK LTD", "other_names": [], "category": "GENERAL", "status": "ACTIVE",
                  "reg_status": "ISSUED", "managing_lou": "LOU1", "registered_as": "01111111", "jurisdiction": "GB",
                  "city": "LONDON", "country": "GB"},
        {"lei": "P", "name": "PARENT LTD", "country": "in"}, None,
    )
    bundle = {"company": {"company_status": "active"}, "psc": {"items": [{"kind": "corporate-entity-person-with-significant-control", "name": "PARENT LTD"}]},
              "psc_statements": {"items": []}}
    row = book._apply_ch_data(row, bundle, {"name": "PARENT LTD"}, None)
    assert row["details"]["ownership_conflict"]["conflict"] is False


def test_public_psc_redacts_individual_names_keeps_corporate_names():
    items = [
        {"kind": "individual-person-with-significant-control", "name": "Jane Doe", "natures_of_control": ["ownership-of-shares-75-to-100-percent"]},
        {"kind": "corporate-entity-person-with-significant-control", "name": "Parent Co Ltd", "natures_of_control": ["voting-rights-75-to-100-percent"]},
    ]
    out = book._public_psc(items)
    assert out[0]["name"] == ""
    assert out[0]["natures_of_control"] == ["ownership-of-shares-75-to-100-percent"]
    assert out[1]["name"] == "Parent Co Ltd"


def test_officer_id_from_appointments_link():
    item = {"links": {"officer": {"appointments": "/officers/abc123/appointments"}}}
    assert book._officer_id(item) == "abc123"


def test_officer_id_falls_back_to_hash_when_no_link():
    item = {"name": "SMITH, John", "date_of_birth": {"month": 1, "year": 1980}}
    oid = book._officer_id(item)
    assert len(oid) == 40  # sha1 hex


def test_birth_date_formats_year_month():
    assert book._birth_date({"date_of_birth": {"month": 6, "year": 1958}}) == "1958-06"
    assert book._birth_date({}) == ""


def test_officer_rows_skips_resigned():
    officers = [
        {"name": "ACTIVE, One", "links": {"officer": {"appointments": "/officers/o1/appointments"}}, "officer_role": "director"},
        {"name": "GONE, Two", "links": {"officer": {"appointments": "/officers/o2/appointments"}}, "resigned_on": "2020-01-01"},
    ]
    rows = book._officer_rows(officers, "lei:LEI_X", "04663024", "X UK LTD")
    assert len(rows) == 1
    assert rows[0]["external_id"] == "ch-officer:o1"
    assert rows[0]["details"]["appointments"][0]["company_number"] == "04663024"
    assert rows[0]["parent_external_id"] == "lei:LEI_X"
    assert rows[0]["kind"] == "person"
    assert rows[0]["country"] == ""


# ---------------------------------------------------------------------------
# snapshot I/O
# ---------------------------------------------------------------------------

def test_write_book_and_load_book_round_trip(tmp_path):
    row_a = book._row_from_api_record(_lei_record("LEI_SHARED", "SHARED CO"), "A")
    row_c = book._row_from_api_record(_lei_record("LEI_SHARED", "SHARED CO"), "C", {"list_entity_id": "NK-1"})
    row_b = book._row_from_api_record(_lei_record("LEI_B1", "UK CO", country="GB"), "B")
    officer = {
        "external_id": "ch-officer:o1", "name": "SMITH, John", "kind": "person", "group": "B",
        "country": "gb", "birth_date": "1958-06", "parent_external_id": "lei:LEI_B1",
        "details": {"officer_role": "director", "appointed_on": "2020-01-01", "nationality": "British",
                     "occupation": "Banker", "company_number": "04663024", "company_name": "UK CO"},
    }
    book.write_book(tmp_path, [row_a, row_c, row_b, officer])

    assert not (tmp_path / "book" / "group_c.jsonl.gz").exists() or _count(tmp_path / "book" / "group_c.jsonl.gz") == 0
    with gzip.open(tmp_path / "book" / "group_a.jsonl.gz", "rt") as f:
        a_rows = [json.loads(line) for line in f]
    assert len(a_rows) == 1
    assert a_rows[0]["group"] == "A"
    assert sorted(a_rows[0]["details"]["groups"]) == ["A", "C"]

    with gzip.open(tmp_path / "cache" / "officers.jsonl.gz", "rt") as f:
        cached = [json.loads(line) for line in f]
    assert cached == [officer]

    loaded = book.load_book(tmp_path)
    external_ids = {r["external_id"] for r in loaded}
    assert external_ids == {"lei:LEI_SHARED", "lei:LEI_B1", "ch-officer:o1"}


def _count(path):
    with gzip.open(path, "rt") as f:
        return sum(1 for line in f if line.strip())


def test_group_c_lookup_strips_commas_and_skips_rejected_names(monkeypatch):
    import httpx

    queries = []

    def fake_get(params):
        queries.append(params["filter[entity.legalName]"])
        if "Bad" in params["filter[entity.legalName]"]:
            request = httpx.Request("GET", "https://api.gleif.org")
            raise httpx.HTTPStatusError("400", request=request, response=httpx.Response(400, request=request))
        return {"data": [_lei_record("LEI0010", "NEW LEADER TRADING CO PVT LTD")]}

    monkeypatch.setattr(book, "_gleif_get", fake_get)
    rows = book.build_group_c([("NK-1", "New Leader Trading Co. Pvt. Ltd.,"), ("NK-2", "Bad Name Ltd")])
    assert [r["details"]["lei"] for r in rows] == ["LEI0010"]
    assert queries[0] == "New Leader Trading Co. Pvt. Ltd."


def test_build_group_b_merges_one_director_across_subsidiaries(monkeypatch):
    uk = lambda name: {"legal_name": name, "other_names": [], "category": "GENERAL", "status": "ACTIVE", "reg_status": "ISSUED",  # noqa: E731
                       "managing_lou": "", "registered_as": name[-1], "jurisdiction": "GB", "city": "LONDON", "country": "GB"}
    parent = {"lei": "P_IN", "name": "PARENT LIMITED", "country": "in"}
    monkeypatch.setattr(book, "_golden_copy_zip", lambda url, name: name)
    monkeypatch.setattr(book, "_load_parent_relationships", lambda path: ({}, {}))
    monkeypatch.setattr(book, "_gb_candidates", lambda d, u, path: [("LEI1", uk("UK ONE 1"), parent, None), ("LEI2", uk("UK TWO 2"), parent, None)])
    officer = {"name": "SHARMA, Ravi", "officer_role": "director", "links": {"officer": {"appointments": "/officers/same/appointments"}}}
    monkeypatch.setattr(book, "_ch_company_bundle", lambda key, number: {"company": {}, "officers": {"items": [officer]}, "psc": {}, "psc_statements": {}})
    rows = book.build_group_b("key")
    people = [r for r in rows if r["kind"] == "person"]
    assert len(people) == 1 and [a["company_number"] for a in people[0]["details"]["appointments"]] == ["1", "2"]
