"""add bracket judge assignments

Revision ID: 026
Revises: 025
Create Date: 2026-04-12
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bracket_judge_assignments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("match_id", sa.Integer(), sa.ForeignKey("bracket_matches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("judge_slot", sa.Integer(), nullable=False),
        sa.Column("judge_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("match_id", "judge_slot", name="uq_bracket_judge_assignments_match_judge_slot"),
    )


def downgrade() -> None:
    op.drop_table("bracket_judge_assignments")
