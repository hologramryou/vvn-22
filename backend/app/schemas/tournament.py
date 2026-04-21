from pydantic import BaseModel, ConfigDict, field_validator, Field
from typing import Optional, Literal, Any
from datetime import datetime


# ── Participant info ───────────────────────────────────────────────────────────

class ParticipantInfo(BaseModel):
    student_id: int
    full_name: str
    gender: str
    weight_class: Optional[float] = None
    model_config = {"from_attributes": True}


# ── Tournament structure ───────────────────────────────────────────────────────

class WeightClassItem(BaseModel):
    id: int
    weight_class_name: str
    gender: str
    total_players: int
    bracket_status: str
    participants: list[ParticipantInfo] = []


class AgeTypeItem(BaseModel):
    code: str
    description: str
    weight_classes: list[WeightClassItem]


class CategoryItem(BaseModel):
    category: str
    age_types: list[AgeTypeItem]


class TournamentStructure(BaseModel):
    tournament_id: int
    tournament_name: str
    tournament_status: str
    categories: list[CategoryItem]


class TournamentListItem(BaseModel):
    id: int
    name: str
    sport_icon: Optional[str] = None
    status: str
    created_at: datetime
    structure_mode: str
    primary_color: Optional[str] = None
    gradient_primary: Optional[str] = None


class TournamentConfig(BaseModel):
    default_round_duration_seconds: int = 180
    default_break_duration_seconds: int = 30
    default_performance_duration_seconds: int = 120
    consensus_window_secs: float = 1.0
    consensus_min_votes: int = 3
    model_config = {"from_attributes": True}


class TournamentConfigUpdate(BaseModel):
    default_round_duration_seconds: Optional[int] = Field(None, ge=30, le=600)
    default_break_duration_seconds: Optional[int] = Field(None, ge=10, le=300)
    default_performance_duration_seconds: Optional[int] = Field(None, ge=30, le=600)
    consensus_window_secs: Optional[float] = Field(None, ge=0.5, le=5.0)
    consensus_min_votes: Optional[int] = Field(None, ge=1, le=5)


class CreateTournamentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sport_icon: Optional[str] = Field(None, max_length=10)
    template_id: Optional[int] = None
    primary_color: Optional[str] = Field(None, max_length=7)
    gradient_primary: Optional[str] = Field(None, max_length=7)


class CreateTournamentResponse(BaseModel):
    id: int
    name: str
    sport_icon: Optional[str] = None
    status: str
    created_at: datetime
    structure_mode: str
    primary_color: Optional[str] = None
    gradient_primary: Optional[str] = None


class UpdateTournamentRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    sport_icon: Optional[str] = Field(None, max_length=10)
    primary_color: Optional[str] = Field(None, max_length=7)
    gradient_primary: Optional[str] = Field(None, max_length=7)


class DeleteTournamentResponse(BaseModel):
    deleted_tournament_id: int


class TournamentTemplateSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    structure_mode: str
    source_tournament_id: Optional[int] = None
    node_count: int
    kata_count: int
    created_at: datetime
    updated_at: datetime


class CreateTournamentTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    source_tournament_id: int
    copy_katas: bool = True


class CreateTournamentTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    structure_mode: str
    source_tournament_id: Optional[int] = None
    node_count: int
    kata_count: int
    created_at: datetime
    updated_at: datetime


# ── Bracket match ──────────────────────────────────────────────────────────────

class BracketMatchOut(BaseModel):
    id: int
    round: int
    match_number: int
    match_code: Optional[str] = None
    schedule_order: Optional[int] = None
    player1_name: Optional[str] = None
    player2_name: Optional[str] = None
    score1: Optional[int] = None
    score2: Optional[int] = None
    winner: Optional[int] = None
    status: str
    is_bye: bool = False
    next_match_id: Optional[int] = None
    model_config = {"from_attributes": True}


class BracketOut(BaseModel):
    weight_class_id: int
    weight_class_name: str
    gender: str
    bracket_status: str
    matches: list[BracketMatchOut]


class BracketExportPathOut(BaseModel):
    node_id: int
    node_path: str
    tree_path: str
    path_segments: list[str]
    weight_class_id: int
    weight_class_name: str
    gender: str
    total_players: int
    bracket_status: str
    players: list[str] = []
    matches: list[BracketMatchOut]


class BracketExportOut(BaseModel):
    tournament_id: int
    tournament_name: str
    tournament_status: str
    scope: Literal["single", "all"]
    total_paths: int
    paths: list[BracketExportPathOut]


# ── Match result input ─────────────────────────────────────────────────────────

class MatchResultIn(BaseModel):
    winner: int   # 1 or 2
    score1: int = 0
    score2: int = 0


# ── Generate all matches output ───────────────────────────────────────────────

class GenerateMatchesOut(BaseModel):
    tournament_id: int
    generated_weight_classes: int
    skipped_weight_classes: int
    total_bracket_matches: int
    total_quyen_slots: int
    bye_matches: int


# ── Generate schedule output ──────────────────────────────────────────────────

class GenerateScheduleOut(BaseModel):
    tournament_id: int
    court_a_count: int
    court_b_count: int
    total_scheduled: int


# ── Quyen slot output ─────────────────────────────────────────────────────────

class QuyenSlotOut(BaseModel):
    id: int
    tournament_id: int
    weight_class_id: Optional[int] = None
    weight_class_name: str
    node_id: Optional[int] = None
    node_path: Optional[str] = None
    representative_type: Literal["student", "club"] = "student"
    player_name: str
    player_club: Optional[str] = None
    club_id: Optional[int] = None
    kata_id: Optional[int] = None
    content_name: str
    court: Optional[str] = None
    schedule_order: Optional[int] = None
    status: str
    performance_duration_seconds: int = 120
    started_at: Optional[datetime] = None
    scoring_started_at: Optional[datetime] = None
    scored_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    official_score: Optional[float] = None
    total_judge_score: Optional[int] = None
    highest_judge_score: Optional[int] = None
    lowest_judge_score: Optional[int] = None
    is_disqualified: bool = False
    assigned_judges_count: int = 0
    ready_judges_count: int = 0
    submitted_judges_count: int = 0
    model_config = {"from_attributes": True}


class QuyenJudgeScoreOut(BaseModel):
    judge_slot: int
    assigned_user_id: Optional[int] = None
    assigned_user_name: Optional[str] = None
    is_ready: bool = False
    ready_at: Optional[datetime] = None
    score: Optional[int] = None
    submitted_at: Optional[datetime] = None


class QuyenRankingItemOut(BaseModel):
    slot_id: int
    rank: int
    player_name: str
    player_club: Optional[str] = None
    official_score: float
    total_judge_score: int
    highest_judge_score: int
    lowest_judge_score: int
    medal: Optional[str] = None


class QuyenRankingGroupOut(BaseModel):
    node_id: Optional[int] = None
    node_path: Optional[str] = None
    content_name: str
    status: Literal["pending", "ready"]
    items: list[QuyenRankingItemOut] = []


class QuyenScoringDetailOut(BaseModel):
    slot: QuyenSlotOut
    tournament_name: str
    tree_path: Optional[str] = None
    judges: list[QuyenJudgeScoreOut]
    ranking_group: Optional[QuyenRankingGroupOut] = None
    audit_count: int = 0


class QuyenJudgePanelOut(BaseModel):
    slot: QuyenSlotOut
    tournament_name: str
    tree_path: Optional[str] = None
    judge: QuyenJudgeScoreOut


class QuyenDisplayJudgeOut(BaseModel):
    judge_slot: int
    assigned_user_name: Optional[str] = None
    is_ready: bool = False
    has_submitted: bool = False
    score: Optional[int] = None


class QuyenDisplayOut(BaseModel):
    slot: QuyenSlotOut
    tournament_name: str
    tree_path: Optional[str] = None
    judges: list[QuyenDisplayJudgeOut]


# ── Extended bracket match for schedule ───────────────────────────────────────

class ScheduleBracketMatchOut(BaseModel):
    id: int
    weight_class_id: int
    weight_class_name: str
    node_path: Optional[str] = None
    gender: str = ""
    category: str = ""
    age_type_code: str = ""
    match_code: Optional[str] = None
    round: int
    round_label: str
    match_number: int
    player1_name: Optional[str] = None
    player2_name: Optional[str] = None
    player1_club: Optional[str] = None
    player2_club: Optional[str] = None
    score1: Optional[int] = None
    score2: Optional[int] = None
    winner: Optional[int] = None
    winner_name: Optional[str] = None
    court: Optional[str] = None
    schedule_order: Optional[int] = None
    status: str
    is_bye: bool = False
    next_match_id: Optional[int] = None
    next_match_code: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    assigned_judges_count: int = 0
    ready_judges_count: int = 0
    model_config = {"from_attributes": True}


# ── Schedule summary ──────────────────────────────────────────────────────────

class ScheduleSummary(BaseModel):
    quyen_count: int
    doi_khang_count: int
    ready_count: int
    ongoing_count: int
    scoring_count: int = 0
    scored_count: int = 0
    completed_count: int
    pending_count: int


# ── Full schedule output ──────────────────────────────────────────────────────

class TournamentScheduleOut(BaseModel):
    tournament_id: int
    tournament_name: str
    tournament_status: str
    summary: ScheduleSummary
    quyen_slots: list[QuyenSlotOut]
    bracket_matches: list[ScheduleBracketMatchOut]


# ── Update schedule (drag & drop reorder + court change) ─────────────────────

class ScheduleItemIn(BaseModel):
    id: int
    schedule_order: int
    court: Optional[str] = None

    @field_validator("court")
    @classmethod
    def validate_court(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("A", "B"):
            raise ValueError("court phải là 'A' hoặc 'B'")
        return v


class UpdateScheduleIn(BaseModel):
    bracket_matches: list[ScheduleItemIn] = []
    quyen_slots: list[ScheduleItemIn] = []


class UpdateScheduleOut(BaseModel):
    updated_bracket: int
    updated_quyen: int


# ── Medal tally ───────────────────────────────────────────────────────────────

class WeightClassMedal(BaseModel):
    weight_class_id: int
    weight_class_name: str
    gender: str
    tree_path: str = ""
    status: str = "completed"  # "completed" | "in_progress"
    gold: Optional[str] = None
    gold_club: Optional[str] = None
    silver: Optional[str] = None
    silver_club: Optional[str] = None
    bronze: list[str] = []
    bronze_clubs: list[str] = []


class QuyenMedalGroup(BaseModel):
    node_id: Optional[int] = None
    node_path: Optional[str] = None
    content_name: str
    kata_id: Optional[int] = None
    status: str = "completed"  # "completed" | "in_progress"
    gold: Optional[str] = None
    gold_club: Optional[str] = None
    gold_club_id: Optional[int] = None
    silver: Optional[str] = None
    silver_club: Optional[str] = None
    silver_club_id: Optional[int] = None
    bronze: list[str] = []
    bronze_clubs: list[str] = []
    bronze_club_ids: list[Optional[int]] = []


class MedalTallyOut(BaseModel):
    tournament_id: int
    tournament_name: str
    weight_class_medals: list[WeightClassMedal]
    quyen_medals: list[QuyenMedalGroup] = []


class ClubMedalRank(BaseModel):
    rank: int
    club_id: int
    club_name: str
    gold: int
    silver: int
    bronze: int
    total: int
    athlete_count: int


class ClubMedalTallyOut(BaseModel):
    tournament_id: int
    tournament_name: str
    rankings: list[ClubMedalRank]


# ── Match detail (for scoring panel) ──────────────────────────────────────────

class MatchJudgeAssignmentOut(BaseModel):
    judge_slot: int
    assigned_user_id: Optional[int] = None
    assigned_user_name: Optional[str] = None
    is_ready: bool = False
    ready_at: Optional[datetime] = None
    score1: Optional[int] = None
    score2: Optional[int] = None
    has_submitted: bool = False


class MatchJudgePanelOut(BaseModel):
    match_id: int
    tournament_name: str
    player1_name: str | None
    player2_name: str | None
    weight_class_name: str
    status: str
    started_at: Optional[datetime] = None
    judge: MatchJudgeAssignmentOut | None = None


class MatchDetailOut(BaseModel):
    id: int
    tournament_id: int
    match_code: str | None
    round: int
    match_number: int
    court: str | None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    player1_name: str | None
    player2_name: str | None
    player1_club: str | None = None
    player2_club: str | None = None
    player1_avatar_url: str | None = None
    player2_avatar_url: str | None = None
    score1: int | None
    score2: int | None
    winner: int | None
    status: str
    is_bye: bool
    weight_class_name: str
    category: str
    age_type_code: str
    gender: str
    current_hiep: int = 1
    match_phase: str = "not_started"
    round_duration_seconds: int = 180
    break_duration_seconds: int = 30
    assigned_judges_count: int = 0
    ready_judges_count: int = 0
    submitted_judges_count: int = 0
    judges: list[MatchJudgeAssignmentOut] = []
    timer_active: bool = False
    model_config = ConfigDict(from_attributes=True)


class MatchJudgeAssignmentIn(BaseModel):
    judge_slot: int = Field(..., ge=1, le=5)
    user_id: int = Field(..., gt=0)


class SetMatchHiepIn(BaseModel):
    hiep: int = Field(..., ge=1)


class EndMatchRoundIn(BaseModel):
    score1: int
    score2: int


class DrawResultIn(BaseModel):
    winner: int = Field(..., ge=1, le=2)


class MatchConfigIn(BaseModel):
    round_duration_seconds: int | None = Field(None, ge=1)
    break_duration_seconds: int | None = Field(None, ge=1)


class LiveScoreIn(BaseModel):
    score1: int = Field(..., ge=0)
    score2: int = Field(..., ge=0)
    yellow_cards1: int | None = None
    yellow_cards2: int | None = None


class ScoreLogIn(BaseModel):
    action: str = Field(..., max_length=50)
    side: int | None = Field(None, ge=1, le=2)
    delta: int | None = None
    score1_after: int | None = None
    score2_after: int | None = None
    description: str | None = Field(None, max_length=255)


class ScoreLogOut(BaseModel):
    id: int
    match_id: int
    actor_type: str
    actor_name: str | None
    action: str
    side: int | None
    delta: int | None
    score1_after: int | None
    score2_after: int | None
    match_phase: str | None
    description: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ConsensusTurnVoteOut(BaseModel):
    id: int
    judge_slot: int
    judge_user_id: int | None
    player_side: str
    score_type: str
    press_order: int
    model_config = ConfigDict(from_attributes=True)


class ConsensusTurnOut(BaseModel):
    id: int
    match_id: int
    match_phase: str | None
    is_consensus: bool
    result_side: str | None
    result_type: str | None
    result_delta: int | None
    score1_after: int | None
    score2_after: int | None
    agreeing_slots: str | None
    created_at: datetime
    votes: list[ConsensusTurnVoteOut] = []
    model_config = ConfigDict(from_attributes=True)


class UpdateMatchJudgeSetupIn(BaseModel):
    judges: list[MatchJudgeAssignmentIn]


class MatchJudgeReadyIn(BaseModel):
    ready: bool = True


class MatchJudgeScoreIn(BaseModel):
    score1: int = Field(..., ge=0)
    score2: int = Field(..., ge=0)


class RefereeCurrentAssignmentOut(BaseModel):
    kind: Literal["match", "quyen"]
    entity_id: int
    judge_slot: int
    route: str
    status: str
    title: str


class QuyenJudgeAssignmentIn(BaseModel):
    judge_slot: int = Field(..., ge=1, le=5)
    user_id: int = Field(..., gt=0)


class UpdateQuyenJudgeSetupIn(BaseModel):
    judges: list[QuyenJudgeAssignmentIn]
    performance_duration_seconds: int = Field(..., ge=10, le=600)


class QuyenJudgeReadyIn(BaseModel):
    ready: bool = True


class QuyenJudgeScoreIn(BaseModel):
    score: int = Field(..., ge=80, le=100)
