"""Make StudentWeightAssignment.node_id nullable for kata-only registrations.

Revision ID: 013
Revises: 012
Create Date: 2026-04-09

VĐV có thể chỉ đăng ký quyền (kata) mà không cần tree-path phân loại (node_id).
Chỉ khi đăng ký đối kháng (sparring) mới bắt buộc chọn node (hạng cân).
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make node_id nullable for kata-only registrations
    op.alter_column(
        'student_weight_assignments',
        'node_id',
        existing_type=sa.Integer(),
        nullable=True,
        existing_nullable=False,
    )


def downgrade() -> None:
    # Revert: make node_id non-nullable (only if no null values exist)
    op.alter_column(
        'student_weight_assignments',
        'node_id',
        existing_type=sa.Integer(),
        nullable=False,
        existing_nullable=True,
    )
