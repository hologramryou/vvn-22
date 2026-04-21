#!/usr/bin/env python
"""Test script to verify student registration"""
import asyncio
import sys
sys.path.insert(0, '/app')

from app.repositories.student_repo import register_student_to_tournament
from app.core.database import AsyncSessionLocal

async def test_registration():
    async with AsyncSessionLocal() as db:
        print("Registering student 485 (Tuan) to tournament...")
        await register_student_to_tournament(db, 485)
        await db.commit()
        print("✅ Registration successful!")
        
        # Verify
        from sqlalchemy import select, text
        result = await db.execute(text(
            "SELECT weight_class_id, student_id FROM tournament_participants WHERE student_id = 485"
        ))
        rows = result.fetchall()
        print(f"\n✅ Found {len(rows)} tournament_participants records for student 485:")
        for row in rows:
            print(f"   Weight Class ID: {row[0]}, Student ID: {row[1]}")

if __name__ == "__main__":
    asyncio.run(test_registration())
