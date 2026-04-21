"""add node_type column to tournament_structure_nodes

Revision ID: 012
Revises: 011
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa

revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Classify tree nodes as either 'group' or 'weight_class' leaf nodes
    # Required for dynamic bracket display logic
    op.add_column('tournament_structure_nodes',
        sa.Column('node_type', sa.String(20), nullable=False, server_default='group')
    )


def downgrade() -> None:
    op.drop_column('tournament_structure_nodes', 'node_type')
