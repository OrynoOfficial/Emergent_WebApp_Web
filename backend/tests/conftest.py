"""
Pytest session + per-test setup.

Phase-5 made rate-limit storage Redis-backed (db 1). Without flushing
between tests, one test that bursts through the cap (e.g. the Phase-5
write-limit suite) would poison the rate-limit counters for every
subsequent test using the same user.

We flush db 1 BEFORE EACH TEST so every test starts with a fresh budget.
This is safe because:
  - Each Phase-5 test does its saturation burst within a single test
    function — the flush happens before, not during.
  - The other phases never exceed the cap within one test.
"""
import os
import subprocess

import pytest


def _flush_rate_limit_storage():
    url = os.environ.get("RATE_LIMIT_STORAGE", "")
    if "redis://" not in url:
        return
    try:
        db = url.rstrip("/").rsplit("/", 1)[-1]
        host_port = url.split("://")[1].split("/", 1)[0]
        host = host_port.split(":")[0]
        port = host_port.split(":")[1] if ":" in host_port else "6379"
        subprocess.run(
            ["redis-cli", "-h", host, "-p", port, "-n", db, "FLUSHDB"],
            check=False, capture_output=True, timeout=3,
        )
    except Exception:
        pass


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """Flush the rate-limit Redis DB so each test has a fresh budget."""
    _flush_rate_limit_storage()
    yield
