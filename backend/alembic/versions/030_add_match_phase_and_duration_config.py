"""add match_phase and duration config to bracket_matches

Revision ID: 030
Revises: 029
Create Date: 2026-04-14
"""

from alembic import op
import sqlalchemy as sa

revision = '030'
down_revision = '029'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'bracket_matches',
        sa.Column('match_phase', sa.String(20), nullable=False, server_default='not_started'),
    )
    op.add_column(
        'bracket_matches',
        sa.Column('round_duration_seconds', sa.Integer(), nullable=False, server_default='180'),
    )
    op.add_column(
        'bracket_matches',
        sa.Column('break_duration_seconds', sa.Integer(), nullable=False, server_default='30'),
    )

    # Backfill match_phase based on existing status
    op.execute("""
        UPDATE bracket_matches SET match_phase = CASE
            WHEN status = 'completed' THEN 'confirmed'
            WHEN status = 'ongoing' THEN 'round_1'
            ELSE 'not_started'
        END
    """)


def downgrade():
    op.drop_column('bracket_matches', 'break_duration_seconds')
    op.drop_column('bracket_matches', 'round_duration_seconds')
    op.drop_column('bracket_matches', 'match_phase')
