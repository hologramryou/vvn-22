from sqlalchemy import Column, Integer, SmallInteger, String, Text, Date, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base

class Province(Base):
    __tablename__ = "provinces"
    id   = Column(SmallInteger, primary_key=True)
    name = Column(String(100), nullable=False)
    code = Column(String(3), unique=True, nullable=False)

class Club(Base):
    __tablename__ = "clubs"
    id           = Column(Integer, primary_key=True)
    code         = Column(String(20), unique=True, nullable=False)
    name         = Column(String(200), nullable=False)
    province_id  = Column(SmallInteger, nullable=False)
    address      = Column(String)
    phone        = Column(String(15))
    email        = Column(String(150))
    description  = Column(Text, nullable=True)
    logo_url     = Column(String(500), nullable=True)
    founded_date = Column(Date)
    status       = Column(String(20), nullable=False, default="active")
    tournament_ids   = Column(JSONB, nullable=False, default=list)
    coach_name       = Column(String(150), nullable=True)
    coach_phone      = Column(String(15), nullable=True)
    caretaker_name   = Column(String(150), nullable=True)
    caretaker_phone  = Column(String(15), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
