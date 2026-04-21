from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.repositories import structure_repo
from app.schemas.tournament_structure import (
    TeamKataRegistrationResponse,
    UpdateTeamKataRegistrationRequest,
    TeamKataMembersResponse,
    UpdateTeamKataMembersRequest,
)


router = APIRouter(prefix="/api", tags=["Tournament Team Kata"])


def _resolve_club_id(current_user, club_id: int) -> int:
    if current_user.role == "admin":
        return club_id
    if current_user.role == "club":
        if not current_user.club_id:
            raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Tai khoan club chua duoc gan cau lac bo"})
        if current_user.club_id != club_id:
            raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Ban chi co the dang ky quyen dong doi cho don vi cua minh"})
        return current_user.club_id
    raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Khong du quyen truy cap"})


@router.get(
    "/tournaments/{tournament_id}/clubs/{club_id}/team-kata-registrations",
    response_model=TeamKataRegistrationResponse,
)
async def get_team_kata_registrations(
    tournament_id: int,
    club_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    resolved_club_id = _resolve_club_id(current_user, club_id)
    result, error = await structure_repo.get_team_kata_registrations(db, tournament_id, resolved_club_id)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Khong tim thay giai dau"})
    if error == "CLUB_NOT_FOUND":
        raise HTTPException(404, detail={"code": "CLUB_NOT_FOUND", "message": "Khong tim thay don vi"})
    if error == "CLUB_NOT_IN_TOURNAMENT":
        raise HTTPException(400, detail={"code": "CLUB_NOT_IN_TOURNAMENT", "message": "Don vi chua duoc gan voi giai dau"})
    return result


@router.put(
    "/tournaments/{tournament_id}/clubs/{club_id}/team-kata-registrations",
    response_model=TeamKataRegistrationResponse,
)
async def replace_team_kata_registrations(
    tournament_id: int,
    club_id: int,
    body: UpdateTeamKataRegistrationRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    resolved_club_id = _resolve_club_id(current_user, club_id)
    result, error = await structure_repo.replace_team_kata_registrations(
        db,
        tournament_id,
        resolved_club_id,
        [{"node_id": item.node_id, "kata_id": item.kata_id} for item in body.items],
    )
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Khong tim thay giai dau"})
    if error == "CLUB_NOT_FOUND":
        raise HTTPException(404, detail={"code": "CLUB_NOT_FOUND", "message": "Khong tim thay don vi"})
    if error == "CLUB_NOT_IN_TOURNAMENT":
        raise HTTPException(400, detail={"code": "CLUB_NOT_IN_TOURNAMENT", "message": "Don vi chua duoc gan voi giai dau"})
    if error == "INVALID_KATA_ID":
        raise HTTPException(400, detail={"code": "INVALID_KATA_ID", "message": "Bai quyen dong doi khong ton tai hoac khong thuoc giai"})
    if error == "INVALID_NODE_ID":
        raise HTTPException(400, detail={"code": "INVALID_NODE_ID", "message": "Tree path khong ton tai hoac khong hop le cho quyen dong doi"})
    return result


@router.get(
    "/tournaments/{tournament_id}/clubs/{club_id}/team-kata-members",
    response_model=TeamKataMembersResponse,
)
async def get_team_kata_members(
    tournament_id: int,
    club_id: int,
    node_id: int,
    kata_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    resolved_club_id = _resolve_club_id(current_user, club_id)
    result, error = await structure_repo.get_team_kata_members(db, tournament_id, resolved_club_id, node_id, kata_id)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Khong tim thay giai dau"})
    if error == "CLUB_NOT_FOUND":
        raise HTTPException(404, detail={"code": "CLUB_NOT_FOUND", "message": "Khong tim thay don vi"})
    if error == "CLUB_NOT_IN_TOURNAMENT":
        raise HTTPException(400, detail={"code": "CLUB_NOT_IN_TOURNAMENT", "message": "Don vi chua duoc gan voi giai dau"})
    if error == "REGISTRATION_NOT_FOUND":
        raise HTTPException(404, detail={"code": "REGISTRATION_NOT_FOUND", "message": "Don vi chua dang ky quyen dong doi nay"})
    if error == "KATA_NOT_FOUND":
        raise HTTPException(404, detail={"code": "KATA_NOT_FOUND", "message": "Khong tim thay bai quyen"})
    return result


@router.put(
    "/tournaments/{tournament_id}/clubs/{club_id}/team-kata-members",
    response_model=TeamKataMembersResponse,
)
async def replace_team_kata_members(
    tournament_id: int,
    club_id: int,
    node_id: int,
    kata_id: int,
    body: UpdateTeamKataMembersRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    resolved_club_id = _resolve_club_id(current_user, club_id)
    result, error = await structure_repo.replace_team_kata_members(
        db, tournament_id, resolved_club_id, node_id, kata_id, body.student_ids
    )
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Khong tim thay giai dau"})
    if error == "CLUB_NOT_FOUND":
        raise HTTPException(404, detail={"code": "CLUB_NOT_FOUND", "message": "Khong tim thay don vi"})
    if error == "CLUB_NOT_IN_TOURNAMENT":
        raise HTTPException(400, detail={"code": "CLUB_NOT_IN_TOURNAMENT", "message": "Don vi chua duoc gan voi giai dau"})
    if error == "REGISTRATION_NOT_FOUND":
        raise HTTPException(404, detail={"code": "REGISTRATION_NOT_FOUND", "message": "Don vi chua dang ky quyen dong doi nay"})
    if error == "KATA_NOT_FOUND":
        raise HTTPException(404, detail={"code": "KATA_NOT_FOUND", "message": "Khong tim thay bai quyen"})
    if error == "EXCEEDS_TEAM_SIZE":
        raise HTTPException(400, detail={"code": "EXCEEDS_TEAM_SIZE", "message": "Số lượng vận động viên vượt quá số người cho phép"})
    if error == "BELOW_MIN_TEAM_SIZE":
        raise HTTPException(400, detail={"code": "BELOW_MIN_TEAM_SIZE", "message": "Số lượng vận động viên chưa đủ tối thiểu theo yêu cầu"})
    if error == "INVALID_STUDENT_ID":
        raise HTTPException(400, detail={"code": "INVALID_STUDENT_ID", "message": "Mot so van dong vien khong ton tai"})
    return result
