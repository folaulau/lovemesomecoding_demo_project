"""add oauth_accounts table

Links a StayHub user to an account at an identity provider — see app/models/oauth_account.py.

Additive: a new table with one foreign key OUT of it and nothing pointing in, so it can be applied
to a running system. The downgrade drops it, which unlinks every provider account; the users
themselves survive and can still sign in with a password, except for the ones created BY this flow,
whose password hash is random. That is worth knowing before running it in anger.

Revision ID: 9f4c1d7b2ae0
Revises: 35c27e31465b
Create Date: 2026-08-25 10:12:03.481907
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '9f4c1d7b2ae0'
down_revision: str | None = '35c27e31465b'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'oauth_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=32), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'],
                                name=op.f('fk_oauth_accounts_user_id_users'),
                                ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_oauth_accounts')),
        # On the PAIR — `subject` alone collides across providers. See the model.
        sa.UniqueConstraint('provider', 'subject', name=op.f('uq_oauth_accounts_provider')),
    )
    op.create_index(op.f('ix_oauth_accounts_user_id'), 'oauth_accounts', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_oauth_accounts_user_id'), table_name='oauth_accounts')
    op.drop_table('oauth_accounts')
