"""administrative scope on exams (national, state, district, local, international)

Revision ID: 0013
Revises: 0012
"""
from alembic import op
import sqlalchemy as sa


revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('exams', sa.Column('exam_scope', sa.String(length=20), nullable=True))
    with op.batch_alter_table('exams', schema=None) as batch:
        batch.create_index(batch.f('ix_exams_exam_scope'), ['exam_scope'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('exams', schema=None) as batch:
        batch.drop_index(batch.f('ix_exams_exam_scope'))
        batch.drop_column('exam_scope')
