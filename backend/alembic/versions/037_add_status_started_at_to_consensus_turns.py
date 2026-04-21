"""add status and started_at to match_consensus_turns

Revision ID: 037
Revises: 036
Create Date: 2026-04-18

"""
from alembic import op
import sqlalchemy as sa

revision = '037'
down_revision = '036'
branch_labels = None
depends_on = None


def upgrade():
    # status: 'scored' | 'expired' — existing rows are all scored
    op.add_column('match_consensus_turns',
        sa.Column('status', sa.String(10), nullable=False, server_default='scored')
    )
    # started_at: when the slot was opened (null for old records)
    op.add_column('match_consensus_turns',
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade():
    op.drop_column('match_consensus_turns', 'started_at')
    op.drop_column('match_consensus_turns', 'status')
