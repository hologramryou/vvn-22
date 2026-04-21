"""add tournament structure templates

Revision ID: 016
Revises: 015
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'tournament_structure_templates',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('source_tournament_id', sa.Integer(), sa.ForeignKey('tournaments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('structure_mode', sa.String(length=20), nullable=False, server_default='dynamic'),
        sa.Column('template_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.UniqueConstraint('name', name='uq_tournament_structure_templates_name'),
    )


def downgrade() -> None:
    op.drop_table('tournament_structure_templates')
