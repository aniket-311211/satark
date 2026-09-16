import pytest

from satark.matcher import MatchIndex, Record
from satark.names import devanagari_to_latin, normalize, phonetic_key
from satark.variants import latin_to_devanagari


@pytest.mark.parametrize(
    "devanagari, latin",
    [
        ("सुरेश", "suresh"),
        ("अमरनाथ", "amarnaath"),
        ("कमला", "kamlaa"),
        ("प्रकाश", "prakaash"),
        ("आर्य", "aarya"),
        ("गांधी", "gaandhee"),
        ("चंपा", "champaa"),
        ("राजेंद्र", "raajendra"),
    ],
)
def test_hindi_schwa_deletion(devanagari, latin):
    assert devanagari_to_latin(devanagari) == latin


@pytest.mark.parametrize(
    "a, b",
    [
        ("Shrivastava", "Srivastav"),
        ("Rajender", "Rajendra"),
        ("Mohd", "Mohammed"),
        ("Laxmi", "Lakshmi"),
        ("Wasim", "Vasim"),
        ("Sambhaajee", "Sambhaji"),
    ],
)
def test_phonetic_equivalence(a, b):
    na, nb = normalize(a), normalize(b)
    assert na.keys == nb.keys


def test_honorifics_relations_and_initials():
    norm = normalize("Shri R.K. Srivastava S/O Late Ram Lal")
    assert norm.text == "r k srivastava"
    assert [t.initial for t in norm.tokens] == [True, True, False]
    assert any("honorific" in n for n in norm.notes)
    assert any("relation" in n for n in norm.notes)


def test_all_caps_honorific_is_not_split_into_initials():
    assert normalize("MR. VAIBHAV GANDHI").text == "vaibhav gandhi"
    assert normalize("RK Sharma").text == "r k sharma"


def test_org_suffixes_and_huf():
    firm = normalize("M/s Shivsathi Mercantile Pvt. Ltd.")
    assert firm.kind == "org" and firm.text == "shivsathi mercantile"
    assert normalize("Rajiv Sanghvi-HUF").text == "rajiv sanghvi"


def test_gujarati_suffix_and_abbreviation():
    assert normalize("Rameshbhai Patel").text == "ramesh patel"
    assert normalize("Rajesh Kr. Singh").text == "rajesh kumar singh"


def test_devanagari_round_trip_keys():
    for name in ["Umashankar Sharan", "Lakshmi Narayan", "Mohammad Irfan Shaikh", "Priya Sharma"]:
        assert normalize(latin_to_devanagari(name)).keys == normalize(name).keys


def test_phonetic_key_is_stable():
    assert phonetic_key("shrivastava") == phonetic_key("srivastav")


def test_org_acronym_stays_atomic_not_split_into_initials():
    # ponytail: real-data regression -- "KSN" is an org acronym, not initials.
    norm = normalize("KSN IMPEX PRIVATE LIMITED")
    assert norm.kind == "org"
    assert [t.text for t in norm.tokens] == ["ksn", "impex"]
    assert [t.initial for t in norm.tokens] == [False, False]

    norm2 = normalize("GRS EXPORTS")
    assert norm2.kind == "org"
    assert [t.text for t in norm2.tokens] == ["grs", "exports"]
    assert [t.initial for t in norm2.tokens] == [False, False]


def test_person_initials_still_split():
    assert [t.initial for t in normalize("RK Sharma").tokens] == [True, True, False]
    assert normalize("RK Sharma").text == "r k sharma"
    assert [t.initial for t in normalize("R.K. Sharma").tokens] == [True, True, False]
    assert normalize("R.K. Sharma").text == "r k sharma"


def test_ksn_impex_no_longer_a_false_positive():
    records = [
        Record(id="fp", name="S K Impex (Mahendrakumar Bishnoi)", schema="LegalEntity", dataset="t", source="t"),
        Record(id="unrelated", name="Classic Credit Ltd", schema="LegalEntity", dataset="t", source="t"),
        Record(id="tp", name="KSN Impex Private Limited", schema="LegalEntity", dataset="t", source="t"),
    ]
    index = MatchIndex(records)
    result = index.screen("KSN IMPEX PRIVATE LIMITED", min_score=0)
    scores = {m.entity_id: m.score for m in result.matches}
    assert scores["fp"] < 80
    assert scores["tp"] >= 80
