#!/usr/bin/env python
"""Test bracket generation with proper bye handling"""
import asyncio
import sys
sys.path.insert(0, '/app')

from sqlalchemy import select, delete
from app.core.database import AsyncSessionLocal
from app.models.tournament import Tournament, TournamentWeightClass, TournamentParticipant, BracketMatch
from app.models.student import Student
from app.repositories.tournament_repo import generate_bracket


async def test_bracket_generation():
    async with AsyncSessionLocal() as db:
        # Get first weight class
        wc = (await db.execute(
            select(TournamentWeightClass)
            .where(TournamentWeightClass.age_type_code == "5")
            .where(TournamentWeightClass.gender == "M")
            .limit(1)
        )).scalar_one_or_none()
        
        if not wc:
            print("❌ No weight class found")
            return
        
        # Get participant count
        all_p = (await db.execute(
            select(TournamentParticipant).where(
                TournamentParticipant.weight_class_id == wc.id
            )
        )).scalars().all()
        
        participant_count = len(all_p)
        
        print(f"✅ Testing weight class: {wc.weight_class_name} ({wc.category}/{wc.age_type_code}/{wc.gender})")
        print(f"   Participants: {participant_count}")
        
        # Generate bracket
        bracket = await generate_bracket(db, wc.id)
        
        if bracket:
            print(f"✅ Bracket generated")
            print(f"   Total matches: {len(bracket.matches)}")
            print(f"   Expected: {participant_count - 1}")
            
            # Check for invalid matches
            invalid = [m for m in bracket.matches if m.player1_name is None and m.player2_name is None]
            print(f"   Invalid (None vs None): {len(invalid)}")
            
            # Show first 5 matches
            print("\n   First matches:")
            for m in bracket.matches[:5]:
                print(f"      Round {m.round} Match {m.match_number}: {m.player1_name} vs {m.player2_name}")
        else:
            print("❌ Failed to generate bracket")
        
        await db.commit()


async def test_bracket_bye_balance():
    from app.repositories.tournament_repo import _build_bracket_for_wc

    names = [f"VĐV{i}" for i in range(1, 20)]
    all_matches, round_matches, r1_list = _build_bracket_for_wc(1, names, "Test")

    r1 = round_matches.get(1, [])
    byes = sum(1 for m in r1 if m.is_bye)
    assert byes == 13, f"Expected 13 bye matches, got {byes}"

    half = len(r1) // 2
    byes_left = sum(1 for m in r1[:half] if m.is_bye)
    byes_right = sum(1 for m in r1[half:] if m.is_bye)

    assert abs(byes_left - byes_right) <= 3, (
        f"Bye imbalance too large: left={byes_left}, right={byes_right}"
    )


if __name__ == "__main__":
    asyncio.run(test_bracket_generation())
    asyncio.run(test_bracket_bye_balance())
