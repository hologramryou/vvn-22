"""refine quyen judge flow

Revision ID: 025
Revises: 024
Create Date: 2026-04-12
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("quyen_slots", "status", server_default="pending")
    op.alter_column(
        "quyen_slots",
        "official_score",
        existing_type=sa.Integer(),
        type_=sa.Float(),
        postgresql_using="official_score::double precision",
        existing_nullable=True,
    )
    op.alter_column("quyen_slots", "chief_judge_score", new_column_name="highest_judge_score")
    op.add_column("quyen_judge_scores", sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("quyen_judge_scores", "ready_at")
    op.alter_column("quyen_slots", "highest_judge_score", new_column_name="chief_judge_score")
    op.alter_column(
        "quyen_slots",
        "official_score",
        existing_type=sa.Float(),
        type_=sa.Integer(),
        postgresql_using="round(official_score)::integer",
        existing_nullable=True,
    )
    op.alter_column("quyen_slots", "status", server_default="ready")
