"""expand match_code column to VARCHAR(50)

Revision ID: 006
Revises: 005
Create Date: 2026-03-27
"""
from alembic import op
import sqlalchemy as sa

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'bracket_matches', 'match_code',
        existing_type=sa.String(10),
        type_=sa.String(50),
        existing_nullable=True,
    )


def downgrade():
    op.alter_column(
        'bracket_matches', 'match_code',
        existing_type=sa.String(50),
        type_=sa.String(10),
        existing_nullable=True,
    )
