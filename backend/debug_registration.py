#!/usr/bin/env python
"""Debug registration script"""
import asyncio
import sys
sys.path.insert(0, '/app')

from sqlalchemy import select, and_
from app.core.database import AsyncSessionLocal
from app.models.student import Student
from app.models.tournament import Tournament, TournamentWeightClass, TournamentParticipant
from app.core.constants import WEIGHT_CLASSES

async def debug_registration():
    async with AsyncSessionLocal() as db:
        student_id = 485
        
        # Step 1: Get student
        student = await db.execute(
            select(Student).where(Student.id == student_id)
        )
        student = student.scalar_one_or_none()
        print(f"✅ Student found: {student.full_name if student else 'NOT FOUND'}")
        if student:
            print(f"   - weight_classes: {student.weight_classes}")
            print(f"   - category_type: {student.category_type}")
            print(f"   - category_loai: {student.category_loai}")
            print(f"   - gender: {student.gender}")
        
        # Step 2: Get tournament
        tournament = await db.execute(
            select(Tournament).where(Tournament.status == "active").order_by(Tournament.id).limit(1)
        )
        tournament = tournament.scalar_one_or_none()
        print(f"\n✅ Tournament found: {tournament.id if tournament else 'NOT FOUND'}")
        if tournament:
            print(f"   - status: {tournament.status}")
        
        if not student or not tournament:
            print("Missing student or tournament")
            return
        
        # Step 3: Check if student has required fields
        if not student.weight_classes or not student.category_type or not student.category_loai:
            print("\n❌ Student missing required fields")
            return
        
        # Step 4: Get weight class labels
        wc_list = WEIGHT_CLASSES.get(student.gender, WEIGHT_CLASSES["M"])
        selected_labels = []
        for val in student.weight_classes:
            wc = next((w for w in wc_list if w["value"] == val), None)
            if wc:
                # Normalize: remove spaces to match tournament_weight_classes format
                normalized_label = wc["label"].replace(" ", "")
                selected_labels.append(normalized_label)
        print(f"\n✅ Selected weight class labels (normalized): {selected_labels}")
        
        # Step 5: Find matching tournament weight classes
        matching_wcs = await db.execute(
            select(TournamentWeightClass)
            .where(
                and_(
                    TournamentWeightClass.tournament_id == tournament.id,
                    TournamentWeightClass.gender == student.gender,
                    TournamentWeightClass.category == student.category_type,
                    TournamentWeightClass.age_type_code == student.category_loai,
                    TournamentWeightClass.weight_class_name.in_(selected_labels),
                )
            )
        )
        matching_wcs = matching_wcs.scalars().all()
        print(f"\n✅ Matching tournament weight classes: {len(matching_wcs)}")
        for wc in matching_wcs:
            print(f"   - ID: {wc.id}, Weight: {wc.weight_class_name}, Gender: {wc.gender}, Category: {wc.category}, Age Type: {wc.age_type_code}")
        
        if not matching_wcs:
            print("\n❌ No matching weight classes found!")
            print("Searching with different criteria...")
            
            # Debug: Show all tournament weight classes for this tournament
            all_wcs = await db.execute(
                select(TournamentWeightClass).where(
                    TournamentWeightClass.tournament_id == tournament.id
                )
            )
            all_wcs = all_wcs.scalars().all()
            print(f"\nAll tournament weight classes in tournament {tournament.id}:")
            for wc in all_wcs[:10]:
                print(f"   - ID: {wc.id}, Weight: {wc.weight_class_name}, Gender: {wc.gender}, Category: {wc.category}, Age Type: {wc.age_type_code}")

if __name__ == "__main__":
    asyncio.run(debug_registration ())
