"""add gradient_primary to tournaments

Revision ID: 041
Revises: 040
Create Date: 2026-04-19

"""
from alembic import op
import sqlalchemy as sa

revision = '041'
down_revision = '040'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tournaments', sa.Column('gradient_primary', sa.String(7), nullable=True))


def downgrade():
    op.drop_column('tournaments', 'gradient_primary')
