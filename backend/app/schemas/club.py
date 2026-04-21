from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
import re


class ClubCreateIn(BaseModel):
    name: str
    description: Optional[str] = None
    province_id: int
    founded_date: Optional[date] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    logo_url: Optional[str] = None
    tournament_ids: list[int] = Field(default_factory=list)
    coach_name: Optional[str] = Field(None, max_length=150)
    coach_phone: Optional[str] = Field(None, max_length=15)
    caretaker_name: Optional[str] = Field(None, max_length=150)
    caretaker_phone: Optional[str] = Field(None, max_length=15)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError("Tên CLB phải từ 2-100 ký tự")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 500:
            raise ValueError("Mô tả tối đa 500 ký tự")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return None
        v = v.strip()
        if not re.match(r"^(\+84|0)[0-9]{8,12}$", v):
            raise ValueError("Số điện thoại không đúng định dạng Việt Nam")
        return v


class ClubUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    province_id: Optional[int] = None
    founded_date: Optional[date] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    logo_url: Optional[str] = None
    tournament_ids: Optional[list[int]] = None
    coach_name: Optional[str] = Field(None, max_length=150)
    coach_phone: Optional[str] = Field(None, max_length=15)
    caretaker_name: Optional[str] = Field(None, max_length=150)
    caretaker_phone: Optional[str] = Field(None, max_length=15)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError("Tên CLB phải từ 2-100 ký tự")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 500:
            raise ValueError("Mô tả tối đa 500 ký tự")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return None
        v = v.strip()
        if not re.match(r"^(\+84|0)[0-9]{8,12}$", v):
            raise ValueError("Số điện thoại không đúng định dạng Việt Nam")
        return v


class ClubOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    province_id: int
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    founded_date: Optional[date] = None
    status: str
    tournament_ids: list[int] = Field(default_factory=list)
    coach_name: Optional[str] = None
    coach_phone: Optional[str] = None
    caretaker_name: Optional[str] = None
    caretaker_phone: Optional[str] = None
    member_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ClubListResponse(BaseModel):
    items: list[ClubOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class ProvinceOut(BaseModel):
    id: int
    name: str
    code: str

    model_config = {"from_attributes": True}
