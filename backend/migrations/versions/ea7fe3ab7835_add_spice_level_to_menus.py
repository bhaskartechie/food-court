"""add_spice_level_to_menus

Revision ID: ea7fe3ab7835
Revises: b4450c361406
Create Date: 2026-09-23 16:41:52.355122

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ea7fe3ab7835'
down_revision: Union[str, Sequence[str], None] = 'b4450c361406'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('menus', sa.Column('spice_level', sa.String(length=50), nullable=True, server_default=sa.text("'medium'")))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('menus', 'spice_level')
