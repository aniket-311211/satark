from satark.upload import parse_customer_csv

FILE = """Customer ID,Full Name,Type,DOB,Nationality,Country
C-1,Hafiz Muhammad Saeed,individual,05/06/1950,Pakistani,PK
C-2,Acme Exports Private Limited,company,,,IN
C-3,,person,,,
C-4,SHARMA Priya,person,12-1984,,IN
C-5,KUMAR Anand,alien,,,
C-1,Hafiz Muhammad Saeed,person,1950,,
"""


def test_parser_maps_loose_headers_and_rejects_bad_rows_with_reasons():
    rows, errors = parse_customer_csv(FILE)
    assert [(r["name"], r["kind"], r["birth_date"], r["country"]) for r in rows] == [
        ("Hafiz Muhammad Saeed", "person", "1950-06-05", "pk"),
        ("Acme Exports Private Limited", "org", "", "in"),
    ]
    assert rows[0]["external_id"] == "upload:C-1" and rows[0]["group"] == "D" and rows[0]["details"]["nationality"] == "Pakistani"
    assert {e["line"]: e["reason"].split(" ")[0] for e in errors} == {4: "Name", 5: "Date", 6: "Kind", 7: "Duplicate"}


def test_file_without_a_name_column_is_rejected_whole():
    rows, errors = parse_customer_csv("id,dob\n1,1980\n")
    assert rows == [] and errors[0]["line"] == 1 and "name column" in errors[0]["reason"]


def test_upload_screens_only_the_uploaded_customers_and_dry_run_writes_nothing(client, service):
    dry = client.post("/customers/import", json={"csv": FILE, "dry_run": True}).json()
    assert dry["valid"] == 2 and dry["rejected"] == 4 and service.customers()["total"] == 0

    done = client.post("/customers/import", json={"csv": FILE}, headers={"X-Satark-User": "analyst"}).json()
    assert done["added"] == 2 and done["screened"] == 2 and done["alerts"] >= 1
    hit = next(h for h in done["hits"] if h["customer"]["name"] == "Hafiz Muhammad Saeed")
    assert hit["case_id"] and hit["customer"]["group"] == "D"
    assert "upload.screened" in [e["action"] for e in service.audit_log()] and service.verify_audit()["ok"]

    again = client.post("/customers/import", json={"csv": FILE}).json()
    assert again["added"] == 0 and again["updated"] == 2 and again["alerts"] == 0  # same customers, alerts already open
    assert client.get("/customers/import/template").text.startswith("customer_id,name,kind")


def test_listing_browse_and_reverse_screening_find_the_customer_behind_an_alert(client, service):
    service.onboard("Hafiz Muhammad Saeed", actor="analyst")
    found = client.get("/entities", params={"q": "Hafiz Muhammad Saeed", "source": "un_sc_sanctions"}).json()
    assert found["total"] >= 1 and found["items"][0]["alerts"] >= 1
    entity_id = found["items"][0]["id"]

    exposure = client.get(f"/entities/{entity_id}/exposure").json()
    top = exposure["matches"][0]
    assert top["customer"]["name"] == "Hafiz Muhammad Saeed" and top["above_threshold"] and top["alert"]["status"] == "open"
    assert client.get("/entities/nope:missing/exposure").status_code == 404
