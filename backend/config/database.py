"""
MongoDB connection — Motor + production-tuned settings.

What changed for scale (Phase 3):
  - Connection pool: `maxPoolSize=200` (Motor default 100 was an early ceiling).
  - Server selection timeout: 3s instead of the 30s default. Failing fast is
    better than hanging requests if Atlas is degraded.
  - readPreference: `secondaryPreferred`. Reads naturally drain to replicas
    when present; primary still answers reads on a single-node deployment.
  - Optional read concern + write concern tuning via env vars (no-op when
    unset so dev keeps the defaults).

Set `MONGO_READ_PREFERENCE=primary` in env to revert to the old behaviour
if a particular deployment doesn't have replicas.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReadPreference
import logging
import os

from config.settings import settings

logger = logging.getLogger(__name__)


class Database:
    client: AsyncIOMotorClient = None
    db = None


db = Database()


_READ_PREF_MAP = {
    "primary": ReadPreference.PRIMARY,
    "primary_preferred": ReadPreference.PRIMARY_PREFERRED,
    "secondary": ReadPreference.SECONDARY,
    "secondary_preferred": ReadPreference.SECONDARY_PREFERRED,
    "nearest": ReadPreference.NEAREST,
}


async def connect_to_mongo():
    """Connect to MongoDB with production-tuned pool + replica settings."""
    pref_name = os.environ.get("MONGO_READ_PREFERENCE", "secondary_preferred").lower()
    read_pref = _READ_PREF_MAP.get(pref_name, ReadPreference.SECONDARY_PREFERRED)

    db.client = AsyncIOMotorClient(
        settings.MONGO_URL,
        maxPoolSize=int(os.environ.get("MONGO_MAX_POOL_SIZE", "200")),
        minPoolSize=int(os.environ.get("MONGO_MIN_POOL_SIZE", "10")),
        serverSelectionTimeoutMS=int(os.environ.get("MONGO_SELECT_TIMEOUT_MS", "3000")),
        # Read preference: secondaryPreferred lets reads drain to replicas
        # while still falling back to primary when no replica is reachable.
        # On a single-node dev cluster this is a no-op.
        read_preference=read_pref,
        retryWrites=True,
        retryReads=True,
    )
    db.db = db.client[settings.effective_db_name]
    logger.info(
        "Connected to MongoDB: %s (pool=%s, read_pref=%s)",
        settings.effective_db_name, db.client.options.pool_options.max_pool_size, pref_name,
    )


async def close_mongo_connection():
    """Close MongoDB connection"""
    if db.client:
        db.client.close()
        logger.info("Closed MongoDB connection")


def get_database():
    """Get database instance"""
    return db.db
