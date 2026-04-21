from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, DateTime, Text, func
from sqlalchemy.dialects.postgresql import ARRAY
from app.core.database import Base

class Student(Base):
    __tablename__ = "students"
    id             = Column(Integer, primary_key=True)
    code           = Column(String(20), unique=True, nullable=False)
    full_name      = Column(String(150), nullable=False)
    date_of_birth  = Column(Date, nullable=False)
    gender         = Column(String(1), nullable=False)
    id_number      = Column(String(12), unique=True, nullable=False)
    phone          = Column(String(15))
    email          = Column(String(150))
    address        = Column(Text)
    avatar_url     = Column(Text)
    current_belt   = Column(String(50), nullable=False, default="Lam đai nhập môn")
    belt_date      = Column(Date)
    join_date      = Column(Date, nullable=False)
    weight_class       = Column(Numeric(5, 2))        # legacy single value
    weight_classes     = Column(ARRAY(Numeric(5, 2))) # legacy multi weight classes
    compete_events     = Column(ARRAY(String))
    quyen_selections   = Column(ARRAY(String))        # legacy: specific form names
    category_type      = Column(String(20))           # legacy: 'phong_trao' | 'pho_thong'
    category_loai      = Column(String(5))            # legacy: '1A','1B','2','3','4','5'
    competition_weight_kg = Column(Numeric(5, 2))     # actual weigh-in weight for dynamic node matching
    status         = Column(String(20), nullable=False, default="active")
    weight_verified = Column(Boolean, nullable=False, default=False)
    notes          = Column(Text)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class StudentClub(Base):
    __tablename__ = "student_clubs"
    id         = Column(Integer, primary_key=True)
    student_id = Column(Integer, nullable=False)
    club_id    = Column(Integer, nullable=False)
    joined_at  = Column(Date, nullable=False)
    left_at    = Column(Date)
    is_current = Column(Boolean, nullable=False, default=True)
    notes      = Column(Text)
