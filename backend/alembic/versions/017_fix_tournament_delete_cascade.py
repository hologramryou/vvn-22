"""fix tournament delete cascade for dynamic structure relations

Revision ID: 017
Revises: 016
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa


revision = '017'
down_revision = '016'
branch_labels = None
depends_on = None


def _replace_foreign_key(table_name: str, column_name: str, referred_table: str, referred_column: str, ondelete: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    fk_name = None
    for fk in inspector.get_foreign_keys(table_name):
        constrained = fk.get("constrained_columns") or []
        if constrained == [column_name] and fk.get("referred_table") == referred_table:
            fk_name = fk.get("name")
            break

    if fk_name:
        op.drop_constraint(fk_name, table_name, type_="foreignkey")

    op.create_foreign_key(
        f"fk_{table_name}_{column_name}",
        table_name,
        referred_table,
        [column_name],
        [referred_column],
        ondelete=ondelete,
    )


def upgrade() -> None:
    _replace_foreign_key(
        "tournament_structure_nodes",
        "parent_id",
        "tournament_structure_nodes",
        "id",
        "CASCADE",
    )
    _replace_foreign_key(
        "student_weight_assignments",
        "node_id",
        "tournament_structure_nodes",
        "id",
        "SET NULL",
    )
    _replace_foreign_key(
        "student_contest_selections",
        "kata_id",
        "tournament_katas",
        "id",
        "SET NULL",
    )
    _replace_foreign_key(
        "bracket_matches",
        "next_match_id",
        "bracket_matches",
        "id",
        "SET NULL",
    )


def downgrade() -> None:
    _replace_foreign_key(
        "bracket_matches",
        "next_match_id",
        "bracket_matches",
        "id",
        "RESTRICT",
    )
    _replace_foreign_key(
        "student_contest_selections",
        "kata_id",
        "tournament_katas",
        "id",
        "RESTRICT",
    )
    _replace_foreign_key(
        "student_weight_assignments",
        "node_id",
        "tournament_structure_nodes",
        "id",
        "RESTRICT",
    )
    _replace_foreign_key(
        "tournament_structure_nodes",
        "parent_id",
        "tournament_structure_nodes",
        "id",
        "RESTRICT",
    )
