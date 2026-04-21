"""add per-judge scoring fields to bracket_judge_assignments

Revision ID: 028
Revises: 027
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa

revision = '028'
down_revision = '027'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('bracket_judge_assignments', sa.Column('score1', sa.Integer(), nullable=True))
    op.add_column('bracket_judge_assignments', sa.Column('score2', sa.Integer(), nullable=True))
    op.add_column('bracket_judge_assignments', sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('bracket_judge_assignments', 'submitted_at')
    op.drop_column('bracket_judge_assignments', 'score2')
    op.drop_column('bracket_judge_assignments', 'score1')
