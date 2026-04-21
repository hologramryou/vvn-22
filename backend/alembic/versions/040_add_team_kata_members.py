"""add team_size to tournament_katas and create tournament_team_kata_members

Revision ID: 040
Revises: 039
Create Date: 2026-04-19

"""
from alembic import op
import sqlalchemy as sa

revision = '040'
down_revision = '039'
branch_labels = None
depends_on = None


def upgrade():
    # Add team_size to tournament_katas (default 2, min 2)
    op.add_column(
        'tournament_katas',
        sa.Column('team_size', sa.Integer(), nullable=False, server_default='2'),
    )
    op.create_check_constraint(
        'ck_tk_team_size_min',
        'tournament_katas',
        'team_size >= 2',
    )

    # Create tournament_team_kata_members table
    op.create_table(
        'tournament_team_kata_members',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tournament_id', sa.Integer(), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('club_id', sa.Integer(), sa.ForeignKey('clubs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('node_id', sa.Integer(), sa.ForeignKey('tournament_structure_nodes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kata_id', sa.Integer(), sa.ForeignKey('tournament_katas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False),
        sa.UniqueConstraint('tournament_id', 'club_id', 'node_id', 'kata_id', 'student_id', name='uq_ttkm_tournament_club_node_kata_student'),
    )


def downgrade():
    op.drop_table('tournament_team_kata_members')
    op.drop_constraint('ck_tk_team_size_min', 'tournament_katas', type_='check')
    op.drop_column('tournament_katas', 'team_size')
