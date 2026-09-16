import random

from faker import Faker
from sqlalchemy import select

from .evaluation import clean_display, eligible_people
from .models import Customer
from .service import Satark
from .variants import VariantMaker

PLANT_STYLES = ["honorific", "initials", "reorder", "spelling", "devanagari", "relation", "drop_middle"]
SEGMENTS = ["retail", "retail", "retail", "wealth", "sme", "nri"]


def seed_customers(app: Satark, count: int = 1000, planted: int = 25, seed: int = 11) -> dict:
    rng = random.Random(seed)
    faker = Faker("en_IN")
    faker.seed_instance(seed)
    maker = VariantMaker(seed)
    rows: list[Customer] = []
    for _ in range(count - planted):
        if rng.random() < 0.08:
            name = f"{faker.last_name()} {rng.choice(['Traders', 'Enterprises', 'Exports', 'Infra Projects', 'Capital'])} Pvt Ltd"
            rows.append(Customer(name=name, kind="org", country="in", segment="sme"))
        else:
            dob = faker.date_of_birth(minimum_age=21, maximum_age=80).isoformat()
            rows.append(Customer(name=faker.name(), kind="person", birth_date=dob, country="in", segment=rng.choice(SEGMENTS)))
    people = eligible_people(app.index)
    rng.shuffle(people)
    made = 0
    for record in people:
        if made >= planted:
            break
        style = PLANT_STYLES[made % len(PLANT_STYLES)]
        variant = maker.apply(clean_display(record.name), style)
        if not variant:
            continue
        rows.append(Customer(name=variant, kind="person", country="in", segment=rng.choice(SEGMENTS)))
        made += 1
    rng.shuffle(rows)
    with app.Session() as session:
        existing = session.scalar(select(Customer.id).limit(1))
        if existing:
            return {"skipped": True, "reason": "customers already exist"}
        session.add_all(rows)
        app.audit(session, "seed", "customers.seed", "customers", count=len(rows), planted=made)
        session.commit()
    result = app.rescreen_all(actor="seed", trigger="onboarding")
    return {"customers": len(rows), "planted_variants": made, **result}
