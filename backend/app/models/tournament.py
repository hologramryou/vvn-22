from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, Numeric, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class TournamentStructureNode(Base):
    __tablename__ = "tournament_structure_nodes"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    parent_id     = Column(Integer, ForeignKey("tournament_structure_nodes.id", ondelete="CASCADE"), nullable=True)
    level         = Column(Integer, nullable=False)      # 0=Gender 1=Category 2=Group 3=WeightClass
    node_type     = Column(String(20), nullable=False, server_default="group")  # 'group' | 'weight_class'
    name          = Column(String(100), nullable=False)  # display label only — NOT a machine key
    node_code     = Column(String(50), nullable=True)    # machine-readable code (e.g. "M","F","1A","45")
    rule_json     = Column(JSONB, nullable=True)         # eligibility rules: min_age, max_age, allowed_belts, max_weight_kg
    sort_order    = Column(Integer, nullable=False)      # 1-based sequential within parent
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("tournament_id", "parent_id", "name", name="uq_tsn_tournament_parent_name"),
    )


class TournamentKata(Base):
    __tablename__ = "tournament_katas"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    name          = Column(String(100), nullable=False)
    description   = Column(String(500), nullable=True)
    division      = Column(String(20), nullable=False, server_default="individual")
    sort_order    = Column(Integer, nullable=False)
    team_size     = Column(Integer, nullable=False, server_default="2")
    min_team_size = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("tournament_id", "name", "division", name="uq_tk_tournament_name_division"),
    )


class StudentWeightAssignment(Base):
    __tablename__ = "student_weight_assignments"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    student_id    = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    node_id       = Column(Integer, ForeignKey("tournament_structure_nodes.id", ondelete="SET NULL"), nullable=True)  # nullable for kata-only registrations
    registered_at = Column(DateTime(timezone=True), server_default=func.now())
    reason        = Column(String(20), nullable=False, server_default="registered")  # "registered" | "moved"

    __table_args__ = (
        UniqueConstraint("student_id", "tournament_id", name="uq_swa_student_tournament"),
    )


class StudentContestSelection(Base):
    __tablename__ = "student_contest_selections"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    student_id    = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    contest_type  = Column(String(20), nullable=False)   # "sparring" | "kata"
    kata_id       = Column(Integer, ForeignKey("tournament_katas.id", ondelete="SET NULL"), nullable=True)  # null if sparring

    __table_args__ = (
        UniqueConstraint("student_id", "tournament_id", "contest_type", "kata_id",
                         name="uq_scs_student_tournament_type_kata"),
    )


class TournamentTeamKataMember(Base):
    __tablename__ = "tournament_team_kata_members"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    club_id       = Column(Integer, ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False)
    node_id       = Column(Integer, ForeignKey("tournament_structure_nodes.id", ondelete="CASCADE"), nullable=False)
    kata_id       = Column(Integer, ForeignKey("tournament_katas.id", ondelete="CASCADE"), nullable=False)
    student_id    = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("tournament_id", "club_id", "node_id", "kata_id", "student_id", name="uq_ttkm_tournament_club_node_kata_student"),
    )


class TournamentTeamKataRegistration(Base):
    __tablename__ = "tournament_team_kata_registrations"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    club_id       = Column(Integer, ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False)
    node_id       = Column(Integer, ForeignKey("tournament_structure_nodes.id", ondelete="CASCADE"), nullable=False)
    kata_id       = Column(Integer, ForeignKey("tournament_katas.id", ondelete="CASCADE"), nullable=False)
    registered_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("tournament_id", "club_id", "node_id", "kata_id", name="uq_ttkr_tournament_club_node_kata"),
    )


class Tournament(Base):
    __tablename__ = "tournaments"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    name           = Column(String(200), nullable=False)
    sport_icon     = Column(String(10), nullable=True)
    status         = Column(String(20), nullable=False, server_default="DRAFT")
    # DRAFT | PUBLISHED | ONGOING | COMPLETED
    structure_mode = Column(String(20), nullable=False, server_default="legacy")
    # "legacy": use TournamentWeightClass + TournamentParticipant
    # "dynamic": use TournamentStructureNode + StudentWeightAssignment + StudentContestSelection
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    # ── Tournament-level config defaults ──────────────────────────────────────
    default_round_duration_seconds       = Column(Integer, nullable=False, server_default="180")
    default_break_duration_seconds       = Column(Integer, nullable=False, server_default="30")
    default_performance_duration_seconds = Column(Integer, nullable=False, server_default="120")
    consensus_window_secs                = Column(Numeric(4, 2), nullable=False, server_default="1.0")
    consensus_min_votes                  = Column(Integer, nullable=False, server_default="3")
    primary_color                        = Column(String(7), nullable=True)
    gradient_primary                     = Column(String(7), nullable=True)


class TournamentStructureTemplate(Base):
    __tablename__ = "tournament_structure_templates"
    id                 = Column(Integer, primary_key=True, autoincrement=True)
    name               = Column(String(200), nullable=False, unique=True)
    description        = Column(String(500), nullable=True)
    source_tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="SET NULL"), nullable=True)
    structure_mode     = Column(String(20), nullable=False, server_default="dynamic")
    template_json      = Column(JSONB, nullable=False)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at         = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TournamentWeightClass(Base):
    __tablename__ = "tournament_weight_classes"
    id                = Column(Integer, primary_key=True, autoincrement=True)
    tournament_id     = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    node_id           = Column(Integer, ForeignKey("tournament_structure_nodes.id", ondelete="SET NULL"), nullable=True)
    category          = Column(String(20), nullable=False)   # phong_trao | pho_thong
    age_type_code     = Column(String(5),  nullable=False)   # 1A,1B,2,3,4,5
    weight_class_name = Column(String(20), nullable=False)
    gender            = Column(String(1),  nullable=False, server_default="M")  # M | F
    total_players     = Column(Integer, nullable=False, server_default="0")
    bracket_status    = Column(String(20), nullable=False, server_default="NOT_GENERATED")
    players           = Column(ARRAY(String), nullable=True)  # cache of participant names


class TournamentParticipant(Base):
    __tablename__ = "tournament_participants"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    weight_class_id = Column(Integer, ForeignKey("tournament_weight_classes.id", ondelete="CASCADE"), nullable=False)
    student_id      = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    registered_at   = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("weight_class_id", "student_id", name="uq_tp_wc_student"),
    )


class BracketMatch(Base):
    __tablename__ = "bracket_matches"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    weight_class_id = Column(Integer, ForeignKey("tournament_weight_classes.id", ondelete="CASCADE"), nullable=False)
    round           = Column(Integer, nullable=False)
    match_number    = Column(Integer, nullable=False)
    match_code      = Column(String(50), nullable=True)           # "Nam_PhongTrao_1A_15kg_A1"
    court           = Column(String(1), nullable=True)            # "A" | "B"
    schedule_order  = Column(Integer, nullable=True)
    player1_name        = Column(String(150), nullable=True)      # None = TBD
    player2_name        = Column(String(150), nullable=True)      # None = TBD | "BYE"
    player1_avatar_url  = Column(Text, nullable=True)
    player2_avatar_url  = Column(Text, nullable=True)
    player1_club        = Column(String(200), nullable=True)
    player2_club        = Column(String(200), nullable=True)
    score1          = Column(Integer, nullable=True)
    score2          = Column(Integer, nullable=True)
    winner          = Column(Integer, nullable=True)   # 1 or 2
    status          = Column(String(20), nullable=False, server_default="pending")
    # pending | ready | checking | ongoing | completed
    is_bye          = Column(Boolean, nullable=False, server_default="false")
    next_match_id   = Column(Integer, ForeignKey("bracket_matches.id", ondelete="SET NULL"), nullable=True)
    current_hiep    = Column(Integer, nullable=False, server_default="1")
    match_phase     = Column(String(20), nullable=False, server_default="not_started")
    # not_started | round_1 | break | round_2 | extra_time | draw_pending | finished | confirmed
    round_duration_seconds = Column(Integer, nullable=False, server_default="180")
    break_duration_seconds = Column(Integer, nullable=False, server_default="30")
    started_at      = Column(DateTime(timezone=True), nullable=True)
    finished_at     = Column(DateTime(timezone=True), nullable=True)
    timer_active    = Column(Boolean, nullable=False, server_default="false")


class BracketJudgeAssignment(Base):
    __tablename__ = "bracket_judge_assignments"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    match_id         = Column(Integer, ForeignKey("bracket_matches.id", ondelete="CASCADE"), nullable=False)
    judge_slot       = Column(Integer, nullable=False)
    judge_user_id    = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ready_at         = Column(DateTime(timezone=True), nullable=True)
    score1           = Column(Integer, nullable=True)   # judge's tally for red/player1
    score2           = Column(Integer, nullable=True)   # judge's tally for blue/player2
    submitted_at     = Column(DateTime(timezone=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("match_id", "judge_slot", name="uq_bracket_judge_assignments_match_judge_slot"),
    )


class MatchScoreLog(Base):
    __tablename__ = "match_score_logs"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    match_id        = Column(Integer, ForeignKey("bracket_matches.id", ondelete="CASCADE"), nullable=False)
    actor_type      = Column(String(20), nullable=False)      # 'judge' | 'admin' | 'system'
    actor_name      = Column(String(100), nullable=True)
    action          = Column(String(50), nullable=False)       # 'score_add', 'score_subtract', 'yellow_card', 'phase_change', 'knockout'
    side            = Column(Integer, nullable=True)           # 1 (red) | 2 (blue) | NULL (system)
    delta           = Column(Integer, nullable=True)           # +1, +2, -1, -2, NULL
    score1_after    = Column(Integer, nullable=True)
    score2_after    = Column(Integer, nullable=True)
    match_phase     = Column(String(20), nullable=True)
    description     = Column(String(255), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class BracketScoreEvent(Base):
    __tablename__ = "bracket_score_events"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    match_id        = Column(Integer, ForeignKey("bracket_matches.id", ondelete="CASCADE"), nullable=False)
    judge_slot      = Column(Integer, nullable=False)
    judge_user_id   = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    player_side     = Column(String(4), nullable=False)   # 'RED' | 'BLUE'
    score_type      = Column(String(3), nullable=False)   # '+1' | '+2' | '-1'
    sequence_index  = Column(Integer, nullable=False)
    window_key      = Column(String(60), nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class MatchConsensusTurn(Base):
    __tablename__ = "match_consensus_turns"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    match_id      = Column(Integer, ForeignKey("bracket_matches.id", ondelete="CASCADE"), nullable=False)
    match_phase   = Column(String(20), nullable=True)
    is_consensus  = Column(Boolean, nullable=False)
    result_side   = Column(String(4), nullable=True)    # 'RED' | 'BLUE' | NULL
    result_type   = Column(String(3), nullable=True)    # '+1' | '+2' | '-1' | NULL
    result_delta  = Column(Integer, nullable=True)
    score1_after  = Column(Integer, nullable=True)
    score2_after  = Column(Integer, nullable=True)
    agreeing_slots = Column(String(50), nullable=True)   # "1,2,3" — các GĐ đồng thuận
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    votes         = relationship("MatchConsensusVote", back_populates="turn", cascade="all, delete-orphan")


class MatchConsensusVote(Base):
    __tablename__ = "match_consensus_votes"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    turn_id       = Column(Integer, ForeignKey("match_consensus_turns.id", ondelete="CASCADE"), nullable=False)
    judge_slot    = Column(Integer, nullable=False)
    judge_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    player_side   = Column(String(4), nullable=False)   # 'RED' | 'BLUE'
    score_type    = Column(String(3), nullable=False)   # '+1' | '+2' | '-1'
    press_order   = Column(Integer, nullable=False)
    turn          = relationship("MatchConsensusTurn", back_populates="votes")


class QuyenSlot(Base):
    __tablename__ = "quyen_slots"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    tournament_id   = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    weight_class_id = Column(Integer, ForeignKey("tournament_weight_classes.id", ondelete="CASCADE"), nullable=True)
    node_id         = Column(Integer, ForeignKey("tournament_structure_nodes.id", ondelete="CASCADE"), nullable=True)
    player_name     = Column(String(150), nullable=False)
    content_name    = Column(String(100), nullable=False)         # label của age_type
    court           = Column(String(1), nullable=True)            # "A" | "B"
    schedule_order  = Column(Integer, nullable=True)
    status          = Column(String(20), nullable=False, server_default="pending")
    # pending | ready | ongoing | scoring | completed
    performance_duration_seconds = Column(Integer, nullable=False, server_default="120")
    started_at      = Column(DateTime(timezone=True), nullable=True)
    scoring_started_at = Column(DateTime(timezone=True), nullable=True)
    scored_at       = Column(DateTime(timezone=True), nullable=True)
    finished_at     = Column(DateTime(timezone=True), nullable=True)
    confirmed_at    = Column(DateTime(timezone=True), nullable=True)
    official_score  = Column(Float, nullable=True)
    total_judge_score = Column(Integer, nullable=True)
    highest_judge_score = Column(Integer, nullable=True)
    lowest_judge_score = Column(Integer, nullable=True)
    is_disqualified = Column(Boolean, nullable=False, server_default="false")


class QuyenJudgeScore(Base):
    __tablename__ = "quyen_judge_scores"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    slot_id         = Column(Integer, ForeignKey("quyen_slots.id", ondelete="CASCADE"), nullable=False)
    judge_slot      = Column(Integer, nullable=False)
    judge_name      = Column(String(150), nullable=False)
    judge_user_id   = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ready_at        = Column(DateTime(timezone=True), nullable=True)
    score           = Column(Integer, nullable=True)
    submitted_at    = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("slot_id", "judge_slot", name="uq_quyen_judge_scores_slot_judge_slot"),
    )


class QuyenScoreAuditLog(Base):
    __tablename__ = "quyen_score_audit_logs"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    slot_id         = Column(Integer, ForeignKey("quyen_slots.id", ondelete="CASCADE"), nullable=False)
    judge_slot      = Column(Integer, nullable=True)
    actor_user_id   = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action          = Column(String(30), nullable=False)
    note            = Column(String(500), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
