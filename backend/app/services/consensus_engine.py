"""
Consensus Engine — realtime 3/5 judge scoring consensus within 1.5-second windows.

Algorithm:
- Each judge button press is an event with (player_side, score_type, sequence_index).
- Events are stored in Redis keyed by match + time bucket (1.5s slots).
- After each new event, we check if ≥3 judges share the same complete sequence.
- If consensus reached: atomically clear the window (idempotency) and return score deltas.
- Server receive-time is used for bucketing (not client clock) to avoid clock skew.
"""

import json
import time
from dataclasses import dataclass, field
from collections import Counter

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tournament import BracketScoreEvent

WINDOW_MS = 1500        # 1.5-second consensus window
WINDOW_TTL_S = 3        # Redis key TTL — 2× window for cleanup buffer
MIN_CONSENSUS = 3       # Minimum judges required for a valid pattern

# Lua script: atomically read all events in a window then delete the key.
# Returns the list of serialized event JSON strings.
_LUA_FETCH_AND_DELETE = """
local events = redis.call('LRANGE', KEYS[1], 0, -1)
if #events > 0 then
    redis.call('DEL', KEYS[1])
end
return events
"""


@dataclass
class ConsensusResult:
    reached: bool
    red_delta: int = 0
    blue_delta: int = 0
    matched_sequence: list[tuple[str, str]] = field(default_factory=list)
    judge_count: int = 0
    window_key: str = ""


async def record_judge_input(
    redis: Redis,
    db: AsyncSession,
    match_id: int,
    judge_slot: int,
    judge_user_id: int | None,
    player_side: str,
    score_type: str,
    sequence_index: int,
) -> ConsensusResult:
    """
    Record one judge button press, then check for consensus in the current window.
    Uses server receive-time as the authoritative bucket timestamp.
    """
    server_ts_ms = int(time.time() * 1000)
    bucket = (server_ts_ms // WINDOW_MS) * WINDOW_MS
    window_key = f"scoring:{match_id}:{bucket}"

    event = {
        "judge_slot": judge_slot,
        "player_side": player_side,
        "score_type": score_type,
        "sequence_index": sequence_index,
        "server_ts_ms": server_ts_ms,
    }
    event_json = json.dumps(event)

    # Push event into window list; set TTL only on creation (NX)
    await redis.rpush(window_key, event_json)
    await redis.expire(window_key, WINDOW_TTL_S, nx=True)

    # Persist audit record (fire-and-forget; do not let DB errors block scoring)
    try:
        db.add(BracketScoreEvent(
            match_id=match_id,
            judge_slot=judge_slot,
            judge_user_id=judge_user_id,
            player_side=player_side,
            score_type=score_type,
            sequence_index=sequence_index,
            window_key=window_key,
        ))
        await db.flush()
    except Exception:
        pass  # Audit failure must not block realtime scoring

    # Read current window events to check for consensus
    raw_events: list[str] = await redis.lrange(window_key, 0, -1)
    if not raw_events:
        return ConsensusResult(reached=False)

    events = [json.loads(e) for e in raw_events]

    # Build per-judge sequences (ordered by sequence_index, then insertion order)
    judge_sequences: dict[int, list[tuple[str, str]]] = {}
    for ev in sorted(events, key=lambda e: (e["judge_slot"], e["sequence_index"])):
        slot = ev["judge_slot"]
        if slot not in judge_sequences:
            judge_sequences[slot] = []
        judge_sequences[slot].append((ev["player_side"], ev["score_type"]))

    # Count votes per distinct sequence
    sequence_votes: Counter[tuple[tuple[str, str], ...]] = Counter()
    for seq in judge_sequences.values():
        sequence_votes[tuple(seq)] += 1

    # Find sequences with >= MIN_CONSENSUS votes
    candidates = [(seq, count) for seq, count in sequence_votes.items() if count >= MIN_CONSENSUS]
    if not candidates:
        return ConsensusResult(reached=False, window_key=window_key)

    # Choose: longest sequence first, then highest vote count
    winning_seq, winning_count = max(candidates, key=lambda x: (len(x[0]), x[1]))

    # Atomically fetch-and-delete the window key to prevent double-application
    fetched: list[str] = await redis.eval(_LUA_FETCH_AND_DELETE, 1, window_key)
    if not fetched:
        # Another concurrent request already consumed this window → no-op
        return ConsensusResult(reached=False, window_key=window_key)

    # Compute score deltas from the winning sequence
    red_delta = 0
    blue_delta = 0
    for player_side_step, score_type_step in winning_seq:
        try:
            delta = int(score_type_step)
        except ValueError:
            continue
        if player_side_step == "RED":
            red_delta += delta
        else:
            blue_delta += delta

    return ConsensusResult(
        reached=True,
        red_delta=red_delta,
        blue_delta=blue_delta,
        matched_sequence=list(winning_seq),
        judge_count=winning_count,
        window_key=window_key,
    )
