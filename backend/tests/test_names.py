import pytest

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
