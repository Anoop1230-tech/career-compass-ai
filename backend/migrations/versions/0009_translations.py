"""Hindi translations for catalog entries

Revision ID: 0009
Revises: 0008
"""
from alembic import op
import sqlalchemy as sa


revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('translations',
    sa.Column('entity_type', sa.String(length=20), nullable=False),
    sa.Column('entity_id', sa.String(length=40), nullable=False),
    sa.Column('field', sa.String(length=20), nullable=False),
    sa.Column('lang', sa.String(length=5), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.PrimaryKeyConstraint('entity_type', 'entity_id', 'field', 'lang')
    )


def downgrade() -> None:
    op.drop_table('translations')
