"""add player1_club player2_club to bracket_matches

Revision ID: 043
Revises: 042
Create Date: 2026-04-20

"""
from alembic import op
import sqlalchemy as sa

revision = '043'
down_revision = '042'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('bracket_matches', sa.Column('player1_club', sa.String(200), nullable=True))
    op.add_column('bracket_matches', sa.Column('player2_club', sa.String(200), nullable=True))


def downgrade():
    op.drop_column('bracket_matches', 'player2_club')
    op.drop_column('bracket_matches', 'player1_club')
