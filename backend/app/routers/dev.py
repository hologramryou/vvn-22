"""Dev endpoints — seed reset, manual registration, etc."""
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, delete
from app.core.database import get_db
from app.repositories.student_repo import register_student_to_tournament

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/register-student-to-tournament/{student_id}")
async def dev_register_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Dev endpoint to manually register student to tournament"""
    await register_student_to_tournament(db, student_id)
    await db.commit()
    return {"success": True, "student_id": student_id}


@router.post("/register-all-students-to-tournament")
async def dev_register_all_students(db: AsyncSession = Depends(get_db)):
    """Re-register ALL active students to the current tournament. Use after schema/logic changes."""
    from sqlalchemy import select
    from app.models.student import Student
    students = (await db.execute(select(Student.id).where(Student.status == "active"))).scalars().all()
    for sid in students:
        await register_student_to_tournament(db, sid)
    await db.commit()
    return {"success": True, "registered": len(students)}


@router.post("/reset-and-seed")
async def reset_and_seed(db: AsyncSession = Depends(get_db)):
    """Drop all data and re-run seed. Only available in development/staging.
    Protect with ENVIRONMENT check so it never runs in production.
    Call: POST /dev/reset-and-seed
    """
    env = os.getenv("ENVIRONMENT", "development")
    if env == "production":
        raise HTTPException(status_code=403, detail="Not available in production")

    # Truncate in FK-safe order
    await db.execute(text("TRUNCATE TABLE bracket_matches, quyen_slots, tournament_participants, tournament_weight_classes, tournaments, student_clubs, students, users RESTART IDENTITY CASCADE"))
    await db.execute(text("TRUNCATE TABLE clubs, provinces RESTART IDENTITY CASCADE"))
    await db.commit()

    # Re-run seed
    from app.seed import seed as run_seed
    await run_seed()

    return {"status": "ok", "message": "Database reset and seeded successfully"}
