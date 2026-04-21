"""add bracket_score_events table for realtime scoring audit log

Revision ID: 029
Revises: 028
Create Date: 2026-04-14
"""

from alembic import op
import sqlalchemy as sa

revision = '032'
down_revision = '031'
branch_labels = None
depends_on = None


def upgrade():
    # Table may already exist if migration 029 (duplicate) ran previously
    from sqlalchemy import inspect
    from alembic import op as _op
    bind = _op.get_bind()
    if 'bracket_score_events' in inspect(bind).get_table_names():
        return
    op.create_table(
        'bracket_score_events',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('match_id', sa.Integer(), sa.ForeignKey('bracket_matches.id', ondelete='CASCADE'), nullable=False),
        sa.Column('judge_slot', sa.Integer(), nullable=False),
        sa.Column('judge_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('player_side', sa.String(4), nullable=False),
        sa.Column('score_type', sa.String(3), nullable=False),
        sa.Column('sequence_index', sa.Integer(), nullable=False),
        sa.Column('window_key', sa.String(60), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_bracket_score_events_match_window', 'bracket_score_events', ['match_id', 'window_key'])


def downgrade():
    op.drop_index('ix_bracket_score_events_match_window', table_name='bracket_score_events')
    op.drop_table('bracket_score_events')
