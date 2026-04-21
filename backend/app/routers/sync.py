"""
Sync router — only useful on api-local (local Docker).
POST /sync/match/{match_id} : pull match data from Railway → local DB
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services import sync_service
from app.core.config import settings

router = APIRouter(prefix="/sync", tags=["sync"])


def _require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin required")
    return user


@router.post("/tournament/{tournament_id}/matches")
async def sync_tournament_matches(
    tournament_id: int,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(_require_admin),
):
    if not settings.railway_database_url:
        raise HTTPException(status_code=503, detail="RAILWAY_DATABASE_URL not configured")
    try:
        result = await sync_service.sync_tournament_matches_from_railway(tournament_id, db, page=page, size=size)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {e}")
    return result


@router.get("/match/{match_id}/exists")
async def match_exists_locally(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(_require_admin),
):
    from sqlalchemy import text
    row = (await db.execute(
        text("SELECT id FROM bracket_matches WHERE id = :id"),
        {"id": match_id}
    )).first()
    return {"exists": row is not None}


@router.post("/match/{match_id}")
async def sync_match_from_railway(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(_require_admin),
):
    if not settings.railway_database_url:
        raise HTTPException(status_code=503, detail="RAILWAY_DATABASE_URL not configured")
    try:
        await sync_service.sync_match_from_railway(match_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {e}")
    return {"synced": match_id}
