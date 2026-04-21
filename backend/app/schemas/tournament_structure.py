"""Pydantic v2 schemas for Dynamic Tournament Structure feature."""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Literal, Any

from pydantic import BaseModel, Field


# ── Node schemas ──────────────────────────────────────────────────────────────

class NodeResponse(BaseModel):
    id:            int
    tournament_id: int
    parent_id:     Optional[int]
    level:         int
    node_type:     Literal["group", "weight_class"]
    name:          str
    node_code:     Optional[str] = None   # machine-readable code, e.g. "M","F","1A","45"
    rule_json:     Optional[Any] = None   # eligibility rules: min_age, max_age, allowed_belts, max_weight_kg
    sort_order:    int
    student_count: int
    created_at:    datetime
    updated_at:    datetime

    model_config = {"from_attributes": True}


class NodeTreeResponse(NodeResponse):
    """NodeResponse with recursive children list (only used in tree format)."""
    children: List[NodeTreeResponse] = []


# Pydantic v2 requires update_forward_refs call style via model_rebuild
NodeTreeResponse.model_rebuild()


class GetNodesResponse(BaseModel):
    tournament_id:      int
    tournament_name:    str
    tournament_status:  str
    nodes:              list  # NodeTreeResponse[] or NodeResponse[] depending on format
    stats: dict  # total_nodes, total_weight_classes, total_students


class CreateNodeRequest(BaseModel):
    parent_id: Optional[int] = None
    name:      str = Field(..., max_length=100)
    node_type: Optional[Literal["group", "weight_class"]] = None
    node_code: Optional[str] = Field(None, max_length=50,
        description="Machine-readable code (e.g. 'M','F','1A','45'). Không parse name.")
    rule_json: Optional[Any] = Field(None,
        description="Eligibility rules: {min_age, max_age, allowed_belts, max_weight_kg, ...}")


class UpdateNodeRequest(BaseModel):
    name: str = Field(..., max_length=100)


class DeleteNodeRequest(BaseModel):
    move_to_node_id: Optional[int] = None


class DeleteNodeResponse(BaseModel):
    deleted_node_id: int
    deleted_count:   int
    moved_students:  int


class ReorderNodeItem(BaseModel):
    node_id:    int
    sort_order: int


class ReorderNodesRequest(BaseModel):
    parent_id: Optional[int] = None
    nodes:     List[ReorderNodeItem]


class ReorderNodesResponse(BaseModel):
    updated_count: int
    nodes:         List[NodeResponse]


class CopyStructureRequest(BaseModel):
    source_tournament_id: int
    copy_katas:           bool = True


class CopyStructureResponse(BaseModel):
    copied_nodes: int
    copied_katas: int
    tree:         List[NodeTreeResponse]


# ── Node students schemas ─────────────────────────────────────────────────────

class StudentInNodeItem(BaseModel):
    student_id:         int
    student_name:       str
    assigned_node_id:   int
    assigned_node_name: str
    contest_types:      List["ContestTypeItem"]


class NodeStudentsResponse(BaseModel):
    node_id:   int
    node_path: str
    students:  List[StudentInNodeItem]
    total:     int


# ── Kata schemas ──────────────────────────────────────────────────────────────

class KataResponse(BaseModel):
    id:            int
    tournament_id: int
    division:      Literal["individual", "team"]
    name:          str
    description:   Optional[str]
    sort_order:    int
    usage_count:   int
    team_size:     int = 2
    min_team_size: Optional[int] = None

    model_config = {"from_attributes": True}


class ListKatasResponse(BaseModel):
    tournament_id: int
    katas:         List[KataResponse]
    total:         int


class CreateKataRequest(BaseModel):
    division:     Literal["individual", "team"] = "individual"
    name:         str = Field(..., max_length=100)
    description:  Optional[str] = Field(None, max_length=500)
    team_size:    int = Field(2, ge=2)
    min_team_size: Optional[int] = Field(None, ge=2)


class UpdateKataRequest(BaseModel):
    division:     Optional[Literal["individual", "team"]] = None
    name:         Optional[str] = Field(None, max_length=100)
    description:  Optional[str] = Field(None, max_length=500)
    team_size:    Optional[int] = Field(None, ge=2)
    min_team_size: Optional[int] = Field(None, ge=2)


class ReorderKataItem(BaseModel):
    kata_id:    int
    sort_order: int


class ReorderKatasRequest(BaseModel):
    katas: List[ReorderKataItem]


class ReorderKatasResponse(BaseModel):
    updated_count: int
    katas:         List[KataResponse]


class DeleteKataResponse(BaseModel):
    deleted_kata_id: int
    kata_name:       str


class TeamKataRegistrationItem(BaseModel):
    node_id: int
    node_path: str
    kata_id: int
    kata_name: str


class TeamKataRegistrationResponse(BaseModel):
    tournament_id: int
    club_id: int
    registrations: List[TeamKataRegistrationItem]


class TeamKataRegistrationSelection(BaseModel):
    node_id: int
    kata_id: int


class UpdateTeamKataRegistrationRequest(BaseModel):
    items: List[TeamKataRegistrationSelection] = Field(default_factory=list)


class TeamKataMemberItem(BaseModel):
    student_id:   int
    student_name: str
    club_name:    str


class TeamKataMembersResponse(BaseModel):
    tournament_id: int
    club_id:       int
    node_id:       int
    kata_id:       int
    team_size:     int
    members:       List[TeamKataMemberItem]


class UpdateTeamKataMembersRequest(BaseModel):
    student_ids: List[int] = Field(default_factory=list)


# ── Contest type / registration schemas ──────────────────────────────────────

class ContestTypeItem(BaseModel):
    type:      Literal["sparring", "kata"]
    kata_id:   Optional[int] = None
    kata_name: Optional[str] = None


class RegisterParticipantRequest(BaseModel):
    node_id: int  # Required: parent of weight_class (classification node)
    sparring: bool
    sparring_weight_id: Optional[int] = None  # Required if sparring=true (weight_class leaf)
    kata: bool
    kata_ids: List[int] = Field(default_factory=list)  # Required if kata=true (min_length=1)


class UpdateContestTypesRequest(BaseModel):
    contest_types: List[ContestTypeItem] = Field(..., min_length=1)


class ReassignNodeRequest(BaseModel):
    new_node_id: int


class StudentRegistrationResponse(BaseModel):
    student_id:    int
    tournament_id: int
    node_id:       int
    classification_node_id: Optional[int] = None
    sparring_weight_id: Optional[int] = None
    node_path:     str
    registered_at: datetime
    contest_types: List[ContestTypeItem]


# ── Eligible nodes schemas ────────────────────────────────────────────────────

class EligibleNodeItem(BaseModel):
    node_id:           int
    path:              str
    node_code:         Optional[str]
    reason:            str   # "recommended" | "override_allowed"
    eligible:          bool
    ineligible_reason: Optional[str] = None


class EligibleNodesResponse(BaseModel):
    tournament_id:      int
    student_id:         int
    recommended_node_id: Optional[int]
    recommended_path:   Optional[str]
    candidate_nodes:    List[EligibleNodeItem]
    warnings:           List[str] = []


# ── Atomic register-student schemas ──────────────────────────────────────────

class StudentCreateInline(BaseModel):
    """Student fields for atomic create+register."""
    full_name      : str
    gender         : str
    club_id        : int
    current_belt   : str = "Tự vệ nhập môn"
    phone          : Optional[str] = None
    email          : Optional[str] = None
    address        : Optional[str] = None
    date_of_birth  : Optional[Any] = None
    id_number      : Optional[str] = None
    join_date      : Optional[Any] = None
    belt_date      : Optional[Any] = None
    competition_weight_kg: Optional[float] = None
    notes          : Optional[str] = None


class RegisterStudentRequest(BaseModel):
    """Atomic: tạo student mới + đăng ký vào dynamic tournament trong 1 transaction."""
    student:        StudentCreateInline
    node_id:        int
    contest_types:  List[ContestTypeItem] = Field(..., min_length=1)
    override_reason: Optional[str] = None  # bắt buộc khi đăng ký ngoài node recommended


class RegisterStudentResponse(BaseModel):
    student_id:   int
    student_code: str
    node_path:    str
    registration: StudentRegistrationResponse


# ── Bracket tree schemas ──────────────────────────────────────────────────────

class BracketLeafParticipant(BaseModel):
    student_id: int
    full_name: str


class BracketLeafInfo(BaseModel):
    weight_class_id: int
    bracket_status: str    # NOT_GENERATED | GENERATING | GENERATED
    total_players: int
    players: list[str]
    participants: list[BracketLeafParticipant] = []


class BracketNodeItem(BaseModel):
    id: int
    name: str
    node_type: Literal["group", "weight_class"]
    sort_order: int
    leaf_info: Optional[BracketLeafInfo] = None  # populated on weight_class nodes only
    children: list["BracketNodeItem"] = []


BracketNodeItem.model_rebuild()


class BracketTreeResponse(BaseModel):
    tournament_id: int
    tournament_name: str
    tournament_status: str
    nodes: list[BracketNodeItem]
