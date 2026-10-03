"""official syllabus links for exams

Revision ID: 0010
Revises: 0009
"""
from alembic import op
import sqlalchemy as sa


revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('exam_syllabus',
    sa.Column('exam_id', sa.String(length=40), nullable=False),
    sa.Column('syllabus_url', sa.String(length=400), nullable=False),
    sa.Column('format', sa.String(length=10), nullable=False),
    sa.Column('sections', sa.JSON(), nullable=False),
    sa.Column('last_verified', sa.Date(), nullable=False),
    sa.ForeignKeyConstraint(['exam_id'], ['exams.exam_id'], ),
    sa.PrimaryKeyConstraint('exam_id')
    )


def downgrade() -> None:
    op.drop_table('exam_syllabus')
