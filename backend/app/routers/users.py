from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import hash_password, get_current_user
from app.models.user import User
from app.models.club import Club
from app.models.tournament import Tournament

router = APIRouter(prefix="/users", tags=["users"])

VALID_ROLES = {"admin", "viewer", "referee", "club"}


# ── Schemas ────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str
    club_id: Optional[int] = None
    club_name: Optional[str] = None
    tournament_ids: list[int] = Field(default_factory=list)
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserCreateIn(BaseModel):
    username: str
    password: str
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str
    club_id: Optional[int] = None
    tournament_ids: list[int] = Field(default_factory=list)
    is_active: bool = True


class UserUpdateIn(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    club_id: Optional[int] = None
    tournament_ids: Optional[list[int]] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None  # if set, change password


# ── Guards ─────────────────────────────────────────────────────────────────────

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ admin mới được thực hiện thao tác này")
    return current_user


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
        raise HTTPException(status_code=400, detail=f"Giải đấu ID {missing_ids[0]} không tồn tại")
    return normalized


# ── List all users ─────────────────────────────────────────────────────────────

@router.get("", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(User, Club.name.label("club_name"))
        .outerjoin(Club, Club.id == User.club_id)
        .order_by(User.id)
    )
    rows = result.all()
    out = []
    for user, club_name in rows:
        item = UserOut.model_validate(user)
        item.club_name = club_name
        out.append(item)
    return out


# ── Create user ────────────────────────────────────────────────────────────────

@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreateIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(400, f"Role không hợp lệ. Cho phép: {', '.join(VALID_ROLES)}")

    # Check duplicate username/email
    dup = await db.execute(
        select(User).where(
            (User.username == body.username) | (User.email == body.email)
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(409, "Username hoặc email đã tồn tại")

    # club role must have club_id
    if body.role == "club" and not body.club_id:
        raise HTTPException(400, "Role 'club' cần có club_id")

    if body.club_id:
        club = await db.get(Club, body.club_id)
        if not club:
            raise HTTPException(400, f"Club ID {body.club_id} không tồn tại")

    tournament_ids = await _validate_tournament_ids(db, body.tournament_ids)

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        email=body.email,
        phone=body.phone,
        role=body.role,
        club_id=body.club_id,
        tournament_ids=tournament_ids,
        is_active=body.is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    club_name: str | None = None
    if user.club_id:
        club = await db.get(Club, user.club_id)
        club_name = club.name if club else None

    result = UserOut.model_validate(user)
    result.club_name = club_name
    return result


# ── Update user ────────────────────────────────────────────────────────────────

@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    body: UserUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Không tìm thấy tài khoản")

    if body.role is not None and body.role not in VALID_ROLES:
        raise HTTPException(400, f"Role không hợp lệ. Cho phép: {', '.join(VALID_ROLES)}")

    # Prevent removing admin role from self
    if user.id == current_admin.id and body.role and body.role != "admin":
        raise HTTPException(400, "Không thể thay đổi role của chính mình")

    if body.full_name is not None:
        user.full_name = body.full_name
    if body.email is not None:
        user.email = body.email
    if body.phone is not None:
        user.phone = body.phone
    if body.role is not None:
        user.role = body.role
    if body.club_id is not None:
        club = await db.get(Club, body.club_id)
        if not club:
            raise HTTPException(400, f"Club ID {body.club_id} không tồn tại")
        user.club_id = body.club_id
    elif body.role is not None and body.role != "club":
        user.club_id = None
    if body.tournament_ids is not None:
        user.tournament_ids = await _validate_tournament_ids(db, body.tournament_ids)
    if body.is_active is not None:
        if user.id == current_admin.id and not body.is_active:
            raise HTTPException(400, "Không thể vô hiệu hóa tài khoản của chính mình")
        user.is_active = body.is_active
    if body.password:
        user.password_hash = hash_password(body.password)

    await db.commit()
    await db.refresh(user)

    club_name: str | None = None
    if user.club_id:
        club = await db.get(Club, user.club_id)
        club_name = club.name if club else None

    result = UserOut.model_validate(user)
    result.club_name = club_name
    return result


# ── Delete user ────────────────────────────────────────────────────────────────

@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(400, "Không thể xóa tài khoản của chính mình")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Không tìm thấy tài khoản")

    await db.delete(user)
    await db.commit()


# ── List clubs (for dropdown when creating club role user) ─────────────────────

@router.get("/clubs/all", response_model=list[dict])
async def list_clubs_for_select(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Club).where(Club.status == "active").order_by(Club.name))
    clubs = result.scalars().all()
    return [{"id": c.id, "name": c.name, "code": c.code} for c in clubs]
