"""display_name on users (name from Google, pre-fills the profile)

Revision ID: 0012
Revises: 0011
"""
from alembic import op
import sqlalchemy as sa


revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('display_name', sa.String(length=100), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users') as batch:
        batch.drop_column('display_name')
