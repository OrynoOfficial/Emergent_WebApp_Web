#!/usr/bin/env python3
"""
One-time migration: enforce **one owner per operator**.

Rule:
    The user whose ``_id`` matches ``operators.owner_user_id`` stays as the
    sole owner. Any other user with ``operator_role == "owner"`` who belongs
    to the same operator is demoted to ``manager`` (closest equivalent role
    that still has team-edit privileges; admins can promote them further if
    needed).

Side effects
    * Does NOT touch the platform-level ``role`` field (super_admin / admin).
    * Records demotions in ``audit_log`` so the change is reversible if
      anything was wrong.

Usage
    python3 /app/backend/scripts/migrate_single_owner_per_operator.py [--dry-run]
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("MONGO_DB_NAME") or os.environ.get("DB_NAME") or "oryno_webapp"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("single-owner-migration")

DEMOTE_TO = "manager"


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]

    operators = await db.operators.find({}, {"_id": 1, "name": 1, "owner_user_id": 1}).to_list(None)
    log.info("Scanning %d operators…", len(operators))

    total_demoted = 0
    for op in operators:
        op_id = op["_id"]
        rightful_owner_id = op.get("owner_user_id")

        # Find every "owner" sitting on this operator.
        owners = await db.users.find(
            {"operator_id": op_id, "operator_role": "owner"},
            {"_id": 1, "email": 1, "full_name": 1, "operator_role": 1},
        ).to_list(None)

        if len(owners) <= 1:
            continue  # already 0 or 1 owner — nothing to do

        # Anyone whose id is NOT the rightful owner gets demoted.
        offenders = [u for u in owners if u["_id"] != rightful_owner_id]
        if not offenders:
            continue

        log.info(
            "%s (%s): %d owners found, demoting %d → %s",
            op.get("name", "?"), op_id, len(owners), len(offenders), DEMOTE_TO,
        )
        for u in offenders:
            log.info("   – demoting %s (%s)", u.get("email") or u.get("full_name") or u["_id"], u["_id"])
            if args.dry_run:
                continue
            await db.users.update_one(
                {"_id": u["_id"]},
                {"$set": {"operator_role": DEMOTE_TO, "updated_at": datetime.now(timezone.utc)}},
            )
            await db.audit_log.insert_one({
                "_id": f"single-owner-migration:{u['_id']}:{int(datetime.now(timezone.utc).timestamp())}",
                "actor": "system:migration",
                "action": "demote_extra_owner",
                "subject_type": "user",
                "subject_id": u["_id"],
                "operator_id": op_id,
                "before": "owner",
                "after": DEMOTE_TO,
                "reason": "Enforced one-owner-per-operator rule. Rightful owner = operators.owner_user_id.",
                "created_at": datetime.now(timezone.utc),
            })
            total_demoted += 1

    log.info("Done. %s%d user(s) demoted.", "[DRY-RUN] " if args.dry_run else "", total_demoted)


if __name__ == "__main__":
    asyncio.run(main())
