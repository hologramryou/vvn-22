"""Backfill structure_mode='dynamic' for tournaments that have TournamentStructureNode records.

Revision ID: 014
Revises: 013
Create Date: 2026-04-10

Tournaments created before migration 010 received structure_mode='legacy' (server default).
If such a tournament already has TournamentStructureNode records it is a dynamic tournament
and must be set to 'dynamic' so the sync and frontend detection work correctly.
"""
from alembic import op

revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE tournaments
        SET structure_mode = 'dynamic'
        WHERE structure_mode = 'legacy'
          AND id IN (SELECT DISTINCT tournament_id FROM tournament_structure_nodes)
    """)


def downgrade() -> None:
    # Not safe to reverse automatically — would incorrectly reset to 'legacy'
    pass
