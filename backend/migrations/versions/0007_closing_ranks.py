"""closing ranks for the college predictor

Revision ID: 0007
Revises: 0006
"""
from alembic import op
import sqlalchemy as sa


revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('closing_ranks',
    sa.Column('rank_id', sa.String(length=20), nullable=False),
    sa.Column('year', sa.Integer(), nullable=False),
    sa.Column('round', sa.Integer(), nullable=False),
    sa.Column('institute_name', sa.String(length=200), nullable=False),
    sa.Column('institute_type', sa.String(length=10), nullable=False),
    sa.Column('exam_id', sa.String(length=40), nullable=False),
    sa.Column('stage_id', sa.String(length=40), nullable=False),
    sa.Column('program_name', sa.String(length=200), nullable=False),
    sa.Column('quota', sa.String(length=5), nullable=False),
    sa.Column('seat_type', sa.String(length=10), nullable=False),
    sa.Column('gender', sa.String(length=10), nullable=False),
    sa.Column('opening_rank', sa.Integer(), nullable=False),
    sa.Column('closing_rank', sa.Integer(), nullable=False),
    sa.Column('source_url', sa.String(length=300), nullable=False),
    sa.Column('last_verified', sa.Date(), nullable=False),
    sa.PrimaryKeyConstraint('rank_id')
    )
    with op.batch_alter_table('closing_ranks', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_closing_ranks_exam_id'), ['exam_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_closing_ranks_stage_id'), ['stage_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('closing_ranks', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_closing_ranks_stage_id'))
        batch_op.drop_index(batch_op.f('ix_closing_ranks_exam_id'))
    op.drop_table('closing_ranks')
