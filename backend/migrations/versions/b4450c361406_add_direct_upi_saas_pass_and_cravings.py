"""add_direct_upi_saas_pass_and_cravings

Revision ID: b4450c361406
Revises: c373aa388bf0
Create Date: 2026-09-14 21:30:00.433956

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4450c361406'
down_revision: Union[str, Sequence[str], None] = 'c373aa388bf0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Update PostgreSQL enum types
    op.execute("ALTER TYPE paymentstatus ADD VALUE IF NOT EXISTS 'submitted';")
    op.execute("ALTER TYPE ledgerentrytype ADD VALUE IF NOT EXISTS 'maintenance_fee';")
    op.execute("ALTER TYPE ledgerentrytype ADD VALUE IF NOT EXISTS 'maintenance_recharge';")

    # 2. Modify existing tables
    op.alter_column('ledger_entries', 'payment_id',
               existing_type=sa.INTEGER(),
               nullable=True)
    op.alter_column('ledger_entries', 'order_id',
               existing_type=sa.INTEGER(),
               nullable=True)
    op.alter_column('menus', 'is_preorder_only',
               existing_type=sa.BOOLEAN(),
               nullable=False,
               existing_server_default=sa.text('false'))
    op.alter_column('menus', 'max_batch_quantity',
               existing_type=sa.INTEGER(),
               nullable=False,
               existing_server_default=sa.text('0'))
    op.alter_column('menus', 'min_lead_time_hours',
               existing_type=sa.INTEGER(),
               nullable=False,
               existing_server_default=sa.text('2'))
    op.add_column('payments', sa.Column('utr_number', sa.String(length=50), nullable=True))
    op.add_column('payments', sa.Column('seller_confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_payments_utr_number'), 'payments', ['utr_number'], unique=False)
    op.add_column('seller_profiles', sa.Column('upi_account_name', sa.String(length=255), nullable=True))
    op.add_column('seller_profiles', sa.Column('is_upi_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('seller_profiles', sa.Column('free_orders_remaining', sa.Integer(), nullable=False, server_default=sa.text('50')))
    op.add_column('seller_profiles', sa.Column('maintenance_balance', sa.Numeric(precision=10, scale=2), nullable=False, server_default=sa.text('0.00')))
    op.add_column('seller_profiles', sa.Column('lifetime_orders_count', sa.Integer(), nullable=False, server_default=sa.text('0')))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('seller_profiles', 'lifetime_orders_count')
    op.drop_column('seller_profiles', 'maintenance_balance')
    op.drop_column('seller_profiles', 'free_orders_remaining')
    op.drop_column('seller_profiles', 'is_upi_verified')
    op.drop_column('seller_profiles', 'upi_account_name')
    op.drop_index(op.f('ix_payments_utr_number'), table_name='payments')
    op.drop_column('payments', 'seller_confirmed_at')
    op.drop_column('payments', 'utr_number')
    op.alter_column('menus', 'min_lead_time_hours',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('2'))
    op.alter_column('menus', 'max_batch_quantity',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('menus', 'is_preorder_only',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('ledger_entries', 'order_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.alter_column('ledger_entries', 'payment_id',
               existing_type=sa.INTEGER(),
               nullable=False)
