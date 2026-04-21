#!/bin/sh
set -e

echo "Running database migrations..."
until alembic upgrade head; do
  echo "Migration failed, retrying in 3s..."
  sleep 3
done

if [ "${FORCE_RESEED}" = "true" ]; then
  echo "FORCE_RESEED=true: truncating all tables..."
  python -c "
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def reset():
    async with AsyncSessionLocal() as db:
        await db.execute(text('TRUNCATE TABLE bracket_matches, quyen_slots, tournament_participants, tournament_weight_classes, tournaments, student_clubs, students, users RESTART IDENTITY CASCADE'))
        await db.execute(text('TRUNCATE TABLE clubs, provinces RESTART IDENTITY CASCADE'))
        await db.commit()
        print('All tables truncated.')

asyncio.run(reset())
"
fi

echo "Seeding initial data..."
python -m app.seed

echo "Starting server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
