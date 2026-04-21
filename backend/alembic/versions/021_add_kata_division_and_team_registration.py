"""add kata division and team kata registrations

Revision ID: 021
Revises: 020
Create Date: 2026-04-11 00:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "tournament_katas",
        sa.Column("division", sa.String(length=20), nullable=False, server_default="individual"),
    )
    op.drop_constraint("uq_tk_tournament_name", "tournament_katas", type_="unique")
    op.create_unique_constraint(
        "uq_tk_tournament_name_division",
        "tournament_katas",
        ["tournament_id", "name", "division"],
    )

    op.create_table(
        "tournament_team_kata_registrations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("club_id", sa.Integer(), nullable=False),
        sa.Column("kata_id", sa.Integer(), nullable=False),
        sa.Column("registered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["club_id"], ["clubs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["kata_id"], ["tournament_katas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tournament_id", "club_id", "kata_id", name="uq_ttkr_tournament_club_kata"),
    )


def downgrade():
    op.drop_table("tournament_team_kata_registrations")
    op.drop_constraint("uq_tk_tournament_name_division", "tournament_katas", type_="unique")
    op.create_unique_constraint(
        "uq_tk_tournament_name",
        "tournament_katas",
        ["tournament_id", "name"],
    )
    op.drop_column("tournament_katas", "division")
