from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date

class StudentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id             : int
    code           : str
    full_name      : str
    gender         : Optional[str] = None
    club_id        : Optional[int] = None
    club_name      : Optional[str] = None
    current_belt   : str
    weight_class   : Optional[float] = None
    weight_classes : Optional[List[float]] = None
    compete_events : Optional[List[str]] = None
    quyen_selections: Optional[List[str]] = None
    category_type  : Optional[str] = None
    category_loai  : Optional[str] = None
    status         : str
    weight_verified: bool = False
    # Dynamic tournament registration display fields
    registration_category           : Optional[str]       = None  # Hạng mục = Node level-1 name
    registration_weight_class_name  : Optional[str]       = None  # Hạng cân = leaf node name (sparring only)
    registration_content            : Optional[List[str]] = None  # Nội dung thi đấu = weight class + katas

class StudentListResponse(BaseModel):
    items      : List[StudentListItem]
    total      : int
    page       : int
    page_size  : int
    total_pages: int

class ClubOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id  : int
    name: str

class StudentClubHistory(BaseModel):
    club_name : str
    joined_at : date
    left_at   : Optional[date] = None
    is_current: bool

class StudentDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id             : int
    code           : str
    full_name      : str
    date_of_birth  : Optional[date] = None
    gender         : str
    id_number      : Optional[str] = None
    phone          : Optional[str] = None
    email          : Optional[str] = None
    address        : Optional[str] = None
    avatar_url     : Optional[str] = None
    current_belt   : str
    belt_date      : Optional[date] = None
    join_date      : Optional[date] = None
    weight_class   : Optional[float] = None
    weight_classes : Optional[List[float]] = None
    compete_events : Optional[List[str]] = None
    quyen_selections: Optional[List[str]] = None
    category_type  : Optional[str] = None
    category_loai  : Optional[str] = None
    competition_weight_kg: Optional[float] = None
    notes          : Optional[str] = None
    status         : str
    weight_verified: bool = False
    club_id        : Optional[int] = None
    club_name      : Optional[str] = None
    club_address   : Optional[str] = None
    coach_name     : Optional[str] = None
    coach_phone    : Optional[str] = None
    club_joined_at : Optional[date] = None
    club_history   : List[StudentClubHistory] = []

class ImportResultRow(BaseModel):
    row       : int
    status    : str
    full_name : Optional[str] = None
    error     : Optional[str] = None

class ImportResult(BaseModel):
    total_rows  : int
    success_rows: int
    failed_rows : int
    errors      : List[ImportResultRow] = []

class StudentCardData(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id             : int
    code           : str
    full_name      : str
    avatar_url     : Optional[str] = None
    date_of_birth  : Optional[date] = None
    gender         : str
    weight_class   : Optional[float] = None
    compete_events : Optional[List[str]] = None
    category_type  : Optional[str] = None
    category_loai  : Optional[str] = None
    club_name      : Optional[str] = None
    status         : str
    registration_category          : Optional[str] = None
    registration_weight_class_name : Optional[str] = None
    registration_content           : Optional[List[str]] = None

class StudentCreate(BaseModel):
    full_name      : str
    gender         : str
    club_id        : int
    current_belt   : str = "Tự vệ nhập môn"
    phone          : Optional[str] = None
    email          : Optional[str] = None
    address        : Optional[str] = None
    weight_class   : Optional[float] = None
    weight_classes : Optional[List[float]] = None
    compete_events : Optional[List[str]] = None
    quyen_selections: Optional[List[str]] = None
    category_type  : Optional[str] = None
    category_loai  : Optional[str] = None
    competition_weight_kg: Optional[float] = None  # cân nặng thực tế cho dynamic tournament
    notes          : Optional[str] = None
    # Auto-generated — not required from UI
    date_of_birth  : Optional[date] = None
    id_number      : Optional[str] = None
    join_date      : Optional[date] = None
    province_id    : Optional[int] = None
    belt_date      : Optional[date] = None

class WeightVerifiedUpdate(BaseModel):
    weight_verified: bool

class StudentUpdate(BaseModel):
    full_name      : Optional[str] = None
    gender         : Optional[str] = None
    club_id        : Optional[int] = None
    current_belt   : Optional[str] = None
    date_of_birth  : Optional[date] = None
    phone          : Optional[str] = None
    email          : Optional[str] = None
    address        : Optional[str] = None
    weight_class   : Optional[float] = None
    weight_classes : Optional[List[float]] = None
    compete_events : Optional[List[str]] = None
    quyen_selections: Optional[List[str]] = None
    category_type  : Optional[str] = None
    category_loai  : Optional[str] = None
    competition_weight_kg: Optional[float] = None  # cân nặng thực tế cho dynamic tournament
    notes          : Optional[str] = None
