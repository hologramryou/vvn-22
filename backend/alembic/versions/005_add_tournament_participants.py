"""add tournament participants, quyen slots, and schedule fields

Revision ID: 005
Revises: 004
Create Date: 2026-03-26
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add gender to existing tournament_weight_classes
    op.add_column(
        'tournament_weight_classes',
        sa.Column('gender', sa.String(1), nullable=False, server_default='M'),
    )

    # 2. Create tournament_participants table
    op.create_table(
        'tournament_participants',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            'weight_class_id', sa.Integer(),
            sa.ForeignKey('tournament_weight_classes.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'student_id', sa.Integer(),
            sa.ForeignKey('students.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('registered_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('weight_class_id', 'student_id', name='uq_tp_wc_student'),
    )
    op.create_index('ix_tp_weight_class_id', 'tournament_participants', ['weight_class_id'])
    op.create_index('ix_tp_student_id', 'tournament_participants', ['student_id'])

    # 3. Add columns to bracket_matches
    op.add_column('bracket_matches', sa.Column('match_code', sa.String(10), nullable=True))
    op.add_column('bracket_matches', sa.Column('court', sa.String(1), nullable=True))
    op.add_column('bracket_matches', sa.Column('schedule_order', sa.Integer(), nullable=True))
    op.add_column('bracket_matches', sa.Column('is_bye', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('bracket_matches', sa.Column('started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('bracket_matches', sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('idx_bracket_matches_court_status', 'bracket_matches', ['court', 'status'])

    # 4. Update tournaments status enum
    op.execute("UPDATE tournaments SET status = 'DRAFT' WHERE status = 'active'")
    op.alter_column('tournaments', 'status', 
                    existing_type=sa.String(20),
                    server_default='DRAFT')

    # 5. Create quyen_slots table
    op.create_table(
        'quyen_slots',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tournament_id', sa.Integer(), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('weight_class_id', sa.Integer(), sa.ForeignKey('tournament_weight_classes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('player_name', sa.String(150), nullable=False),
        sa.Column('content_name', sa.String(100), nullable=False),
        sa.Column('court', sa.String(1), nullable=True),
        sa.Column('schedule_order', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='ready'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_quyen_slots_tournament', 'quyen_slots', ['tournament_id'])
    op.create_index('idx_quyen_slots_court_status', 'quyen_slots', ['court', 'status'])


def downgrade():
    op.drop_index('idx_quyen_slots_court_status', 'quyen_slots')
    op.drop_index('idx_quyen_slots_tournament', 'quyen_slots')
    op.drop_table('quyen_slots')
    op.drop_index('idx_bracket_matches_court_status', 'bracket_matches')
    op.drop_column('bracket_matches', 'finished_at')
    op.drop_column('bracket_matches', 'started_at')
    op.drop_column('bracket_matches', 'is_bye')
    op.drop_column('bracket_matches', 'schedule_order')
    op.drop_column('bracket_matches', 'court')
    op.drop_column('bracket_matches', 'match_code')
    op.alter_column('tournaments', 'status',
                    existing_type=sa.String(20),
                    server_default='active')
    op.execute("UPDATE tournaments SET status = 'active' WHERE status = 'DRAFT'")
    op.drop_index('ix_tp_student_id', table_name='tournament_participants')
    op.drop_index('ix_tp_weight_class_id', table_name='tournament_participants')
    op.drop_table('tournament_participants')
    op.drop_column('tournament_weight_classes', 'gender')

