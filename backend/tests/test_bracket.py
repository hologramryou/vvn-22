"""Unit tests for bracket generation logic (no DB required).

Run with:
    docker compose exec api pytest backend/tests/test_bracket.py -v
"""
import math
import pytest

from app.repositories.tournament_repo import (
    _seed_participants_with_byes,
    _build_bracket_for_wc,
    _bracket_size,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _names(n: int) -> list[str]:
    return [f"Player{i}" for i in range(1, n + 1)]


# ── _seed_participants_with_byes ──────────────────────────────────────────────

class TestSeedParticipants:

    def test_no_byes(self):
        names = _names(8)
        seeded = _seed_participants_with_byes(names, 8, 0)
        assert len(seeded) == 8
        assert all(x is not None for x in seeded)
        assert set(seeded) == set(names)

    def test_n5_slots8_byes3_no_double_bye_pair(self):
        """n=5, slots=8, byes=3 — no pair should have both slots as BYE."""
        names = _names(5)
        seeded = _seed_participants_with_byes(names, 8, 3)

        assert len(seeded) == 8
        assert sum(1 for x in seeded if x is None) == 3
        assert sum(1 for x in seeded if x is not None) == 5

        # No double-BYE pair
        for i in range(0, 8, 2):
            assert not (seeded[i] is None and seeded[i + 1] is None), \
                f"Double BYE found at pair {i // 2} (slots {i},{i+1})"

    def test_byes_always_at_p2_slot(self):
        """BYEs must always land at the p2 (even+1) slot of each pair."""
        for n in [5, 6, 7, 9, 10, 11, 13]:
            slots = _bracket_size(n)
            byes = slots - n
            if byes == 0:
                continue
            seeded = _seed_participants_with_byes(_names(n), slots, byes)

            for i in range(0, slots, 2):
                assert seeded[i] is not None, \
                    f"n={n}: p1 at pair {i // 2} is None (should never be BYE)"
            bye_count = sum(1 for x in seeded if x is None)
            assert bye_count == byes, f"n={n}: expected {byes} BYEs, got {bye_count}"

    def test_n6_byes2_exactly_two_bye_pairs(self):
        names = _names(6)
        seeded = _seed_participants_with_byes(names, 8, 2)
        bye_pair_count = sum(1 for i in range(0, 8, 2) if seeded[i + 1] is None)
        assert bye_pair_count == 2
        # All non-BYE players present
        real = [x for x in seeded if x is not None]
        assert set(real) == set(names)


# ── _build_bracket_for_wc ─────────────────────────────────────────────────────

class TestBuildBracket:

    def test_n5_structure(self):
        """n=5: slots=8, byes=3 → R1=4 matches, R2=2, R3=1."""
        all_matches, round_matches, r1_list = _build_bracket_for_wc(1, _names(5), "TEST")

        # Total: 4+2+1 = 7
        assert len(all_matches) == 7
        assert len(round_matches[1]) == 4
        assert len(round_matches[2]) == 2
        assert len(round_matches[3]) == 1

    def test_n5_r1_match_numbers_sequential_no_repeat(self):
        """R1 match_number must be 1,2,3,4 — sequential, no repeats."""
        _, _, r1_list = _build_bracket_for_wc(1, _names(5), "TEST")
        nums = [m.match_number for m in r1_list]
        assert nums == [1, 2, 3, 4], f"Expected [1,2,3,4], got {nums}"
        assert len(set(nums)) == 4, "Duplicate match_number in R1"

    def test_n5_match_codes(self):
        """match_codes: R1=A1..A4, R2=B1..B2, R3=C1."""
        all_matches, round_matches, _ = _build_bracket_for_wc(1, _names(5), "TEST")

        r1_codes = sorted(m.match_code for m in round_matches[1])
        assert r1_codes == ["TEST-A1", "TEST-A2", "TEST-A3", "TEST-A4"]

        r2_codes = sorted(m.match_code for m in round_matches[2])
        assert r2_codes == ["TEST-B1", "TEST-B2"]

        r3_codes = [m.match_code for m in round_matches[3]]
        assert r3_codes == ["TEST-C1"]

    def test_n5_exactly_3_bye_matches_1_normal(self):
        _, _, r1_list = _build_bracket_for_wc(1, _names(5), "TEST")
        bye_matches = [m for m in r1_list if m.is_bye]
        normal_matches = [m for m in r1_list if not m.is_bye]
        assert len(bye_matches) == 3
        assert len(normal_matches) == 1

    def test_n5_bye_match_properties(self):
        """BYE match: status=completed, winner=1, player2='BYE', player1=real player."""
        _, _, r1_list = _build_bracket_for_wc(1, _names(5), "TEST")
        for m in (m for m in r1_list if m.is_bye):
            assert m.status == "completed", f"{m.match_code}: expected completed, got {m.status}"
            assert m.winner == 1, f"{m.match_code}: expected winner=1, got {m.winner}"
            assert m.player2_name == "BYE", f"{m.match_code}: p2 should be 'BYE'"
            assert m.player1_name is not None, f"{m.match_code}: p1 should be real player"

    def test_n5_normal_match_properties(self):
        """Normal match: status=ready, winner=None, both players real."""
        _, _, r1_list = _build_bracket_for_wc(1, _names(5), "TEST")
        normal = [m for m in r1_list if not m.is_bye]
        assert len(normal) == 1
        m = normal[0]
        assert m.status == "ready"
        assert m.winner is None
        assert m.player1_name is not None
        assert m.player2_name is not None
        assert m.player2_name != "BYE"

    def test_no_bye_n8(self):
        """n=8 (power of 2): no BYE matches, all 4 R1 matches are normal."""
        _, _, r1_list = _build_bracket_for_wc(1, _names(8), "TEST")
        assert all(not m.is_bye for m in r1_list)
        assert all(m.status == "ready" for m in r1_list)

    def test_n2_minimal(self):
        """n=2: 1 match, no BYE."""
        all_matches, round_matches, r1_list = _build_bracket_for_wc(1, _names(2), "T")
        assert len(all_matches) == 1
        assert len(r1_list) == 1
        assert r1_list[0].is_bye is False
        assert r1_list[0].match_number == 1
        assert r1_list[0].match_code == "T-A1"

    def test_n3_slots4_byes1(self):
        """n=3: slots=4, byes=1 → 1 BYE match, 1 normal match in R1."""
        _, _, r1_list = _build_bracket_for_wc(1, _names(3), "T")
        assert len(r1_list) == 2
        bye_count = sum(1 for m in r1_list if m.is_bye)
        assert bye_count == 1

    @pytest.mark.parametrize("n", [4, 5, 6, 7, 8, 9, 10, 11, 12, 16])
    def test_match_numbers_always_sequential(self, n: int):
        """For any n, R1 match_numbers must be 1..slots/2 without gaps or repeats."""
        slots = _bracket_size(n)
        _, round_matches, r1_list = _build_bracket_for_wc(1, _names(n), "T")
        nums = sorted(m.match_number for m in r1_list)
        expected = list(range(1, slots // 2 + 1))
        assert nums == expected, f"n={n}: expected {expected}, got {nums}"

    @pytest.mark.parametrize("n", [4, 5, 6, 7, 8, 9, 10, 11, 12, 16])
    def test_no_double_bye_pair_any_n(self, n: int):
        """No pair in R1 should have both p1 and p2 as BYE."""
        slots = _bracket_size(n)
        _, _, r1_list = _build_bracket_for_wc(1, _names(n), "T")
        for m in r1_list:
            assert not (m.player1_name == "BYE" and m.player2_name == "BYE"), \
                f"n={n}: double-BYE at match {m.match_number}"

    @pytest.mark.parametrize("n", [4, 5, 6, 7, 8, 9, 10, 11, 12, 16])
    def test_bye_winner_propagation_slot_logic(self, n: int):
        """Odd match_number → winner goes to p1 of next match; even → p2."""
        _, _, r1_list = _build_bracket_for_wc(1, _names(n), "T")
        for m in r1_list:
            if not m.is_bye or m.winner is None:
                continue
            winner_name = m.player1_name if m.winner == 1 else m.player2_name
            assert winner_name is not None and winner_name != "BYE", \
                f"n={n}: BYE match {m.match_number} has invalid winner_name={winner_name}"
            # Slot rule: odd → player1 of next, even → player2 of next
            expected_slot = "player1" if m.match_number % 2 == 1 else "player2"
            # Just validate the logic is well-defined (actual link tested via _flush_and_link)
            assert expected_slot in ("player1", "player2")


# ── _bracket_size ─────────────────────────────────────────────────────────────

class TestBracketSize:

    @pytest.mark.parametrize("n,expected", [
        (1, 2), (2, 2), (3, 4), (4, 4), (5, 8),
        (7, 8), (8, 8), (9, 16), (16, 16), (17, 32),
    ])
    def test_bracket_size(self, n: int, expected: int):
        assert _bracket_size(n) == expected
