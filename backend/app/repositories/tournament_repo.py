"""Tournament repository — bracket generation, schedule & result propagation."""
import math
import random
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select, update, delete, nullslast, func
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Student, StudentClub
from app.models.club import Club
from app.models.user import User
from app.models.tournament import (
    Tournament, TournamentWeightClass, TournamentParticipant,
    BracketMatch, BracketJudgeAssignment, QuyenSlot, QuyenJudgeScore, QuyenScoreAuditLog,
    TournamentStructureNode, StudentWeightAssignment,
    StudentContestSelection, TournamentKata, TournamentTeamKataRegistration,
)
from app.schemas.tournament import (
    TournamentStructure, CategoryItem, AgeTypeItem, WeightClassItem,
    ParticipantInfo, BracketOut, BracketMatchOut, BracketExportOut, BracketExportPathOut,
    QuyenSlotOut, QuyenJudgeScoreOut, QuyenRankingGroupOut, QuyenRankingItemOut, QuyenScoringDetailOut,
    QuyenJudgePanelOut, QuyenDisplayOut, QuyenDisplayJudgeOut,
    MatchJudgeAssignmentOut, MatchJudgePanelOut, RefereeCurrentAssignmentOut,
    ScheduleBracketMatchOut, TournamentScheduleOut, ScheduleSummary,
    WeightClassMedal, QuyenMedalGroup, MedalTallyOut,
    ClubMedalRank, ClubMedalTallyOut,
)

# ── Age-type metadata ─────────────────────────────────────────────────────────

AGE_TYPE_META = {
    "phong_trao": {
        "1A": "Dưới 4 tuổi",
        "1B": "4–6 tuổi",
        "2":  "7–9 tuổi",
        "3":  "10–12 tuổi",
        "4":  "18–25 tuổi (đối kháng)",
        "5":  "18–35 tuổi",
    },
    "pho_thong": {
        "1": "Phổ thông chung",
        "2": "Cấp 2 (lớp 6–9)",
        "3": "Cấp 3 (lớp 10–12)",
        "4": "18–25 tuổi (đối kháng) / 18–35 tuổi",
    },
}


def _is_missing_consensus_table_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return isinstance(exc, ProgrammingError) and (
        'match_consensus_turns' in text or 'match_consensus_votes' in text
    ) and 'does not exist' in text


async def _delete_match_consensus_turns_if_available(db: AsyncSession, match_id: int) -> None:
    from app.models.tournament import MatchConsensusTurn

    try:
        await db.execute(delete(MatchConsensusTurn).where(MatchConsensusTurn.match_id == match_id))
    except ProgrammingError as exc:
        if not _is_missing_consensus_table_error(exc):
            raise


def _default_quyen_judge_name(judge_slot: int) -> str:
    return f"Ghế trọng tài {judge_slot}"


async def _ensure_quyen_judge_rows(db: AsyncSession, slot_id: int) -> list[QuyenJudgeScore]:
    rows = (await db.execute(
        select(QuyenJudgeScore)
        .where(QuyenJudgeScore.slot_id == slot_id)
        .order_by(QuyenJudgeScore.judge_slot)
    )).scalars().all()

    existing_slots = {row.judge_slot for row in rows}
    created = False
    for judge_slot in range(1, 6):
        if judge_slot in existing_slots:
            continue
        row = QuyenJudgeScore(
            slot_id=slot_id,
            judge_slot=judge_slot,
            judge_name=_default_quyen_judge_name(judge_slot),
        )
        db.add(row)
        rows.append(row)
        created = True

    if created:
        await db.flush()
        rows = sorted(rows, key=lambda item: item.judge_slot)

    return rows


def _compute_quyen_score_values(judges: list[QuyenJudgeScore]) -> tuple[float | None, int | None, int | None, int | None]:
    scores = [judge.score for judge in judges if judge.score is not None]
    if len(scores) < 5:
        return None, None, None, None

    sorted_scores = sorted(scores)
    middle_three = sorted_scores[1:4]
    highest_score = max(scores)
    lowest_score = min(scores)
    official_score = float(sum(middle_three))
    return official_score, sum(scores), highest_score, lowest_score


def _apply_quyen_score_summary(slot: QuyenSlot, judges: list[QuyenJudgeScore]) -> bool:
    official_score, total_score, highest_score, lowest_score = _compute_quyen_score_values(judges)
    slot.official_score = official_score
    slot.total_judge_score = total_score
    slot.highest_judge_score = highest_score
    slot.lowest_judge_score = lowest_score
    return official_score is not None


def _has_full_quyen_assignment(judges: list[QuyenJudgeScore]) -> bool:
    return len(judges) == 5 and all(judge.judge_user_id for judge in judges)


def _has_all_quyen_ready(judges: list[QuyenJudgeScore]) -> bool:
    return _has_full_quyen_assignment(judges) and all(judge.ready_at for judge in judges)


def _count_ready_quyen_judges(judges: list[QuyenJudgeScore]) -> int:
    return sum(1 for judge in judges if judge.ready_at is not None)


def _count_submitted_quyen_judges(judges: list[QuyenJudgeScore]) -> int:
    return sum(1 for judge in judges if judge.score is not None)


def _sync_quyen_slot_status(slot: QuyenSlot, judges: list[QuyenJudgeScore]) -> None:
    """Auto-transition setup state without overwriting active control phases."""
    if slot.status in ("ongoing", "scoring", "completed"):
        return

    slot.status = "ready" if _has_full_quyen_assignment(judges) else "pending"


async def _get_user_name_map(db: AsyncSession, user_ids: list[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    rows = (await db.execute(
        select(User.id, User.full_name)
        .where(User.id.in_(user_ids))
    )).all()
    return {user_id: full_name for user_id, full_name in rows}


async def _ensure_match_judge_rows(db: AsyncSession, match_id: int) -> list[BracketJudgeAssignment]:
    rows = (await db.execute(
        select(BracketJudgeAssignment)
        .where(BracketJudgeAssignment.match_id == match_id)
        .order_by(BracketJudgeAssignment.judge_slot)
    )).scalars().all()

    existing_slots = {row.judge_slot for row in rows}
    created = False
    for judge_slot in range(1, 6):
        if judge_slot in existing_slots:
            continue
        row = BracketJudgeAssignment(match_id=match_id, judge_slot=judge_slot)
        db.add(row)
        rows.append(row)
        created = True

    if created:
        await db.flush()
        rows = sorted(rows, key=lambda item: item.judge_slot)

    return rows


def _count_ready_match_judges(judges: list[BracketJudgeAssignment]) -> int:
    return sum(1 for judge in judges if judge.ready_at is not None)


def _has_full_match_assignment(judges: list[BracketJudgeAssignment]) -> bool:
    return len(judges) == 5 and all(judge.judge_user_id for judge in judges)


def _has_all_match_ready(judges: list[BracketJudgeAssignment]) -> bool:
    return _has_full_match_assignment(judges) and all(judge.ready_at for judge in judges)


def _can_match_be_ready(match: BracketMatch) -> bool:
    return bool(match.player1_name and match.player2_name and match.player2_name != "BYE" and not match.is_bye)


def _sync_match_status(match: BracketMatch, judges: list[BracketJudgeAssignment]) -> None:
    if match.status in ("ongoing", "completed"):
        return
    match.status = "ready" if (_can_match_be_ready(match) and _has_full_match_assignment(judges)) else "pending"


def _build_match_judge_outs(
    judges: list[BracketJudgeAssignment],
    user_name_map: dict[int, str],
) -> list[MatchJudgeAssignmentOut]:
    return [
        MatchJudgeAssignmentOut(
            judge_slot=judge.judge_slot,
            assigned_user_id=judge.judge_user_id,
            assigned_user_name=user_name_map.get(judge.judge_user_id) if judge.judge_user_id else None,
            is_ready=judge.ready_at is not None,
            ready_at=judge.ready_at,
            score1=judge.score1,
            score2=judge.score2,
            has_submitted=judge.submitted_at is not None,
        )
        for judge in judges
    ]


async def _validate_match_assigned_user(
    db: AsyncSession,
    tournament_id: int,
    user_id: int,
) -> User | None:
    user = (await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)  # noqa: E712
    )).scalar_one_or_none()
    if not user or user.role != "referee":
        return None
    if tournament_id not in (user.tournament_ids or []):
        return None
    return user


async def _log_quyen_score_action(
    db: AsyncSession,
    slot_id: int,
    action: str,
    actor_user_id: int | None,
    judge_slot: int | None = None,
    note: str | None = None,
) -> None:
    db.add(QuyenScoreAuditLog(
        slot_id=slot_id,
        judge_slot=judge_slot,
        actor_user_id=actor_user_id,
        action=action,
        note=note,
    ))
    await db.flush()


def _quyen_ranking_sort_key(slot: QuyenSlot) -> tuple[int, int, int, int, int, str]:
    return (
        -(slot.official_score or 0),
        -(slot.total_judge_score or 0),
        -(slot.highest_judge_score or 0),
        -(slot.lowest_judge_score or 0),
        slot.schedule_order or 999999,
        slot.player_name,
    )


async def _get_player_club_map_for_tournament(db: AsyncSession, tournament_id: int) -> dict[str, str]:
    rows = (await db.execute(
        select(Student.full_name, Club.name)
        .join(StudentWeightAssignment, StudentWeightAssignment.student_id == Student.id)
        .join(StudentClub, (StudentClub.student_id == Student.id) & (StudentClub.is_current == True))  # noqa: E712
        .join(Club, Club.id == StudentClub.club_id)
        .where(
            StudentWeightAssignment.tournament_id == tournament_id,
            Student.status == "active",
        )
    )).all()
    return {name: club for name, club in rows}


async def _build_quyen_ranking_groups(
    db: AsyncSession,
    tournament_id: int,
    *,
    target_node_id: int | None = None,
    target_content_name: str | None = None,
) -> list[QuyenRankingGroupOut]:
    t = (await db.execute(select(Tournament).where(Tournament.id == tournament_id))).scalar_one_or_none()
    if not t:
        return []

    q_slots = (await db.execute(
        select(QuyenSlot)
        .where(QuyenSlot.tournament_id == tournament_id)
        .order_by(nullslast(QuyenSlot.schedule_order.asc()), QuyenSlot.id)
    )).scalars().all()
    if not q_slots:
        return []

    node_path_map, node_order_map = await _get_dynamic_node_path_order_maps(db, tournament_id)
    parent_map, parent_ids = await _get_dynamic_node_relationship_maps(db, tournament_id)
    player_club_map = await _get_player_club_map_for_tournament(db, tournament_id)

    groups: dict[tuple[int | None, str], dict] = {}
    for slot in q_slots:
        display_node_id = slot.node_id
        if t.structure_mode == "dynamic" and slot.weight_class_id is not None:
            display_node_id = _resolve_quyen_classification_node_id(slot.node_id, parent_map, parent_ids)

        if target_node_id is not None and display_node_id != target_node_id:
            continue
        if target_content_name is not None and slot.content_name != target_content_name:
            continue

        key = (display_node_id, slot.content_name)
        group = groups.setdefault(key, {
            "node_id": display_node_id,
            "node_path": node_path_map.get(display_node_id) if display_node_id is not None else None,
            "content_name": slot.content_name,
            "slots": [],
            "order_key": node_order_map.get(display_node_id) if display_node_id is not None else (),
        })
        group["slots"].append(slot)

    ranking_groups: list[QuyenRankingGroupOut] = []
    for group in sorted(groups.values(), key=lambda item: (item["order_key"], item["content_name"])):
        slots = group["slots"]
        eligible_slots = [s for s in slots if not s.is_disqualified]
        is_ready = bool(eligible_slots) and all(slot.status == "completed" and slot.official_score is not None for slot in eligible_slots)
        if not is_ready:
            ranking_groups.append(QuyenRankingGroupOut(
                node_id=group["node_id"],
                node_path=group["node_path"],
                content_name=group["content_name"],
                status="pending",
                items=[],
            ))
            continue

        sorted_slots = sorted(eligible_slots, key=_quyen_ranking_sort_key)
        signatures = [
            (
                slot.official_score or 0,
                slot.total_judge_score or 0,
                slot.highest_judge_score or 0,
                slot.lowest_judge_score or 0,
            )
            for slot in sorted_slots
        ]
        if len(signatures) != len(set(signatures)):
            ranking_groups.append(QuyenRankingGroupOut(
                node_id=group["node_id"],
                node_path=group["node_path"],
                content_name=group["content_name"],
                status="pending",
                items=[],
            ))
            continue

        items: list[QuyenRankingItemOut] = []
        for index, slot in enumerate(sorted_slots, start=1):
            medal = "gold" if index == 1 else "silver" if index == 2 else "bronze" if index == 3 else None
            items.append(QuyenRankingItemOut(
                slot_id=slot.id,
                rank=index,
                player_name=slot.player_name,
                player_club=player_club_map.get(slot.player_name) if slot.weight_class_id is not None else slot.player_name,
                official_score=slot.official_score or 0,
                total_judge_score=slot.total_judge_score or 0,
                highest_judge_score=slot.highest_judge_score or 0,
                lowest_judge_score=slot.lowest_judge_score or 0,
                medal=medal,
            ))

        ranking_groups.append(QuyenRankingGroupOut(
            node_id=group["node_id"],
            node_path=group["node_path"],
            content_name=group["content_name"],
            status="ready",
            items=items,
        ))

    return ranking_groups


def _seed_participants_with_byes(names: list[str], slots: int, byes: int) -> list[str | None]:
    """Create seeded slot array with byes evenly distributed.

    BYEs are ALWAYS placed at the p2 (odd-index) slot of a pair so that
    `is_bye = (p2 is None)` in _build_bracket_for_wc always works correctly.
    This also prevents double-BYE pairs by construction.
    """
    shuffled = names.copy()
    random.shuffle(shuffled)

    num_pairs = slots // 2
    if byes == 0:
        seeded: list[str | None] = list(shuffled)
        # pad to slots if needed (shouldn't happen)
        while len(seeded) < slots:
            seeded.append(None)
        return seeded

    # Choose which pairs receive a BYE, evenly spaced across num_pairs
    spacing = num_pairs / byes
    bye_pairs: set[int] = set()
    for k in range(byes):
        pair_idx = int(k * spacing + spacing / 2)
        pair_idx = max(0, min(num_pairs - 1, pair_idx))
        bye_pairs.add(pair_idx)

    # Fill to exactly byes if deduplication collapsed some
    candidate = 0
    while len(bye_pairs) < byes:
        if candidate not in bye_pairs:
            bye_pairs.add(candidate)
        candidate += 1

    seeded = [None] * slots
    pidx = 0
    for pair_idx in range(num_pairs):
        p1_slot = pair_idx * 2
        p2_slot = pair_idx * 2 + 1
        if pair_idx in bye_pairs:
            # Real player at p1, BYE at p2
            seeded[p1_slot] = shuffled[pidx] if pidx < len(shuffled) else None
            pidx += 1
            seeded[p2_slot] = None          # BYE always at p2
        else:
            seeded[p1_slot] = shuffled[pidx] if pidx < len(shuffled) else None
            pidx += 1
            seeded[p2_slot] = shuffled[pidx] if pidx < len(shuffled) else None
            pidx += 1

    return seeded


CATEGORY_ORDER = ["phong_trao", "pho_thong"]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def get_first_tournament_id(db: AsyncSession) -> int | None:
    row = (await db.execute(select(Tournament).order_by(Tournament.id).limit(1))).scalar_one_or_none()
    return row.id if row else None


async def get_active_tournament_status(db: AsyncSession) -> str | None:
    """Return status of the first (active) tournament, or None if no tournament exists."""
    row = (await db.execute(select(Tournament.status).order_by(Tournament.id).limit(1))).scalar_one_or_none()
    return row


async def delete_tournament_scoped_data(db: AsyncSession, tournament_id: int) -> bool:
    """Delete only data owned by a tournament.

    This intentionally does not touch shared master data such as clubs or students.
    """
    tournament = (await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )).scalar_one_or_none()
    if not tournament:
        return False

    affected_users = (await db.execute(
        select(User).where(User.tournament_ids.contains([tournament_id]))
    )).scalars().all()
    for user in affected_users:
        user.tournament_ids = [tid for tid in (user.tournament_ids or []) if tid != tournament_id]

    affected_clubs = (await db.execute(
        select(Club).where(Club.tournament_ids.contains([tournament_id]))
    )).scalars().all()
    for club in affected_clubs:
        club.tournament_ids = [tid for tid in (club.tournament_ids or []) if tid != tournament_id]

    # Delete leaf / dependent tables first to avoid FK surprises on databases
    # where cascades are not fully reflected in the runtime schema.
    await db.execute(delete(BracketMatch).where(BracketMatch.weight_class_id.in_(
        select(TournamentWeightClass.id).where(TournamentWeightClass.tournament_id == tournament_id)
    )))
    await db.execute(delete(QuyenSlot).where(QuyenSlot.tournament_id == tournament_id))
    await db.execute(delete(TournamentParticipant).where(TournamentParticipant.weight_class_id.in_(
        select(TournamentWeightClass.id).where(TournamentWeightClass.tournament_id == tournament_id)
    )))
    await db.execute(delete(StudentContestSelection).where(StudentContestSelection.tournament_id == tournament_id))
    await db.execute(delete(StudentWeightAssignment).where(StudentWeightAssignment.tournament_id == tournament_id))
    await db.execute(delete(TournamentKata).where(TournamentKata.tournament_id == tournament_id))
    await db.execute(delete(TournamentStructureNode).where(TournamentStructureNode.tournament_id == tournament_id))
    await db.execute(delete(TournamentWeightClass).where(TournamentWeightClass.tournament_id == tournament_id))
    await db.execute(delete(Tournament).where(Tournament.id == tournament_id))
    return True


def _bracket_size(n: int) -> int:
    """Next power of 2 >= n (min 2)."""
    if n <= 1:
        return 2
    p = 1
    while p < n:
        p <<= 1
    return p


def _make_match_prefix(wc) -> str:
    """Build a short unique match prefix.
    Format: '{G}-{CAT}-{AGE}-{WC}' e.g. 'M-PT-1A-45' or 'F-PH-4-48'
    FE decodes: M=Nam F=Nữ, PT=Phong Trào PH=Phổ Thông
    """
    gender_str = "M" if wc.gender == "M" else "F"
    cat_str = "PT" if wc.category == "phong_trao" else "PH"
    wc_num = wc.weight_class_name.replace("kg", "").strip()
    return f"{gender_str}-{cat_str}-{wc.age_type_code}-{wc_num}"


def _get_round_label(round_num: int, total_rounds: int) -> str:
    if round_num == total_rounds:
        return "Chung kết"
    if round_num == total_rounds - 1:
        return "Bán kết"
    if round_num == total_rounds - 2:
        return "Tứ kết"
    return f"Vòng {round_num}"


def _parse_gender_from_node(node: TournamentStructureNode | None) -> str | None:
    if not node:
        return None
    code = (node.node_code or "").strip().upper()
    if code in ("M", "F"):
        return code
    name = (node.name or "").strip().lower()
    if "nữ" in name:
        return "F"
    if "nam" in name:
        return "M"
    return None


def _parse_category_from_node(node: TournamentStructureNode | None) -> str | None:
    if not node:
        return None
    code = (node.node_code or "").strip().lower()
    if code in ("phong_trao", "pho_thong"):
        return code
    name = (node.name or "").strip().lower()
    if "phong" in name:
        return "phong_trao"
    if "phổ thông" in name or "pho thong" in name:
        return "pho_thong"
    return None


def _parse_age_type_from_node(node: TournamentStructureNode | None) -> str | None:
    if not node:
        return None
    code = (node.node_code or "").strip().upper()
    if code:
        return code
    name = (node.name or "").strip().upper().replace("LOẠI", "").replace("LOAI", "").strip()
    # Examples: "1A", "1B", "2", "3", "4", "5"
    if name in {"1A", "1B", "1", "2", "3", "4", "5"}:
        return name
    return None


def _normalize_weight_class_name(node: TournamentStructureNode) -> str:
    raw = (node.node_code or node.name or "").strip().lower().replace(" ", "")
    if not raw:
        return f"node{node.id}"
    if raw.endswith("kg"):
        return raw
    try:
        num = float(raw)
        if num.is_integer():
            return f"{int(num)}kg"
        return f"{num}kg"
    except ValueError:
        return raw


def _safe_node_type(
    node: TournamentStructureNode,
    nodes: list[TournamentStructureNode] | None = None,
) -> str:
    node_type = (getattr(node, "node_type", None) or "").strip().lower()
    if node_type in ("group", "weight_class"):
        return node_type
    if nodes is not None and any(child.parent_id == node.id for child in nodes):
        return "group"
    # Root-level nodes (no parent) are always groups — never leaf weight classes
    if node.parent_id is None:
        return "group"
    return "weight_class"


async def _sync_dynamic_participants_to_legacy(db: AsyncSession, tournament: Tournament) -> None:
    """Project dynamic registration tables into legacy wc/participant tables for /tournaments APIs.

    This keeps existing tournament endpoints and FE contract unchanged while allowing dynamic source data.
    """
    if getattr(tournament, "structure_mode", "legacy") != "dynamic":
        return

    nodes = (
        await db.execute(
            select(TournamentStructureNode)
            .where(TournamentStructureNode.tournament_id == tournament.id)
            .order_by(TournamentStructureNode.level, TournamentStructureNode.sort_order, TournamentStructureNode.id)
        )
    ).scalars().all()
    if not nodes:
        return

    node_by_id = {n.id: n for n in nodes}
    child_ids = {n.parent_id for n in nodes if n.parent_id is not None}
    leaf_nodes = [n for n in nodes if n.id not in child_ids and _safe_node_type(n, nodes) == "weight_class"]
    if not leaf_nodes:
        return

    def _ancestor(node: TournamentStructureNode, level: int) -> TournamentStructureNode | None:
        cur = node
        while cur.parent_id is not None:
            if cur.level == level:
                return cur
            nxt = node_by_id.get(cur.parent_id)
            if not nxt:
                break
            cur = nxt
        return cur if cur.level == level else None

    # Build leaf_meta — use fallback values when name parsing fails so all leaf nodes are synced
    leaf_meta: dict[int, tuple[str, str, str, str]] = {}
    for leaf in leaf_nodes:
        g = _parse_gender_from_node(_ancestor(leaf, 0)) or "M"
        c = _parse_category_from_node(_ancestor(leaf, 1)) or "dynamic"
        a = _parse_age_type_from_node(_ancestor(leaf, 2)) or str(leaf.level)
        w = _normalize_weight_class_name(leaf)
        if w:
            leaf_meta[leaf.id] = (c, a, g, w)

    if not leaf_meta:
        return

    existing_wcs = (
        await db.execute(
            select(TournamentWeightClass).where(TournamentWeightClass.tournament_id == tournament.id)
        )
    ).scalars().all()

    duplicate_groups: dict[int, list[TournamentWeightClass]] = defaultdict(list)
    for wc in sorted(existing_wcs, key=lambda item: item.id):
        if wc.node_id is not None:
            duplicate_groups[wc.node_id].append(wc)

    deduped_existing_wcs: list[TournamentWeightClass] = []
    duplicate_wc_ids: list[int] = []
    for group in duplicate_groups.values():
        canonical = group[0]
        deduped_existing_wcs.append(canonical)
        if len(group) > 1:
            duplicate_wc_ids.extend(wc.id for wc in group[1:])
            canonical.bracket_status = "NOT_GENERATED"

    deduped_existing_wcs.extend(wc for wc in existing_wcs if wc.node_id is None)

    if duplicate_wc_ids:
        await db.execute(delete(BracketMatch).where(BracketMatch.weight_class_id.in_(duplicate_wc_ids)))
        await db.execute(delete(TournamentParticipant).where(TournamentParticipant.weight_class_id.in_(duplicate_wc_ids)))
        await db.execute(delete(QuyenSlot).where(QuyenSlot.weight_class_id.in_(duplicate_wc_ids)))
        await db.execute(delete(TournamentWeightClass).where(TournamentWeightClass.id.in_(duplicate_wc_ids)))
        await db.flush()
        existing_wcs = deduped_existing_wcs

    wc_by_key = {
        (wc.category, wc.age_type_code, wc.gender, wc.weight_class_name): wc
        for wc in existing_wcs
    }
    wc_by_node_id = {wc.node_id: wc for wc in existing_wcs if wc.node_id is not None}

    for leaf_id, key in leaf_meta.items():
        # Try node_id match first (for already-synced rows)
        if leaf_id in wc_by_node_id:
            continue

        existing = wc_by_key.get(key)
        if existing is not None and existing.node_id is None:
            # Backfill node_id on unlinked legacy row
            existing.node_id = leaf_id
            wc_by_node_id[leaf_id] = existing
        else:
            # Either no legacy WC for this key, or the existing WC is already linked
            # to a different node (same weight_class_name appears under multiple branches).
            # Always create a dedicated WC for this leaf node.
            cat, age_code, gender, wc_name = key
            new_wc = TournamentWeightClass(
                tournament_id=tournament.id,
                node_id=leaf_id,
                category=cat,
                age_type_code=age_code,
                gender=gender,
                weight_class_name=wc_name,
                total_players=0,
                bracket_status="NOT_GENERATED",
                players=[],
            )
            db.add(new_wc)
            await db.flush()
            wc_by_node_id[leaf_id] = new_wc

    # Query assignments using node_ids of all known leaf WCs (not just newly parsed ones)
    active_assignments = (
        await db.execute(
            select(StudentWeightAssignment.student_id, StudentWeightAssignment.node_id, Student.full_name)
            .join(Student, Student.id == StudentWeightAssignment.student_id)
            .join(
                StudentContestSelection,
                (StudentContestSelection.student_id == StudentWeightAssignment.student_id)
                & (StudentContestSelection.tournament_id == StudentWeightAssignment.tournament_id)
                & (StudentContestSelection.contest_type == "sparring"),
            )
            .where(
                StudentWeightAssignment.tournament_id == tournament.id,
                StudentWeightAssignment.node_id.in_(list(wc_by_node_id.keys())),
                Student.status == "active",
            )
        )
    ).all()

    desired_pairs: set[tuple[int, int]] = set()
    names_by_wc: dict[int, list[str]] = defaultdict(list)
    for sid, node_id, full_name in active_assignments:
        # Direct lookup via node_id — no need to go through leaf_meta key
        wc = wc_by_node_id.get(node_id)
        if not wc:
            continue
        desired_pairs.add((wc.id, sid))
        if full_name:
            names_by_wc[wc.id].append(full_name)

    # Only touch WCs that are linked to tree nodes (avoid affecting unrelated legacy WCs)
    all_wc_ids = [wc.id for wc in wc_by_node_id.values()]
    if all_wc_ids:
        await db.execute(delete(TournamentParticipant).where(TournamentParticipant.weight_class_id.in_(all_wc_ids)))
    if desired_pairs:
        await db.execute(
            pg_insert(TournamentParticipant)
            .values([{"weight_class_id": wc_id, "student_id": sid} for wc_id, sid in desired_pairs])
            .on_conflict_do_nothing(constraint="uq_tp_wc_student")
        )

    for wc in wc_by_node_id.values():
        names = sorted(names_by_wc.get(wc.id, []))
        wc.total_players = len(names)
        wc.players = names

    await db.flush()


async def _get_dynamic_wc_order_map(db: AsyncSession, tournament_id: int) -> dict[int, int]:
    """Map projected weight_class_id to the current leaf-node order in a dynamic tree."""
    nodes = (
        await db.execute(
            select(TournamentStructureNode)
            .where(TournamentStructureNode.tournament_id == tournament_id)
            .order_by(
                TournamentStructureNode.level,
                TournamentStructureNode.sort_order,
                TournamentStructureNode.id,
            )
        )
    ).scalars().all()
    if not nodes:
        return {}

    node_by_id = {node.id: node for node in nodes}
    child_ids = {node.parent_id for node in nodes if node.parent_id is not None}
    leaf_nodes = [node for node in nodes if node.id not in child_ids and _safe_node_type(node, nodes) == "weight_class"]

    def _ancestor(node: TournamentStructureNode, level: int) -> TournamentStructureNode | None:
        current = node
        while current.parent_id is not None:
            if current.level == level:
                return current
            current = node_by_id.get(current.parent_id)
            if current is None:
                break
        return current if current and current.level == level else None

    def _path_sort_key(node: TournamentStructureNode) -> tuple[int, ...]:
        parts: list[int] = []
        current: TournamentStructureNode | None = node
        while current is not None:
            parts.append(current.sort_order)
            current = node_by_id.get(current.parent_id) if current.parent_id is not None else None
        return tuple(reversed(parts))

    wc_rows = (
        await db.execute(
            select(TournamentWeightClass).where(TournamentWeightClass.tournament_id == tournament_id)
        )
    ).scalars().all()
    wc_by_key = {
        (wc.category, wc.age_type_code, wc.gender, wc.weight_class_name): wc.id
        for wc in wc_rows
    }

    order_map: dict[int, int] = {}
    for idx, leaf in enumerate(sorted(leaf_nodes, key=_path_sort_key)):
        key = (
            _parse_category_from_node(_ancestor(leaf, 1)),
            _parse_age_type_from_node(_ancestor(leaf, 2)),
            _parse_gender_from_node(_ancestor(leaf, 0)),
            _normalize_weight_class_name(leaf),
        )
        wc_id = wc_by_key.get(key)
        if wc_id is not None:
            order_map[wc_id] = idx
    return order_map


async def _get_dynamic_node_path_order_maps(
    db: AsyncSession,
    tournament_id: int,
) -> tuple[dict[int, str], dict[int, tuple[int, ...]]]:
    nodes = (
        await db.execute(
            select(TournamentStructureNode)
            .where(TournamentStructureNode.tournament_id == tournament_id)
            .order_by(
                TournamentStructureNode.level,
                TournamentStructureNode.sort_order,
                TournamentStructureNode.id,
            )
        )
    ).scalars().all()
    if not nodes:
        return {}, {}

    node_by_id = {node.id: node for node in nodes}
    path_cache: dict[int, str] = {}
    order_cache: dict[int, tuple[int, ...]] = {}

    def build(node_id: int) -> tuple[str, tuple[int, ...]]:
        if node_id in path_cache:
            return path_cache[node_id], order_cache[node_id]

        node = node_by_id.get(node_id)
        if not node:
            return "", ()

        if node.parent_id is None:
            path = node.name
            order_key = (node.sort_order,)
        else:
            parent_path, parent_order = build(node.parent_id)
            path = f"{parent_path} > {node.name}" if parent_path else node.name
            order_key = (*parent_order, node.sort_order)

        path_cache[node_id] = path
        order_cache[node_id] = order_key
        return path, order_key

    for node in nodes:
        build(node.id)

    return path_cache, order_cache


def _split_node_path(node_path: str) -> list[str]:
    return [segment.strip() for segment in node_path.split(">") if segment.strip()]


def _format_tree_path_for_export(node_path: str) -> str:
    segments = _split_node_path(node_path)
    if not segments:
        return ""
    segments[-1] = f"Hạng {segments[-1]}"
    return " · ".join(segments)


async def _get_dynamic_node_relationship_maps(
    db: AsyncSession,
    tournament_id: int,
) -> tuple[dict[int, int | None], set[int]]:
    rows = (
        await db.execute(
            select(TournamentStructureNode.id, TournamentStructureNode.parent_id)
            .where(TournamentStructureNode.tournament_id == tournament_id)
        )
    ).all()
    if not rows:
        return {}, set()

    parent_by_id = {node_id: parent_id for node_id, parent_id in rows}
    parent_ids = {parent_id for _, parent_id in rows if parent_id is not None}
    return parent_by_id, parent_ids


def _resolve_quyen_classification_node_id(
    node_id: int | None,
    parent_by_id: dict[int, int | None],
    parent_ids: set[int],
) -> int | None:
    if node_id is None:
        return None
    if node_id in parent_ids:
        return node_id
    parent_id = parent_by_id.get(node_id)
    if parent_id is not None:
        return parent_id
    return node_id


def _build_bracket_for_wc(
    wc_id: int,
    names: list[str],
    match_prefix: str = "",
) -> tuple:
    """Build a full single-elimination bracket with BYE matches.
    match_prefix: e.g. 'Nam_PhongTrao_1A_15kg' → codes become 'Nam_PhongTrao_1A_15kg_A1'
    """
    n = len(names)
    slots = 2 ** math.ceil(math.log2(n)) if n > 1 else 2
    total_rounds = int(math.log2(slots))
    byes = slots - n

    seeded: list[str | None]
    if byes > 0:
        seeded = _seed_participants_with_byes(names, slots, byes)
    else:
        seeded = names.copy()
        random.shuffle(seeded)

    sep = "-" if match_prefix else ""
    round_matches: dict[int, list[BracketMatch]] = {}
    r1_list: list[BracketMatch] = []

    for i in range(0, slots, 2):
        p1 = seeded[i]
        p2 = seeded[i + 1]
        pos = i // 2 + 1          # match_number 1..slots/2, sequential, no repeats

        # Classify the match
        if p1 is None and p2 is None:
            # Double-BYE — defensive guard, should never occur with correct seeding
            player1_name, player2_name = "BYE", "BYE"
            is_bye, status, winner = True, "skipped", None
        elif p2 is None:
            # Normal BYE: real player p1 auto-wins
            player1_name, player2_name = p1, "BYE"
            is_bye, status, winner = True, "completed", 1
        elif p1 is None:
            # Inverted BYE: real player p2 auto-wins (defensive, shouldn't happen)
            player1_name, player2_name = "BYE", p2
            is_bye, status, winner = True, "completed", 2
        else:
            # Regular match
            player1_name, player2_name = p1, p2
            is_bye, status, winner = False, "ready", None

        m = BracketMatch(
            weight_class_id=wc_id,
            round=1,
            match_number=pos,
            match_code=f"{match_prefix}{sep}A{pos}",
            player1_name=player1_name,
            player2_name=player2_name,
            is_bye=is_bye,
            status=status,
            winner=winner,
        )
        r1_list.append(m)

    round_matches[1] = r1_list

    for r in range(2, total_rounds + 1):
        round_letter = chr(64 + r)
        prev = round_matches[r - 1]
        curr: list[BracketMatch] = []
        for i in range(0, len(prev), 2):
            pos = i // 2 + 1
            m = BracketMatch(
                weight_class_id=wc_id,
                round=r,
                match_number=pos,
                match_code=f"{match_prefix}{sep}{round_letter}{pos}",
                status="pending",
            )
            curr.append(m)
        round_matches[r] = curr

    all_matches: list[BracketMatch] = []
    for r in sorted(round_matches.keys()):
        all_matches.extend(round_matches[r])

    return all_matches, round_matches, r1_list


async def _reshuffle_bracket(
    db: AsyncSession,
    weight_class_id: int,
    r1_matches: list[BracketMatch],
    names: list[str],
) -> None:
    """Shuffle player names within existing Round 1 matches in place.
    Preserves all match IDs, next_match_id links, and schedule_order.
    Raises ValueError if player count no longer matches the bracket structure.
    """
    # Collect real-player slots in match_number order (BYE positions are fixed)
    player_slots: list[tuple[BracketMatch, str]] = []
    for m in r1_matches:
        player_slots.append((m, "p1"))
        if not m.is_bye:
            player_slots.append((m, "p2"))

    if len(names) != len(player_slots):
        raise ValueError(f"Player count mismatch: {len(names)} vs {len(player_slots)} slots")

    shuffled = names.copy()
    random.shuffle(shuffled)

    for (m, slot), name in zip(player_slots, shuffled):
        if slot == "p1":
            m.player1_name = name
        else:
            m.player2_name = name

    await db.flush()

    # Reset Round 2+ matches
    await db.execute(
        update(BracketMatch)
        .where(BracketMatch.weight_class_id == weight_class_id, BracketMatch.round > 1)
        .values(player1_name=None, player2_name=None, winner=None, status="pending",
                score1=None, score2=None)
    )
    await db.flush()

    # Propagate BYE winners into Round 2
    r2_matches = (await db.execute(
        select(BracketMatch)
        .where(BracketMatch.weight_class_id == weight_class_id, BracketMatch.round == 2)
        .order_by(BracketMatch.match_number)
    )).scalars().all()

    r2_by_id = {m.id: m for m in r2_matches}
    for m in r1_matches:
        if not m.is_bye or m.winner is None or not m.next_match_id:
            continue
        nxt = r2_by_id.get(m.next_match_id)
        if nxt is None:
            continue
        winner_name = m.player1_name if m.winner == 1 else m.player2_name
        if m.match_number % 2 == 1:
            nxt.player1_name = winner_name
        else:
            nxt.player2_name = winner_name

    for m in r2_matches:
        if m.player1_name and m.player2_name and not m.is_bye:
            m.status = "ready"

    await db.flush()


async def _flush_and_link(
    db: AsyncSession,
    round_matches: dict[int, list[BracketMatch]],
    r1_list: list[BracketMatch],
    total_rounds: int,
) -> None:
    """Flush DB, link next_match_id, propagate BYE winners."""
    await db.flush()

    # Link next_match_id
    for r in range(1, total_rounds):
        curr_list = round_matches[r]
        next_list = round_matches[r + 1]
        for i, m in enumerate(curr_list):
            m.next_match_id = next_list[i // 2].id

    # Propagate BYE winners into round 2
    if total_rounds >= 2:
        for m in r1_list:
            if not m.is_bye or m.winner is None or not m.next_match_id:
                continue  # skip: not a BYE, or skipped (double-BYE), or unlinked
            nxt = next((x for x in round_matches[2] if x.id == m.next_match_id), None)
            if nxt is None:
                continue
            # Resolve actual winner name from winner field (1=player1, 2=player2)
            winner_name = m.player1_name if m.winner == 1 else m.player2_name
            # Odd match_number feeds p1 slot of next match; even feeds p2 slot
            if m.match_number % 2 == 1:
                nxt.player1_name = winner_name
            else:
                nxt.player2_name = winner_name

    # Set round-2 matches to "ready" if both players now filled (from BYE propagation)
    if total_rounds >= 2:
        for m in round_matches[2]:
            if m.player1_name and m.player2_name and not m.is_bye:
                m.status = "ready"

    await db.flush()


# ── Tournament structure ──────────────────────────────────────────────────────

async def get_tournament_structure(db: AsyncSession, tournament_id: int) -> TournamentStructure | None:
    t = (await db.execute(select(Tournament).where(Tournament.id == tournament_id))).scalar_one_or_none()
    if not t:
        return None
    await _sync_dynamic_participants_to_legacy(db, t)

    wcs = (
        await db.execute(
            select(TournamentWeightClass)
            .where(TournamentWeightClass.tournament_id == tournament_id)
            .order_by(
                TournamentWeightClass.category,
                TournamentWeightClass.age_type_code,
                TournamentWeightClass.gender,
                TournamentWeightClass.weight_class_name,
            )
        )
    ).scalars().all()

    wc_ids = [wc.id for wc in wcs]
    participant_rows = (
        await db.execute(
            select(
                TournamentParticipant.weight_class_id,
                Student.id,
                Student.full_name,
                Student.gender,
                Student.weight_class,
            )
            .join(Student, Student.id == TournamentParticipant.student_id)
            .where(
                TournamentParticipant.weight_class_id.in_(wc_ids),
                Student.status == "active",
            )
            .order_by(Student.full_name)
        )
    ).all()

    participants_by_wc: dict[int, list[ParticipantInfo]] = defaultdict(list)
    for wc_id, sid, full_name, gender, wc in participant_rows:
        participants_by_wc[wc_id].append(
            ParticipantInfo(
                student_id=sid,
                full_name=full_name,
                gender=gender,
                weight_class=float(wc) if wc is not None else None,
            )
        )

    # Sync total_players from live participant count — keeps column consistent
    stale_wcs = [
        wc for wc in wcs
        if wc.total_players != len(participants_by_wc.get(wc.id, []))
    ]
    if stale_wcs:
        for wc in stale_wcs:
            live_count = len(participants_by_wc.get(wc.id, []))
            await db.execute(
                update(TournamentWeightClass)
                .where(TournamentWeightClass.id == wc.id)
                .values(total_players=live_count)
            )
        await db.flush()

    cat_map: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for wc in wcs:
        live_count = len(participants_by_wc.get(wc.id, []))
        cat_map[wc.category][wc.age_type_code].append(
            WeightClassItem(
                id=wc.id,
                weight_class_name=wc.weight_class_name,
                gender=wc.gender,
                total_players=live_count,
                bracket_status=wc.bracket_status,
                participants=participants_by_wc.get(wc.id, []),
            )
        )

    categories: list[CategoryItem] = []
    for cat in CATEGORY_ORDER:
        if cat not in cat_map:
            continue
        meta = AGE_TYPE_META.get(cat, {})
        age_type_order = list(meta.keys())
        age_types: list[AgeTypeItem] = []
        for code in age_type_order:
            if code not in cat_map[cat]:
                continue
            age_types.append(AgeTypeItem(
                code=code,
                description=meta.get(code, code),
                weight_classes=cat_map[cat][code],
            ))
        if age_types:
            categories.append(CategoryItem(category=cat, age_types=age_types))

    return TournamentStructure(
        tournament_id=t.id,
        tournament_name=t.name,
        tournament_status=t.status,
        categories=categories,
    )


async def get_bracket_tree(db: AsyncSession, tournament_id: int) -> "BracketTreeResponse | None":
    """Get tournament bracket data organized by the dynamic tree structure.

    For dynamic tournaments, returns the node tree with leaf nodes enriched with bracket info.
    For legacy tournaments, returns None (use get_tournament_structure instead).
    """
    from app.schemas.tournament_structure import BracketTreeResponse, BracketNodeItem, BracketLeafInfo

    t = (await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )).scalar_one_or_none()

    if not t:
        return None

    # Sync dynamic participants to legacy weight_classes if needed
    if getattr(t, "structure_mode", "legacy") == "dynamic":
        await _sync_dynamic_participants_to_legacy(db, t)

    # Fetch all nodes for this tournament
    nodes = (
        await db.execute(
            select(TournamentStructureNode)
            .where(TournamentStructureNode.tournament_id == tournament_id)
            .order_by(TournamentStructureNode.sort_order, TournamentStructureNode.id)
        )
    ).scalars().all()

    if not nodes:
        return None

    # Fetch all weight classes keyed by node_id
    weight_classes = (
        await db.execute(
            select(TournamentWeightClass)
            .where(TournamentWeightClass.tournament_id == tournament_id)
        )
    ).scalars().all()

    wc_by_node_id = {wc.node_id: wc for wc in weight_classes if wc.node_id is not None}
    node_by_id = {n.id: n for n in nodes}

    # Fetch participants (student_id + full_name) for all weight classes in one query
    from app.schemas.tournament_structure import BracketLeafParticipant
    wc_ids = [wc.id for wc in weight_classes]
    participants_by_wc: dict[int, list[BracketLeafParticipant]] = {}
    if wc_ids:
        p_rows = (await db.execute(
            select(TournamentParticipant.weight_class_id, TournamentParticipant.student_id, Student.full_name)
            .join(Student, Student.id == TournamentParticipant.student_id)
            .where(TournamentParticipant.weight_class_id.in_(wc_ids))
            .order_by(Student.full_name)
        )).all()
        for wc_id, student_id, full_name in p_rows:
            participants_by_wc.setdefault(wc_id, []).append(
                BracketLeafParticipant(student_id=student_id, full_name=full_name)
            )

    # Build tree recursively
    def build_node_item(node: TournamentStructureNode) -> BracketNodeItem:
        # Get children sorted by sort_order
        children = sorted(
            [n for n in nodes if n.parent_id == node.id],
            key=lambda n: (n.sort_order, n.id)
        )

        # Build leaf_info if this is a weight_class leaf node
        leaf_info = None
        resolved_type = _safe_node_type(node, nodes)
        if resolved_type == "weight_class":
            wc = wc_by_node_id.get(node.id)
            if wc:
                leaf_info = BracketLeafInfo(
                    weight_class_id=wc.id,
                    bracket_status=wc.bracket_status,
                    total_players=wc.total_players,
                    players=wc.players or [],
                    participants=participants_by_wc.get(wc.id, []),
                )

        return BracketNodeItem(
            id=node.id,
            name=node.name,
            node_type=resolved_type,
            sort_order=node.sort_order,
            leaf_info=leaf_info,
            children=[build_node_item(child) for child in children],
        )

    # Get root nodes (parent_id IS NULL) sorted by sort_order
    root_nodes = sorted(
        [n for n in nodes if n.parent_id is None],
        key=lambda n: (n.sort_order, n.id)
    )

    return BracketTreeResponse(
        tournament_id=t.id,
        tournament_name=t.name,
        tournament_status=t.status,
        nodes=[build_node_item(root) for root in root_nodes],
    )


# ── Bracket retrieval ─────────────────────────────────────────────────────────

async def get_bracket(db: AsyncSession, weight_class_id: int) -> BracketOut | None:
    wc = (await db.execute(
        select(TournamentWeightClass).where(TournamentWeightClass.id == weight_class_id)
    )).scalar_one_or_none()
    if not wc:
        return None

    matches = (
        await db.execute(
            select(BracketMatch)
            .where(BracketMatch.weight_class_id == weight_class_id)
            .order_by(BracketMatch.round, BracketMatch.match_number)
        )
    ).scalars().all()

    return BracketOut(
        weight_class_id=wc.id,
        weight_class_name=wc.weight_class_name,
        gender=wc.gender,
        bracket_status=wc.bracket_status,
        matches=[BracketMatchOut.model_validate(m) for m in matches],
    )


async def get_dynamic_bracket_export(
    db: AsyncSession,
    tournament_id: int,
    node_id: int | None = None,
) -> tuple[BracketExportOut | None, str | None]:
    tournament = (
        await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    ).scalar_one_or_none()
    if not tournament:
        return None, "TOURNAMENT_NOT_FOUND"
    if getattr(tournament, "structure_mode", "legacy") != "dynamic":
        return None, "NOT_DYNAMIC_TOURNAMENT"

    if node_id is not None:
        node = (
            await db.execute(
                select(TournamentStructureNode).where(
                    TournamentStructureNode.id == node_id,
                    TournamentStructureNode.tournament_id == tournament_id,
                )
            )
        ).scalar_one_or_none()
        if not node:
            return None, "NODE_NOT_FOUND"

    node_path_map, node_order_map = await _get_dynamic_node_path_order_maps(db, tournament_id)

    wc_stmt = (
        select(TournamentWeightClass)
        .where(
            TournamentWeightClass.tournament_id == tournament_id,
            TournamentWeightClass.node_id.isnot(None),
        )
    )
    if node_id is not None:
        wc_stmt = wc_stmt.where(TournamentWeightClass.node_id == node_id)

    weight_classes = (await db.execute(wc_stmt)).scalars().all()
    if node_id is not None and not weight_classes:
        return None, "EXPORT_PATH_NOT_FOUND"

    match_rows = (
        await db.execute(
            select(BracketMatch)
            .join(TournamentWeightClass, TournamentWeightClass.id == BracketMatch.weight_class_id)
            .where(TournamentWeightClass.tournament_id == tournament_id)
            .order_by(BracketMatch.weight_class_id, BracketMatch.round, BracketMatch.match_number)
        )
    ).scalars().all()

    matches_by_wc: dict[int, list[BracketMatch]] = defaultdict(list)
    for match in match_rows:
        matches_by_wc[match.weight_class_id].append(match)

    sorted_weight_classes = sorted(
        weight_classes,
        key=lambda wc: (node_order_map.get(wc.node_id or 0, (999999, wc.id)), wc.id),
    )

    paths: list[BracketExportPathOut] = []
    for wc in sorted_weight_classes:
        node_path = node_path_map.get(wc.node_id or 0, "")
        paths.append(
            BracketExportPathOut(
                node_id=wc.node_id or 0,
                node_path=node_path,
                tree_path=_format_tree_path_for_export(node_path),
                path_segments=_split_node_path(node_path),
                weight_class_id=wc.id,
                weight_class_name=wc.weight_class_name,
                gender=wc.gender or "",
                total_players=wc.total_players or 0,
                bracket_status=wc.bracket_status,
                players=list(wc.players or []),
                matches=[BracketMatchOut.model_validate(match) for match in matches_by_wc.get(wc.id, [])],
            )
        )

    return BracketExportOut(
        tournament_id=tournament.id,
        tournament_name=tournament.name,
        tournament_status=tournament.status,
        scope="single" if node_id is not None else "all",
        total_paths=len(paths),
        paths=paths,
    ), None


# ── Single weight class bracket generation (TournamentsPage per-wc) ───────────

async def generate_bracket(db: AsyncSession, weight_class_id: int) -> BracketOut | None:
    """Single-elimination bracket with BYE, power-of-2 slots, match_code.
    On re-generation: reshuffles player names in place (preserves match IDs/STT).
    On first generation: creates fresh bracket records.
    """
    wc = (await db.execute(
        select(TournamentWeightClass).where(TournamentWeightClass.id == weight_class_id)
    )).scalar_one_or_none()
    if not wc:
        return None
    tournament = (await db.execute(
        select(Tournament).where(Tournament.id == wc.tournament_id)
    )).scalar_one_or_none()
    if tournament:
        await _sync_dynamic_participants_to_legacy(db, tournament)

    # Load participants from registration table
    # Dynamic: wc.players is source of truth (synced from StudentWeightAssignment above).
    # Legacy: filter by StudentContestSelection(contest_type='sparring') to exclude kata-only students.
    is_dynamic = tournament and getattr(tournament, "structure_mode", "legacy") == "dynamic"
    if is_dynamic:
        names = list(wc.players or [])
    else:
        name_rows = (
            await db.execute(
                select(Student.full_name)
                .join(TournamentParticipant, TournamentParticipant.student_id == Student.id)
                .join(
                    StudentContestSelection,
                    (StudentContestSelection.student_id == Student.id)
                    & (StudentContestSelection.tournament_id == wc.tournament_id)
                    & (StudentContestSelection.contest_type == "sparring"),
                )
                .where(
                    TournamentParticipant.weight_class_id == weight_class_id,
                    Student.status == "active",
                )
                .order_by(Student.full_name)
            )
        ).all()
        names = [r[0] for r in name_rows]
        if not names:
            names = list(wc.players or [])
    if len(names) < 2:
        return None

    await db.execute(
        update(TournamentWeightClass)
        .where(TournamentWeightClass.id == weight_class_id)
        .values(bracket_status="GENERATING")
    )
    await db.flush()

    # Check if bracket already exists (re-generation case)
    existing_r1 = (await db.execute(
        select(BracketMatch)
        .where(BracketMatch.weight_class_id == weight_class_id, BracketMatch.round == 1)
        .order_by(BracketMatch.match_number)
    )).scalars().all()

    if existing_r1:
        # Re-generation: shuffle players in place — preserves match IDs, STT, schedule_order
        try:
            await _reshuffle_bracket(db, weight_class_id, list(existing_r1), names)
        except ValueError:
            # Player count changed — fall back to full recreate
            await db.execute(delete(BracketMatch).where(BracketMatch.weight_class_id == weight_class_id))
            await db.flush()
            n = len(names)
            slots = 2 ** math.ceil(math.log2(n)) if n > 1 else 2
            total_rounds = int(math.log2(slots))
            prefix = _make_match_prefix(wc)
            all_matches, round_matches, r1_list = _build_bracket_for_wc(weight_class_id, names, prefix)
            for m in all_matches:
                db.add(m)
            await _flush_and_link(db, round_matches, r1_list, total_rounds)
    else:
        # First generation: create fresh bracket records
        n = len(names)
        slots = 2 ** math.ceil(math.log2(n)) if n > 1 else 2
        total_rounds = int(math.log2(slots))
        prefix = _make_match_prefix(wc)
        all_matches, round_matches, r1_list = _build_bracket_for_wc(weight_class_id, names, prefix)
        for m in all_matches:
            db.add(m)
        await _flush_and_link(db, round_matches, r1_list, total_rounds)

    await db.execute(
        update(TournamentWeightClass)
        .where(TournamentWeightClass.id == weight_class_id)
        .values(bracket_status="GENERATED")
    )

    return await get_bracket(db, weight_class_id)


# ── Generate ALL weight classes for tournament ─────────────────────────────────

async def generate_all_matches(db: AsyncSession, tournament_id: int) -> dict | None:
    """Generate single-elimination brackets for đối kháng weight classes only.
    Quyền (age_type_code='5') is skipped — those are handled by generate_schedule.
    """
    t = (await db.execute(select(Tournament).where(Tournament.id == tournament_id))).scalar_one_or_none()
    if not t:
        return None
    await _sync_dynamic_participants_to_legacy(db, t)

    # Only đối kháng weight classes (skip Quyền)
    wcs = (await db.execute(
        select(TournamentWeightClass).where(
            TournamentWeightClass.tournament_id == tournament_id,
            TournamentWeightClass.age_type_code != "5",
        )
    )).scalars().all()
    wc_ids = [wc.id for wc in wcs]

    # Clear old bracket matches for đối kháng WCs only
    if wc_ids:
        await db.execute(delete(BracketMatch).where(BracketMatch.weight_class_id.in_(wc_ids)))
        await db.execute(
            update(TournamentWeightClass)
            .where(TournamentWeightClass.id.in_(wc_ids))
            .values(bracket_status="NOT_GENERATED")
        )
        await db.flush()

    total_bracket_matches = 0
    bye_matches = 0
    generated_wc = 0
    skipped_wc = 0

    is_dynamic = getattr(t, "structure_mode", "legacy") == "dynamic"
    for wc in wcs:
        # Load participants
        # Dynamic: wc.players is source of truth (synced from StudentWeightAssignment above).
        # Legacy: filter by StudentContestSelection(contest_type='sparring') to exclude kata-only students.
        if is_dynamic:
            names = list(wc.players or [])
        else:
            rows = (await db.execute(
                select(Student.full_name)
                .join(TournamentParticipant, TournamentParticipant.student_id == Student.id)
                .join(
                    StudentContestSelection,
                    (StudentContestSelection.student_id == Student.id)
                    & (StudentContestSelection.tournament_id == tournament_id)
                    & (StudentContestSelection.contest_type == "sparring"),
                )
                .where(
                    TournamentParticipant.weight_class_id == wc.id,
                    Student.status == "active",
                )
                .order_by(Student.full_name)
            )).all()
            names = [r[0] for r in rows]
            if not names:
                names = list(wc.players or [])

        actual_count = len(names)
        await db.execute(
            update(TournamentWeightClass)
            .where(TournamentWeightClass.id == wc.id)
            .values(total_players=actual_count)
        )

        # Need >= 2 players for a bracket
        if actual_count < 2:
            skipped_wc += 1
            continue

        await db.execute(
            update(TournamentWeightClass)
            .where(TournamentWeightClass.id == wc.id)
            .values(bracket_status="GENERATING")
        )
        await db.flush()

        n = actual_count
        slots = 2 ** math.ceil(math.log2(n)) if n > 1 else 2
        total_rounds = int(math.log2(slots))

        prefix = _make_match_prefix(wc)
        all_matches, round_matches, r1_list = _build_bracket_for_wc(wc.id, names, prefix)
        for m in all_matches:
            m.round_duration_seconds = t.default_round_duration_seconds
            m.break_duration_seconds = t.default_break_duration_seconds
            db.add(m)

        await _flush_and_link(db, round_matches, r1_list, total_rounds)

        bye_count = sum(1 for m in r1_list if m.is_bye)
        bye_matches += bye_count
        total_bracket_matches += sum(len(v) for v in round_matches.values())

        await db.execute(
            update(TournamentWeightClass)
            .where(TournamentWeightClass.id == wc.id)
            .values(bracket_status="GENERATED")
        )
        generated_wc += 1

    return {
        "tournament_id": tournament_id,
        "generated_weight_classes": generated_wc,
        "skipped_weight_classes": skipped_wc,
        "total_bracket_matches": total_bracket_matches,
        "bye_matches": bye_matches,
    }


# ── Generate schedule (assign courts + order) ─────────────────────────────────

async def generate_schedule(db: AsyncSession, tournament_id: int) -> dict | None:
    t = (await db.execute(select(Tournament).where(Tournament.id == tournament_id))).scalar_one_or_none()
    if not t:
        return None
    await _sync_dynamic_participants_to_legacy(db, t)
    # Always rebuild sparring brackets from current registration data before scheduling.
    # Relying only on bracket_status can keep stale generated matches alive after a
    # participant edit drops a weight class below the minimum 2-athlete threshold.
    await generate_all_matches(db, tournament_id)

    await db.execute(delete(QuyenSlot).where(QuyenSlot.tournament_id == tournament_id))
    await db.flush()

    node_path_map: dict[int, str] = {}
    node_order_map: dict[int, tuple[int, ...]] = {}
    node_parent_map: dict[int, int | None] = {}
    node_parent_ids: set[int] = set()
    if t.structure_mode == "dynamic":
        node_path_map, node_order_map = await _get_dynamic_node_path_order_maps(db, tournament_id)
        node_parent_map, node_parent_ids = await _get_dynamic_node_relationship_maps(db, tournament_id)

    quyen_specs: list[dict] = []

    individual_quyen_rows = (await db.execute(
        select(
            TournamentWeightClass.id,
            StudentWeightAssignment.node_id,
            TournamentWeightClass.node_id,
            Student.full_name,
            TournamentKata.name,
            TournamentKata.sort_order,
        )
        .join(Student, Student.id == StudentWeightAssignment.student_id)
        .join(
            StudentContestSelection,
            (StudentContestSelection.student_id == Student.id)
            & (StudentContestSelection.tournament_id == tournament_id)
            & (StudentContestSelection.contest_type == "kata"),
        )
        .join(TournamentKata, TournamentKata.id == StudentContestSelection.kata_id)
        .outerjoin(
            TournamentWeightClass,
            (TournamentWeightClass.tournament_id == tournament_id)
            & (TournamentWeightClass.node_id == StudentWeightAssignment.node_id),
        )
        .where(
            StudentWeightAssignment.tournament_id == tournament_id,
            Student.status == "active",
        )
        .order_by(
            nullslast(TournamentWeightClass.id.asc()),
            StudentWeightAssignment.node_id,
            Student.full_name,
            TournamentKata.sort_order,
            TournamentKata.name,
        )
    )).all()

    for wc_id, assignment_node_id, sparring_node_id, full_name, kata_name, kata_sort_order in individual_quyen_rows:
        node_id = (
            _resolve_quyen_classification_node_id(assignment_node_id, node_parent_map, node_parent_ids)
            if t.structure_mode == "dynamic"
            else sparring_node_id
        )
        quyen_specs.append({
            "sort_key": (
                node_order_map.get(node_id, (wc_id,)) if node_id is not None else (wc_id,),
                kata_sort_order or 0,
                full_name,
                kata_name,
                wc_id,
            ),
            "weight_class_id": wc_id,
            "node_id": node_id,
            "player_name": full_name,
            "content_name": kata_name,
        })

    if t.structure_mode == "dynamic":
        team_quyen_rows = (await db.execute(
            select(
                TournamentTeamKataRegistration.node_id,
                Club.name,
                TournamentKata.name,
                TournamentKata.sort_order,
            )
            .join(Club, Club.id == TournamentTeamKataRegistration.club_id)
            .join(TournamentKata, TournamentKata.id == TournamentTeamKataRegistration.kata_id)
            .where(TournamentTeamKataRegistration.tournament_id == tournament_id)
            .order_by(TournamentTeamKataRegistration.node_id, Club.name, TournamentKata.sort_order, TournamentKata.name)
        )).all()

        for node_id, club_name, kata_name, kata_sort_order in team_quyen_rows:
            quyen_specs.append({
                "sort_key": (
                    node_order_map.get(node_id, (9999, node_id)),
                    kata_sort_order or 0,
                    club_name,
                    kata_name,
                ),
                "weight_class_id": None,
                "node_id": node_id,
                "player_name": club_name,
                "content_name": kata_name,
            })

    q_slots: list[QuyenSlot] = []
    for spec in sorted(quyen_specs, key=lambda item: item["sort_key"]):
        slot = QuyenSlot(
            tournament_id=tournament_id,
            weight_class_id=spec["weight_class_id"],
            node_id=spec["node_id"],
            player_name=spec["player_name"],
            content_name=spec["content_name"],
            status="pending",
            performance_duration_seconds=t.default_performance_duration_seconds,
        )
        db.add(slot)
        q_slots.append(slot)

    await db.flush()
    wc_order_map = await _get_dynamic_wc_order_map(db, tournament_id) if t.structure_mode == "dynamic" else {}

    b_rows = (await db.execute(
        select(
            BracketMatch,
            TournamentWeightClass.category,
            TournamentWeightClass.age_type_code,
            TournamentWeightClass.gender,
            TournamentWeightClass.weight_class_name,
        )
        .join(TournamentWeightClass, BracketMatch.weight_class_id == TournamentWeightClass.id)
        .where(
            TournamentWeightClass.tournament_id == tournament_id,
            BracketMatch.is_bye == False,
        )
    )).all()

    wc_max_round: dict[int, int] = {}
    for row in b_rows:
        match = row[0]
        wc_max_round[match.weight_class_id] = max(wc_max_round.get(match.weight_class_id, 0), match.round)

    category_order = {"phong_trao": 0, "pho_thong": 1}
    gender_order = {"M": 0, "F": 1}

    def b_sort_key(row):
        match, category, age_type_code, gender_code, weight_class_name = row
        max_round = wc_max_round.get(match.weight_class_id, match.round)
        distance_from_final = max_round - match.round
        return (
            -distance_from_final,
            wc_order_map.get(match.weight_class_id, 9999) if wc_order_map else category_order.get(category or "", 9),
            age_type_code or "",
            gender_order.get(gender_code or "", 9),
            weight_class_name or "",
            match.match_number,
        )

    b_matches = [row[0] for row in sorted(b_rows, key=b_sort_key)]

    court_a = 0
    court_b = 0
    counter = 1

    for slot in q_slots:
        slot.court = "A" if (counter - 1) % 2 == 0 else "B"
        slot.schedule_order = counter
        counter += 1
        if slot.court == "A":
            court_a += 1
        else:
            court_b += 1

    for match in b_matches:
        match.court = "A" if (counter - 1) % 2 == 0 else "B"
        match.schedule_order = counter
        counter += 1
        if match.court == "A":
            court_a += 1
        else:
            court_b += 1

    await db.flush()
    return {
        "tournament_id": tournament_id,
        "court_a_count": court_a,
        "court_b_count": court_b,
        "total_scheduled": court_a + court_b,
    }


async def get_full_schedule(db: AsyncSession, tournament_id: int) -> TournamentScheduleOut | None:
    t = (await db.execute(select(Tournament).where(Tournament.id == tournament_id))).scalar_one_or_none()
    if not t:
        return None

    q_slots = (await db.execute(
        select(QuyenSlot)
        .where(QuyenSlot.tournament_id == tournament_id)
        .order_by(nullslast(QuyenSlot.schedule_order.asc()), QuyenSlot.id)
    )).scalars().all()

    wc_name_map: dict[int, str] = {}
    wc_ids = sorted({slot.weight_class_id for slot in q_slots if slot.weight_class_id is not None})
    if wc_ids:
        wc_rows = (await db.execute(
            select(TournamentWeightClass.id, TournamentWeightClass.weight_class_name)
            .where(TournamentWeightClass.id.in_(wc_ids))
        )).all()
        wc_name_map = {wc_id: wc_name for wc_id, wc_name in wc_rows}


    # Bracket matches — exclude BYE (auto-win) matches from schedule output.
    # BYE matches are visible in the bracket tree (get_bracket) but not in the schedule list.
    b_rows = (await db.execute(
        select(
            BracketMatch,
            TournamentWeightClass.weight_class_name,
            TournamentWeightClass.node_id,
            TournamentWeightClass.gender,
            TournamentWeightClass.category,
            TournamentWeightClass.age_type_code,
        )
        .join(TournamentWeightClass, BracketMatch.weight_class_id == TournamentWeightClass.id)
        .where(
            TournamentWeightClass.tournament_id == tournament_id,
            BracketMatch.is_bye == False,   # noqa: E712  — exclude auto-win BYE matches
        )
        .order_by(nullslast(BracketMatch.schedule_order.asc()), BracketMatch.round, BracketMatch.weight_class_id, BracketMatch.match_number)
    )).all()

    node_path_map: dict[int, str] = {}
    node_parent_map: dict[int, int | None] = {}
    node_parent_ids: set[int] = set()
    if any(slot.node_id is not None for slot in q_slots) or any(node_id is not None for _, _, node_id, *_ in b_rows):
        node_path_map, _ = await _get_dynamic_node_path_order_maps(db, tournament_id)
        if t.structure_mode == "dynamic":
            node_parent_map, node_parent_ids = await _get_dynamic_node_relationship_maps(db, tournament_id)

    # Build match_code lookup for next_match_code
    match_code_by_id: dict[int, str] = {}
    for m, *_ in b_rows:
        if m.match_code:
            match_code_by_id[m.id] = m.match_code

    match_ids = [m.id for m, *_ in b_rows]
    judge_map: dict[int, list[BracketJudgeAssignment]] = {}
    if match_ids:
        judge_rows = (await db.execute(
            select(BracketJudgeAssignment)
            .where(BracketJudgeAssignment.match_id.in_(match_ids))
            .order_by(BracketJudgeAssignment.match_id, BracketJudgeAssignment.judge_slot)
        )).scalars().all()
        for judge in judge_rows:
            judge_map.setdefault(judge.match_id, []).append(judge)

    # Max round per weight class → for round_label
    wc_max_round: dict[int, int] = {}
    for m, *_ in b_rows:
        wc_max_round[m.weight_class_id] = max(wc_max_round.get(m.weight_class_id, 0), m.round)

    # Build player_name → club_name lookup from tournament participants
    participant_club_rows = (await db.execute(
        select(Student.full_name, Club.name)
        .join(StudentWeightAssignment, StudentWeightAssignment.student_id == Student.id)
        .join(StudentClub, (StudentClub.student_id == Student.id) & (StudentClub.is_current == True))  # noqa: E712
        .join(Club, Club.id == StudentClub.club_id)
        .where(
            StudentWeightAssignment.tournament_id == tournament_id,
            Student.status == "active",
        )
    )).all()
    player_club_map: dict[str, str] = {name: club for name, club in participant_club_rows}

    # Build club_name → club_id lookup for team kata (club-type) slots
    team_club_rows = (await db.execute(
        select(Club.name, Club.id)
        .join(TournamentTeamKataRegistration, TournamentTeamKataRegistration.club_id == Club.id)
        .where(TournamentTeamKataRegistration.tournament_id == tournament_id)
        .distinct()
    )).all()
    team_club_id_map: dict[str, int] = {name: club_id for name, club_id in team_club_rows}

    # Build (node_id, kata_name) → kata_id map for team kata slots
    team_kata_name_rows = (await db.execute(
        select(TournamentTeamKataRegistration.node_id, TournamentKata.name, TournamentKata.id)
        .join(TournamentKata, TournamentKata.id == TournamentTeamKataRegistration.kata_id)
        .where(TournamentTeamKataRegistration.tournament_id == tournament_id)
        .distinct()
    )).all()
    team_kata_id_map: dict[tuple[int, str], int] = {
        (node_id, kata_name): kata_id
        for node_id, kata_name, kata_id in team_kata_name_rows
    }

    quyen_slots = []
    for slot in q_slots:
        judges = await _ensure_quyen_judge_rows(db, slot.id)
        _sync_quyen_slot_status(slot, judges)
        display_node_id = slot.node_id
        if t.structure_mode == "dynamic" and slot.weight_class_id is not None:
            display_node_id = _resolve_quyen_classification_node_id(
                slot.node_id,
                node_parent_map,
                node_parent_ids,
            )

        quyen_slots.append(
            QuyenSlotOut(
                id=slot.id,
                tournament_id=slot.tournament_id,
                weight_class_id=slot.weight_class_id,
                weight_class_name=(
                    wc_name_map.get(slot.weight_class_id)
                    if slot.weight_class_id is not None
                    else node_path_map.get(display_node_id or 0, "")
                ) or "",
                node_id=display_node_id,
                node_path=node_path_map.get(display_node_id or 0) if display_node_id is not None else None,
                representative_type="student" if slot.weight_class_id is not None else "club",
                player_name=slot.player_name,
                player_club=player_club_map.get(slot.player_name) if slot.weight_class_id is not None else None,
                club_id=team_club_id_map.get(slot.player_name) if slot.weight_class_id is None else None,
                kata_id=team_kata_id_map.get((display_node_id, slot.content_name)) if slot.weight_class_id is None and display_node_id is not None else None,
                content_name=slot.content_name,
                court=slot.court,
                schedule_order=slot.schedule_order,
                status=slot.status,
                performance_duration_seconds=slot.performance_duration_seconds,
                started_at=slot.started_at,
                scoring_started_at=slot.scoring_started_at,
                scored_at=slot.scored_at,
                finished_at=slot.finished_at,
                confirmed_at=slot.confirmed_at,
                official_score=slot.official_score,
                total_judge_score=slot.total_judge_score,
                highest_judge_score=slot.highest_judge_score,
                lowest_judge_score=slot.lowest_judge_score,
                assigned_judges_count=sum(1 for judge in judges if judge.judge_user_id is not None),
                ready_judges_count=_count_ready_quyen_judges(judges),
                submitted_judges_count=_count_submitted_quyen_judges(judges),
            )
        )

    bracket_matches = []
    for m, wc_name, wc_node_id, gender, category, age_type_code in b_rows:
        judges = judge_map.get(m.id)
        if judges is None:
            judges = await _ensure_match_judge_rows(db, m.id)
            judge_map[m.id] = judges
        _sync_match_status(m, judges)
        total_rounds = wc_max_round.get(m.weight_class_id, m.round)
        winner_name = None
        if m.winner == 1:
            winner_name = m.player1_name
        elif m.winner == 2:
            winner_name = m.player2_name
        bracket_matches.append(ScheduleBracketMatchOut(
            id=m.id,
            weight_class_id=m.weight_class_id,
            weight_class_name=wc_name,
            node_path=node_path_map.get(wc_node_id) if wc_node_id is not None else None,
            gender=gender or "",
            category=category or "",
            age_type_code=age_type_code or "",
            match_code=m.match_code,
            round=m.round,
            round_label=_get_round_label(m.round, total_rounds),
            match_number=m.match_number,
            player1_name=m.player1_name,
            player2_name=m.player2_name,
            player1_club=player_club_map.get(m.player1_name) if m.player1_name else None,
            player2_club=player_club_map.get(m.player2_name) if m.player2_name else None,
            score1=m.score1,
            score2=m.score2,
            winner=m.winner,
            winner_name=winner_name,
            court=m.court,
            schedule_order=m.schedule_order,
            status=m.status,
            is_bye=m.is_bye,
            next_match_id=m.next_match_id,
            next_match_code=match_code_by_id.get(m.next_match_id) if m.next_match_id else None,
            started_at=m.started_at,
            finished_at=m.finished_at,
            assigned_judges_count=sum(1 for judge in judges if judge.judge_user_id is not None),
            ready_judges_count=_count_ready_match_judges(judges),
        ))

    # Summary counts (exclude BYE from doi_khang_count and status counts)
    non_bye_matches = [m for m, *_ in b_rows if not m.is_bye]
    all_statuses = [slot.status for slot in q_slots] + [m.status for m, *_ in b_rows if not m.is_bye]

    summary = ScheduleSummary(
        quyen_count=len(q_slots),
        doi_khang_count=len(non_bye_matches),
        ready_count=sum(1 for s in all_statuses if s == "ready"),
        ongoing_count=sum(1 for s in all_statuses if s in ("ongoing", "scoring")),
        scoring_count=sum(1 for s in all_statuses if s == "scoring"),
        scored_count=0,
        completed_count=sum(1 for s in all_statuses if s == "completed"),
        pending_count=sum(1 for s in all_statuses if s == "pending"),
    )

    return TournamentScheduleOut(
        tournament_id=t.id,
        tournament_name=t.name,
        tournament_status=t.status,
        summary=summary,
        quyen_slots=quyen_slots,
        bracket_matches=bracket_matches,
    )


# ── Update schedule (manual reorder + court change) ───────────────────────────

async def update_schedule(
    db: AsyncSession,
    tournament_id: int,
    body,  # UpdateScheduleIn — imported at call site to avoid circular
) -> tuple[dict | None, str | None]:
    """Batch-update schedule_order + court for bracket_matches and quyen_slots.

    Allowed in DRAFT and PUBLISHED. Blocked in ONGOING / COMPLETED.
    Returns (result_dict, error_code).
    """
    t = (await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )).scalar_one_or_none()
    if not t:
        return None, "NOT_FOUND"
    if t.status in ("ONGOING", "COMPLETED"):
        return None, "LOCKED"

    # Bulk-update bracket_matches
    for item in body.bracket_matches:
        values: dict = {"schedule_order": item.schedule_order}
        if item.court is not None:
            values["court"] = item.court
        await db.execute(
            update(BracketMatch)
            .where(BracketMatch.id == item.id)
            .values(**values)
        )

    # Bulk-update quyen_slots
    for item in body.quyen_slots:
        values = {"schedule_order": item.schedule_order}
        if item.court is not None:
            values["court"] = item.court
        await db.execute(
            update(QuyenSlot)
            .where(QuyenSlot.id == item.id)
            .values(**values)
        )

    await db.commit()
    return {
        "updated_bracket": len(body.bracket_matches),
        "updated_quyen": len(body.quyen_slots),
    }, None


# ── Match actions ──────────────────────────────────────────────────────────────

async def start_match(db: AsyncSession, match_id: int) -> tuple[BracketMatch | None, str | None]:
    """ready → ongoing with court conflict check."""
    match = (await db.execute(
        select(BracketMatch).where(BracketMatch.id == match_id)
    )).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if not match.player1_name or not match.player2_name or match.player2_name == "BYE":
        return None, "MISSING_PLAYERS"
    if match.status not in ("ready", "pending"):
        return None, "NOT_READY"

    # Court conflict: bracket_matches (scoped to same tournament only)
    if match.court:
        tournament_id_row = (await db.execute(
            select(TournamentWeightClass.tournament_id)
            .where(TournamentWeightClass.id == match.weight_class_id)
        )).scalar_one_or_none()

        if tournament_id_row:
            busy_match = (await db.execute(
                select(BracketMatch).where(
                    BracketMatch.court == match.court,
                    BracketMatch.status == "ongoing",
                    BracketMatch.id != match_id,
                    BracketMatch.weight_class_id.in_(
                        select(TournamentWeightClass.id).where(
                            TournamentWeightClass.tournament_id == tournament_id_row
                        )
                    ),
                )
            )).scalar_one_or_none()
            if busy_match:
                return None, f"COURT_BUSY:{match.court}"

            busy_slot = (await db.execute(
                select(QuyenSlot).where(
                    QuyenSlot.court == match.court,
                    QuyenSlot.status.in_(["ongoing", "scoring"]),
                    QuyenSlot.tournament_id == tournament_id_row,
                )
            )).scalar_one_or_none()
            if busy_slot:
                return None, f"COURT_BUSY:{match.court}"

    match.status = "ongoing"
    match.match_phase = "not_started"
    match.current_hiep = 1
    match.started_at = datetime.now(timezone.utc)
    await db.flush()
    return match, None


async def reset_match(db: AsyncSession, match_id: int) -> tuple[BracketMatch | None, str | None]:
    """Reset ongoing match back to not_started phase (keeps ongoing status) — clears scores/logs so admin can restart from round 1."""
    match = (await db.execute(select(BracketMatch).where(BracketMatch.id == match_id))).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.status not in ("ongoing", "completed"):
        return None, "INVALID_STATUS"
    judges = await _ensure_match_judge_rows(db, match.id)
    for judge in judges:
        judge.ready_at = None
        judge.submitted_at = None
        judge.score1 = None
        judge.score2 = None
    # Xóa nhật ký điểm và consensus turns để bắt đầu lại sạch
    from app.models.tournament import MatchScoreLog, BracketScoreEvent
    await db.execute(delete(MatchScoreLog).where(MatchScoreLog.match_id == match_id))
    await db.execute(delete(BracketScoreEvent).where(BracketScoreEvent.match_id == match_id))
    await _delete_match_consensus_turns_if_available(db, match_id)
    match.status = "ongoing"
    match.match_phase = "not_started"
    match.current_hiep = 1
    match.score1 = None
    match.score2 = None
    match.winner = None
    match.timer_active = False
    await db.flush()
    return match, None


async def cancel_match(db: AsyncSession, match_id: int) -> tuple[BracketMatch | None, str | None]:
    """Cancel a match: revert to ready status.
    Allowed for ongoing/completed only if next match hasn't started yet."""
    match = (await db.execute(select(BracketMatch).where(BracketMatch.id == match_id))).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.status not in ("ongoing", "completed"):
        return None, "INVALID_STATUS"

    # If completed, verify next match hasn't started and undo bracket propagation
    if match.status == "completed" and match.next_match_id:
        next_match = (await db.execute(
            select(BracketMatch).where(BracketMatch.id == match.next_match_id)
        )).scalar_one_or_none()
        if next_match and next_match.status in ("ongoing", "completed"):
            return None, "NEXT_MATCH_STARTED"
        if next_match:
            # Undo: odd match_number fills player1, even fills player2
            if match.match_number % 2 == 1:
                next_match.player1_name = None
            else:
                next_match.player2_name = None
            next_judges = await _ensure_match_judge_rows(db, next_match.id)
            _sync_match_status(next_match, next_judges)

    # Reset judge assignments (keep assignments, clear ready/score state)
    judges = await _ensure_match_judge_rows(db, match.id)
    for judge in judges:
        judge.ready_at = None
        judge.submitted_at = None
        judge.score1 = None
        judge.score2 = None

    # Xóa nhật ký điểm, score events và consensus turns để bắt đầu lại sạch
    from app.models.tournament import MatchScoreLog, BracketScoreEvent
    await db.execute(delete(MatchScoreLog).where(MatchScoreLog.match_id == match_id))
    await db.execute(delete(BracketScoreEvent).where(BracketScoreEvent.match_id == match_id))
    await _delete_match_consensus_turns_if_available(db, match_id)

    match.status = "ready"
    match.match_phase = "not_started"
    match.current_hiep = 1
    match.score1 = None
    match.score2 = None
    match.winner = None
    match.timer_active = False
    match.started_at = None
    match.finished_at = None
    await db.flush()
    return match, None


async def set_match_hiep(db: AsyncSession, match_id: int, hiep: int) -> tuple[BracketMatch | None, str | None]:
    """Set current_hiep for an ongoing match."""
    match = (await db.execute(select(BracketMatch).where(BracketMatch.id == match_id))).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.status != "ongoing":
        return None, "NOT_ONGOING"
    if hiep < 1:
        return None, "INVALID_HIEP"
    match.current_hiep = hiep
    await db.flush()
    return match, None


async def apply_consensus_score(
    db: AsyncSession,
    match_id: int,
    red_delta: int,
    blue_delta: int,
) -> tuple[BracketMatch | None, str | None]:
    """Apply consensus-confirmed score deltas to a match. Uses SELECT FOR UPDATE to prevent races."""
    match = (await db.execute(
        select(BracketMatch).where(BracketMatch.id == match_id).with_for_update()
    )).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.status != "ongoing":
        return None, "NOT_ONGOING"
    match.score1 = (match.score1 or 0) + red_delta
    match.score2 = (match.score2 or 0) + blue_delta
    await db.flush()
    return match, None


# ── Match state machine transitions ──────────────────────────────────────

async def end_match_round(
    db: AsyncSession,
    match_id: int,
    score1: int,
    score2: int,
) -> tuple[BracketMatch | None, str | None]:
    """End the current round/phase. Determines next phase based on match_phase + scores."""
    match = (await db.execute(select(BracketMatch).where(BracketMatch.id == match_id))).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.status != "ongoing":
        return None, "NOT_ONGOING"

    match.score1 = score1
    match.score2 = score2

    if match.match_phase == "round_1":
        match.match_phase = "break"
    elif match.match_phase == "round_2":
        if score1 == score2:
            match.match_phase = "extra_time"
            match.current_hiep = 3
        else:
            match.match_phase = "finished"
            match.status = "completed"
            match.winner = 1 if score1 > score2 else 2
    elif match.match_phase == "extra_time":
        if score1 == score2:
            match.match_phase = "draw_pending"
        else:
            match.match_phase = "finished"
            match.status = "completed"
            match.winner = 1 if score1 > score2 else 2
    else:
        return None, "INVALID_PHASE"

    await db.flush()
    return match, None


async def start_match_round(
    db: AsyncSession,
    match_id: int,
) -> tuple[BracketMatch | None, str | None]:
    """Start the next round (break → round_2)."""
    match = (await db.execute(select(BracketMatch).where(BracketMatch.id == match_id))).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.status != "ongoing":
        return None, "NOT_ONGOING"
    if match.match_phase != "break":
        return None, "NOT_BREAK"

    match.match_phase = "round_2"
    match.current_hiep = 2
    await db.flush()
    return match, None


async def draw_match_result(
    db: AsyncSession,
    match_id: int,
    winner: int,
) -> tuple[BracketMatch | None, str | None]:
    """Resolve draw by admin pick (bốc thăm). draw_pending → finished."""
    match = (await db.execute(select(BracketMatch).where(BracketMatch.id == match_id))).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.status != "ongoing":
        return None, "NOT_ONGOING"
    if match.match_phase != "draw_pending":
        return None, "NOT_DRAW_PENDING"
    if winner not in (1, 2):
        return None, "INVALID_WINNER"

    match.winner = winner
    match.match_phase = "finished"
    await db.flush()
    return match, None


async def confirm_match(
    db: AsyncSession,
    match_id: int,
) -> tuple[BracketMatch | None, str | None]:
    """Admin confirms final result. finished → confirmed, status → completed. Propagates bracket."""
    match = (await db.execute(select(BracketMatch).where(BracketMatch.id == match_id))).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.match_phase not in ("finished", "confirmed"):
        return None, "NOT_FINISHED"

    # Idempotent: if already confirmed, just re-push without changing data
    if match.match_phase == "finished":
        match.match_phase = "confirmed"
        match.status = "completed"
        match.finished_at = datetime.now(timezone.utc)

    # Bracket propagation
    if match.next_match_id:
        next_match = (await db.execute(
            select(BracketMatch).where(BracketMatch.id == match.next_match_id)
        )).scalar_one_or_none()
        if next_match:
            winner_name = match.player1_name if match.winner == 1 else match.player2_name
            if match.match_number % 2 == 1:
                next_match.player1_name = winner_name
            else:
                next_match.player2_name = winner_name
            next_judges = await _ensure_match_judge_rows(db, next_match.id)
            _sync_match_status(next_match, next_judges)

    await db.flush()
    return match, None


async def update_match_config(
    db: AsyncSession,
    match_id: int,
    round_duration_seconds: int | None,
    break_duration_seconds: int | None,
) -> tuple[BracketMatch | None, str | None]:
    """Update timer config. Only allowed before match starts (match_phase = not_started)."""
    match = (await db.execute(select(BracketMatch).where(BracketMatch.id == match_id))).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.match_phase != "not_started":
        return None, "ALREADY_STARTED"

    if round_duration_seconds is not None:
        match.round_duration_seconds = round_duration_seconds
    if break_duration_seconds is not None:
        match.break_duration_seconds = break_duration_seconds
    await db.flush()
    return match, None


# ── Live score update (realtime sync) ────────────────────────────────────

async def update_match_live_score(
    db: AsyncSession,
    match_id: int,
    score1: int,
    score2: int,
) -> tuple["BracketMatch | None", "str | None"]:
    """Persist running score to DB so all polling clients stay in sync.
    Admin may adjust scores during any non-completed phase (break, draw_pending, etc.),
    so phase-specific restrictions are intentionally not enforced here.
    """
    match = (await db.execute(select(BracketMatch).where(BracketMatch.id == match_id))).scalar_one_or_none()
    if not match:
        return None, "Match not found"
    if match.status == "completed":
        return None, "Match is completed"
    match.score1 = score1
    match.score2 = score2
    await db.flush()
    return match, None


# ── Score log ────────────────────────────────────────────────────────────

async def add_match_score_log(
    db: AsyncSession,
    match_id: int,
    actor_type: str,
    actor_name: str | None,
    action: str,
    side: int | None,
    delta: int | None,
    score1_after: int | None,
    score2_after: int | None,
    match_phase: str | None,
    description: str | None,
) -> "MatchScoreLog":
    from app.models.tournament import MatchScoreLog
    log = MatchScoreLog(
        match_id=match_id,
        actor_type=actor_type,
        actor_name=actor_name,
        action=action,
        side=side,
        delta=delta,
        score1_after=score1_after,
        score2_after=score2_after,
        match_phase=match_phase,
        description=description,
    )
    db.add(log)
    await db.flush()
    return log


async def get_match_score_logs(db: AsyncSession, match_id: int) -> list:
    from app.models.tournament import MatchScoreLog
    result = await db.execute(
        select(MatchScoreLog)
        .where(MatchScoreLog.match_id == match_id)
        .order_by(MatchScoreLog.created_at.asc())
    )
    return list(result.scalars().all())


async def get_match_consensus_turns(db: AsyncSession, match_id: int) -> list:
    from app.models.tournament import MatchConsensusTurn, MatchConsensusVote
    from sqlalchemy.orm import selectinload
    try:
        result = await db.execute(
            select(MatchConsensusTurn)
            .where(MatchConsensusTurn.match_id == match_id)
            .options(selectinload(MatchConsensusTurn.votes))
            .order_by(MatchConsensusTurn.created_at.asc())
        )
        return list(result.scalars().all())
    except ProgrammingError as exc:
        if _is_missing_consensus_table_error(exc):
            return []
        raise


async def get_match_detail(db: AsyncSession, match_id: int) -> dict | None:
    """Return match with joined weight class metadata and player avatar URLs."""
    row = (await db.execute(
        select(BracketMatch, TournamentWeightClass)
        .join(TournamentWeightClass, BracketMatch.weight_class_id == TournamentWeightClass.id)
        .where(BracketMatch.id == match_id)
    )).first()
    if not row:
        return None
    match, wc = row
    judges = await _ensure_match_judge_rows(db, match.id)
    _sync_match_status(match, judges)
    user_name_map = await _get_user_name_map(
        db,
        [judge.judge_user_id for judge in judges if judge.judge_user_id is not None],
    )

    # Use stored club columns if available (synced from cloud); fall back to student join
    p1_club = getattr(match, "player1_club", None)
    p2_club = getattr(match, "player2_club", None)
    if not p1_club and not p2_club:
        club_map = await _get_player_club_map_for_tournament(db, wc.tournament_id)
        p1_club = club_map.get(match.player1_name) if match.player1_name else None
        p2_club = club_map.get(match.player2_name) if match.player2_name else None

    return {
        "id": match.id,
        "tournament_id": wc.tournament_id,
        "match_code": match.match_code,
        "round": match.round,
        "match_number": match.match_number,
        "court": match.court,
        "started_at": match.started_at,
        "finished_at": match.finished_at,
        "player1_name": match.player1_name,
        "player2_name": match.player2_name,
        "player1_club": p1_club,
        "player2_club": p2_club,
        "player1_avatar_url": getattr(match, "player1_avatar_url", None),
        "player2_avatar_url": getattr(match, "player2_avatar_url", None),
        "score1": match.score1,
        "score2": match.score2,
        "winner": match.winner,
        "status": match.status,
        "is_bye": match.is_bye,
        "weight_class_name": wc.weight_class_name,
        "category": wc.category,
        "age_type_code": wc.age_type_code,
        "gender": wc.gender,
        "current_hiep": match.current_hiep,
        "match_phase": match.match_phase,
        "round_duration_seconds": match.round_duration_seconds,
        "break_duration_seconds": match.break_duration_seconds,
        "assigned_judges_count": sum(1 for judge in judges if judge.judge_user_id is not None),
        "ready_judges_count": _count_ready_match_judges(judges),
        "submitted_judges_count": sum(1 for judge in judges if judge.submitted_at is not None),
        "judges": _build_match_judge_outs(judges, user_name_map),
        "timer_active": bool(match.timer_active),  # REST endpoint overrides with in-memory value
    }


async def update_match_result(
    db: AsyncSession,
    match_id: int,
    winner: int,
    score1: int,
    score2: int,
) -> tuple[BracketMatch | None, str | None]:
    match = (await db.execute(
        select(BracketMatch).where(BracketMatch.id == match_id)
    )).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.status != "ongoing":
        return None, "NOT_ONGOING"

    match.winner = winner
    match.score1 = score1
    match.score2 = score2
    match.match_phase = "finished"
    # Keep status = "ongoing" until admin confirms (→ confirmed → completed)
    await db.flush()
    return match, None


async def update_match_judge_setup(
    db: AsyncSession,
    match_id: int,
    judges_in: list,
) -> tuple[BracketMatch | None, str | None]:
    row = (await db.execute(
        select(BracketMatch, TournamentWeightClass)
        .join(TournamentWeightClass, BracketMatch.weight_class_id == TournamentWeightClass.id)
        .where(BracketMatch.id == match_id)
    )).first()
    if not row:
        return None, "NOT_FOUND"

    match, wc = row
    if match.status == "ongoing":
        return None, "LOCKED"
    if len(judges_in) != 5:
        return None, "INCOMPLETE_ASSIGNMENT"

    judge_rows = await _ensure_match_judge_rows(db, match.id)
    row_by_slot = {row.judge_slot: row for row in judge_rows}
    selected_user_ids: set[int] = set()

    for item in judges_in:
        judge_row = row_by_slot.get(item.judge_slot)
        if not judge_row:
            continue
        if item.user_id in selected_user_ids:
            return None, "DUPLICATE_JUDGE"
        selected_user_ids.add(item.user_id)
        assigned_user = await _validate_match_assigned_user(db, wc.tournament_id, item.user_id)
        if not assigned_user:
            return None, "INVALID_JUDGE"
        judge_row.judge_user_id = assigned_user.id
        judge_row.ready_at = None

    _sync_match_status(match, judge_rows)
    await db.flush()
    return match, None


async def set_match_judge_ready(
    db: AsyncSession,
    match_id: int,
    judge_slot: int,
    *,
    current_user: User,
    ready: bool,
) -> tuple[BracketMatch | None, str | None]:
    match = (await db.execute(select(BracketMatch).where(BracketMatch.id == match_id))).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.status not in ("pending", "ready"):
        return None, "NOT_WAITING"

    judges = await _ensure_match_judge_rows(db, match.id)
    judge = next((item for item in judges if item.judge_slot == judge_slot), None)
    if not judge:
        return None, "JUDGE_NOT_FOUND"
    if judge.judge_user_id is None:
        return None, "JUDGE_UNASSIGNED"
    if current_user.role != "admin" and judge.judge_user_id != current_user.id:
        return None, "FORBIDDEN"

    judge.ready_at = datetime.now(timezone.utc) if ready else None
    _sync_match_status(match, judges)
    await db.flush()
    return match, None


async def get_referee_current_assignment(
    db: AsyncSession,
    current_user: User,
) -> RefereeCurrentAssignmentOut | None:
    q_rows = (await db.execute(
        select(QuyenJudgeScore, QuyenSlot)
        .join(QuyenSlot, QuyenJudgeScore.slot_id == QuyenSlot.id)
        .where(
            QuyenJudgeScore.judge_user_id == current_user.id,
            QuyenSlot.status.in_(("ongoing", "scoring")),
        )
        .order_by(
            QuyenSlot.status == "ongoing",
            QuyenSlot.status == "scoring",
            nullslast(QuyenSlot.schedule_order.asc()),
            QuyenSlot.id,
        )
    )).all()
    if q_rows:
        judge, slot = q_rows[0]
        return RefereeCurrentAssignmentOut(
            kind="quyen",
            entity_id=slot.id,
            judge_slot=judge.judge_slot,
            route=f"/quyen-slots/{slot.id}/judges/{judge.judge_slot}",
            status=slot.status,
            title=f"{slot.content_name} · {slot.player_name}",
        )

    m_rows = (await db.execute(
        select(BracketJudgeAssignment, BracketMatch)
        .join(BracketMatch, BracketJudgeAssignment.match_id == BracketMatch.id)
        .where(
            BracketJudgeAssignment.judge_user_id == current_user.id,
            BracketMatch.status == "ongoing",
        )
        .order_by(
            BracketMatch.status == "ongoing",
            nullslast(BracketMatch.schedule_order.asc()),
            BracketMatch.id,
        )
    )).all()
    if m_rows:
        judge, match = m_rows[0]
        return RefereeCurrentAssignmentOut(
            kind="match",
            entity_id=match.id,
            judge_slot=judge.judge_slot,
            route=f"/matches/{match.id}/judge-panel",
            status=match.status,
            title=f"{match.player1_name or 'TBD'} vs {match.player2_name or 'TBD'}",
        )

    return None


# ── Quyen slot actions ────────────────────────────────────────────────────────

async def _validate_quyen_assigned_user(
    db: AsyncSession,
    tournament_id: int,
    user_id: int,
) -> User | None:
    user = (await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)  # noqa: E712
    )).scalar_one_or_none()
    if not user or user.role != "referee":
        return None
    if tournament_id not in (user.tournament_ids or []):
        return None
    return user


async def _build_quyen_slot_out(
    db: AsyncSession,
    slot: QuyenSlot,
    judges: list[QuyenJudgeScore],
    *,
    tournament: Tournament,
    display_node_id: int | None,
    node_path_map: dict[int, str],
    player_club_map: dict[str, str],
) -> QuyenSlotOut:
    return QuyenSlotOut(
        id=slot.id,
        tournament_id=slot.tournament_id,
        weight_class_id=slot.weight_class_id,
        weight_class_name=node_path_map.get(display_node_id or 0, ""),
        node_id=display_node_id,
        node_path=node_path_map.get(display_node_id or 0) if display_node_id is not None else None,
        representative_type="student" if slot.weight_class_id is not None else "club",
        player_name=slot.player_name,
        player_club=player_club_map.get(slot.player_name) if slot.weight_class_id is not None else None,
        content_name=slot.content_name,
        court=slot.court,
        schedule_order=slot.schedule_order,
        status=slot.status,
        performance_duration_seconds=slot.performance_duration_seconds,
        started_at=slot.started_at,
        scoring_started_at=slot.scoring_started_at,
        scored_at=slot.scored_at,
        finished_at=slot.finished_at,
        confirmed_at=slot.confirmed_at,
        official_score=slot.official_score,
        total_judge_score=slot.total_judge_score,
        highest_judge_score=slot.highest_judge_score,
        lowest_judge_score=slot.lowest_judge_score,
        is_disqualified=slot.is_disqualified if slot.is_disqualified is not None else False,
        assigned_judges_count=sum(1 for judge in judges if judge.judge_user_id is not None),
        ready_judges_count=_count_ready_quyen_judges(judges),
        submitted_judges_count=_count_submitted_quyen_judges(judges),
    )


def _build_quyen_judge_outs(
    judges: list[QuyenJudgeScore],
    user_name_map: dict[int, str],
) -> list[QuyenJudgeScoreOut]:
    return [
        QuyenJudgeScoreOut(
            judge_slot=judge.judge_slot,
            assigned_user_id=judge.judge_user_id,
            assigned_user_name=user_name_map.get(judge.judge_user_id) if judge.judge_user_id else None,
            is_ready=judge.ready_at is not None,
            ready_at=judge.ready_at,
            score=judge.score,
            submitted_at=judge.submitted_at,
        )
        for judge in judges
    ]


async def _get_quyen_slot_display_context(
    db: AsyncSession,
    slot: QuyenSlot,
    tournament: Tournament,
) -> tuple[int | None, dict[int, str], dict[str, str]]:
    node_path_map, _ = await _get_dynamic_node_path_order_maps(db, slot.tournament_id)
    parent_map, parent_ids = await _get_dynamic_node_relationship_maps(db, slot.tournament_id)
    display_node_id = slot.node_id
    if tournament.structure_mode == "dynamic" and slot.weight_class_id is not None:
        display_node_id = _resolve_quyen_classification_node_id(slot.node_id, parent_map, parent_ids)
    player_club_map = await _get_player_club_map_for_tournament(db, slot.tournament_id)
    return display_node_id, node_path_map, player_club_map

async def start_quyen_slot(db: AsyncSession, slot_id: int) -> tuple[QuyenSlot | None, str | None]:
    slot = (await db.execute(
        select(QuyenSlot).where(QuyenSlot.id == slot_id)
    )).scalar_one_or_none()
    if not slot:
        return None, "NOT_FOUND"
    if slot.status != "ready":
        return None, "NOT_READY"

    if slot.court:
        busy_match = (await db.execute(
            select(BracketMatch).where(
                BracketMatch.court == slot.court,
                BracketMatch.status == "ongoing",
                BracketMatch.weight_class_id.in_(
                    select(TournamentWeightClass.id).where(
                        TournamentWeightClass.tournament_id == slot.tournament_id
                    )
                ),
            )
        )).scalar_one_or_none()
        if busy_match:
            return None, f"COURT_BUSY:{slot.court}"

        busy_slot = (await db.execute(
            select(QuyenSlot).where(
                QuyenSlot.court == slot.court,
                QuyenSlot.status.in_(("ongoing", "scoring")),
                QuyenSlot.id != slot_id,
                QuyenSlot.tournament_id == slot.tournament_id,
            )
        )).scalar_one_or_none()
        if busy_slot:
            return None, f"COURT_BUSY:{slot.court}"

    judges = await _ensure_quyen_judge_rows(db, slot.id)
    _sync_quyen_slot_status(slot, judges)
    slot.status = "ongoing"
    slot.started_at = None  # Timer starts only when user explicitly presses "Bắt đầu"
    await db.flush()
    return slot, None


async def complete_quyen_slot(db: AsyncSession, slot_id: int) -> tuple[QuyenSlot | None, str | None]:
    slot = (await db.execute(
        select(QuyenSlot).where(QuyenSlot.id == slot_id)
    )).scalar_one_or_none()
    if not slot:
        return None, "NOT_FOUND"
    judges = await _ensure_quyen_judge_rows(db, slot.id)
    has_all_scores = _apply_quyen_score_summary(slot, judges)

    if slot.status == "ongoing":
        slot.status = "scoring"
        slot.scoring_started_at = datetime.now(timezone.utc)
    elif slot.status == "scoring" and has_all_scores:
        finished_at = datetime.now(timezone.utc)
        slot.status = "completed"
        slot.scored_at = slot.scored_at or finished_at
        slot.finished_at = finished_at
        slot.confirmed_at = finished_at
    elif slot.status == "scoring":
        return None, "SCORES_PENDING"
    else:
        return None, "NOT_ONGOING"
    await db.flush()
    return slot, None


async def get_quyen_slot_scoring_detail(db: AsyncSession, slot_id: int) -> QuyenScoringDetailOut | None:
    slot = (await db.execute(
        select(QuyenSlot).where(QuyenSlot.id == slot_id)
    )).scalar_one_or_none()
    if not slot:
        return None

    tournament = (await db.execute(
        select(Tournament).where(Tournament.id == slot.tournament_id)
    )).scalar_one_or_none()
    if not tournament:
        return None

    judges = await _ensure_quyen_judge_rows(db, slot.id)
    _sync_quyen_slot_status(slot, judges)
    _apply_quyen_score_summary(slot, judges)
    await db.flush()

    display_node_id, node_path_map, player_club_map = await _get_quyen_slot_display_context(db, slot, tournament)
    user_name_map = await _get_user_name_map(
        db,
        [judge.judge_user_id for judge in judges if judge.judge_user_id is not None],
    )
    ranking_groups = await _build_quyen_ranking_groups(
        db,
        slot.tournament_id,
        target_node_id=display_node_id,
        target_content_name=slot.content_name,
    )
    ranking_group = ranking_groups[0] if ranking_groups else None

    audit_count = len((await db.execute(
        select(QuyenScoreAuditLog.id).where(QuyenScoreAuditLog.slot_id == slot.id)
    )).scalars().all())

    return QuyenScoringDetailOut(
        slot=await _build_quyen_slot_out(
            db,
            slot,
            judges,
            tournament=tournament,
            display_node_id=display_node_id,
            node_path_map=node_path_map,
            player_club_map=player_club_map,
        ),
        tournament_name=tournament.name,
        tree_path=node_path_map.get(display_node_id or 0) if display_node_id is not None else None,
        judges=_build_quyen_judge_outs(judges, user_name_map),
        ranking_group=ranking_group,
        audit_count=audit_count,
    )


async def update_quyen_judge_setup(
    db: AsyncSession,
    slot_id: int,
    judges_in: list,
    *,
    actor_user_id: int | None,
    performance_duration_seconds: int,
) -> tuple[QuyenSlot | None, str | None]:
    slot = (await db.execute(select(QuyenSlot).where(QuyenSlot.id == slot_id))).scalar_one_or_none()
    if not slot:
        return None, "NOT_FOUND"
    if slot.status in ("ongoing", "scoring", "completed"):
        return None, "LOCKED"
    if len(judges_in) != 5:
        return None, "INCOMPLETE_ASSIGNMENT"

    judge_rows = await _ensure_quyen_judge_rows(db, slot.id)
    row_by_slot = {row.judge_slot: row for row in judge_rows}
    selected_user_ids: set[int] = set()

    for item in judges_in:
        row = row_by_slot.get(item.judge_slot)
        if not row:
            continue
        if item.user_id in selected_user_ids:
            return None, "DUPLICATE_JUDGE"
        selected_user_ids.add(item.user_id)
        assigned_user = await _validate_quyen_assigned_user(db, slot.tournament_id, item.user_id)
        if not assigned_user:
            return None, "INVALID_JUDGE"
        row.judge_user_id = assigned_user.id
        row.ready_at = None
        row.score = None
        row.submitted_at = None
        await _log_quyen_score_action(
            db,
            slot.id,
            action="assign_judge",
            actor_user_id=actor_user_id,
            judge_slot=item.judge_slot,
            note=str(assigned_user.id),
        )

    slot.performance_duration_seconds = performance_duration_seconds
    slot.started_at = None
    slot.scoring_started_at = None
    slot.scored_at = None
    slot.finished_at = None
    slot.confirmed_at = None
    slot.official_score = None
    slot.total_judge_score = None
    slot.highest_judge_score = None
    slot.lowest_judge_score = None
    _sync_quyen_slot_status(slot, judge_rows)
    await db.flush()
    return slot, None


async def set_quyen_judge_ready(
    db: AsyncSession,
    slot_id: int,
    judge_slot: int,
    *,
    current_user: User,
    ready: bool,
) -> tuple[QuyenSlot | None, str | None]:
    slot = (await db.execute(select(QuyenSlot).where(QuyenSlot.id == slot_id))).scalar_one_or_none()
    if not slot:
        return None, "NOT_FOUND"
    if slot.status not in ("ready", "ongoing"):
        return None, "NOT_WAITING"

    judge_rows = await _ensure_quyen_judge_rows(db, slot.id)
    judge = next((item for item in judge_rows if item.judge_slot == judge_slot), None)
    if not judge:
        return None, "JUDGE_NOT_FOUND"
    if judge.judge_user_id is None:
        return None, "JUDGE_UNASSIGNED"
    if current_user.role != "admin" and judge.judge_user_id != current_user.id:
        return None, "FORBIDDEN"

    judge.ready_at = datetime.now(timezone.utc) if ready else None
    await _log_quyen_score_action(
        db,
        slot.id,
        action="judge_ready" if ready else "judge_unready",
        actor_user_id=current_user.id,
        judge_slot=judge_slot,
    )
    await db.flush()
    return slot, None


async def get_quyen_judge_panel(
    db: AsyncSession,
    slot_id: int,
    judge_slot: int,
) -> QuyenJudgePanelOut | None:
    slot = (await db.execute(select(QuyenSlot).where(QuyenSlot.id == slot_id))).scalar_one_or_none()
    if not slot:
        return None
    tournament = (await db.execute(select(Tournament).where(Tournament.id == slot.tournament_id))).scalar_one_or_none()
    if not tournament:
        return None

    judges = await _ensure_quyen_judge_rows(db, slot.id)
    _sync_quyen_slot_status(slot, judges)
    _apply_quyen_score_summary(slot, judges)
    display_node_id, node_path_map, player_club_map = await _get_quyen_slot_display_context(db, slot, tournament)
    user_name_map = await _get_user_name_map(
        db,
        [judge.judge_user_id for judge in judges if judge.judge_user_id is not None],
    )
    judge = next((item for item in judges if item.judge_slot == judge_slot), None)
    if not judge:
        return None

    return QuyenJudgePanelOut(
        slot=await _build_quyen_slot_out(
            db,
            slot,
            judges,
            tournament=tournament,
            display_node_id=display_node_id,
            node_path_map=node_path_map,
            player_club_map=player_club_map,
        ),
        tournament_name=tournament.name,
        tree_path=node_path_map.get(display_node_id or 0) if display_node_id is not None else None,
        judge=_build_quyen_judge_outs([judge], user_name_map)[0],
    )


async def submit_quyen_judge_score(
    db: AsyncSession,
    slot_id: int,
    judge_slot: int,
    score: int,
    *,
    current_user: User,
) -> tuple[QuyenSlot | None, str | None]:
    slot = (await db.execute(select(QuyenSlot).where(QuyenSlot.id == slot_id))).scalar_one_or_none()
    if not slot:
        return None, "NOT_FOUND"
    if slot.status != "scoring":
        return None, "NOT_SCORING"

    judge_rows = await _ensure_quyen_judge_rows(db, slot.id)
    judge = next((item for item in judge_rows if item.judge_slot == judge_slot), None)
    if not judge:
        return None, "JUDGE_NOT_FOUND"
    if judge.judge_user_id is None:
        return None, "JUDGE_UNASSIGNED"
    if current_user.role != "admin" and judge.judge_user_id != current_user.id:
        return None, "FORBIDDEN"
    if judge.score is not None:
        return None, "ALREADY_SUBMITTED"

    judge.score = score
    judge.submitted_at = datetime.now(timezone.utc)

    has_all_scores = _apply_quyen_score_summary(slot, judge_rows)
    if has_all_scores:
        slot.status = "scoring"
        slot.scored_at = datetime.now(timezone.utc)
    else:
        slot.status = "scoring"

    await _log_quyen_score_action(
        db,
        slot.id,
        action="submit",
        actor_user_id=current_user.id,
        judge_slot=judge_slot,
        note=str(score),
    )
    await db.flush()
    return slot, None


async def unlock_quyen_judge_score(
    db: AsyncSession,
    slot_id: int,
    judge_slot: int,
    *,
    actor_user_id: int | None,
) -> tuple[QuyenSlot | None, str | None]:
    slot = (await db.execute(select(QuyenSlot).where(QuyenSlot.id == slot_id))).scalar_one_or_none()
    if not slot:
        return None, "NOT_FOUND"
    if slot.status not in ("scoring", "completed"):
        return None, "NOT_SCORING"

    judge_rows = await _ensure_quyen_judge_rows(db, slot.id)
    judge = next((item for item in judge_rows if item.judge_slot == judge_slot), None)
    if not judge:
        return None, "JUDGE_NOT_FOUND"

    judge.score = None
    judge.submitted_at = None
    _apply_quyen_score_summary(slot, judge_rows)
    slot.status = "scoring"
    slot.scored_at = None
    slot.finished_at = None
    slot.confirmed_at = None

    await _log_quyen_score_action(
        db,
        slot.id,
        action="unlock",
        actor_user_id=actor_user_id,
        judge_slot=judge_slot,
    )
    await db.flush()
    return slot, None


async def get_quyen_slot_display_detail(db: AsyncSession, slot_id: int) -> QuyenDisplayOut | None:
    slot = (await db.execute(select(QuyenSlot).where(QuyenSlot.id == slot_id))).scalar_one_or_none()
    if not slot:
        return None
    tournament = (await db.execute(select(Tournament).where(Tournament.id == slot.tournament_id))).scalar_one_or_none()
    if not tournament:
        return None

    judges = await _ensure_quyen_judge_rows(db, slot.id)
    _sync_quyen_slot_status(slot, judges)
    _apply_quyen_score_summary(slot, judges)
    display_node_id, node_path_map, player_club_map = await _get_quyen_slot_display_context(db, slot, tournament)
    user_name_map = await _get_user_name_map(
        db,
        [judge.judge_user_id for judge in judges if judge.judge_user_id is not None],
    )

    return QuyenDisplayOut(
        slot=await _build_quyen_slot_out(
            db,
            slot,
            judges,
            tournament=tournament,
            display_node_id=display_node_id,
            node_path_map=node_path_map,
            player_club_map=player_club_map,
        ),
        tournament_name=tournament.name,
        tree_path=node_path_map.get(display_node_id or 0) if display_node_id is not None else None,
        judges=[
            QuyenDisplayJudgeOut(
                judge_slot=judge.judge_slot,
                assigned_user_name=user_name_map.get(judge.judge_user_id) if judge.judge_user_id else None,
                is_ready=judge.ready_at is not None,
                has_submitted=judge.submitted_at is not None,
                score=judge.score,
            )
            for judge in judges
        ],
    )


async def reset_quyen_slot_timer(
    db: AsyncSession,
    slot_id: int,
    remaining_seconds: int | None = None,
) -> tuple[QuyenSlot | None, str | None]:
    slot = (await db.execute(
        select(QuyenSlot).where(QuyenSlot.id == slot_id)
    )).scalar_one_or_none()
    if not slot:
        return None, "NOT_FOUND"
    if slot.status != "ongoing":
        return None, "NOT_ONGOING"

    slot.started_at = None
    if remaining_seconds is not None:
        slot.performance_duration_seconds = remaining_seconds
    await db.commit()
    return slot, None


async def resume_quyen_slot(
    db: AsyncSession,
    slot_id: int,
) -> tuple[QuyenSlot | None, str | None]:
    slot = (await db.execute(
        select(QuyenSlot).where(QuyenSlot.id == slot_id)
    )).scalar_one_or_none()
    if not slot:
        return None, "NOT_FOUND"
    if slot.status != "ongoing":
        return None, "NOT_ONGOING"
    if slot.started_at is not None:
        return None, "ALREADY_RUNNING"

    slot.started_at = datetime.now(timezone.utc)
    await db.commit()
    return slot, None


async def disqualify_quyen_slot(
    db: AsyncSession,
    slot_id: int,
) -> tuple[QuyenSlot | None, str | None]:
    slot = (await db.execute(
        select(QuyenSlot).where(QuyenSlot.id == slot_id)
    )).scalar_one_or_none()
    if not slot:
        return None, "NOT_FOUND"
    if slot.status == "completed" or slot.status == "disqualified":
        return None, "ALREADY_COMPLETED"
    
    judges = await _ensure_quyen_judge_rows(db, slot.id)
    
    # Set all judges scores to 0
    for judge in judges:
        judge.score = 0
        judge.submitted_at = datetime.now(timezone.utc)
    
    # Complete the slot with disqualified status
    finished_at = datetime.now(timezone.utc)
    slot.status = "completed"
    slot.is_disqualified = True
    slot.official_score = 0
    slot.total_judge_score = 0
    slot.highest_judge_score = 0
    slot.lowest_judge_score = 0
    slot.scored_at = finished_at
    slot.finished_at = finished_at
    slot.confirmed_at = finished_at
    
    await db.commit()
    return slot, None




# ── Publish tournament ────────────────────────────────────────────────────────

async def publish_tournament(db: AsyncSession, tournament_id: int) -> tuple[Tournament | None, str | None]:
    t = (await db.execute(select(Tournament).where(Tournament.id == tournament_id))).scalar_one_or_none()
    if not t:
        return None, "NOT_FOUND"
    if t.status != "DRAFT":
        return None, "NOT_DRAFT"

    has_matches = (await db.execute(
        select(BracketMatch.id)
        .join(TournamentWeightClass, BracketMatch.weight_class_id == TournamentWeightClass.id)
        .where(TournamentWeightClass.tournament_id == tournament_id)
        .limit(1)
    )).scalar_one_or_none()

    if not has_matches:
        # Check quyen slots too
        has_slots = (await db.execute(
            select(QuyenSlot.id).where(QuyenSlot.tournament_id == tournament_id).limit(1)
        )).scalar_one_or_none()
        if not has_slots:
            return None, "NO_MATCHES"

    t.status = "PUBLISHED"
    await db.flush()
    return t, None


# ── Reset tournament ──────────────────────────────────────────────────────────

async def reset_tournament(db: AsyncSession, tournament_id: int) -> dict | None:
    t = (await db.execute(select(Tournament).where(Tournament.id == tournament_id))).scalar_one_or_none()
    if not t:
        return None

    wcs = (await db.execute(
        select(TournamentWeightClass).where(TournamentWeightClass.tournament_id == tournament_id)
    )).scalars().all()
    wc_ids = [wc.id for wc in wcs]

    if wc_ids:
        await db.execute(delete(BracketMatch).where(BracketMatch.weight_class_id.in_(wc_ids)))
        await db.execute(
            update(TournamentWeightClass)
            .where(TournamentWeightClass.id.in_(wc_ids))
            .values(bracket_status="NOT_GENERATED")
        )
    await db.execute(delete(QuyenSlot).where(QuyenSlot.tournament_id == tournament_id))
    await db.flush()

    # Re-sync total_players from current TournamentParticipant data
    from sqlalchemy import func as sa_func
    for wc_id in wc_ids:
        count = (await db.execute(
            select(sa_func.count(TournamentParticipant.id))
            .where(TournamentParticipant.weight_class_id == wc_id)
        )).scalar_one()
        await db.execute(
            update(TournamentWeightClass)
            .where(TournamentWeightClass.id == wc_id)
            .values(total_players=count)
        )

    t.status = "DRAFT"
    await db.flush()
    return {"tournament_id": tournament_id, "status": "DRAFT"}


# ── Medal tally ───────────────────────────────────────────────────────────────

async def _build_player_club_map_for_wc(
    db: AsyncSession,
    weight_class_id: int,
    player_names: list[str],
) -> dict[str, str]:
    """Return {player_name: club_name} for given names in a weight class."""
    if not player_names:
        return {}
    rows = (await db.execute(
        select(Student.full_name, Club.name)
        .join(TournamentParticipant, TournamentParticipant.student_id == Student.id)
        .join(StudentClub, StudentClub.student_id == Student.id)
        .join(Club, Club.id == StudentClub.club_id)
        .where(
            TournamentParticipant.weight_class_id == weight_class_id,
            Student.full_name.in_(player_names),
            StudentClub.is_current == True,
        )
    )).all()
    return {row[0]: row[1] for row in rows}


async def get_medal_tally(db: AsyncSession, tournament_id: int) -> MedalTallyOut | None:
    t = (await db.execute(select(Tournament).where(Tournament.id == tournament_id))).scalar_one_or_none()
    if not t:
        return None

    wcs = (await db.execute(
        select(TournamentWeightClass)
        .where(
            TournamentWeightClass.tournament_id == tournament_id,
            TournamentWeightClass.age_type_code != "5",  # exclude quyen
        )
        .order_by(TournamentWeightClass.gender, TournamentWeightClass.weight_class_name)
    )).scalars().all()

    medals: list[WeightClassMedal] = []
    for wc in wcs:
        gender_label = "Nam" if wc.gender == "M" else "Nữ"
        tree_path = f"Đối kháng > {gender_label} > {wc.weight_class_name}"

        # Lấy tất cả trận không bye (cả completed lẫn chưa) để xác định round max
        all_matches = (await db.execute(
            select(BracketMatch)
            .where(
                BracketMatch.weight_class_id == wc.id,
                BracketMatch.is_bye == False,
            )
            .order_by(BracketMatch.round.desc(), BracketMatch.match_number)
        )).scalars().all()

        if not all_matches:
            continue

        max_round = max(m.round for m in all_matches)
        finals = [m for m in all_matches if m.round == max_round]
        semis_completed = [
            m for m in all_matches
            if m.round == max_round - 1 and m.status == "completed"
        ] if max_round > 1 else []

        gold = silver = None
        gold_club = silver_club = None
        bronze: list[str] = []
        bronze_clubs: list[str] = []

        final_completed = finals and finals[0].status == "completed"
        if final_completed:
            f = finals[0]
            if f.winner == 1:
                gold, silver = f.player1_name, f.player2_name
            elif f.winner == 2:
                gold, silver = f.player2_name, f.player1_name

        for s in semis_completed:
            loser = s.player2_name if s.winner == 1 else s.player1_name
            if loser:
                bronze.append(loser)

        if not (gold or silver or bronze):
            continue

        status = "completed" if final_completed else "in_progress"

        # Lookup club cho tất cả tên có huy chương
        candidate_names = [n for n in [gold, silver] + bronze if n]
        club_map = await _build_player_club_map_for_wc(db, wc.id, candidate_names)

        if gold:
            gold_club = club_map.get(gold)
        if silver:
            silver_club = club_map.get(silver)
        bronze_clubs = [club_map.get(n, "") for n in bronze]

        medals.append(WeightClassMedal(
            weight_class_id=wc.id,
            weight_class_name=wc.weight_class_name,
            gender=wc.gender,
            tree_path=tree_path,
            status=status,
            gold=gold,
            gold_club=gold_club,
            silver=silver,
            silver_club=silver_club,
            bronze=bronze,
            bronze_clubs=bronze_clubs,
        ))

    quyen_ranking_groups = await _build_quyen_ranking_groups(db, tournament_id)

    # Build (node_id, kata_name) → kata_id and club_name → club_id for team kata
    team_kata_meta_rows = (await db.execute(
        select(TournamentTeamKataRegistration.node_id, TournamentKata.name, TournamentKata.id, Club.name, Club.id)
        .join(TournamentKata, TournamentKata.id == TournamentTeamKataRegistration.kata_id)
        .join(Club, Club.id == TournamentTeamKataRegistration.club_id)
        .where(TournamentTeamKataRegistration.tournament_id == tournament_id)
    )).all()
    quyen_kata_id_map: dict[tuple[int, str], int] = {}
    quyen_club_id_map: dict[str, int] = {}
    for node_id_r, kata_name_r, kata_id_r, club_name_r, club_id_r in team_kata_meta_rows:
        quyen_kata_id_map[(node_id_r, kata_name_r)] = kata_id_r
        quyen_club_id_map[club_name_r] = club_id_r

    quyen_medals: list[QuyenMedalGroup] = []
    for group in quyen_ranking_groups:
        if not group.items:
            continue
        all_scored = group.status == "ready"
        node_id_for_kata = group.node_id
        kata_id_for_group = quyen_kata_id_map.get((node_id_for_kata, group.content_name)) if node_id_for_kata else None

        gold_name = next((item.player_name for item in group.items if item.medal == "gold"), None) if all_scored else None
        gold_club = next((item.player_club for item in group.items if item.medal == "gold"), None) if all_scored else None
        silver_name = next((item.player_name for item in group.items if item.medal == "silver"), None) if all_scored else None
        silver_club = next((item.player_club for item in group.items if item.medal == "silver"), None) if all_scored else None
        bronze_names = [item.player_name for item in group.items if item.medal == "bronze"] if all_scored else []
        bronze_clubs_list = [item.player_club or "" for item in group.items if item.medal == "bronze"] if all_scored else []

        quyen_medals.append(QuyenMedalGroup(
            node_id=group.node_id,
            node_path=group.node_path,
            content_name=group.content_name,
            kata_id=kata_id_for_group,
            status="completed" if all_scored else "in_progress",
            gold=gold_name,
            gold_club=gold_club,
            gold_club_id=quyen_club_id_map.get(gold_name) if gold_name else None,
            silver=silver_name,
            silver_club=silver_club,
            silver_club_id=quyen_club_id_map.get(silver_name) if silver_name else None,
            bronze=bronze_names,
            bronze_clubs=bronze_clubs_list,
            bronze_club_ids=[quyen_club_id_map.get(name) for name in bronze_names],
        ))

    return MedalTallyOut(
        tournament_id=t.id,
        tournament_name=t.name,
        weight_class_medals=medals,
        quyen_medals=quyen_medals,
    )


async def get_medal_tally_by_club(db: AsyncSession, tournament_id: int) -> ClubMedalTallyOut | None:
    tally = await get_medal_tally(db, tournament_id)
    if tally is None:
        return None

    club_medals: dict[str, dict] = {}  # club_name → {gold, silver, bronze}

    def _add(name: str | None, medal: str) -> None:
        if not name:
            return
        if name not in club_medals:
            club_medals[name] = {"gold": 0, "silver": 0, "bronze": 0}
        club_medals[name][medal] += 1

    for wm in tally.weight_class_medals:
        if wm.status != "completed":
            continue
        _add(wm.gold_club, "gold")
        _add(wm.silver_club, "silver")
        for c in wm.bronze_clubs:
            _add(c, "bronze")

    for qm in tally.quyen_medals:
        if qm.status != "completed":
            continue
        _add(qm.gold_club, "gold")
        _add(qm.silver_club, "silver")
        for c in qm.bronze_clubs:
            _add(c, "bronze")

    if not club_medals:
        return ClubMedalTallyOut(
            tournament_id=tally.tournament_id,
            tournament_name=tally.tournament_name,
            rankings=[],
        )

    # Lấy athlete_count per club (từ đối kháng)
    rows = (await db.execute(
        select(Club.name, Club.id)
        .join(StudentClub, StudentClub.club_id == Club.id)
        .join(Student, Student.id == StudentClub.student_id)
        .join(TournamentParticipant, TournamentParticipant.student_id == Student.id)
        .join(TournamentWeightClass, TournamentWeightClass.id == TournamentParticipant.weight_class_id)
        .where(
            TournamentWeightClass.tournament_id == tournament_id,
            StudentClub.is_current == True,
        )
    )).all()
    club_id_map: dict[str, int] = {}
    athlete_count_map: dict[str, int] = defaultdict(int)
    for club_name, club_id in rows:
        club_id_map[club_name] = club_id
        athlete_count_map[club_name] += 1

    # Bổ sung club_id từ đơn vị đăng ký đồng diễn (không có TournamentParticipant)
    team_kata_club_rows = (await db.execute(
        select(Club.name, Club.id)
        .join(TournamentTeamKataRegistration, TournamentTeamKataRegistration.club_id == Club.id)
        .where(TournamentTeamKataRegistration.tournament_id == tournament_id)
        .distinct()
    )).all()
    for club_name, club_id in team_kata_club_rows:
        if club_name not in club_id_map:
            club_id_map[club_name] = club_id

    # Sort: gold desc → silver desc → bronze desc → athlete_count asc → name asc
    sorted_clubs = sorted(
        club_medals.keys(),
        key=lambda n: (
            -club_medals[n]["gold"],
            -club_medals[n]["silver"],
            -club_medals[n]["bronze"],
            athlete_count_map.get(n, 0),
            n,
        ),
    )

    rankings = [
        ClubMedalRank(
            rank=i + 1,
            club_id=club_id_map.get(name, 0),
            club_name=name,
            gold=club_medals[name]["gold"],
            silver=club_medals[name]["silver"],
            bronze=club_medals[name]["bronze"],
            total=club_medals[name]["gold"] + club_medals[name]["silver"] + club_medals[name]["bronze"],
            athlete_count=athlete_count_map.get(name, 0),
        )
        for i, name in enumerate(sorted_clubs)
    ]

    return ClubMedalTallyOut(
        tournament_id=tally.tournament_id,
        tournament_name=tally.tournament_name,
        rankings=rankings,
    )


# ── Athlete stats by club ─────────────────────────────────────────────────────

async def get_athlete_stats_by_club(db: AsyncSession, tournament_id: int) -> dict:
    """
    Trả về tổng VĐV và breakdown theo CLB.
    Ưu tiên đọc từ StudentWeightAssignment (dynamic), rồi TournamentParticipant (classic),
    rồi fallback đếm từ players array (không có club breakdown).
    """
    # 1. Thử StudentWeightAssignment (dynamic structure — đăng ký trước khi gen bracket)
    swa_rows = (await db.execute(
        select(Club.name, func.count(StudentWeightAssignment.student_id.distinct()))
        .join(StudentClub, StudentClub.student_id == StudentWeightAssignment.student_id)
        .join(Club, Club.id == StudentClub.club_id)
        .where(
            StudentWeightAssignment.tournament_id == tournament_id,
            StudentClub.is_current == True,
        )
        .group_by(Club.name)
    )).all()

    if swa_rows:
        by_club = [{"club_name": r[0], "count": r[1]} for r in swa_rows]
        total = sum(r["count"] for r in by_club)
        return {"total": total, "by_club": by_club}

    # 2. Thử TournamentParticipant (classic structure sau khi gen bracket)
    tp_rows = (await db.execute(
        select(Club.name, func.count(TournamentParticipant.student_id.distinct()))
        .join(StudentClub, StudentClub.student_id == TournamentParticipant.student_id)
        .join(Club, Club.id == StudentClub.club_id)
        .join(TournamentWeightClass, TournamentWeightClass.id == TournamentParticipant.weight_class_id)
        .where(
            TournamentWeightClass.tournament_id == tournament_id,
            StudentClub.is_current == True,
        )
        .group_by(Club.name)
    )).all()

    if tp_rows:
        by_club = [{"club_name": r[0], "count": r[1]} for r in tp_rows]
        total = sum(r["count"] for r in by_club)
        return {"total": total, "by_club": by_club}

    # 3. Fallback: đếm từ players array + quyen_slots (không có club breakdown)
    players_count = (await db.execute(
        select(func.coalesce(func.sum(func.array_length(TournamentWeightClass.players, 1)), 0))
        .where(
            TournamentWeightClass.tournament_id == tournament_id,
            TournamentWeightClass.players.isnot(None),
        )
    )).scalar() or 0

    quyen_count = (await db.execute(
        select(func.count(QuyenSlot.id))
        .where(QuyenSlot.tournament_id == tournament_id)
    )).scalar() or 0

    return {"total": int(players_count) + int(quyen_count), "by_club": []}


# ── Match per-judge scoring ────────────────────────────────────────────────────

async def get_match_judge_panel(
    db: AsyncSession,
    match_id: int,
    current_user,
) -> "MatchJudgePanelOut | None | str":
    row = (await db.execute(
        select(BracketMatch, TournamentWeightClass, Tournament)
        .join(TournamentWeightClass, BracketMatch.weight_class_id == TournamentWeightClass.id)
        .join(Tournament, TournamentWeightClass.tournament_id == Tournament.id)
        .where(BracketMatch.id == match_id)
    )).first()
    if not row:
        return "NOT_FOUND"
    match, wc, tournament = row

    judges = await _ensure_match_judge_rows(db, match.id)
    judge = next((j for j in judges if j.judge_user_id == current_user.id), None)
    if judge is None and current_user.role != "admin":
        return "FORBIDDEN"

    user_name_map = await _get_user_name_map(
        db,
        [j.judge_user_id for j in judges if j.judge_user_id is not None],
    )

    judge_out = MatchJudgeAssignmentOut(
        judge_slot=judge.judge_slot if judge else 0,
        assigned_user_id=judge.judge_user_id if judge else None,
        assigned_user_name=user_name_map.get(judge.judge_user_id) if judge and judge.judge_user_id else None,
        is_ready=judge.ready_at is not None if judge else False,
        ready_at=judge.ready_at if judge else None,
        score1=judge.score1 if judge else 0,
        score2=judge.score2 if judge else 0,
        has_submitted=judge.submitted_at is not None if judge else False,
    ) if judge else None

    return MatchJudgePanelOut(
        match_id=match.id,
        tournament_name=tournament.name,
        player1_name=match.player1_name,
        player2_name=match.player2_name,
        weight_class_name=wc.weight_class_name,
        status=match.status,
        started_at=match.started_at,
        judge=judge_out,
    )


async def update_match_judge_score(
    db: AsyncSession,
    match_id: int,
    judge_slot: int,
    score1: int,
    score2: int,
    current_user,
) -> tuple[BracketJudgeAssignment | None, str | None]:
    match = (await db.execute(
        select(BracketMatch).where(BracketMatch.id == match_id)
    )).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.status != "ongoing":
        return None, "NOT_ONGOING"

    judges = await _ensure_match_judge_rows(db, match_id)
    judge = next((j for j in judges if j.judge_slot == judge_slot), None)
    if not judge:
        return None, "JUDGE_NOT_FOUND"
    if current_user.role != "admin" and judge.judge_user_id != current_user.id:
        return None, "FORBIDDEN"
    if judge.submitted_at is not None:
        return None, "ALREADY_SUBMITTED"

    judge.score1 = score1
    judge.score2 = score2
    await db.flush()
    return judge, None


async def submit_match_judge_score(
    db: AsyncSession,
    match_id: int,
    judge_slot: int,
    current_user,
) -> tuple[BracketJudgeAssignment | None, str | None]:
    match = (await db.execute(
        select(BracketMatch).where(BracketMatch.id == match_id)
    )).scalar_one_or_none()
    if not match:
        return None, "NOT_FOUND"
    if match.status != "ongoing":
        return None, "NOT_ONGOING"

    judges = await _ensure_match_judge_rows(db, match_id)
    judge = next((j for j in judges if j.judge_slot == judge_slot), None)
    if not judge:
        return None, "JUDGE_NOT_FOUND"
    if current_user.role != "admin" and judge.judge_user_id != current_user.id:
        return None, "FORBIDDEN"
    if judge.submitted_at is not None:
        return None, "ALREADY_SUBMITTED"
    if judge.score1 is None or judge.score2 is None:
        return None, "NO_SCORE"

    judge.submitted_at = datetime.now(timezone.utc)
    await db.flush()
    return judge, None


# ── Tournament config ──────────────────────────────────────────────────────────

async def get_tournament_config(db: AsyncSession, tournament_id: int):
    from app.models.tournament import Tournament
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    return result.scalar_one_or_none()


async def update_tournament_config(db: AsyncSession, tournament_id: int, data: dict):
    from app.models.tournament import Tournament
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()
    if not tournament:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(tournament, key, value)

    # Bulk-update pending/ready bracket matches with new duration defaults
    INACTIVE_MATCH_STATUSES = ("pending", "ready")
    match_updates: dict = {}
    if "default_round_duration_seconds" in data and data["default_round_duration_seconds"] is not None:
        match_updates["round_duration_seconds"] = data["default_round_duration_seconds"]
    if "default_break_duration_seconds" in data and data["default_break_duration_seconds"] is not None:
        match_updates["break_duration_seconds"] = data["default_break_duration_seconds"]
    if match_updates:
        await db.execute(
            update(BracketMatch)
            .where(
                BracketMatch.weight_class_id.in_(
                    select(TournamentWeightClass.id).where(
                        TournamentWeightClass.tournament_id == tournament_id
                    )
                ),
                BracketMatch.status.in_(INACTIVE_MATCH_STATUSES),
            )
            .values(**match_updates)
        )

    # Bulk-update pending quyen slots with new performance duration
    if "default_performance_duration_seconds" in data and data["default_performance_duration_seconds"] is not None:
        await db.execute(
            update(QuyenSlot)
            .where(
                QuyenSlot.tournament_id == tournament_id,
                QuyenSlot.status == "pending",
            )
            .values(performance_duration_seconds=data["default_performance_duration_seconds"])
        )

    await db.commit()
    await db.refresh(tournament)
    return tournament
