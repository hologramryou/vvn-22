"""add dynamic tournament structure

Revision ID: 009
Revises: 008
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # tournament_structure_nodes — adjacency list, 4-level tree
    op.create_table(
        'tournament_structure_nodes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tournament_id', sa.Integer(), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('tournament_structure_nodes.id'), nullable=True),
        sa.Column('level', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_unique_constraint(
        'uq_tsn_tournament_parent_name',
        'tournament_structure_nodes',
        ['tournament_id', 'parent_id', 'name'],
    )
    op.create_index('ix_tsn_tournament_id', 'tournament_structure_nodes', ['tournament_id'])
    op.create_index('ix_tsn_parent_id', 'tournament_structure_nodes', ['parent_id'])

    # tournament_katas — kata settings per tournament
    op.create_table(
        'tournament_katas',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tournament_id', sa.Integer(), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False),
    )
    op.create_unique_constraint(
        'uq_tk_tournament_name',
        'tournament_katas',
        ['tournament_id', 'name'],
    )
    op.create_index('ix_tk_tournament_id', 'tournament_katas', ['tournament_id'])

    # student_weight_assignments — 1 student = 1 node per tournament
    op.create_table(
        'student_weight_assignments',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tournament_id', sa.Integer(), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('node_id', sa.Integer(), sa.ForeignKey('tournament_structure_nodes.id'), nullable=False),
        sa.Column('registered_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('reason', sa.String(20), nullable=False, server_default='registered'),
    )
    op.create_unique_constraint(
        'uq_swa_student_tournament',
        'student_weight_assignments',
        ['student_id', 'tournament_id'],
    )
    op.create_index('ix_swa_tournament_id', 'student_weight_assignments', ['tournament_id'])
    op.create_index('ix_swa_node_id', 'student_weight_assignments', ['node_id'])

    # student_contest_selections — what each student competes in
    op.create_table(
        'student_contest_selections',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tournament_id', sa.Integer(), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('contest_type', sa.String(20), nullable=False),
        sa.Column('kata_id', sa.Integer(), sa.ForeignKey('tournament_katas.id'), nullable=True),
    )
    op.create_unique_constraint(
        'uq_scs_student_tournament_type_kata',
        'student_contest_selections',
        ['student_id', 'tournament_id', 'contest_type', 'kata_id'],
    )
    op.create_index('ix_scs_student_tournament', 'student_contest_selections', ['student_id', 'tournament_id'])


def downgrade() -> None:
    op.drop_table('student_contest_selections')
    op.drop_table('student_weight_assignments')
    op.drop_table('tournament_katas')
    op.drop_table('tournament_structure_nodes')
