"""add min_team_size to tournament_katas

Revision ID: 042
Revises: 041
Create Date: 2026-04-19

"""
from alembic import op
import sqlalchemy as sa

revision = '042'
down_revision = '041'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tournament_katas', sa.Column('min_team_size', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('tournament_katas', 'min_team_size')
