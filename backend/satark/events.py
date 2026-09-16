import json
import logging
import socket
from collections.abc import Callable
from typing import Protocol

log = logging.getLogger("satark.events")

DELTA_STREAM = "satark:watchlist.delta"
GROUP = "rescreen"

Handler = Callable[[dict], None]


class EventBus(Protocol):
    kind: str

    def publish(self, stream: str, payload: dict) -> str: ...

    def subscribe(self, stream: str, handler: Handler) -> None: ...


class MemoryBus:
    kind = "memory"

    def __init__(self) -> None:
        self.handlers: dict[str, list[Handler]] = {}
        self.published = 0

    def publish(self, stream: str, payload: dict) -> str:
        self.published += 1
        for handler in self.handlers.get(stream, []):
            handler(payload)
        return f"mem-{self.published}"

    def subscribe(self, stream: str, handler: Handler) -> None:
        self.handlers.setdefault(stream, []).append(handler)


class RedisBus:
    kind = "redis"

    def __init__(self, url: str) -> None:
        import redis

        self.client = redis.Redis.from_url(url, decode_responses=True, socket_timeout=30, socket_connect_timeout=5)
        self.client.ping()

    def publish(self, stream: str, payload: dict) -> str:
        return self.client.xadd(stream, {"payload": json.dumps(payload)}, maxlen=10_000, approximate=True)

    def subscribe(self, stream: str, handler: Handler) -> None:
        raise RuntimeError("RedisBus delivers through consume(); run `satark worker`")

    def ensure_group(self, stream: str, group: str) -> None:
        import redis

        try:
            self.client.xgroup_create(stream, group, id="0", mkstream=True)
        except redis.ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    def lag(self, stream: str, group: str) -> int:
        try:
            groups = self.client.xinfo_groups(stream)
        except Exception:
            return 0
        for info in groups:
            if info.get("name") == group:
                return int(info.get("lag") or 0) + int(info.get("pending") or 0)
        return 0

    def consume(self, stream: str, group: str, handler: Handler, block_ms: int = 2000, once: bool = False) -> int:
        import redis

        self.ensure_group(stream, group)
        consumer = socket.gethostname()
        handled = 0
        while True:
            try:
                batches = self.client.xreadgroup(group, consumer, {stream: ">"}, count=10, block=block_ms)
            except (redis.TimeoutError, redis.ConnectionError) as exc:
                log.warning("redis read interrupted (%s); retrying", exc)
                if once:
                    return handled
                continue
            for _, messages in batches or []:
                for message_id, fields in messages:
                    try:
                        handler(json.loads(fields["payload"]))
                        self.client.xack(stream, group, message_id)
                        handled += 1
                    except Exception:
                        log.exception("handler failed for %s", message_id)
            if once:
                return handled


def make_bus(redis_url: str) -> EventBus:
    if redis_url:
        try:
            return RedisBus(redis_url)
        except Exception as exc:
            log.warning("redis unavailable (%s); using in-memory bus", exc)
    return MemoryBus()
