#!/usr/bin/env python
"""Clear tournament data and trigger reseed"""
import asyncio
import sys
sys.path.insert(0, '/app')

from sqlalchemy import delete, text
from app.core.database import AsyncSessionLocal
from app.models.tournament import Tournament, TournamentWeightClass, TournamentParticipant, BracketMatch

async def clear_tournament_data():
    async with AsyncSessionLocal() as db:
        # Clear in reverse dependency order
        await db.execute(delete(BracketMatch))
        await db.execute(delete(TournamentParticipant))
        await db.execute(delete(TournamentWeightClass))
        await db.execute(delete(Tournament))
        await db.commit()
        print("✅ Tournament data cleared")

async def main():
    await clear_tournament_data()
    print("\nRun the following to reseed:")
    print("  docker compose exec api bash -c 'cd /app && PYTHONPATH=/app python -m app.seed'")

if __name__ == "__main__":
    asyncio.run(main())
