"""add match_consensus_turns and match_consensus_votes tables

Revision ID: 034
Revises: 033
Create Date: 2026-04-17

"""
from alembic import op
import sqlalchemy as sa

revision = '034'
down_revision = '033'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'match_consensus_turns',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('match_id', sa.Integer(), sa.ForeignKey('bracket_matches.id', ondelete='CASCADE'), nullable=False),
        sa.Column('match_phase', sa.String(20), nullable=True),
        sa.Column('is_consensus', sa.Boolean(), nullable=False),
        sa.Column('result_side', sa.String(4), nullable=True),    # 'RED' | 'BLUE' | NULL
        sa.Column('result_type', sa.String(3), nullable=True),    # '+1' | '+2' | '-1' | NULL
        sa.Column('result_delta', sa.Integer(), nullable=True),
        sa.Column('score1_after', sa.Integer(), nullable=True),
        sa.Column('score2_after', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_consensus_turns_match_id', 'match_consensus_turns', ['match_id'])

    op.create_table(
        'match_consensus_votes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('turn_id', sa.Integer(), sa.ForeignKey('match_consensus_turns.id', ondelete='CASCADE'), nullable=False),
        sa.Column('judge_slot', sa.Integer(), nullable=False),
        sa.Column('judge_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('player_side', sa.String(4), nullable=False),   # 'RED' | 'BLUE'
        sa.Column('score_type', sa.String(3), nullable=False),    # '+1' | '+2' | '-1'
        sa.Column('press_order', sa.Integer(), nullable=False),   # thứ tự bấm trong turn
    )
    op.create_index('ix_consensus_votes_turn_id', 'match_consensus_votes', ['turn_id'])


def downgrade():
    op.drop_index('ix_consensus_votes_turn_id', 'match_consensus_votes')
    op.drop_table('match_consensus_votes')
    op.drop_index('ix_consensus_turns_match_id', 'match_consensus_turns')
    op.drop_table('match_consensus_turns')
