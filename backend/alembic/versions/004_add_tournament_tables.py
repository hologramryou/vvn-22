"""add tournament tables

Revision ID: 004
Revises: 003
Create Date: 2026-03-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tournaments',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'tournament_weight_classes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tournament_id', sa.Integer(), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(20), nullable=False),
        sa.Column('age_type_code', sa.String(5), nullable=False),
        sa.Column('weight_class_name', sa.String(20), nullable=False),
        sa.Column('total_players', sa.Integer(), nullable=False, server_default='16'),
        sa.Column('bracket_status', sa.String(20), nullable=False, server_default='NOT_GENERATED'),
        sa.Column('players', ARRAY(sa.String()), nullable=True),
    )
    op.create_index('idx_twc_tournament', 'tournament_weight_classes', ['tournament_id'])

    op.create_table(
        'bracket_matches',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('weight_class_id', sa.Integer(), sa.ForeignKey('tournament_weight_classes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('round', sa.Integer(), nullable=False),
        sa.Column('match_number', sa.Integer(), nullable=False),
        sa.Column('player1_name', sa.String(150), nullable=True),
        sa.Column('player2_name', sa.String(150), nullable=True),
        sa.Column('score1', sa.Integer(), nullable=True),
        sa.Column('score2', sa.Integer(), nullable=True),
        sa.Column('winner', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('next_match_id', sa.Integer(), sa.ForeignKey('bracket_matches.id'), nullable=True),
    )
    op.create_index('idx_bm_weight_class', 'bracket_matches', ['weight_class_id'])
    op.create_index('idx_bm_round', 'bracket_matches', ['round'])


def downgrade():
    op.drop_table('bracket_matches')
    op.drop_table('tournament_weight_classes')
    op.drop_table('tournaments')
