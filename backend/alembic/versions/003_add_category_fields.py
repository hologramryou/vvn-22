"""add category_type and category_loai to students, backfill existing rows as pho_thong/1

Revision ID: 003
Revises: 002
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('students', sa.Column('category_type', sa.String(20), nullable=True))
    op.add_column('students', sa.Column('category_loai', sa.String(5),  nullable=True))

    # Migrate all existing students to Phổ thông – Loại 1
    op.execute("UPDATE students SET category_type = 'pho_thong', category_loai = '1' WHERE category_type IS NULL")


def downgrade():
    op.drop_column('students', 'category_loai')
    op.drop_column('students', 'category_type')
