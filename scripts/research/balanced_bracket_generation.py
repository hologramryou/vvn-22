"""Balanced bracket generation fix for even player distribution."""
import math
import random
from typing import List

def distribute_byes_evenly(names: List[str], byes: int) -> List[str | None]:
    """
    Distribute bye slots evenly across the bracket.
    
    Instead of placing all byes at the end, this spreads them throughout
    so both halves (left and right of the bracket) have similar strength.
    
    Args:
        names: List of player names
        byes: Number of bye slots needed
    
    Returns:
        Seeded list with players and None (bye) evenly distributed
    
    Example:
        names = ["P1", "P2", ..., "P19"]  (19 players)
        byes = 13  (to make 32 = 2^5)
        slots = 32
        
        Result: BYEs distributed at positions spaced ~2.3 apart
        instead of all 13 at the end
    """
    n = len(names)
    slots = n + byes
    
    # Create seeded array
    seeded: List[str | None] = [None] * slots
    
    # Calculate bye positions using even spacing
    # spacing = slots / (byes + 1) gives us the interval between bye positions
    spacing = slots / (byes + 1)
    
    bye_positions = set()
    for bye_num in range(1, byes + 1):
        pos = round((bye_num * spacing)) - 1
        bye_positions.add(min(pos, slots - 1))  # Clamp to valid range
    
    # Fill remaining positions with shuffled players
    player_indices = [i for i in range(slots) if i not in bye_positions]
    shuffled_names = names.copy()
    random.shuffle(shuffled_names)
    
    for idx, pos in enumerate(player_indices):
        if idx < len(shuffled_names):
            seeded[pos] = shuffled_names[idx]
    
    return seeded


def distribute_byes_weighted(names: List[str], byes: int) -> List[str | None]:
    """
    Alternative: Distribute byes with slight top-seeding bias.
    
    Places last items (potentially seeded top players) away from each other
    early in the bracket, with byes interspersed to avoid bye-vs-bye matches.
    """
    n = len(names)
    slots = n + byes
    seeded: List[str | None] = [None] * slots
    
    # Separate potential seeds (last ~10% of list if pre-ordered)
    # and regular players
    seed_threshold = max(1, n // 10)
    regular_players = names[:-seed_threshold] if seed_threshold > 0 else names
    seeded_players = names[-seed_threshold:] if seed_threshold > 0 else []
    
    random.shuffle(regular_players)
    random.shuffle(seeded_players)
    
    # Stagger placement to avoid too many byes in one region
    bye_step = max(2, slots // (byes + 1))
    bye_pos = 0
    bye_count = 0
    player_pool = regular_players + seeded_players
    player_idx = 0
    
    for i in range(slots):
        if bye_count < byes and i == bye_pos:
            seeded[i] = None
            bye_pos += bye_step
            bye_count += 1
        elif player_idx < len(player_pool):
            seeded[i] = player_pool[player_idx]
            player_idx += 1
    
    # Fill any remaining None slots with players (edge case)
    for i in range(slots):
        if seeded[i] is None and player_idx < len(player_pool):
            seeded[i] = player_pool[player_idx]
            player_idx += 1
    
    return seeded


def verify_bracket_balance(seeded: List[str | None], byes: int) -> dict:
    """
    Verify that byes are evenly distributed across both halves.
    
    Returns:
        dict with balance metrics
    """
    half = len(seeded) // 2
    left_half = seeded[:half]
    right_half = seeded[half:]
    
    left_byes = sum(1 for p in left_half if p is None)
    right_byes = sum(1 for p in right_half if p is None)
    
    left_players = half - left_byes
    right_players = half - right_byes
    
    # Calculate balance score (0-100, higher is better)
    max_imbalance = byes
    actual_imbalance = abs(left_byes - right_byes)
    balance_score = 100 * (1 - (actual_imbalance / max(1, max_imbalance)))
    
    return {
        "total_slots": len(seeded),
        "left_players": left_players,
        "right_players": right_players,
        "left_byes": left_byes,
        "right_byes": right_byes,
        "bye_imbalance": actual_imbalance,
        "balance_score": max(0, balance_score),
        "is_balanced": actual_imbalance <= 1,
    }


if __name__ == "__main__":
    # Test with 19 players
    test_names = [f"Player{i}" for i in range(1, 20)]
    byes = 13
    
    print("=" * 60)
    print("BRACKET GENERATION TEST: 19 Players")
    print("=" * 60)
    
    # Test old method (all byes at end)
    print("\n❌ OLD METHOD (Byes at end):")
    old_seeded = test_names + [None] * byes
    old_balance = verify_bracket_balance(old_seeded, byes)
    print(f"  Left half:  {old_balance['left_players']} players, {old_balance['left_byes']} byes")
    print(f"  Right half: {old_balance['right_players']} players, {old_balance['right_byes']} byes")
    print(f"  Balance Score: {old_balance['balance_score']:.1f}%")
    
    # Test new method (even distribution)
    print("\n✅ NEW METHOD (Even distribution):")
    new_seeded = distribute_byes_evenly(test_names, byes)
    new_balance = verify_bracket_balance(new_seeded, byes)
    print(f"  Left half:  {new_balance['left_players']} players, {new_balance['left_byes']} byes")
    print(f"  Right half: {new_balance['right_players']} players, {new_balance['right_byes']} byes")
    print(f"  Balance Score: {new_balance['balance_score']:.1f}%")
    
    # Test weighted method
    print("\n✨ WEIGHTED METHOD (Seeding-aware):")
    weighted_seeded = distribute_byes_weighted(test_names, byes)
    weighted_balance = verify_bracket_balance(weighted_seeded, byes)
    print(f"  Left half:  {weighted_balance['left_players']} players, {weighted_balance['left_byes']} byes")
    print(f"  Right half: {weighted_balance['right_players']} players, {weighted_balance['right_byes']} byes")
    print(f"  Balance Score: {weighted_balance['balance_score']:.1f}%")
    
    # Show bracket structure
    print("\n" + "=" * 60)
    print("Bracket Structure (Even Distribution):")
    print("=" * 60)
    for i in range(0, 32, 2):
        p1 = new_seeded[i] if new_seeded[i] else "BYE"
        p2 = new_seeded[i+1] if new_seeded[i+1] else "BYE"
        print(f"R1 Match {i//2 + 1:2d}: {p1:12} vs {p2:12}")
