"""add tournament config columns

Revision ID: 036
Revises: 035
Create Date: 2026-04-17

"""
from alembic import op
import sqlalchemy as sa

revision = '036'
down_revision = '035'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tournaments', sa.Column('default_round_duration_seconds', sa.Integer(), nullable=False, server_default='180'))
    op.add_column('tournaments', sa.Column('default_break_duration_seconds', sa.Integer(), nullable=False, server_default='30'))
    op.add_column('tournaments', sa.Column('default_performance_duration_seconds', sa.Integer(), nullable=False, server_default='120'))
    op.add_column('tournaments', sa.Column('consensus_window_secs', sa.Numeric(precision=4, scale=2), nullable=False, server_default='1.0'))
    op.add_column('tournaments', sa.Column('consensus_min_votes', sa.Integer(), nullable=False, server_default='3'))


def downgrade():
    op.drop_column('tournaments', 'consensus_min_votes')
    op.drop_column('tournaments', 'consensus_window_secs')
    op.drop_column('tournaments', 'default_performance_duration_seconds')
    op.drop_column('tournaments', 'default_break_duration_seconds')
    op.drop_column('tournaments', 'default_round_duration_seconds')
