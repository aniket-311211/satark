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
    from .seed import seed_customers
    from .service import Satark

    app = Satark()
    app.ensure_ready()
    print(json.dumps(seed_customers(app, count=args.customers, planted=args.planted, seed=args.seed), indent=2))


def cmd_eval(args) -> None:
    from .config import get_settings
    from .evaluation import evaluate, format_table, write_report
    from .matcher import MatchIndex
    from .sources import SOURCES, load_snapshot, to_record

    settings = get_settings()
    records = [to_record(row, s.key) for s in SOURCES for row in load_snapshot(settings.data_dir, s.key)]
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

    seed = sub.add_parser("seed", help="create synthetic customers and screen them")
    seed.add_argument("--customers", type=int, default=1000)
    seed.add_argument("--planted", type=int, default=25)
    seed.add_argument("--seed", type=int, default=11)
    seed.set_defaults(func=cmd_seed)

    ev = sub.add_parser("eval", help="benchmark Satark against exact and RapidFuzz baselines")
    ev.add_argument("--positives", type=int, default=1000)
    ev.add_argument("--negatives", type=int, default=1000)
    ev.add_argument("--seed", type=int, default=7)
    ev.add_argument("--gate", action="store_true", help="exit 1 if quality floors are missed")
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

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
