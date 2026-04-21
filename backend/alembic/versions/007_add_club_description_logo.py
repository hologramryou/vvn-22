"""add description and logo_url to clubs table

Revision ID: 007
Revises: 006
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('clubs', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('clubs', sa.Column('logo_url', sa.String(500), nullable=True))


def downgrade():
    op.drop_column('clubs', 'logo_url')
    op.drop_column('clubs', 'description')
