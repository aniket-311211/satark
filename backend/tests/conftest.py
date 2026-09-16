import pytest
from fastapi.testclient import TestClient

from satark.config import ROOT, Settings
from satark.matcher import MatchIndex
from satark.service import Satark
from satark.sources import SOURCES, load_snapshot, to_record


@pytest.fixture(scope="session")
def index() -> MatchIndex:
    return MatchIndex([to_record(row, s.key) for s in SOURCES for row in load_snapshot(ROOT / "data", s.key)])


@pytest.fixture()
def service(tmp_path) -> Satark:
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", redis_url="", reports_dir=tmp_path, anthropic_api_key="")
    app = Satark(settings=settings)
    app.ensure_ready()
    return app


@pytest.fixture()
def client(service):
    from satark.api import create_app

    with TestClient(create_app(service)) as test_client:
        yield test_client
