"""official salary ranges per career

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa


revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('salary_ranges',
    sa.Column('salary_id', sa.String(length=40), nullable=False),
    sa.Column('career_id', sa.String(length=40), nullable=False),
    sa.Column('role_label', sa.String(length=200), nullable=False),
    sa.Column('sector', sa.String(length=30), nullable=False),
    sa.Column('pay_basis', sa.String(length=20), nullable=False),
    sa.Column('level', sa.String(length=60), nullable=True),
    sa.Column('monthly_min', sa.Integer(), nullable=False),
    sa.Column('monthly_max', sa.Integer(), nullable=True),
    sa.Column('range_note', sa.Text(), nullable=False),
    sa.Column('includes_note', sa.Text(), nullable=False),
    sa.Column('source_name', sa.String(length=200), nullable=False),
    sa.Column('source_url', sa.String(length=300), nullable=False),
    sa.Column('as_of', sa.Date(), nullable=False),
    sa.Column('last_verified', sa.Date(), nullable=False),
    sa.ForeignKeyConstraint(['career_id'], ['careers.career_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('salary_id')
    )
    with op.batch_alter_table('salary_ranges', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_salary_ranges_career_id'), ['career_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('salary_ranges', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_salary_ranges_career_id'))
    op.drop_table('salary_ranges')
