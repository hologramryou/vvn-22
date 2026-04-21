import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.routers.users import require_admin
from app.schemas.club import ClubCreateIn, ClubUpdateIn, ClubOut, ClubListResponse, ProvinceOut
from app.repositories import club_repo

router = APIRouter(prefix="/admin", tags=["admin-clubs"])


@router.get("/clubs", response_model=ClubListResponse)
async def list_clubs(
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query("all"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    items, total = await club_repo.get_clubs(db, keyword, status, page, page_size)
    return ClubListResponse(
        items=[ClubOut(**item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.post("/clubs", response_model=ClubOut, status_code=201)
async def create_club(
    body: ClubCreateIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    club = await club_repo.create_club(db, body)
    return ClubOut.model_validate(club)


@router.put("/clubs/{club_id}", response_model=ClubOut)
async def update_club(
    club_id: int,
    body: ClubUpdateIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    club = await club_repo.update_club(db, club_id, body)
    return ClubOut.model_validate(club)


@router.delete("/clubs/{club_id}", status_code=204)
async def delete_club(
    club_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    await club_repo.delete_club(db, club_id)


@router.get("/provinces", response_model=list[ProvinceOut])
async def list_provinces(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    provinces = await club_repo.get_provinces(db)
    return [ProvinceOut.model_validate(p) for p in provinces]
