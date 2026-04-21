"""create match_score_logs table

Revision ID: 031
Revises: 030
Create Date: 2026-04-14
"""

from alembic import op
import sqlalchemy as sa

revision = '031'
down_revision = '030'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'match_score_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('match_id', sa.Integer(), sa.ForeignKey('bracket_matches.id', ondelete='CASCADE'), nullable=False),
        sa.Column('actor_type', sa.String(20), nullable=False),
        sa.Column('actor_name', sa.String(100), nullable=True),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('side', sa.Integer(), nullable=True),
        sa.Column('delta', sa.Integer(), nullable=True),
        sa.Column('score1_after', sa.Integer(), nullable=True),
        sa.Column('score2_after', sa.Integer(), nullable=True),
        sa.Column('match_phase', sa.String(20), nullable=True),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_match_score_logs_match', 'match_score_logs', ['match_id'])


def downgrade():
    op.drop_index('ix_match_score_logs_match', table_name='match_score_logs')
    op.drop_table('match_score_logs')
