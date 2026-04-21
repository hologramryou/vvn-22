"""add player avatar_url to bracket_matches

Revision ID: 039
Revises: 038
Create Date: 2026-04-18

"""
from alembic import op
import sqlalchemy as sa

revision = '039'
down_revision = '038'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('bracket_matches', sa.Column('player1_avatar_url', sa.Text(), nullable=True))
    op.add_column('bracket_matches', sa.Column('player2_avatar_url', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('bracket_matches', 'player2_avatar_url')
    op.drop_column('bracket_matches', 'player1_avatar_url')
