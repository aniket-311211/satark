import argparse
import json
import logging
import sys
from pathlib import Path

GATES = {"precision": 0.93, "recall": 0.90, "f1": 0.92}


def cmd_ingest(args) -> None:
    from .service import Satark

    app = Satark()
    if args.custom:
        print(json.dumps(app.ingest_custom(Path(args.custom), args.key), indent=2))
        return
    summary = app.ingest(mode="remote" if args.remote else "snapshot", sources=args.source or None,
                         actor="cli", update_snapshot=args.update_snapshot)
    print(json.dumps(summary, indent=2))


def cmd_seed(args) -> None:
    from .service import Satark

    app = Satark()
    app.ensure_ready()
    if args.synthetic:
        from .seed import seed_customers

        print(json.dumps(seed_customers(app, count=args.customers, planted=args.planted, seed=args.seed), indent=2))
        return
    from .book import load_book

    summary = app.import_book(load_book(app.settings.data_dir), actor="cli")
    print(json.dumps({**summary, **app.rescreen_all(actor="cli", trigger="onboarding")}, indent=2))


def cmd_book_build(args) -> None:
    import time

    from . import book
    from .config import get_settings
    from .sources import load_snapshot

    settings = get_settings()
    groups = "".join(g for g in "ABC" if g in args.groups.upper())
    rows, started = [], time.monotonic()
    if "A" in groups:
        rows += book.build_group_a()
        print(f"group A: {sum(r['group'] == 'A' for r in rows)} LSE-issued Indian LEIs ({time.monotonic() - started:.0f}s)")
    if "C" in groups:
        pairs = book.nse_active_company_pairs(load_snapshot(settings.data_dir, "in_nse_debarred"))
        found = book.build_group_c(pairs, progress=print)
        rows += found
        print(f"group C: {len(found)} LEI holders among {len(pairs)} active debarred companies ({time.monotonic() - started:.0f}s)")
    if "B" in groups:
        if not settings.companies_house_key:
            sys.exit("group B needs SATARK_COMPANIES_HOUSE_KEY (free: developer.company-information.service.gov.uk)")
        found = book.build_group_b(settings.companies_house_key, limit=args.ch_limit)
        rows += found
        officers = sum(r["external_id"].startswith("ch-officer:") for r in found)
        conflicts = sum(bool(r["details"].get("ownership_conflict", {}).get("conflict")) for r in found)
        print(f"group B: {len(found) - officers} UK subsidiaries of Indian parents, {officers} current officers, "
              f"{conflicts} ownership conflicts ({time.monotonic() - started:.0f}s)")
    book.write_book(settings.data_dir, rows, groups)
    print(f"wrote data/book for groups {groups}")


def cmd_eval(args) -> None:
    from .config import get_settings
    from .evaluation import evaluate, format_table, write_report
    from .matcher import MatchIndex
    from .sources import SOURCES, load_snapshot, to_record

    settings = get_settings()
    records = [to_record(row, s.key) for s in SOURCES for row in load_snapshot(settings.data_dir, s.key)]
    if args.export_decisions:
        export_decisions(settings.data_dir / "eval" / "real_cases.csv")
        return
    if args.real:
        from .evaluation import evaluate_real, load_real_cases

        result = evaluate_real(MatchIndex(records), load_real_cases(settings.data_dir / "eval" / "real_cases.csv"), settings.alert_threshold)
        print(f"real labelled cases: {result['passed']}/{result['cases']} passed at threshold {result['threshold']:.0f}")
        for failure in result["failures"]:
            print(f"  FAIL {failure['expected']:<8} {failure['score']:5.1f}  {failure['query']}  ({failure['note']})")
        if args.gate and result["failures"]:
            sys.exit(1)
        return
    report = evaluate(MatchIndex(records), positives=args.positives, negatives=args.negatives, seed=args.seed)
    path = write_report(report, settings.reports_dir)
    print(format_table(report))
    print(f"\nper-transform recall (satark): {json.dumps(report['systems']['satark']['per_transform'])}")
    print(f"latency: {report['systems']['satark']['latency_ms']}  report: {path}")
    if args.gate:
        satark = report["systems"]["satark"]
        failed = {k: satark[k] for k, floor in GATES.items() if satark[k] < floor}
        if failed:
            print(f"quality gate failed: {failed} (floors {GATES})")
            sys.exit(1)
        print(f"quality gate passed (floors {GATES})")


def export_decisions(path: Path) -> None:
    """Closed maker-checker decisions become labelled real cases: confirmed -> match, discarded -> no_match."""
    import csv

    from sqlalchemy import select

    from .models import Alert, Customer
    from .service import Satark

    with open(path, newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    seen = {(r["query"], r["entity_id"]) for r in rows}
    added = 0
    with Satark().Session() as session:
        decided = session.execute(select(Alert, Customer).join(Customer, Customer.id == Alert.customer_id)
                                  .where(Alert.status.in_(("confirmed", "discarded")))).all()
        for alert, customer in decided:
            if (customer.name, alert.entity_id) in seen:
                continue
            seen.add((customer.name, alert.entity_id))
            rows.append({"query": customer.name, "kind": customer.kind, "entity_id": alert.entity_id,
                         "expected": "match" if alert.status == "confirmed" else "no_match", "origin": "analyst_decision",
                         "note": f"case {alert.case_id}, approved by {alert.decided_by}: {alert.note}"})
            added += 1
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["query", "kind", "entity_id", "expected", "origin", "note"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"exported {added} new decisions; {len(rows)} labelled real cases in {path}")


def cmd_serve(args) -> None:
    import uvicorn

    uvicorn.run("satark.api:app", host=args.host, port=args.port, reload=args.reload, workers=None if args.reload else args.workers)


def cmd_worker(args) -> None:
    from .events import DELTA_STREAM, GROUP, RedisBus
    from .service import Satark

    app = Satark()
    if not isinstance(app.bus, RedisBus):
        print("worker needs SATARK_REDIS_URL; without Redis the API rescreens inline")
        sys.exit(1)
    app.ensure_ready(bootstrap=False)
    from prometheus_client import start_http_server

    start_http_server(args.metrics_port)
    logging.getLogger("satark").info("rescreen worker listening on %s (metrics on :%s)", DELTA_STREAM, args.metrics_port)
    app.bus.consume(DELTA_STREAM, GROUP, app.handle_delta)


def cmd_rescreen(args) -> None:
    from .service import Satark

    app = Satark()
    app.ensure_ready()
    print(json.dumps(app.rescreen_all(actor="cli"), indent=2))


def cmd_news_poll(args) -> None:
    from .config import get_settings
    from .media.feeds import poll

    db = get_settings().data_dir / "cache" / "news.db"
    db.parent.mkdir(parents=True, exist_ok=True)
    results = poll(db)
    for r in results:
        print(f"{r['name']:<26} {r['status']:<14} new {r['new']:>4}  total {r['total']:>5}")
    print(f"index: {db}")


def cmd_mcp(args) -> None:
    from .mcp_server import main

    main()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s", stream=sys.stderr)
    parser = argparse.ArgumentParser(prog="satark", description="India-first KYC screening engine")
    sub = parser.add_subparsers(dest="command", required=True)

    ingest = sub.add_parser("ingest", help="load watchlists into the database")
    ingest.add_argument("--remote", action="store_true", help="download the latest lists from OpenSanctions")
    ingest.add_argument("--update-snapshot", action="store_true", help="overwrite data/snapshot with the download")
    ingest.add_argument("--source", action="append", help="limit to one source key; repeatable")
    ingest.add_argument("--custom", help="CSV with name[,aliases,schema,birth_date,countries] columns")
    ingest.add_argument("--key", default="custom_list", help="source key for --custom")
    ingest.set_defaults(func=cmd_ingest)

    seed = sub.add_parser("seed", help="load watchlists and the real customer book, then screen everyone")
    seed.add_argument("--synthetic", action="store_true", help="use the old Faker book with planted variants instead")
    seed.add_argument("--customers", type=int, default=1000)
    seed.add_argument("--planted", type=int, default=25)
    seed.add_argument("--seed", type=int, default=11)
    seed.set_defaults(func=cmd_seed)

    ev = sub.add_parser("eval", help="benchmark Satark against exact and RapidFuzz baselines")
    ev.add_argument("--positives", type=int, default=1000)
    ev.add_argument("--negatives", type=int, default=1000)
    ev.add_argument("--seed", type=int, default=7)
    ev.add_argument("--gate", action="store_true", help="exit 1 if quality floors are missed")
    ev.add_argument("--export-decisions", action="store_true", help="append closed case decisions to data/eval/real_cases.csv")
    ev.add_argument("--real", action="store_true", help="check the labelled real cases in data/eval/real_cases.csv instead")
    ev.set_defaults(func=cmd_eval)

    serve = sub.add_parser("serve", help="run the REST API")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument("--reload", action="store_true")
    serve.add_argument("--workers", type=int, default=1)
    serve.set_defaults(func=cmd_serve)

    worker = sub.add_parser("worker", help="consume watchlist deltas from Redis and rescreen customers")
    worker.add_argument("--metrics-port", type=int, default=9101)
    worker.set_defaults(func=cmd_worker)
    sub.add_parser("rescreen", help="rescreen every customer against the full index").set_defaults(func=cmd_rescreen)
    sub.add_parser("mcp", help="run the MCP server over stdio").set_defaults(func=cmd_mcp)
    book_cmd = sub.add_parser("book", help="real customer book from GLEIF and Companies House")
    build = book_cmd.add_subparsers(dest="book_command", required=True).add_parser("build", help="rebuild data/book snapshots")
    build.add_argument("--groups", default="ABC", help="A: LSE-issued Indian LEIs, B: UK subsidiaries of Indian groups, C: debarred LEI holders")
    build.add_argument("--ch-limit", type=int, default=None, help="cap group B companies (Companies House calls)")
    build.set_defaults(func=cmd_book_build)

    news = sub.add_parser("news", help="adverse-media index built from allowlisted regulator and publisher feeds")
    news.add_subparsers(dest="news_command", required=True).add_parser("poll", help="fetch new items into the local index").set_defaults(func=cmd_news_poll)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
