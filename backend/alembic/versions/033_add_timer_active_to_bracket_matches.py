"""add timer_active to bracket_matches

Revision ID: 033
Revises: 032
Create Date: 2026-04-16

"""
from alembic import op
import sqlalchemy as sa

revision = '033'
down_revision = '032'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('bracket_matches',
        sa.Column('timer_active', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade():
    op.drop_column('bracket_matches', 'timer_active')
