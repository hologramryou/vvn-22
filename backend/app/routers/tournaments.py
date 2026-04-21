from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel as _BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import asyncio
import json
import logging

logger = logging.getLogger(__name__)

from app.core.database import get_db, AsyncSessionLocal
from app.core.security import get_current_user
from app.core.config import settings
from app.core.redis_client import get_redis
from app.services.match_ws_manager import ws_manager
from app.services.local_match_engine import match_engine
from jose import JWTError, jwt
from app.repositories import tournament_repo, structure_repo
from app.models.user import User
from app.models.club import Club
from app.models.tournament import Tournament, TournamentWeightClass, BracketMatch, BracketJudgeAssignment, MatchScoreLog
from app.schemas.tournament import (
    BracketOut, MatchResultIn, TournamentStructure,
    GenerateMatchesOut, GenerateScheduleOut, TournamentScheduleOut, MedalTallyOut, ClubMedalTallyOut,
    MatchDetailOut, UpdateScheduleIn, UpdateScheduleOut,
    TournamentListItem, CreateTournamentRequest, CreateTournamentResponse,
    DeleteTournamentResponse, TournamentTemplateSummary,
    CreateTournamentTemplateRequest, CreateTournamentTemplateResponse,
    UpdateTournamentRequest, BracketExportOut,
    QuyenScoringDetailOut, QuyenJudgePanelOut, QuyenDisplayOut,
    UpdateQuyenJudgeSetupIn, QuyenJudgeReadyIn, QuyenJudgeScoreIn,
    UpdateMatchJudgeSetupIn, MatchJudgeReadyIn, MatchJudgeScoreIn, MatchJudgePanelOut,
    RefereeCurrentAssignmentOut, SetMatchHiepIn,
    EndMatchRoundIn, DrawResultIn, MatchConfigIn, LiveScoreIn, ScoreLogIn, ScoreLogOut,
    ConsensusTurnOut, TournamentConfig, TournamentConfigUpdate,
)
router = APIRouter(tags=["tournaments"])


async def _visible_tournament_ids(db: AsyncSession, current_user: User) -> list[int] | None:
    if current_user.role == "admin":
        return None

    allowed_ids: list[int] = []
    seen: set[int] = set()

    for tid in getattr(current_user, "tournament_ids", None) or []:
        try:
            tid_int = int(tid)
        except (TypeError, ValueError):
            continue
        if tid_int in seen:
            continue
        seen.add(tid_int)
        allowed_ids.append(tid_int)

    if current_user.club_id:
        club = await db.get(Club, current_user.club_id)
        if club:
            for tid in club.tournament_ids or []:
                try:
                    tid_int = int(tid)
                except (TypeError, ValueError):
                    continue
                if tid_int in seen:
                    continue
                seen.add(tid_int)
                allowed_ids.append(tid_int)

    return allowed_ids


# â”€â”€ List / Create tournaments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/tournaments", response_model=list[TournamentListItem])
async def list_tournaments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visible_ids = await _visible_tournament_ids(db, current_user)
    stmt = select(Tournament).order_by(Tournament.id.desc())
    if visible_ids is not None:
        if not visible_ids:
            return []
        stmt = stmt.where(Tournament.id.in_(visible_ids))
    rows = (await db.execute(stmt)).scalars().all()
    return [
        {"id": t.id, "name": t.name, "sport_icon": t.sport_icon, "status": t.status, "created_at": t.created_at, "structure_mode": t.structure_mode, "primary_color": t.primary_color, "gradient_primary": t.gradient_primary}
        for t in rows
    ]


@router.post("/tournaments", status_code=201, response_model=CreateTournamentResponse)
async def create_tournament(
    body: CreateTournamentRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        from fastapi import HTTPException as _H
        raise _H(403, detail="Admin only")
    name = body.name.strip()
    if not name:
        from fastapi import HTTPException as _H
        raise _H(400, detail="name is required")

    t = Tournament(name=name, status="DRAFT", structure_mode="legacy", primary_color=body.primary_color)
    db.add(t)
    await db.flush()

    if body.template_id is not None:
        copied, error = await structure_repo.apply_structure_template(db, t.id, body.template_id)
        if error:
            await db.rollback()
            if error == "TEMPLATE_NOT_FOUND":
                raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy template"})
            if error == "NOT_DRAFT":
                raise HTTPException(409, detail={"code": "TARGET_NOT_DRAFT", "message": "Giải đấu mới phải ở trạng thái Nháp"})
            if error == "TARGET_NOT_EMPTY":
                raise HTTPException(409, detail={"code": "TARGET_NOT_EMPTY", "message": "Giải đấu đích đã có dữ liệu"})
            raise HTTPException(400, detail={"code": error, "message": "Không thể áp dụng template"})
        t.structure_mode = "dynamic"

    await db.commit()
    await db.refresh(t)
    return {"id": t.id, "name": t.name, "sport_icon": t.sport_icon, "status": t.status, "created_at": t.created_at, "structure_mode": t.structure_mode, "primary_color": t.primary_color, "gradient_primary": t.gradient_primary}


@router.patch("/tournaments/{tournament_id}", response_model=TournamentListItem)
async def update_tournament(
    tournament_id: int,
    body: UpdateTournamentRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới có thể sửa giải đấu"})
    t = await db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(404, detail={"code": "NOT_FOUND"})
    if body.name is not None:
        t.name = body.name
    if body.sport_icon is not None:
        t.sport_icon = body.sport_icon
    elif body.sport_icon == '':
        t.sport_icon = None
    if body.primary_color is not None:
        t.primary_color = body.primary_color
    if body.gradient_primary is not None:
        t.gradient_primary = body.gradient_primary
    await db.commit()
    await db.refresh(t)
    return t


@router.delete("/tournaments/{tournament_id}", response_model=DeleteTournamentResponse)
async def delete_tournament(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới có thể xóa giải đấu"})

    deleted = await tournament_repo.delete_tournament_scoped_data(db, tournament_id)
    if not deleted:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    await db.commit()
    return {"deleted_tournament_id": tournament_id}


@router.get("/tournament-templates", response_model=list[TournamentTemplateSummary])
async def list_tournament_templates(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await structure_repo.list_structure_templates(db)


@router.post("/tournament-templates", response_model=CreateTournamentTemplateResponse, status_code=201)
async def create_tournament_template(
    body: CreateTournamentTemplateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới có thể lưu template"})

    template, error = await structure_repo.create_structure_template(
        db,
        body.source_tournament_id,
        body.name.strip(),
        body.description,
        body.copy_katas,
    )
    if error:
        if error == "TOURNAMENT_NOT_FOUND":
            raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu nguồn"})
        if error == "NOT_DYNAMIC":
            raise HTTPException(400, detail={"code": "NOT_DYNAMIC", "message": "Chỉ lưu template từ giải dynamic"})
        if error == "DUPLICATE_TEMPLATE_NAME":
            raise HTTPException(409, detail={"code": "DUPLICATE_TEMPLATE_NAME", "message": "Tên template đã tồn tại"})
        raise HTTPException(400, detail={"code": error, "message": "Không thể lưu template"})

    await db.commit()
    return template


# â”€â”€ Tournament structure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/tournaments/structure", response_model=TournamentStructure)
async def get_structure(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tid = await tournament_repo.get_first_tournament_id(db)
    if tid is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Chưa có giải đấu nào"})
    structure = await tournament_repo.get_tournament_structure(db, tid)
    if not structure:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return structure


@router.get("/tournaments/{tournament_id}/structure", response_model=TournamentStructure)
async def get_structure_by_id(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    structure = await tournament_repo.get_tournament_structure(db, tournament_id)
    if not structure:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return structure


# â”€â”€ Per weight class bracket (legacy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/weight-classes/{wc_id}/bracket", response_model=BracketOut)
async def get_bracket(
    wc_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    bracket = await tournament_repo.get_bracket(db, wc_id)
    if not bracket:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy hạng cân"})
    return bracket


@router.post("/weight-classes/{wc_id}/generate", response_model=BracketOut)
async def generate_bracket(
    wc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được tạo sơ đồ thi đấu"})
    status = await tournament_repo.get_active_tournament_status(db)
    if status is not None and status != "DRAFT":
        raise HTTPException(409, detail={"code": "TOURNAMENT_LOCKED", "message": f"Giáº£i Ä‘áº¥u Ä‘Ã£ Ä‘Æ°á»£c phÃ¡t hÃ nh ({status}). KhÃ´ng thá»ƒ táº¡o láº¡i sÆ¡ Ä‘á»“."})
    bracket = await tournament_repo.generate_bracket(db, wc_id)
    if not bracket:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy hạng cân hoặc < 2 VĐV"})
    return bracket


# â”€â”€ Tournament-level generate + schedule + publish â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.post("/tournaments/{tournament_id}/generate-matches")
async def generate_all_matches(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được tạo sơ đồ thi đấu"})
    status = await tournament_repo.get_active_tournament_status(db)
    if status is not None and status != "DRAFT":
        raise HTTPException(409, detail={"code": "TOURNAMENT_LOCKED", "message": f"Giáº£i Ä‘áº¥u Ä‘Ã£ Ä‘Æ°á»£c phÃ¡t hÃ nh ({status}). KhÃ´ng thá»ƒ táº¡o láº¡i sÆ¡ Ä‘á»“."})
    result = await tournament_repo.generate_all_matches(db, tournament_id)
    if result is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return result


@router.post("/tournaments/{tournament_id}/generate-schedule")
async def generate_schedule(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được tạo lịch thi đấu"})
    status = await tournament_repo.get_active_tournament_status(db)
    if status is not None and status != "DRAFT":
        raise HTTPException(409, detail={"code": "TOURNAMENT_LOCKED", "message": f"Giáº£i Ä‘áº¥u Ä‘Ã£ Ä‘Æ°á»£c phÃ¡t hÃ nh ({status}). KhÃ´ng thá»ƒ táº¡o láº¡i lá»‹ch thi Ä‘áº¥u."})
    result = await tournament_repo.generate_schedule(db, tournament_id)
    if result is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return result


@router.get("/tournaments/{tournament_id}/schedule", response_model=TournamentScheduleOut)
async def get_schedule(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await tournament_repo.get_full_schedule(db, tournament_id)
    if result is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return result


@router.get("/tournaments/{tournament_id}/bracket-export", response_model=BracketExportOut)
async def get_bracket_export(
    tournament_id: int,
    node_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result, error = await tournament_repo.get_dynamic_bracket_export(db, tournament_id, node_id)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "NOT_DYNAMIC_TOURNAMENT":
        raise HTTPException(400, detail={"code": "NOT_DYNAMIC_TOURNAMENT", "message": "Chi export tree path cho giai dynamic"})
    if error == "NODE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "NODE_NOT_FOUND", "message": "Không tìm thấy tree path"})
    if error == "EXPORT_PATH_NOT_FOUND":
        raise HTTPException(404, detail={"code": "EXPORT_PATH_NOT_FOUND", "message": "Không tìm thấy du lieu export cho tree path"})
    return result


@router.patch("/tournaments/{tournament_id}/update-schedule", response_model=UpdateScheduleOut)
async def update_schedule(
    tournament_id: int,
    body: UpdateScheduleIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được chỉnh sửa lịch thi đấu"})
    result, error = await tournament_repo.update_schedule(db, tournament_id, body)
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "LOCKED":
        raise HTTPException(409, detail={"code": "LOCKED", "message": "Không thể chỉnh sửa khi giải đấu đang diễn ra hoặc đã kết thúc"})
    return result


@router.patch("/tournaments/{tournament_id}/publish")
async def publish_tournament(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được phát hành giải đấu"})
    t, error = await tournament_repo.publish_tournament(db, tournament_id)
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "NOT_DRAFT":
        raise HTTPException(409, detail={"code": "CONFLICT", "message": "Giải đấu không ở trạng thái DRAFT"})
    if error == "NO_MATCHES":
        raise HTTPException(409, detail={"code": "CONFLICT", "message": "Chưa có trận đấu nào, vui lòng generate trước"})
    return {"id": t.id, "name": t.name, "status": t.status}


# ── Tournament config ─────────────────────────────────────────────────────────

@router.get("/tournaments/{tournament_id}/config", response_model=TournamentConfig)
async def get_tournament_config(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = await tournament_repo.get_tournament_config(db, tournament_id)
    if not t:
        raise HTTPException(404, detail={"code": "NOT_FOUND"})
    return t


@router.patch("/tournaments/{tournament_id}/config", response_model=TournamentConfig)
async def update_tournament_config(
    tournament_id: int,
    body: TournamentConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN"})
    t = await tournament_repo.update_tournament_config(
        db, tournament_id, body.model_dump(exclude_none=True)
    )
    if not t:
        raise HTTPException(404, detail={"code": "NOT_FOUND"})
    return t


# â"€â"€ Match actions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

# In-memory timer-active state per match (lightweight, no DB migration needed)
_timer_active: dict[int, bool] = {}

# In-memory live scores per match — updated by consensus and live_score admin commands.
# Only written to DB at explicit transitions (end_round, live_score manual adjust).
# This avoids per-consensus DB writes and allows pure WS score sync during a match.
_match_scores: dict[int, tuple[int, int]] = {}  # match_id → (score1, score2)

@router.get("/matches/{match_id}", response_model=MatchDetailOut)
async def get_match_detail(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    detail = await tournament_repo.get_match_detail(db, match_id)
    if not detail:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy trận đấu"})
    if current_user.role not in ("admin", "referee"):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin/referee mới được xem màn chám điểm"})
    if current_user.role == "referee":
        assigned_user_ids = {
            judge.assigned_user_id
            for judge in detail["judges"]
            if judge.assigned_user_id is not None
        }
        if current_user.id not in assigned_user_ids:
            raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Bạn không được phân công trận này"})
    # Use in-memory value if set; fall back to DB column so backend restart doesn't reset state
    db_timer_active = bool(detail.get("timer_active", False))
    detail["timer_active"] = _timer_active.get(match_id, db_timer_active)
    return detail


@router.put("/matches/{match_id}/timer-active")
async def set_timer_active(
    match_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403)
    _timer_active[match_id] = bool(body.get("active", False))
    return {"match_id": match_id, "timer_active": _timer_active[match_id]}


@router.patch("/matches/{match_id}/setup")
async def update_match_judge_setup(
    match_id: int,
    body: UpdateMatchJudgeSetupIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được cập nhật trọng tài"})
    match, error = await tournament_repo.update_match_judge_setup(db, match_id, body.judges)
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy trận đấu"})
    if error == "LOCKED":
        raise HTTPException(400, detail={"code": "LOCKED", "message": "Trận đang diễn ra, không thể sửa setup"})
    if error == "INCOMPLETE_ASSIGNMENT":
        raise HTTPException(400, detail={"code": "INCOMPLETE_ASSIGNMENT", "message": "Cần gán đủ đúng 5 trọng tài cho trận đấu"})
    if error == "INVALID_JUDGE":
        raise HTTPException(400, detail={"code": "INVALID_JUDGE", "message": "Tài khoản được chọn không phải trọng tài hợp lệ của giải"})
    if error == "DUPLICATE_JUDGE":
        raise HTTPException(400, detail={"code": "DUPLICATE_JUDGE", "message": "Không thể gán cùng một trọng tài cho nhiều ghế trong cùng trận"})
    return {"id": match.id, "status": match.status}


@router.patch("/matches/{match_id}/judges/{judge_slot}/ready")
async def set_match_judge_ready(
    match_id: int,
    judge_slot: int,
    body: MatchJudgeReadyIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "referee"):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin/referee mới được xác nhận sẵn sàng"})
    match, error = await tournament_repo.set_match_judge_ready(
        db,
        match_id,
        judge_slot,
        current_user=current_user,
        ready=body.ready,
    )
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy trận đấu"})
    if error == "NOT_WAITING":
        raise HTTPException(400, detail={"code": "NOT_WAITING", "message": "Chỉ xác nhận sẵn sàng trước khi trận bắt đầu"})
    if error == "JUDGE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "JUDGE_NOT_FOUND", "message": "Không tìm thấy ghế trọng tài"})
    if error == "JUDGE_UNASSIGNED":
        raise HTTPException(400, detail={"code": "JUDGE_UNASSIGNED", "message": "Ghế trọng tài này chưa được phân công account"})
    if error == "FORBIDDEN":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Bạn không được phân công ghế chấm này"})
    from sqlalchemy import select, func
    from app.models.tournament import BracketJudgeAssignment
    ready_count = (await db.execute(
        select(func.count()).where(
            BracketJudgeAssignment.match_id == match_id,
            BracketJudgeAssignment.ready_at.isnot(None),
        )
    )).scalar() or 0
    await ws_manager.broadcast(match_id, json.dumps({
        "type": "judge_ready",
        "ready_count": ready_count,
    }))
    return {"id": match.id, "status": match.status}



@router.patch("/matches/{match_id}/reset")
async def reset_match(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403)
    match, error = await tournament_repo.reset_match(db, match_id)
    if error == "NOT_FOUND":
        raise HTTPException(404)
    if error == "INVALID_STATUS":
        raise HTTPException(400, detail={"code": "INVALID_STATUS"})
    # Clear in-memory state so live scores and timer don't bleed into next round
    _match_scores.pop(match_id, None)
    _timer_active.pop(match_id, None)
    await ws_manager.broadcast(match_id, json.dumps({
        "type": "match_state",
        "match_phase": match.match_phase,
        "status": match.status,
        "score1": 0,
        "score2": 0,
        "timer_active": False,
    }))
    return {"id": match.id, "status": match.status}


@router.patch("/matches/{match_id}/cancel")
async def cancel_match(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403)
    match, error = await tournament_repo.cancel_match(db, match_id)
    if error == "NOT_FOUND":
        raise HTTPException(404)
    if error == "INVALID_STATUS":
        raise HTTPException(400, detail={"code": "INVALID_STATUS", "message": "Trận đấu không ở trạng thái có thể hủy"})
    if error == "NEXT_MATCH_STARTED":
        raise HTTPException(400, detail={"code": "NEXT_MATCH_STARTED", "message": "Trận tiếp theo đã bắt đầu, không thể hủy"})
    _match_scores.pop(match_id, None)
    _timer_active.pop(match_id, None)
    await ws_manager.broadcast(match_id, json.dumps({
        "type": "match_state",
        "match_phase": "not_started",
        "status": "ready",
        "score1": 0,
        "score2": 0,
        "timer_active": False,
    }))
    return {"id": match.id, "status": match.status}


@router.patch("/matches/{match_id}/hiep")
async def set_match_hiep(
    match_id: int,
    body: SetMatchHiepIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403)
    match, error = await tournament_repo.set_match_hiep(db, match_id, body.hiep)
    if error == "NOT_FOUND":
        raise HTTPException(404)
    if error == "NOT_ONGOING":
        raise HTTPException(400, detail={"code": "NOT_ONGOING"})
    if error == "INVALID_HIEP":
        raise HTTPException(400, detail={"code": "INVALID_HIEP"})
    return {"id": match.id, "current_hiep": match.current_hiep}


# ── Match state machine endpoints ────────────────────────────────────────

@router.patch("/matches/{match_id}/end-round")
async def end_match_round(
    match_id: int,
    body: EndMatchRoundIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403)
    match, error = await tournament_repo.end_match_round(db, match_id, body.score1, body.score2)
    if error == "NOT_FOUND":
        raise HTTPException(404)
    if error:
        raise HTTPException(400, detail={"code": error})
    # After end_round: DB now has the committed scores — sync in-memory to match
    _match_scores[match_id] = (match.score1 or 0, match.score2 or 0)
    _timer_active[match_id] = False
    await ws_manager.broadcast(match_id, json.dumps({
        "type": "match_state",
        "match_phase": match.match_phase,
        "status": match.status,
        "score1": match.score1 or 0,
        "score2": match.score2 or 0,
        "timer_active": False,
        "winner": match.winner,
    }))
    # Propagate winner to next match bracket slot when match is completed
    if match.status == "completed" and match.winner and match.next_match_id:
        async def _propagate_winner(_mid=match_id, _next_id=match.next_match_id, _winner=match.winner, _num=match.match_number, _p1=match.player1_name, _p2=match.player2_name):
            async with AsyncSessionLocal() as _db:
                _next = await _db.get(BracketMatch, _next_id)
                if _next:
                    winner_name = _p1 if _winner == 1 else _p2
                    if _num % 2 == 1:
                        _next.player1_name = winner_name
                    else:
                        _next.player2_name = winner_name
                    await _db.commit()
        asyncio.create_task(_propagate_winner())
    return {"id": match.id, "match_phase": match.match_phase, "winner": match.winner, "current_hiep": match.current_hiep}


@router.patch("/matches/{match_id}/start-round")
async def start_match_round(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403)
    match, error = await tournament_repo.start_match_round(db, match_id)
    if error == "NOT_FOUND":
        raise HTTPException(404)
    if error:
        raise HTTPException(400, detail={"code": error})
    # Sync in-memory scores at round start (DB may have been updated at end_round)
    _match_scores[match_id] = (match.score1 or 0, match.score2 or 0)
    _timer_active[match_id] = False
    await ws_manager.broadcast(match_id, json.dumps({
        "type": "match_state",
        "match_phase": match.match_phase,
        "status": match.status,
        "score1": match.score1 or 0,
        "score2": match.score2 or 0,
        "timer_active": False,
    }))
    return {"id": match.id, "match_phase": match.match_phase, "current_hiep": match.current_hiep}


@router.patch("/matches/{match_id}/draw-result")
async def draw_match_result(
    match_id: int,
    body: DrawResultIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403)
    match, error = await tournament_repo.draw_match_result(db, match_id, body.winner)
    if error == "NOT_FOUND":
        raise HTTPException(404)
    if error:
        raise HTTPException(400, detail={"code": error})
    await ws_manager.broadcast(match_id, json.dumps({
        "type": "match_state",
        "match_phase": match.match_phase,
        "status": match.status,
        "score1": match.score1 or 0,
        "score2": match.score2 or 0,
        "winner": match.winner,
        "timer_active": _timer_active.get(match_id, False),
    }))
    return {"id": match.id, "match_phase": match.match_phase, "winner": match.winner}


@router.patch("/matches/{match_id}/confirm")
async def confirm_match(
    match_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403)
    match, error = await tournament_repo.confirm_match(db, match_id)
    if error == "NOT_FOUND":
        raise HTTPException(404)
    if error:
        raise HTTPException(400, detail={"code": error})
    await ws_manager.broadcast(match_id, json.dumps({
        "type": "match_state",
        "match_phase": match.match_phase,
        "status": match.status,
        "score1": match.score1 or 0,
        "score2": match.score2 or 0,
        "timer_active": _timer_active.get(match_id, False),
    }))
    # Push result back to Railway if running in local mode
    from app.core.config import settings as _settings
    if _settings.railway_database_url:
        from app.services.sync_service import push_match_result_to_railway
        background_tasks.add_task(push_match_result_to_railway, match_id)
    return {"id": match.id, "match_phase": match.match_phase, "status": match.status}


@router.patch("/matches/{match_id}/config")
async def update_match_config(
    match_id: int,
    body: MatchConfigIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403)
    match, error = await tournament_repo.update_match_config(
        db, match_id, body.round_duration_seconds, body.break_duration_seconds
    )
    if error == "NOT_FOUND":
        raise HTTPException(404)
    if error:
        raise HTTPException(400, detail={"code": error})
    return {
        "id": match.id,
        "round_duration_seconds": match.round_duration_seconds,
        "break_duration_seconds": match.break_duration_seconds,
    }


@router.patch("/matches/{match_id}/live-score")
async def update_match_live_score(
    match_id: int,
    body: LiveScoreIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403)
    match, error = await tournament_repo.update_match_live_score(db, match_id, body.score1, body.score2)
    if error == "Match not found":
        raise HTTPException(404)
    if error:
        raise HTTPException(400, detail=error)
    broadcast: dict = {
        "type": "match_state",
        "match_phase": match.match_phase,
        "status": match.status,
        "score1": match.score1 or 0,
        "score2": match.score2 or 0,
        "timer_active": _timer_active.get(match_id, bool(match.timer_active)),
    }
    if body.yellow_cards1 is not None:
        broadcast["yellow_cards1"] = body.yellow_cards1
    if body.yellow_cards2 is not None:
        broadcast["yellow_cards2"] = body.yellow_cards2
    await ws_manager.broadcast(match_id, json.dumps(broadcast))
    return {"id": match.id, "score1": match.score1, "score2": match.score2}


@router.get("/matches/{match_id}/score-logs", response_model=list[ScoreLogOut])
async def get_match_score_logs(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await tournament_repo.get_match_score_logs(db, match_id)


@router.get("/matches/{match_id}/consensus-turns", response_model=list[ConsensusTurnOut])
async def get_match_consensus_turns(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await tournament_repo.get_match_consensus_turns(db, match_id)


@router.post("/matches/{match_id}/score-log")
async def add_match_score_log(
    match_id: int,
    body: ScoreLogIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403)
    # Get match to read current phase
    from app.models.tournament import BracketMatch
    match = (await db.execute(select(BracketMatch).where(BracketMatch.id == match_id))).scalar_one_or_none()
    if not match:
        raise HTTPException(404)

    log = await tournament_repo.add_match_score_log(
        db,
        match_id=match_id,
        actor_type="admin",
        actor_name=current_user.full_name or current_user.username,
        action=body.action,
        side=body.side,
        delta=body.delta,
        score1_after=body.score1_after,
        score2_after=body.score2_after,
        match_phase=match.match_phase,
        description=body.description,
    )
    return {"id": log.id, "created_at": log.created_at}


@router.get("/matches/{match_id}/judge-panel", response_model=MatchJudgePanelOut)
async def get_match_judge_panel(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await tournament_repo.get_match_judge_panel(db, match_id, current_user)
    if result == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Kh\u00f4ng t\u00ecm th\u1ea5y tr\u1eadn \u0111\u1ea5u"})
    if result == "FORBIDDEN":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "B\u1ea1n kh\u00f4ng \u0111\u01b0\u1ee3c ph\u00e2n c\u00f4ng tr\u1eadn n\u00e0y"})
    return result


@router.patch("/matches/{match_id}/judges/{judge_slot}/score")
async def update_match_judge_score(
    match_id: int,
    judge_slot: int,
    body: MatchJudgeScoreIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "referee"):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Ch\u1ec9 admin/referee m\u1edbi \u0111\u01b0\u1ee3c ch\u1ea5m \u0111i\u1ec3m"})
    judge, error = await tournament_repo.update_match_judge_score(
        db, match_id, judge_slot, body.score1, body.score2, current_user
    )
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Kh\u00f4ng t\u00ecm th\u1ea5y tr\u1eadn \u0111\u1ea5u"})
    if error == "NOT_ONGOING":
        raise HTTPException(400, detail={"code": "NOT_ONGOING", "message": "Tr\u1eadn ch\u01b0a b\u1eaft \u0111\u1ea7u ho\u1eb7c \u0111\u00e3 k\u1ebft th\u00fac"})
    if error == "JUDGE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "JUDGE_NOT_FOUND", "message": "Kh\u00f4ng t\u00ecm th\u1ea5y gh\u1ebf tr\u1ecdn g t\u00e0i"})
    if error == "FORBIDDEN":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "B\u1ea1n kh\u00f4ng \u0111\u01b0\u1ee3c ph\u00e2n c\u00f4ng gh\u1ebf n\u00e0y"})
    if error == "ALREADY_SUBMITTED":
        raise HTTPException(400, detail={"code": "ALREADY_SUBMITTED", "message": "\u0110\u00e3 x\u00e1c nh\u1eadn \u0111i\u1ec3m, kh\u00f4ng th\u1ec3 s\u1eeda"})
    return {"judge_slot": judge.judge_slot, "score1": judge.score1, "score2": judge.score2}


@router.patch("/matches/{match_id}/judges/{judge_slot}/submit")
async def submit_match_judge_score(
    match_id: int,
    judge_slot: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "referee"):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Ch\u1ec9 admin/referee m\u1edbi \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn \u0111i\u1ec3m"})
    judge, error = await tournament_repo.submit_match_judge_score(
        db, match_id, judge_slot, current_user
    )
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Kh\u00f4ng t\u00ecm th\u1ea5y tr\u1eadn \u0111\u1ea5u"})
    if error == "NOT_ONGOING":
        raise HTTPException(400, detail={"code": "NOT_ONGOING", "message": "Tr\u1eadn ch\u01b0a b\u1eaft \u0111\u1ea7u ho\u1eb7c \u0111\u00e3 k\u1ebft th\u00fac"})
    if error == "JUDGE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "JUDGE_NOT_FOUND", "message": "Kh\u00f4ng t\u00ecm th\u1ea5y gh\u1ebf tr\u1ecdn g t\u00e0i"})
    if error == "FORBIDDEN":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "B\u1ea1n kh\u00f4ng \u0111\u01b0\u1ee3c ph\u00e2n c\u00f4ng gh\u1ebf n\u00e0y"})
    if error == "ALREADY_SUBMITTED":
        raise HTTPException(400, detail={"code": "ALREADY_SUBMITTED", "message": "\u0110\u00e3 x\u00e1c nh\u1eadn r\u1ed3i"})
    if error == "NO_SCORE":
        raise HTTPException(400, detail={"code": "NO_SCORE", "message": "Ch\u01b0a nh\u1eadp \u0111i\u1ec3m tr\u01b0\u1edbc khi x\u00e1c nh\u1eadn"})
    return {"judge_slot": judge.judge_slot, "submitted_at": judge.submitted_at}


@router.patch("/matches/{match_id}/start")
async def start_match(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được bắt đầu trận"})
    match, error = await tournament_repo.start_match(db, match_id)
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy trận đấu"})
    if error == "MISSING_PLAYERS":
        raise HTTPException(400, detail={"code": "MISSING_PLAYERS", "message": "Trận chưa đủ vận động viên (thiếu tên VĐV)"})
    if error == "NOT_READY":
        raise HTTPException(400, detail={"code": "NOT_READY", "message": "Trận chưa đủ trọng tài được gán"})
    if error and error.startswith("COURT_BUSY"):
        court = error.split(":")[1] if ":" in error else ""
        raise HTTPException(409, detail={"code": "COURT_BUSY", "message": f"SÃ¢n {court} Ä’ang cÃ³ tráº­n diá»…n ra"})
    # Init in-memory scores when match begins (scores start at DB value, usually 0)
    _match_scores[match_id] = (match.score1 or 0, match.score2 or 0)
    _timer_active[match_id] = False
    await ws_manager.broadcast(match_id, json.dumps({
        "type": "match_state",
        "match_phase": match.match_phase,
        "status": match.status,
        "score1": match.score1 or 0,
        "score2": match.score2 or 0,
        "timer_active": False,
    }))
    return {
        "id": match.id,
        "match_code": match.match_code,
        "status": match.status,
        "court": match.court,
        "started_at": match.started_at,
    }


@router.post("/matches/{match_id}/result")
async def update_match_result(
    match_id: int,
    body: MatchResultIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "referee"):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin/referee mới được nhập kết quả"})
    if body.winner not in (1, 2):
        raise HTTPException(400, detail={"code": "INVALID_WINNER", "message": "winner phải là 1 hoặc 2"})
    match, error = await tournament_repo.update_match_result(db, match_id, body.winner, body.score1, body.score2)
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy trận đấu"})
    if error == "NOT_ONGOING":
        raise HTTPException(400, detail={"code": "NOT_ONGOING", "message": "Trận phải đang diễn ra mới có thể nhập kết quả"})
    _timer_active.pop(match_id, None)
    await ws_manager.broadcast(match_id, json.dumps({
        "type": "match_state",
        "match_phase": match.match_phase,
        "status": match.status,
        "score1": match.score1 or 0,
        "score2": match.score2 or 0,
        "timer_active": False,
        "winner": match.winner,
    }))
    return {"id": match.id, "winner": match.winner, "status": match.status}


# â”€â”€ Quyen slot actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/referee/current-assignment", response_model=RefereeCurrentAssignmentOut | None)
async def get_referee_current_assignment(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "referee":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ account trọng tài mới được xem bàn phân công"})
    return await tournament_repo.get_referee_current_assignment(db, current_user)


@router.patch("/quyen-slots/{slot_id}/start")
async def start_quyen_slot(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được bắt đầu lượt thi"})
    slot, error = await tournament_repo.start_quyen_slot(db, slot_id)
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
    if error == "NOT_READY":
        raise HTTPException(400, detail={"code": "NOT_READY", "message": "Lượt thi phải ở trạng thái sẵn sàng"})
    if error == "JUDGES_NOT_READY":
        raise HTTPException(400, detail={"code": "JUDGES_NOT_READY", "message": "Chưa đủ 5/5 trọng tài sẵn sàng"})
    if error and error.startswith("COURT_BUSY"):
        court = error.split(":")[1] if ":" in error else ""
        raise HTTPException(409, detail={"code": "COURT_BUSY", "message": f"SÃ¢n {court} Ä‘ang cÃ³ tráº­n diá»…n ra"})
    return {"id": slot.id, "player_name": slot.player_name, "status": slot.status, "court": slot.court}


@router.patch("/quyen-slots/{slot_id}/complete")
async def complete_quyen_slot(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được hoàn thành lượt thi"})
    slot, error = await tournament_repo.complete_quyen_slot(db, slot_id)
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
    if error == "NOT_ONGOING":
        raise HTTPException(400, detail={"code": "NOT_ONGOING", "message": "Lượt thi phải đang diễn ra"})
    if error == "SCORES_PENDING":
        raise HTTPException(400, detail={"code": "SCORES_PENDING", "message": "Chưa đủ 5/5 trọng tài chốt điểm"})
    return {"id": slot.id, "player_name": slot.player_name, "status": slot.status}


@router.get("/quyen-slots/{slot_id}/scoring", response_model=QuyenScoringDetailOut)
async def get_quyen_slot_scoring(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):

    detail = await tournament_repo.get_quyen_slot_scoring_detail(db, slot_id)
    if detail is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
    return detail


@router.get("/quyen-slots/{slot_id}/display", response_model=QuyenDisplayOut)
async def get_quyen_slot_display(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
):
    detail = await tournament_repo.get_quyen_slot_display_detail(db, slot_id)
    if detail is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
    return detail


@router.patch("/quyen-slots/{slot_id}/setup")
async def update_quyen_judge_setup(
    slot_id: int,
    body: UpdateQuyenJudgeSetupIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được cập nhật trọng tài"})
    slot, error = await tournament_repo.update_quyen_judge_setup(
        db,
        slot_id,
        body.judges,
        actor_user_id=current_user.id,
        performance_duration_seconds=body.performance_duration_seconds,
    )
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
    if error == "LOCKED":
        raise HTTPException(400, detail={"code": "LOCKED", "message": "Lượt thi đang diễn ra hoặc đang chấm, không thể sửa setup"})
    if error == "INCOMPLETE_ASSIGNMENT":
        raise HTTPException(400, detail={"code": "INCOMPLETE_ASSIGNMENT", "message": "Cần gán đủ đúng 5 trọng tài cho lượt thi"})
    if error == "INVALID_JUDGE":
        raise HTTPException(400, detail={"code": "INVALID_JUDGE", "message": "Tài khoản được chọn không phải trọng tài hợp lệ của giải"})
    if error == "DUPLICATE_JUDGE":
        raise HTTPException(400, detail={"code": "DUPLICATE_JUDGE", "message": "Không thể gán cùng một trọng tài cho nhiều ghế trong cùng trận"})
    return {"id": slot.id, "status": slot.status}


@router.get("/quyen-slots/{slot_id}/judges/{judge_slot}", response_model=QuyenJudgePanelOut)
async def get_quyen_judge_panel(
    slot_id: int,
    judge_slot: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "referee"):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin/referee mới được xem bàn chấm"})
    detail = await tournament_repo.get_quyen_judge_panel(db, slot_id, judge_slot)
    if detail is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy bàn chấm"})
    if current_user.role != "admin" and detail.judge.assigned_user_id != current_user.id:
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Bạn không được phân công ghế chấm này"})
    return detail


@router.patch("/quyen-slots/{slot_id}/judges/{judge_slot}/ready")
async def set_quyen_judge_ready(
    slot_id: int,
    judge_slot: int,
    body: QuyenJudgeReadyIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "referee"):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin/referee mới được xác nhận sẵn sàng"})
    slot, error = await tournament_repo.set_quyen_judge_ready(
        db,
        slot_id,
        judge_slot,
        current_user=current_user,
        ready=body.ready,
    )
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
    if error == "NOT_WAITING":
        raise HTTPException(400, detail={"code": "NOT_WAITING", "message": "Chỉ xác nhận sẵn sàng trước khi trận bắt đầu"})
    if error == "JUDGE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "JUDGE_NOT_FOUND", "message": "Không tìm thấy ghế trọng tài"})
    if error == "JUDGE_UNASSIGNED":
        raise HTTPException(400, detail={"code": "JUDGE_UNASSIGNED", "message": "Ghế trọng tài này chưa được phân công account"})
    if error == "FORBIDDEN":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Bạn không được phân công ghế chấm này"})
    return {"id": slot.id, "status": slot.status}


@router.post("/quyen-slots/{slot_id}/judges/{judge_slot}/score")
async def submit_quyen_judge_score(
    slot_id: int,
    judge_slot: int,
    body: QuyenJudgeScoreIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "referee"):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin/referee mới được nhập điểm"})
    slot, error = await tournament_repo.submit_quyen_judge_score(
        db,
        slot_id,
        judge_slot,
        body.score,
        current_user=current_user,
    )
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
    if error == "NOT_SCORING":
        raise HTTPException(400, detail={"code": "NOT_SCORING", "message": "Lượt thi chưa ở giai đoạn chấm điểm"})
    if error == "ALREADY_SUBMITTED":
        raise HTTPException(400, detail={"code": "ALREADY_SUBMITTED", "message": "Trọng tài này đã gửi điểm"})
    if error == "JUDGE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "JUDGE_NOT_FOUND", "message": "Không tìm thấy trọng tài"})
    if error == "JUDGE_UNASSIGNED":
        raise HTTPException(400, detail={"code": "JUDGE_UNASSIGNED", "message": "Ghế trọng tài này chưa được phân công account"})
    if error == "FORBIDDEN":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Bạn không được phân công ghế chấm này"})
    return {"id": slot.id, "status": slot.status, "official_score": slot.official_score}


@router.post("/quyen-slots/{slot_id}/judges/{judge_slot}/unlock")
async def unlock_quyen_judge_score(
    slot_id: int,
    judge_slot: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được mở khóa điểm"})
    slot, error = await tournament_repo.unlock_quyen_judge_score(
        db,
        slot_id,
        judge_slot,
        actor_user_id=current_user.id,
    )
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
    if error == "NOT_SCORING":
        raise HTTPException(400, detail={"code": "NOT_SCORING", "message": "Lượt thi chưa ở giai đoạn có thể sửa điểm"})
    if error == "JUDGE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "JUDGE_NOT_FOUND", "message": "Không tìm thấy trọng tài"})
    return {"id": slot.id, "status": slot.status}

class _ResetTimerBody(_BaseModel):
    remaining_seconds: int | None = None


@router.patch("/quyen-slots/{slot_id}/reset-timer")
async def reset_quyen_slot_timer(
    slot_id: int,
    body: _ResetTimerBody = Body(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được reset giờ"})
    remaining = body.remaining_seconds if body else None
    slot, error = await tournament_repo.reset_quyen_slot_timer(db, slot_id, remaining)
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
    if error == "NOT_ONGOING":
        raise HTTPException(400, detail={"code": "NOT_ONGOING", "message": "Lượt thi phải đang diễn ra"})
    return {"id": slot.id, "status": slot.status, "started_at": slot.started_at}


@router.patch("/quyen-slots/{slot_id}/resume")
async def resume_quyen_slot(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được tiếp tục giờ"})
    slot, error = await tournament_repo.resume_quyen_slot(db, slot_id)
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
    if error == "NOT_ONGOING":
        raise HTTPException(400, detail={"code": "NOT_ONGOING", "message": "Lượt thi phải đang diễn ra"})
    if error == "ALREADY_RUNNING":
        raise HTTPException(400, detail={"code": "ALREADY_RUNNING", "message": "Đồng hồ đang chạy"})
    return {"id": slot.id, "status": slot.status, "started_at": slot.started_at}


@router.patch("/quyen-slots/{slot_id}/disqualify")
async def disqualify_quyen_slot(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới được loại vận động viên"})
    slot, error = await tournament_repo.disqualify_quyen_slot(db, slot_id)
    if error == "NOT_FOUND":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
    if error == "ALREADY_COMPLETED":
        raise HTTPException(400, detail={"code": "ALREADY_COMPLETED", "message": "Không thể loại vận động viên lúc này"})
    return {"id": slot.id, "status": slot.status}



# â”€â”€ Admin reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.post("/tournaments/{tournament_id}/reset")
async def reset_tournament(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới có thể reset giải đấu"})
    result = await tournament_repo.reset_tournament(db, tournament_id)
    if result is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return result


# â”€â”€ Medal tally â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/tournaments/{tournament_id}/medals", response_model=MedalTallyOut)
async def get_medals(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await tournament_repo.get_medal_tally(db, tournament_id)
    if result is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return result


@router.get("/tournaments/{tournament_id}/medals/by-club", response_model=ClubMedalTallyOut)
async def get_medals_by_club(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await tournament_repo.get_medal_tally_by_club(db, tournament_id)
    if result is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return result


@router.get("/tournaments/{tournament_id}/athlete-stats")
async def get_athlete_stats(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await tournament_repo.get_athlete_stats_by_club(db, tournament_id)


# ── Realtime Scoring WebSocket ───────────────────────────────────────────────

async def _ws_authenticate(token: str, db: AsyncSession) -> User | None:
    """Decode JWT from query param and return the active User, or None."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    result = await db.execute(select(User).where(User.id == int(user_id), User.is_active == True))
    return result.scalar_one_or_none()


async def _get_judge_slot_for_user(db: AsyncSession, match_id: int, user: User) -> int | None:
    """Return the judge_slot assigned to this user for this match, or None."""
    result = await db.execute(
        select(BracketJudgeAssignment).where(
            BracketJudgeAssignment.match_id == match_id,
            BracketJudgeAssignment.judge_user_id == user.id,
        )
    )
    assignment = result.scalar_one_or_none()
    return assignment.judge_slot if assignment else None


@router.websocket("/ws/matches/{match_id}/scoring")
async def match_scoring_ws(
    match_id: int,
    websocket: WebSocket,
    token: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    """
    Realtime scoring WebSocket for a match.

    Judges connect here to send scoring events (judge_input messages).
    Admin / display screens connect as spectators to receive score_update broadcasts.

    Server-side consensus engine groups inputs into 1.5s windows and broadcasts
    score_update to all subscribers when 3/5 judges agree on the same scoring pattern.

    Auth is optional — unauthenticated clients (e.g. TV display without login) connect
    as anonymous spectators: they receive all broadcasts but cannot send judge_input or
    admin_cmd messages.
    """
    # 1. Authenticate (optional — None = anonymous spectator)
    user = await _ws_authenticate(token, db) if token else None
    # Reject only if token was provided but invalid (not if token was omitted).
    # Must accept() before close() so the upgrade handshake completes; otherwise
    # Starlette returns HTTP 400 instead of a proper WS close frame.
    if token and user is None:
        await websocket.accept()
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # 2. Load match and owning tournament config
    row = (await db.execute(
        select(BracketMatch, Tournament)
        .join(TournamentWeightClass, BracketMatch.weight_class_id == TournamentWeightClass.id)
        .join(Tournament, TournamentWeightClass.tournament_id == Tournament.id)
        .where(BracketMatch.id == match_id)
    )).first()
    if not row:
        await websocket.accept()
        await websocket.close(code=4004, reason="Match not found")
        return
    match, tournament = row

    # 3. Determine judge slot (None = spectator/admin/anonymous)
    judge_slot = None
    if user is not None and user.role != "admin":
        judge_slot = await _get_judge_slot_for_user(db, match_id, user)

    # 3b. Load tournament config and set per-match engine config (idempotent)
    match_engine.set_match_config(
        match_id,
        window_secs=float(tournament.consensus_window_secs),
        min_votes=int(tournament.consensus_min_votes),
    )

    await ws_manager.connect(match_id, websocket)

    # 4. Send initial snapshot to the connecting client
    # Use in-memory scores if available (they're more current than DB during live match)
    _snap_s1, _snap_s2 = _match_scores.get(match_id, (match.score1 or 0, match.score2 or 0))
    await websocket.send_json({
        "type": "snapshot",
        "match_id": match_id,
        "status": match.status,
        "match_phase": match.match_phase or "not_started",
        "score1": _snap_s1,
        "score2": _snap_s2,
        "timer_active": _timer_active.get(match_id, bool(match.timer_active)),
        "judge_slot": judge_slot,
    })

    # 5. Register consensus callback once per judge connection
    #    The callback fires after each 1.5s window closes and applies valid slots.
    #    Scores are updated in-memory only (_match_scores) — no DB write per consensus.
    #    DB is only written at end_round (via REST) to keep realtime path fast.
    if judge_slot is not None:
        async def on_slots_confirmed(result) -> None:
            from app.models.tournament import MatchConsensusTurn, MatchConsensusVote
            valid_slots = result.valid_slots
            raw_inputs = result.raw_inputs  # list of (judge_slot, player_side, score_type, press_order)

            if not valid_slots:
                # Không đồng thuận — ghi log turn thất bại nếu có ai bấm
                if raw_inputs:
                    async def _write_failed_turn(mid=match_id, inputs=raw_inputs, phase=match.match_phase):
                        async with AsyncSessionLocal() as _db:
                            # Lấy judge_user_id map
                            from sqlalchemy import select as _select
                            from app.models.tournament import BracketJudgeAssignment
                            assignments = (await _db.execute(
                                _select(BracketJudgeAssignment).where(BracketJudgeAssignment.match_id == mid)
                            )).scalars().all()
                            slot_to_user = {a.judge_slot: a.judge_user_id for a in assignments}

                            turn = MatchConsensusTurn(
                                match_id=mid,
                                match_phase=phase,
                                is_consensus=False,
                                result_side=None,
                                result_type=None,
                                result_delta=None,
                                score1_after=None,
                                score2_after=None,
                            )
                            _db.add(turn)
                            await _db.flush()

                            for (js, side, stype, order) in inputs:
                                _db.add(MatchConsensusVote(
                                    turn_id=turn.id,
                                    judge_slot=js,
                                    judge_user_id=slot_to_user.get(js),
                                    player_side=side,
                                    score_type=stype,
                                    press_order=order,
                                ))
                            await _db.commit()
                    t = asyncio.create_task(_write_failed_turn())
                    t.add_done_callback(lambda f: logger.error("consensus turn log failed: %s", f.exception()) if f.exception() else None)

                # Always clear pending even on empty result
                await ws_manager.broadcast(match_id, json.dumps({
                    "type": "pending_update",
                    "match_id": match_id,
                    "pending": [],
                }))
                return

            red_delta = sum(s.delta for s in valid_slots if s.player_side == "RED")
            blue_delta = sum(s.delta for s in valid_slots if s.player_side == "BLUE")

            if red_delta or blue_delta:
                # Update in-memory scores atomically (no DB write — scores persist to DB at end_round)
                cur1, cur2 = _match_scores.get(match_id, (match.score1 or 0, match.score2 or 0))
                new1 = cur1 + red_delta
                new2 = cur2 + blue_delta
                _match_scores[match_id] = (new1, new2)

                await ws_manager.broadcast(match_id, json.dumps({
                    "type": "score_update",
                    "match_id": match_id,
                    "score1": new1,
                    "score2": new2,
                    "confirmed_slots": [
                        {
                            "playerSide": s.player_side,
                            "scoreType": s.score_type,
                            "delta": s.delta,
                        }
                        for s in valid_slots
                    ],
                }))

                # Ghi score log + consensus turn
                async def _write_logs(mid=match_id, slots=valid_slots, inputs=raw_inputs, s1=new1, s2=new2, phase=match.match_phase):
                    async with AsyncSessionLocal() as _db:
                        from app.models.tournament import BracketJudgeAssignment
                        assignments = (await _db.execute(
                            select(BracketJudgeAssignment).where(BracketJudgeAssignment.match_id == mid)
                        )).scalars().all()
                        slot_to_user = {a.judge_slot: a.judge_user_id for a in assignments}

                        for s in slots:
                            side = 1 if s.player_side == "RED" else 2
                            judges_str = " ".join(f"GĐ{j}" for j in sorted(s.judge_slots))
                            desc = f"{'+' if s.delta > 0 else ''}{s.delta} đồng thuận {judges_str}"
                            await tournament_repo.add_match_score_log(
                                _db, mid,
                                actor_type="referee",
                                actor_name="Hội đồng trọng tài",
                                action="score_add" if s.delta > 0 else "score_subtract",
                                side=side, delta=s.delta,
                                score1_after=s1, score2_after=s2,
                                match_phase=phase,
                                description=desc,
                            )

                        # Ghi 1 consensus turn (đồng thuận)
                        first_slot = slots[0]
                        agreeing = ",".join(str(j) for j in sorted(first_slot.judge_slots))
                        # result_delta = tổng delta thực tế áp dụng cho bên đó (không chỉ delta của 1 slot)
                        total_delta = red_delta if first_slot.player_side == "RED" else blue_delta
                        turn = MatchConsensusTurn(
                            match_id=mid,
                            match_phase=phase,
                            is_consensus=True,
                            result_side=first_slot.player_side,
                            result_type=first_slot.score_type,
                            result_delta=total_delta,
                            score1_after=s1,
                            score2_after=s2,
                            agreeing_slots=agreeing,
                        )
                        _db.add(turn)
                        await _db.flush()

                        for (js, side_raw, stype, order) in inputs:
                            _db.add(MatchConsensusVote(
                                turn_id=turn.id,
                                judge_slot=js,
                                judge_user_id=slot_to_user.get(js),
                                player_side=side_raw,
                                score_type=stype,
                                press_order=order,
                            ))
                        await _db.commit()
                t = asyncio.create_task(_write_logs())
                t.add_done_callback(lambda f: logger.error("consensus turn log failed: %s", f.exception()) if f.exception() else None)

            # Always clear pending after window closes
            await ws_manager.broadcast(match_id, json.dumps({
                "type": "pending_update",
                "match_id": match_id,
                "pending": [],
            }))

        match_engine.register_callback(match_id, on_slots_confirmed)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if msg_type == "judge_input":
                if judge_slot is None:
                    await websocket.send_json({"type": "error", "code": "NOT_A_JUDGE"})
                    continue

                # Refresh match status from DB
                await db.refresh(match)

                if match.status != "ongoing":
                    await websocket.send_json({"type": "error", "code": "NOT_ONGOING"})
                    continue

                player_side = data.get("playerSide")
                score_type = data.get("scoreType")

                if player_side not in ("RED", "BLUE") or score_type not in ("+1", "+2", "-1"):
                    await websocket.send_json({"type": "error", "code": "INVALID_PAYLOAD"})
                    continue

                pending, judge_inputs = await match_engine.add_input(
                    match_id, judge_slot, player_side, score_type
                )
                await ws_manager.broadcast(match_id, json.dumps({
                    "type": "pending_update",
                    "match_id": match_id,
                    "pending": [
                        {
                            "playerSide": p.player_side,
                            "scoreType": p.score_type,
                            "slotIndex": p.slot_index,
                            "judgeCount": p.judge_count,
                        }
                        for p in pending
                    ],
                    "judgeInputs": [
                        {
                            "judgeSlot": ji.judge_slot,
                            "playerSide": ji.player_side,
                            "scoreType": ji.score_type,
                            "count": ji.count,
                            "accumulatedDelta": ji.accumulated_delta,
                            "pressDeltas": ji.press_deltas,
                        }
                        for ji in judge_inputs
                    ],
                }))

            elif msg_type == 'admin_cmd':
                if user is None or user.role != 'admin':
                    await websocket.send_json({"type": "error", "code": "FORBIDDEN"})
                    continue

                await db.refresh(match)
                cmd = data.get('cmd')

                broadcast_payload = None
                db_updates: dict = {}

                if cmd == 'begin':
                    can_begin = match.status == 'ready' or (match.status == 'ongoing' and match.match_phase == 'not_started')
                    if not can_begin:
                        await websocket.send_json({"type": "error", "code": "INVALID_TRANSITION"})
                        continue
                    _match_scores[match_id] = (match.score1 or 0, match.score2 or 0)
                    _timer_active[match_id] = False
                    broadcast_payload = {
                        "match_phase": "round_1",
                        "status": "ongoing",
                        "score1": match.score1 or 0,
                        "score2": match.score2 or 0,
                        "timer_active": False,
                    }
                    db_updates = {"match_phase": "round_1", "status": "ongoing", "current_hiep": 1}

                elif cmd == 'end_round':
                    s1 = data.get('score1', match.score1 or 0)
                    s2 = data.get('score2', match.score2 or 0)
                    cur_phase = match.match_phase
                    if cur_phase == 'round_1':
                        new_phase = 'break'
                        winner = None
                    elif cur_phase == 'round_2':
                        new_phase = 'finished' if s1 != s2 else 'extra_time'
                        winner = (1 if s1 > s2 else 2) if s1 != s2 else None
                    elif cur_phase == 'extra_time':
                        new_phase = 'finished' if s1 != s2 else 'draw_pending'
                        winner = (1 if s1 > s2 else 2) if s1 != s2 else None
                    else:
                        await websocket.send_json({"type": "error", "code": "INVALID_TRANSITION"})
                        continue
                    new_status = "completed" if new_phase == "finished" else "ongoing"
                    broadcast_payload = {
                        "match_phase": new_phase,
                        "status": new_status,
                        "score1": s1,
                        "score2": s2,
                        "timer_active": False,
                        "winner": winner,
                    }
                    db_updates = {"match_phase": new_phase, "status": new_status, "score1": s1, "score2": s2, "timer_active": False}
                    if winner is not None:
                        db_updates["winner"] = winner

                elif cmd == 'start_round':
                    if match.match_phase != 'break':
                        await websocket.send_json({"type": "error", "code": "INVALID_TRANSITION"})
                        continue
                    broadcast_payload = {
                        "match_phase": "round_2",
                        "status": "ongoing",
                        "score1": match.score1 or 0,
                        "score2": match.score2 or 0,
                        "timer_active": False,
                    }
                    db_updates = {"match_phase": "round_2", "current_hiep": 2}

                elif cmd == 'draw_result':
                    winner_val = data.get('winner')
                    if match.match_phase != 'draw_pending' or winner_val not in (1, 2):
                        await websocket.send_json({"type": "error", "code": "INVALID_TRANSITION"})
                        continue
                    broadcast_payload = {
                        "match_phase": "finished",
                        "status": "ongoing",
                        "score1": match.score1 or 0,
                        "score2": match.score2 or 0,
                        "timer_active": False,
                    }
                    db_updates = {"match_phase": "finished", "winner": winner_val}

                elif cmd == 'live_score':
                    # Admin manual score adjustment — read current in-memory scores as default
                    cur1, cur2 = _match_scores.get(match_id, (match.score1 or 0, match.score2 or 0))
                    s1 = data.get('score1', cur1)
                    s2 = data.get('score2', cur2)
                    _match_scores[match_id] = (s1, s2)  # keep in-memory in sync
                    ta = _timer_active.get(match_id, bool(match.timer_active))
                    broadcast_payload = {
                        "match_phase": match.match_phase,
                        "status": match.status,
                        "score1": s1,
                        "score2": s2,
                        "timer_active": ta,
                        "yellow_cards1": data.get('yellow_cards1'),
                        "yellow_cards2": data.get('yellow_cards2'),
                    }
                    db_updates = {"score1": s1, "score2": s2}  # persist manual adjustments to DB

                elif cmd == 'timer_active':
                    active = bool(data.get('active', False))
                    _timer_active[match_id] = active  # keep in-memory state in sync so snapshots are accurate
                    s1, s2 = _match_scores.get(match_id, (match.score1 or 0, match.score2 or 0))
                    broadcast_payload = {
                        "match_phase": match.match_phase,
                        "status": match.status,
                        "score1": s1,
                        "score2": s2,
                        "timer_active": active,
                    }
                    db_updates = {"timer_active": active}

                if broadcast_payload:
                    broadcast_payload["type"] = "match_state"
                    await ws_manager.broadcast(match_id, json.dumps(broadcast_payload))

                    _mid = match_id
                    _upd = db_updates.copy()

                    _propagate = _upd.get("status") == "completed" and _upd.get("winner") in (1, 2)

                    async def _write_db(_mid=_mid, _upd=_upd, _propagate=_propagate):
                        async with AsyncSessionLocal() as _db:
                            _m = await _db.get(BracketMatch, _mid)
                            if _m:
                                for k, v in _upd.items():
                                    setattr(_m, k, v)
                                # Auto-propagate winner to next match when completed
                                if _propagate and _m.next_match_id and _m.winner:
                                    _next = await _db.get(BracketMatch, _m.next_match_id)
                                    if _next:
                                        winner_name = _m.player1_name if _m.winner == 1 else _m.player2_name
                                        if _m.match_number % 2 == 1:
                                            _next.player1_name = winner_name
                                        else:
                                            _next.player2_name = winner_name
                                await _db.commit()

                    asyncio.create_task(_write_db())

    except WebSocketDisconnect:
        await ws_manager.disconnect(match_id, websocket)
        # Unregister callback only if no more judge connections remain for this match
        if not ws_manager.has_connections(match_id):
            match_engine.unregister_callback(match_id)
    except Exception:
        await ws_manager.disconnect(match_id, websocket)
        if not ws_manager.has_connections(match_id):
            match_engine.unregister_callback(match_id)
