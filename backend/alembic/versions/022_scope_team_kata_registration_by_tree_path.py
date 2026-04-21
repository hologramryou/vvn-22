"""scope team kata registration by tree path

Revision ID: 022
Revises: 021
Create Date: 2026-04-11 18:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "tournament_team_kata_registrations",
        sa.Column("node_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_ttkr_node_id",
        "tournament_team_kata_registrations",
        "tournament_structure_nodes",
        ["node_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Old registrations were keyed only by kata_id, so they cannot be mapped losslessly to a tree path.
    op.execute("DELETE FROM tournament_team_kata_registrations")

    op.drop_constraint(
        "uq_ttkr_tournament_club_kata",
        "tournament_team_kata_registrations",
        type_="unique",
    )
    op.alter_column(
        "tournament_team_kata_registrations",
        "node_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.create_unique_constraint(
        "uq_ttkr_tournament_club_node_kata",
        "tournament_team_kata_registrations",
        ["tournament_id", "club_id", "node_id", "kata_id"],
    )


def downgrade():
    op.drop_constraint(
        "uq_ttkr_tournament_club_node_kata",
        "tournament_team_kata_registrations",
        type_="unique",
    )
    op.alter_column(
        "tournament_team_kata_registrations",
        "node_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_unique_constraint(
        "uq_ttkr_tournament_club_kata",
        "tournament_team_kata_registrations",
        ["tournament_id", "club_id", "kata_id"],
    )
    op.drop_constraint("fk_ttkr_node_id", "tournament_team_kata_registrations", type_="foreignkey")
    op.drop_column("tournament_team_kata_registrations", "node_id")
