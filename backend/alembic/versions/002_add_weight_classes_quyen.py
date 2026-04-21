"""add weight_classes and quyen_selections arrays

Revision ID: 002
Revises: 001
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('students', sa.Column('weight_classes', ARRAY(sa.Numeric(5, 2)), nullable=True))
    op.add_column('students', sa.Column('quyen_selections', ARRAY(sa.String()), nullable=True))

def downgrade():
    op.drop_column('students', 'quyen_selections')
    op.drop_column('students', 'weight_classes')
