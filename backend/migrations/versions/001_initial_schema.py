"""Initial database schema

Revision ID: 001
Revises:
Create Date: 2026-08-11

Creates all core tables:
- users
- seller_profiles
- menus
- orders
- ratings
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── users ───────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("flat_number", sa.String(length=50), nullable=True),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="buyer"),
        sa.Column("is_verified", sa.Boolean(), nullable=True, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("otp_secret", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_flat_number"), "users", ["flat_number"], unique=False)

    # ─── seller_profiles ─────────────────────────────────────────────────────
    op.create_table(
        "seller_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("photo_url", sa.String(length=500), nullable=True),
        sa.Column("bank_account", sa.String(length=255), nullable=True),
        sa.Column("upi_id", sa.String(length=255), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True, server_default="0"),
        sa.Column("review_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("is_approved", sa.Boolean(), nullable=True, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ─── menus ───────────────────────────────────────────────────────────────
    op.create_table(
        "menus",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("seller_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["seller_id"], ["seller_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_menus_id"), "menus", ["id"], unique=False)
    op.create_index(op.f("ix_menus_seller_id"), "menus", ["seller_id"], unique=False)

    # ─── orders ──────────────────────────────────────────────────────────────
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("buyer_id", sa.Integer(), nullable=True),
        sa.Column("seller_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=True, server_default="pending"),
        sa.Column("items", sa.Text(), nullable=False),
        sa.Column("total_price", sa.Float(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["buyer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["seller_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_orders_id"), "orders", ["id"], unique=False)
    op.create_index(op.f("ix_orders_buyer_id"), "orders", ["buyer_id"], unique=False)
    op.create_index(op.f("ix_orders_seller_id"), "orders", ["seller_id"], unique=False)

    # ─── ratings ─────────────────────────────────────────────────────────────
    op.create_table(
        "ratings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("seller_id", sa.Integer(), nullable=True),
        sa.Column("rater_id", sa.Integer(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("review_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["seller_id"], ["seller_profiles.id"]),
        sa.ForeignKeyConstraint(["rater_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ratings_id"), "ratings", ["id"], unique=False)
    op.create_index(op.f("ix_ratings_seller_id"), "ratings", ["seller_id"], unique=False)
    op.create_index(op.f("ix_ratings_order_id"), "ratings", ["order_id"], unique=False)


def downgrade() -> None:
    op.drop_table("ratings")
    op.drop_table("orders")
    op.drop_table("menus")
    op.drop_table("seller_profiles")
    op.drop_table("users")
