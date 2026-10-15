"""official fee figures (fee_examples)

Revision ID: 0014
Revises: 0013
"""
from alembic import op
import sqlalchemy as sa


revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('fee_examples',
    sa.Column('fee_id', sa.String(length=40), nullable=False),
    sa.Column('stage_ids', sa.JSON(), nullable=False),
    sa.Column('institution', sa.String(length=200), nullable=False),
    sa.Column('institute_type', sa.String(length=20), nullable=False),
    sa.Column('band', sa.String(length=30), nullable=False),
    sa.Column('period', sa.String(length=30), nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('includes_note', sa.Text(), nullable=False),
    sa.Column('excludes_note', sa.Text(), nullable=True),
    sa.Column('waiver_note', sa.Text(), nullable=True),
    sa.Column('source_name', sa.String(length=200), nullable=False),
    sa.Column('source_url', sa.String(length=300), nullable=False),
    sa.Column('as_of', sa.Date(), nullable=False),
    sa.Column('last_verified', sa.Date(), nullable=False),
    sa.PrimaryKeyConstraint('fee_id')
    )


def downgrade() -> None:
    op.drop_table('fee_examples')
