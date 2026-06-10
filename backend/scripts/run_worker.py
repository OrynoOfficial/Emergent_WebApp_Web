#!/usr/bin/env python3
"""
Stand-alone Arq worker entrypoint.

Production deployment topology:
    api-pod      → runs uvicorn (no in-process worker)
    worker-pod   → runs `python -m scripts.run_worker` (this file)
                   or simply `arq utils.task_queue.WorkerSettings`

Why split?
    - Worker crashes don't take the API down.
    - Workers can be scaled independently of API replicas.
    - Long-running tasks (PDF gen, large fan-outs) don't compete with HTTP
      handlers for the event loop.

Local single-pod dev still runs the in-process worker via
`utils.task_queue.start_worker_in_process` from server.py's startup hook —
either path uses the SAME WorkerSettings, so there's no drift between dev
and prod task code.

Usage:
    cd /app/backend && python -m scripts.run_worker
        or
    cd /app/backend && arq utils.task_queue.WorkerSettings
"""
import sys
from pathlib import Path

# Make the script runnable from /app/backend.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    from arq.worker import run_worker
    from utils.task_queue import WorkerSettings

    # `run_worker` is blocking — uses its own asyncio loop and handles signals.
    run_worker(WorkerSettings)


if __name__ == "__main__":
    main()
