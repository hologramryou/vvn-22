"""
Local Match Engine — per-score-type consensus windows using asyncio timers.

Algorithm:
- Windows are keyed by (match_id, score_type) — +1 and +2 are fully independent
- Each judge can vote at most once per window
- When judge presses score_type:
  - Find the earliest open window for (match_id, score_type) where this judge has not yet voted
  - If none exists → open a new window and start its 1s timer
  - Record the vote in that window
- Window expires → evaluate: if ≥ min_votes judges agree on same (player_side, score_type) → valid slot
- A judge pressing +1 then +2: goes into separate +1 and +2 windows simultaneously
- A judge pressing +1 twice: first press → window[0], second press → window[1] (new window)
"""

from __future__ import annotations

import asyncio
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Callable, Coroutine, Any

DEFAULT_WINDOW_SECS = 1.0
DEFAULT_MIN_VOTES = 3

DELTA_MAP: dict[str, int] = {'+1': 1, '+2': 2, '-1': -1}


@dataclass
class PendingSlot:
    player_side: str
    score_type: str
    slot_index: int
    judge_count: int


@dataclass
class JudgeActivity:
    """Aggregated activity of one judge across all open windows for a match."""
    judge_slot: int
    player_side: str
    score_type: str
    count: int
    accumulated_delta: int = 0
    press_deltas: list = field(default_factory=list)


@dataclass
class ValidSlot:
    player_side: str
    score_type: str
    delta: int
    judge_slots: list[int] = field(default_factory=list)


@dataclass
class WindowResult:
    valid_slots: list[ValidSlot]
    raw_inputs: list[tuple[int, str, str, int]]


CallbackType = Callable[[WindowResult], Coroutine[Any, Any, None]]


class _ScoreWindow:
    """Single timed window for one (match_id, score_type, window_index)."""

    def __init__(self, min_votes: int) -> None:
        # judge_slot → (player_side, score_type)
        self._votes: dict[int, tuple[str, str]] = {}
        self._min_votes = min_votes

    def can_accept(self, judge_slot: int) -> bool:
        return judge_slot not in self._votes

    def add_vote(self, judge_slot: int, player_side: str, score_type: str) -> None:
        self._votes[judge_slot] = (player_side, score_type)

    @property
    def judge_count(self) -> int:
        return len(self._votes)

    def dominant_side(self) -> str:
        if not self._votes:
            return 'RED'
        side_counts = Counter(v[0] for v in self._votes.values())
        return side_counts.most_common(1)[0][0]

    def evaluate(self) -> ValidSlot | None:
        """Return ValidSlot if ≥ min_votes judges agree, else None."""
        if len(self._votes) < self._min_votes:
            return None
        vote_counts = Counter(self._votes.values())
        (best_side, best_type), count = vote_counts.most_common(1)[0]
        if count < self._min_votes:
            return None
        agreeing = sorted(js for js, v in self._votes.items() if v == (best_side, best_type))
        delta = DELTA_MAP.get(best_type, 0)
        return ValidSlot(
            player_side=best_side,
            score_type=best_type,
            delta=delta,
            judge_slots=agreeing,
        )

    def get_raw_inputs(self) -> list[tuple[int, str, str, int]]:
        return [(js, ps, st, i) for i, (js, (ps, st)) in enumerate(self._votes.items())]


class LocalMatchEngine:
    """
    Singleton engine managing per-score-type scoring windows with asyncio timers.

    Usage:
        pending, activity = await match_engine.add_input(match_id, judge_slot, player_side, score_type)
        match_engine.register_callback(match_id, async_callback)
        match_engine.unregister_callback(match_id)
    """

    def __init__(self) -> None:
        # (match_id, score_type) → {win_idx: _ScoreWindow}
        self._windows: dict[tuple[int, str], dict[int, _ScoreWindow]] = defaultdict(dict)
        # (match_id, score_type) → next window index counter
        self._win_counter: dict[tuple[int, str], int] = defaultdict(int)
        # (match_id, score_type, win_idx) → TimerHandle
        self._timers: dict[tuple[int, str, int], asyncio.TimerHandle] = {}
        self._callbacks: dict[int, CallbackType] = {}
        self._lock = asyncio.Lock()
        self._window_secs: dict[int, float] = {}
        self._min_votes: dict[int, int] = {}

    def set_match_config(self, match_id: int, window_secs: float, min_votes: int) -> None:
        self._window_secs[match_id] = window_secs
        self._min_votes[match_id] = min_votes

    def register_callback(self, match_id: int, cb: CallbackType) -> None:
        self._callbacks[match_id] = cb

    def unregister_callback(self, match_id: int) -> None:
        self._callbacks.pop(match_id, None)

    async def add_input(
        self,
        match_id: int,
        judge_slot: int,
        player_side: str,
        score_type: str,
    ) -> tuple[list[PendingSlot], list[JudgeActivity]]:
        """
        Record one judge press. Finds or creates the appropriate window for this
        (match_id, score_type) pair and records the vote. Returns current pending
        state and per-judge activity for broadcast.
        """
        async with self._lock:
            key = (match_id, score_type)
            win_map = self._windows[key]
            min_votes = self._min_votes.get(match_id, DEFAULT_MIN_VOTES)
            window_secs = self._window_secs.get(match_id, DEFAULT_WINDOW_SECS)

            # Find earliest open window where this judge has not yet voted
            target_idx: int | None = None
            for idx in sorted(win_map.keys()):
                if win_map[idx].can_accept(judge_slot):
                    target_idx = idx
                    break

            if target_idx is None:
                # No available window — open a new one
                target_idx = self._win_counter[key]
                self._win_counter[key] += 1
                win_map[target_idx] = _ScoreWindow(min_votes=min_votes)
                # Start timer for this window
                loop = asyncio.get_event_loop()
                timer_key = (match_id, score_type, target_idx)
                handle = loop.call_later(
                    window_secs,
                    lambda mid=match_id, st=score_type, idx=target_idx: asyncio.create_task(
                        self._on_window_expire(mid, st, idx)
                    ),
                )
                self._timers[timer_key] = handle

            win_map[target_idx].add_vote(judge_slot, player_side, score_type)

            pending = self._compute_pending(match_id)
            judge_activity = self._compute_judge_activity(match_id)
            return pending, judge_activity

    def _compute_pending(self, match_id: int) -> list[PendingSlot]:
        result: list[PendingSlot] = []
        for (mid, score_type), win_map in self._windows.items():
            if mid != match_id:
                continue
            for win_idx, win in win_map.items():
                if win.judge_count > 0:
                    result.append(PendingSlot(
                        player_side=win.dominant_side(),
                        score_type=score_type,
                        slot_index=win_idx,
                        judge_count=win.judge_count,
                    ))
        return result

    def _compute_judge_activity(self, match_id: int) -> list[JudgeActivity]:
        # Aggregate all votes by (judge_slot, player_side) across all open windows
        deltas_map: dict[tuple[int, str], list[int]] = defaultdict(list)
        last_score_type: dict[int, str] = {}

        for (mid, score_type), win_map in self._windows.items():
            if mid != match_id:
                continue
            for win in win_map.values():
                for js, (ps, st) in win._votes.items():
                    deltas_map[(js, ps)].append(DELTA_MAP.get(st, 0))
                    last_score_type[js] = st

        return [
            JudgeActivity(
                judge_slot=js,
                player_side=side,
                score_type=last_score_type.get(js, '?'),
                count=len(deltas),
                accumulated_delta=sum(deltas),
                press_deltas=deltas,
            )
            for (js, side), deltas in deltas_map.items()
        ]

    async def _on_window_expire(self, match_id: int, score_type: str, win_idx: int) -> None:
        async with self._lock:
            key = (match_id, score_type)
            timer_key = (match_id, score_type, win_idx)
            self._timers.pop(timer_key, None)

            win_map = self._windows.get(key, {})
            window = win_map.pop(win_idx, None)
            if not win_map:
                self._windows.pop(key, None)

        if window is None:
            return

        valid_slot = window.evaluate()
        raw_inputs = window.get_raw_inputs()
        result = WindowResult(
            valid_slots=[valid_slot] if valid_slot else [],
            raw_inputs=raw_inputs,
        )

        cb = self._callbacks.get(match_id)
        if cb is not None:
            try:
                await cb(result)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(
                    "on_slots_confirmed error for match %s: %s", match_id, e, exc_info=True
                )


# Singleton
match_engine = LocalMatchEngine()
