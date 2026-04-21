"""add sport_icon to tournaments

Revision ID: 019_add_tournament_sport_icon_and_name_edit
Revises: 018_add_tournament_scoping_assignments
Create Date: 2026-04-11 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = '019'
down_revision = '018'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tournaments', sa.Column('sport_icon', sa.String(10), nullable=True))


def downgrade():
    op.drop_column('tournaments', 'sport_icon')
