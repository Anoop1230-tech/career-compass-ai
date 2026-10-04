"""sign in with Google: google_sub on users

Revision ID: 0011
Revises: 0010
"""
from alembic import op
import sqlalchemy as sa


revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('google_sub', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_users_google_sub'), 'users', ['google_sub'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_google_sub'), table_name='users')
    with op.batch_alter_table('users') as batch:
        batch.drop_column('google_sub')
