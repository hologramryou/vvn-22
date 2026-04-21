from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.models.club import Club, Province
from app.models.student import Student, StudentClub
from app.models.tournament import Tournament
from app.schemas.club import ClubCreateIn, ClubUpdateIn


async def get_next_code(db: AsyncSession) -> str:
    result = await db.execute(select(func.max(Club.id)))
    max_id = result.scalar() or 0
    return f"CLB{(max_id + 1):03d}"


async def get_clubs(
    db: AsyncSession,
    keyword: Optional[str],
    status: Optional[str],
    page: int,
    page_size: int,
) -> tuple[list, int]:
    # Subquery: count active students per club via StudentClub join table
    member_count_sq = (
        select(StudentClub.club_id, func.count(StudentClub.id).label("cnt"))
        .where(StudentClub.is_current == True)  # noqa: E712
        .group_by(StudentClub.club_id)
        .subquery()
    )

    stmt = (
        select(
            Club,
            func.coalesce(member_count_sq.c.cnt, 0).label("member_count"),
        )
        .outerjoin(member_count_sq, member_count_sq.c.club_id == Club.id)
    )

    if keyword:
        stmt = stmt.where(Club.name.ilike(f"%{keyword.strip()}%"))

    if status and status != "all":
        stmt = stmt.where(Club.status == status)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total: int = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(Club.name).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).all()

    result = []
    for club, member_count in rows:
        item = {
            "id": club.id,
            "code": club.code,
            "name": club.name,
            "description": club.description,
            "province_id": club.province_id,
            "address": club.address,
            "phone": club.phone,
            "email": club.email,
            "logo_url": club.logo_url,
            "founded_date": club.founded_date,
            "status": club.status,
            "tournament_ids": list(club.tournament_ids or []),
            "member_count": member_count,
            "created_at": club.created_at,
            "updated_at": club.updated_at,
        }
        result.append(item)

    return result, total


async def get_club_by_id(db: AsyncSession, club_id: int) -> Club | None:
    return await db.get(Club, club_id)


async def _check_name_unique(db: AsyncSession, name: str, exclude_id: int | None = None) -> bool:
    """Returns True if name is available."""
    stmt = select(Club).where(func.lower(Club.name) == name.strip().lower())
    if exclude_id is not None:
        stmt = stmt.where(Club.id != exclude_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is None


async def _validate_province(db: AsyncSession, province_id: int) -> bool:
    result = await db.execute(select(Province).where(Province.id == province_id))
    return result.scalar_one_or_none() is not None


def _normalize_tournament_ids(tournament_ids: list[int] | None) -> list[int]:
    normalized: list[int] = []
    seen: set[int] = set()
    for value in tournament_ids or []:
        try:
            tid = int(value)
        except (TypeError, ValueError):
            continue
        if tid in seen:
            continue
        seen.add(tid)
        normalized.append(tid)
    return normalized


async def _validate_tournament_ids(db: AsyncSession, tournament_ids: list[int] | None) -> list[int]:
    normalized = _normalize_tournament_ids(tournament_ids)
    if not normalized:
        return []

    result = await db.execute(select(Tournament.id).where(Tournament.id.in_(normalized)))
    existing_ids = set(result.scalars().all())
    missing_ids = [tid for tid in normalized if tid not in existing_ids]
    if missing_ids:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Giải đấu ID {missing_ids[0]} không tồn tại")
    return normalized


async def create_club(db: AsyncSession, data: ClubCreateIn) -> Club:
    from fastapi import HTTPException

    if not await _check_name_unique(db, data.name):
        raise HTTPException(status_code=409, detail="Tên CLB đã tồn tại")

    if not await _validate_province(db, data.province_id):
        raise HTTPException(status_code=400, detail=f"Province ID {data.province_id} không tồn tại")

    code = await get_next_code(db)
    tournament_ids = await _validate_tournament_ids(db, data.tournament_ids)
    club = Club(
        code=code,
        name=data.name.strip(),
        description=data.description,
        province_id=data.province_id,
        founded_date=data.founded_date,
        address=data.address,
        phone=data.phone,
        email=data.email,
        logo_url=data.logo_url,
        tournament_ids=tournament_ids,
        status="active",
    )
    db.add(club)
    await db.commit()
    await db.refresh(club)
    return club


async def update_club(db: AsyncSession, club_id: int, data: ClubUpdateIn) -> Club:
    from fastapi import HTTPException

    club = await db.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Không tìm thấy CLB")

    if data.name is not None:
        if not await _check_name_unique(db, data.name, exclude_id=club_id):
            raise HTTPException(status_code=409, detail="Tên CLB đã tồn tại")
        club.name = data.name.strip()

    if data.province_id is not None:
        if not await _validate_province(db, data.province_id):
            raise HTTPException(status_code=400, detail=f"Province ID {data.province_id} không tồn tại")
        club.province_id = data.province_id

    if data.description is not None:
        club.description = data.description
    if data.founded_date is not None:
        club.founded_date = data.founded_date
    if data.address is not None:
        club.address = data.address
    if data.phone is not None:
        club.phone = data.phone
    if data.email is not None:
        club.email = str(data.email)
    if data.logo_url is not None:
        club.logo_url = data.logo_url
    if data.tournament_ids is not None:
        club.tournament_ids = await _validate_tournament_ids(db, data.tournament_ids)

    await db.commit()
    await db.refresh(club)
    return club


async def delete_club(db: AsyncSession, club_id: int) -> None:
    from fastapi import HTTPException

    club = await db.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Không tìm thấy CLB")

    # Check via StudentClub join table (is_current = still in this club)
    student_count_result = await db.execute(
        select(func.count(StudentClub.id)).where(
            StudentClub.club_id == club_id,
            StudentClub.is_current == True,  # noqa: E712
        )
    )
    if student_count_result.scalar_one() > 0:
        raise HTTPException(
            status_code=409,
            detail="Không thể xóa: CLB có thành viên hoặc giải đấu đang hoạt động",
        )

    club.status = "inactive"
    await db.commit()


async def get_provinces(db: AsyncSession) -> list[Province]:
    result = await db.execute(select(Province).order_by(Province.name))
    return result.scalars().all()
