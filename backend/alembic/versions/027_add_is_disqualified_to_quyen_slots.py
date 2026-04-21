"""add is_disqualified to quyen_slots

Revision ID: 027
Revises: 026
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa

revision = '027'
down_revision = '026'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'quyen_slots',
        sa.Column('is_disqualified', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade():
    op.drop_column('quyen_slots', 'is_disqualified')
