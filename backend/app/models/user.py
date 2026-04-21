from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True)
    username      = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name     = Column(String(150), nullable=False)
    email         = Column(String(150), unique=True, nullable=False)
    phone         = Column(String(15))
    role          = Column(String(30), nullable=False, default="viewer")  # valid: "admin" | "referee" | "viewer"
    club_id       = Column(Integer, nullable=True)
    tournament_ids = Column(JSONB, nullable=False, default=list)
    is_active     = Column(Boolean, nullable=False, default=True)
    last_login_at = Column(DateTime(timezone=True))
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
