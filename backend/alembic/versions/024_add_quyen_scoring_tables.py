"""add quyen scoring tables

Revision ID: 024
Revises: 023
Create Date: 2026-04-12
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quyen_slots", sa.Column("performance_duration_seconds", sa.Integer(), nullable=False, server_default="120"))
    op.add_column("quyen_slots", sa.Column("scoring_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quyen_slots", sa.Column("scored_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quyen_slots", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quyen_slots", sa.Column("official_score", sa.Integer(), nullable=True))
    op.add_column("quyen_slots", sa.Column("total_judge_score", sa.Integer(), nullable=True))
    op.add_column("quyen_slots", sa.Column("chief_judge_score", sa.Integer(), nullable=True))
    op.add_column("quyen_slots", sa.Column("lowest_judge_score", sa.Integer(), nullable=True))

    op.create_table(
        "quyen_judge_scores",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slot_id", sa.Integer(), sa.ForeignKey("quyen_slots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("judge_slot", sa.Integer(), nullable=False),
        sa.Column("judge_name", sa.String(length=150), nullable=False),
        sa.Column("judge_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("slot_id", "judge_slot", name="uq_quyen_judge_scores_slot_judge_slot"),
    )

    op.create_table(
        "quyen_score_audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slot_id", sa.Integer(), sa.ForeignKey("quyen_slots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("judge_slot", sa.Integer(), nullable=True),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(length=30), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("quyen_score_audit_logs")
    op.drop_table("quyen_judge_scores")

    op.drop_column("quyen_slots", "lowest_judge_score")
    op.drop_column("quyen_slots", "chief_judge_score")
    op.drop_column("quyen_slots", "total_judge_score")
    op.drop_column("quyen_slots", "official_score")
    op.drop_column("quyen_slots", "confirmed_at")
    op.drop_column("quyen_slots", "scored_at")
    op.drop_column("quyen_slots", "scoring_started_at")
    op.drop_column("quyen_slots", "performance_duration_seconds")
