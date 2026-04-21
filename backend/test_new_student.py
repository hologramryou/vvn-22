#!/usr/bin/env python
"""Test creating a new student and verify it gets auto-registered to tournament"""
import asyncio
import sys
from datetime import date
from decimal import Decimal
sys.path.insert(0, '/app')

from app.core.database import AsyncSessionLocal
from app.models.student import Student, StudentClub
from app.repositories.student_repo import register_student_to_tournament
from sqlalchemy import select

async def test_create_student():
    async with AsyncSessionLocal() as db:
        # Get a club
        from app.models.club import Club
        club_result = await db.execute(select(Club).limit(1))
        club = club_result.scalar_one_or_none()
        if not club:
            print("❌ No club found")
            return
        
        # Create new student
        student = Student(
            code="TEST-NEW-001",
            full_name="Test Student New",
            date_of_birth=date(2010, 5, 15),
            gender="M",
            id_number="999999999999",
            phone="0901234567",
            current_belt="Lam đai nhập môn",
            join_date=date(2024, 1, 1),
            weight_class=Decimal("45"),
            weight_classes=[Decimal("45"), Decimal("48")],
            category_type="phong_trao",
            category_loai="2",  # Loại 2: 7-9 tuổi
            status="active",
            compete_events=["sparring"],
        )
        db.add(student)
        await db.flush()
        student_id = student.id
        
        # Add to club
        db.add(StudentClub(
            student_id=student_id,
            club_id=club.id,
            joined_at=date(2024, 1, 1),
            is_current=True,
        ))
        
        # Register to tournament
        await register_student_to_tournament(db, student_id)
        await db.commit()
        
        print(f"✅ Created student ID {student_id}")
        
        # Verify registration
        from app.models.tournament import TournamentParticipant
        result = await db.execute(
            select(TournamentParticipant).where(
                TournamentParticipant.student_id == student_id
            )
        )
        records = result.scalars().all()
        print(f"✅ Found {len(records)} tournament_participants records:")
        for r in records:
            print(f"   - Weight Class ID: {r.weight_class_id}")

if __name__ == "__main__":
    asyncio.run(test_create_student())
