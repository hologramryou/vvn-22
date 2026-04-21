"""add current_hiep to bracket_matches

Revision ID: 029
Revises: 028
Create Date: 2026-04-14
"""

from alembic import op
import sqlalchemy as sa

revision = '029'
down_revision = '028'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'bracket_matches',
        sa.Column('current_hiep', sa.Integer(), nullable=False, server_default='1'),
    )


def downgrade():
    op.drop_column('bracket_matches', 'current_hiep')
