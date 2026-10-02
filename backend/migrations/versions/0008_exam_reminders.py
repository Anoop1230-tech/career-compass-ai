"""exam dates and followed exams (reminders)

Revision ID: 0008
Revises: 0007
"""
from alembic import op
import sqlalchemy as sa


revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('exam_dates',
    sa.Column('date_id', sa.String(length=20), nullable=False),
    sa.Column('exam_id', sa.String(length=40), nullable=False),
    sa.Column('event', sa.String(length=30), nullable=False),
    sa.Column('start_date', sa.Date(), nullable=False),
    sa.Column('end_date', sa.Date(), nullable=False),
    sa.Column('source_url', sa.String(length=300), nullable=False),
    sa.Column('last_verified', sa.Date(), nullable=False),
    sa.ForeignKeyConstraint(['exam_id'], ['exams.exam_id'], ),
    sa.PrimaryKeyConstraint('date_id')
    )
    with op.batch_alter_table('exam_dates', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_exam_dates_exam_id'), ['exam_id'], unique=False)

    op.create_table('exam_follows',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('exam_id', sa.String(length=40), nullable=False),
    sa.Column('email', sa.Boolean(), nullable=False),
    sa.Column('reminded', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'exam_id', name='uq_follow_user_exam')
    )
    with op.batch_alter_table('exam_follows', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_exam_follows_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('exam_follows', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_exam_follows_user_id'))
    op.drop_table('exam_follows')
    with op.batch_alter_table('exam_dates', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_exam_dates_exam_id'))
    op.drop_table('exam_dates')
