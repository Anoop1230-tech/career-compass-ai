"""learning resources: courses and certifications

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('courses',
    sa.Column('course_id', sa.String(length=40), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('provider', sa.String(length=200), nullable=False),
    sa.Column('platform', sa.String(length=100), nullable=True),
    sa.Column('url', sa.String(length=300), nullable=False),
    sa.Column('skill_ids', sa.JSON(), nullable=False),
    sa.Column('level', sa.String(length=20), nullable=False),
    sa.Column('cost_type', sa.String(length=20), nullable=False),
    sa.Column('duration_hours', sa.Float(), nullable=True),
    sa.Column('language', sa.String(length=60), nullable=False),
    sa.Column('certificate_available', sa.Boolean(), nullable=True),
    sa.Column('last_verified', sa.Date(), nullable=False),
    sa.PrimaryKeyConstraint('course_id')
    )
    with op.batch_alter_table('courses', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_courses_name'), ['name'], unique=False)

    op.create_table('certifications',
    sa.Column('certification_id', sa.String(length=40), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('issuing_body', sa.String(length=200), nullable=False),
    sa.Column('url', sa.String(length=300), nullable=False),
    sa.Column('related_career_ids', sa.JSON(), nullable=False),
    sa.Column('skill_ids', sa.JSON(), nullable=False),
    sa.Column('level', sa.String(length=20), nullable=False),
    sa.Column('prerequisites', sa.Text(), nullable=True),
    sa.Column('cost_note', sa.Text(), nullable=False),
    sa.Column('validity_years', sa.Integer(), nullable=True),
    sa.Column('last_verified', sa.Date(), nullable=False),
    sa.PrimaryKeyConstraint('certification_id')
    )
    with op.batch_alter_table('certifications', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_certifications_name'), ['name'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('certifications', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_certifications_name'))
    op.drop_table('certifications')
    with op.batch_alter_table('courses', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_courses_name'))
    op.drop_table('courses')
