"""Backfill node_type='weight_class' for leaf nodes in tournament_structure_nodes.

Revision ID: 015
Revises: 014
Create Date: 2026-04-10

Migration 012 added node_type with server_default='group', so ALL existing nodes
(including leaf weight-class nodes) got node_type='group'.
Leaf nodes are those that have no children — they should be 'weight_class'.
"""
from alembic import op

revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nodes that appear as parent_id → they ARE group nodes (have children)
    # Nodes that never appear as parent_id → they ARE leaf weight_class nodes
    op.execute("""
        UPDATE tournament_structure_nodes
        SET node_type = 'weight_class'
        WHERE id NOT IN (
            SELECT DISTINCT parent_id
            FROM tournament_structure_nodes
            WHERE parent_id IS NOT NULL
        )
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE tournament_structure_nodes SET node_type = 'group'
    """)
