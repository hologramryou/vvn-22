"""add node_id FK to tournament_weight_classes for direct tree-bracket linkage

Revision ID: 011
Revises: 010
Create Date: 2026-04-08
"""
from alembic import op
import sqlalchemy as sa

revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Link legacy weight_class rows to their source dynamic tree nodes
    # Allows bracket queries to work with the tree directly instead of name-parsing
    op.add_column('tournament_weight_classes',
        sa.Column('node_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_twc_node_id',
        'tournament_weight_classes', 'tournament_structure_nodes',
        ['node_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_twc_node_id', 'tournament_weight_classes', ['node_id'])


def downgrade() -> None:
    op.drop_index('ix_twc_node_id', table_name='tournament_weight_classes')
    op.drop_constraint('fk_twc_node_id', 'tournament_weight_classes', type_='foreignkey')
    op.drop_column('tournament_weight_classes', 'node_id')
