"""recommendation feedback ("did this fit you?")

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa


revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('recommendation_feedback',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('career_id', sa.String(length=40), nullable=False),
    sa.Column('verdict', sa.String(length=20), nullable=False),
    sa.Column('reason', sa.String(length=30), nullable=True),
    sa.Column('score', sa.Float(), nullable=True),
    sa.Column('rank', sa.Integer(), nullable=True),
    sa.Column('confidence', sa.Integer(), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'career_id', name='uq_feedback_user_career')
    )
    with op.batch_alter_table('recommendation_feedback', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_recommendation_feedback_career_id'), ['career_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_recommendation_feedback_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('recommendation_feedback', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_recommendation_feedback_user_id'))
        batch_op.drop_index(batch_op.f('ix_recommendation_feedback_career_id'))
    op.drop_table('recommendation_feedback')
