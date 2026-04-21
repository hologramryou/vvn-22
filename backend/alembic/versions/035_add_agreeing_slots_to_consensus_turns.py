"""add agreeing_slots to match_consensus_turns

Revision ID: 035
Revises: 034
Create Date: 2026-04-17

"""
from alembic import op
import sqlalchemy as sa

revision = '035'
down_revision = '034'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('match_consensus_turns',
        sa.Column('agreeing_slots', sa.String(50), nullable=True)  # e.g. "1,2,3"
    )


def downgrade():
    op.drop_column('match_consensus_turns', 'agreeing_slots')
