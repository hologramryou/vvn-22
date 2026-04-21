"""add structure_mode to tournaments, node_code+rule_json to nodes, competition_weight_kg to students

Revision ID: 010
Revises: 009
Create Date: 2026-04-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # tournaments: distinguish legacy vs dynamic mode
    op.add_column('tournaments',
        sa.Column('structure_mode', sa.String(20), nullable=False, server_default='legacy')
    )

    # tournament_structure_nodes: machine-readable metadata (no more name-parsing)
    op.add_column('tournament_structure_nodes',
        sa.Column('node_code', sa.String(50), nullable=True)
    )
    op.add_column('tournament_structure_nodes',
        sa.Column('rule_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )

    # students: actual competition weight used for dynamic node matching
    # (separate from legacy weight_class which is a profile field)
    op.add_column('students',
        sa.Column('competition_weight_kg', sa.Numeric(5, 2), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('students', 'competition_weight_kg')
    op.drop_column('tournament_structure_nodes', 'rule_json')
    op.drop_column('tournament_structure_nodes', 'node_code')
    op.drop_column('tournaments', 'structure_mode')
