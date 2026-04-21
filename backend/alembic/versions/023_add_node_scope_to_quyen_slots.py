"""add node scope to quyen slots

Revision ID: 023
Revises: 022
Create Date: 2026-04-11
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quyen_slots",
        sa.Column("node_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_quyen_slots_node_id_tournament_structure_nodes",
        "quyen_slots",
        "tournament_structure_nodes",
        ["node_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.alter_column("quyen_slots", "weight_class_id", existing_type=sa.Integer(), nullable=True)

    op.execute(
        """
        UPDATE quyen_slots AS qs
        SET node_id = twc.node_id
        FROM tournament_weight_classes AS twc
        WHERE qs.weight_class_id = twc.id
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE quyen_slots
        SET node_id = NULL
        """
    )
    op.alter_column("quyen_slots", "weight_class_id", existing_type=sa.Integer(), nullable=False)
    op.drop_constraint(
        "fk_quyen_slots_node_id_tournament_structure_nodes",
        "quyen_slots",
        type_="foreignkey",
    )
    op.drop_column("quyen_slots", "node_id")
