"""add primary_color to tournaments

Revision ID: 038
Revises: 036
Create Date: 2026-04-18

"""
from alembic import op
import sqlalchemy as sa

revision = '038'
down_revision = '037'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tournaments', sa.Column('primary_color', sa.String(7), nullable=True))


def downgrade():
    op.drop_column('tournaments', 'primary_color')
