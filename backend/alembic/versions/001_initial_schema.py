"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('provinces',
        sa.Column('id', sa.SmallInteger(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(3), unique=True, nullable=False),
    )
    op.create_table('clubs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('code', sa.String(20), unique=True, nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('province_id', sa.SmallInteger(), nullable=False),
        sa.Column('address', sa.Text()),
        sa.Column('phone', sa.String(15)),
        sa.Column('email', sa.String(150)),
        sa.Column('founded_date', sa.Date()),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('username', sa.String(50), unique=True, nullable=False),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('full_name', sa.String(150), nullable=False),
        sa.Column('email', sa.String(150), unique=True, nullable=False),
        sa.Column('phone', sa.String(15)),
        sa.Column('role', sa.String(30), nullable=False, server_default='viewer'),
        sa.Column('club_id', sa.Integer()),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_login_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table('students',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('code', sa.String(20), unique=True, nullable=False),
        sa.Column('full_name', sa.String(150), nullable=False),
        sa.Column('date_of_birth', sa.Date(), nullable=False),
        sa.Column('gender', sa.String(1), nullable=False),
        sa.Column('id_number', sa.String(12), unique=True, nullable=False),
        sa.Column('phone', sa.String(15)),
        sa.Column('email', sa.String(150)),
        sa.Column('address', sa.Text()),
        sa.Column('avatar_url', sa.Text()),
        sa.Column('current_belt', sa.String(30), nullable=False, server_default='Vang'),
        sa.Column('belt_date', sa.Date()),
        sa.Column('join_date', sa.Date(), nullable=False),
        sa.Column('weight_class', sa.Numeric(5, 2)),
        sa.Column('compete_events', ARRAY(sa.String())),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_students_full_name', 'students', [sa.text("lower(full_name)")])
    op.create_index('idx_students_status', 'students', ['status'])
    op.create_index('idx_students_belt', 'students', ['current_belt'])

    op.create_table('student_clubs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('club_id', sa.Integer(), nullable=False),
        sa.Column('joined_at', sa.Date(), nullable=False),
        sa.Column('left_at', sa.Date()),
        sa.Column('is_current', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notes', sa.Text()),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['club_id'], ['clubs.id']),
    )
    op.create_index('idx_student_clubs_student', 'student_clubs', ['student_id'])
    op.create_index('idx_student_clubs_club', 'student_clubs', ['club_id'])

def downgrade():
    op.drop_table('student_clubs')
    op.drop_table('students')
    op.drop_table('users')
    op.drop_table('clubs')
    op.drop_table('provinces')
