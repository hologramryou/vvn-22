"""add weight_verified to students

Revision ID: 008
Revises: 007
Create Date: 2026-04-01
"""
from alembic import op
import sqlalchemy as sa

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('students', sa.Column('weight_verified', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('students', 'weight_verified')
