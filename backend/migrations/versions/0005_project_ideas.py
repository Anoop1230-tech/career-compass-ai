"""project ideas with checklists on roadmaps

Revision ID: 0005
Revises: 0004
"""
from alembic import op
import sqlalchemy as sa


revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('project_ideas',
    sa.Column('project_id', sa.String(length=40), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('career_ids', sa.JSON(), nullable=False),
    sa.Column('level', sa.String(length=20), nullable=False),
    sa.Column('summary', sa.Text(), nullable=False),
    sa.Column('skill_ids', sa.JSON(), nullable=False),
    sa.Column('steps', sa.JSON(), nullable=False),
    sa.Column('deliverable', sa.Text(), nullable=False),
    sa.Column('estimated_hours', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('project_id')
    )
    with op.batch_alter_table('roadmap_progress', schema=None) as batch_op:
        # Existing rows get an empty list
        batch_op.add_column(sa.Column('completed_project_steps', sa.JSON(), nullable=False, server_default='[]'))


def downgrade() -> None:
    with op.batch_alter_table('roadmap_progress', schema=None) as batch_op:
        batch_op.drop_column('completed_project_steps')
    op.drop_table('project_ideas')
