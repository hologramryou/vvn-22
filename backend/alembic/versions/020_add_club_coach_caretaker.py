"""add coach and caretaker fields to clubs

Revision ID: 020
Revises: 019
Create Date: 2026-04-11 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = '020'
down_revision = '019'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('clubs', sa.Column('coach_name', sa.String(150), nullable=True))
    op.add_column('clubs', sa.Column('coach_phone', sa.String(15), nullable=True))
    op.add_column('clubs', sa.Column('caretaker_name', sa.String(150), nullable=True))
    op.add_column('clubs', sa.Column('caretaker_phone', sa.String(15), nullable=True))


def downgrade():
    op.drop_column('clubs', 'caretaker_phone')
    op.drop_column('clubs', 'caretaker_name')
    op.drop_column('clubs', 'coach_phone')
    op.drop_column('clubs', 'coach_name')
