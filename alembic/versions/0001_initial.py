"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "food_entries",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.String(), nullable=False),
        sa.Column("meal", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("weight_g", sa.Float(), nullable=True, server_default="0"),
        sa.Column("calories", sa.Float(), nullable=True, server_default="0"),
        sa.Column("protein", sa.Float(), nullable=True, server_default="0"),
        sa.Column("fat", sa.Float(), nullable=True, server_default="0"),
        sa.Column("carbs", sa.Float(), nullable=True, server_default="0"),
        sa.Column("fiber", sa.Float(), nullable=True, server_default="0"),
        sa.Column("sugar", sa.Float(), nullable=True, server_default="0"),
        sa.Column("sodium_mg", sa.Float(), nullable=True, server_default="0"),
        sa.Column("saturated_fat", sa.Float(), nullable=True, server_default="0"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_food_entries_user"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_food_entries_user_id", "food_entries", ["user_id"])
    op.create_index("ix_food_entries_date", "food_entries", ["date"])

    op.create_table(
        "daily_metrics",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.String(), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("waist_cm", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_daily_metrics_user"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "date", name="uix_user_metric_date"),
    )
    op.create_index("ix_daily_metrics_user_id", "daily_metrics", ["user_id"])
    op.create_index("ix_daily_metrics_date", "daily_metrics", ["date"])

    op.create_table(
        "profile",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=True, server_default=""),
        sa.Column("goal", sa.String(), nullable=True, server_default="weight_loss"),
        sa.Column("sex", sa.String(), nullable=True, server_default="male"),
        sa.Column("activity_factor", sa.Float(), nullable=True, server_default="1.35"),
        sa.Column("daily_calorie_target", sa.Integer(), nullable=True, server_default="2200"),
        sa.Column("protein_target_g", sa.Integer(), nullable=True, server_default="140"),
        sa.Column("fat_target_g", sa.Integer(), nullable=True, server_default="73"),
        sa.Column("carbs_target_g", sa.Integer(), nullable=True, server_default="220"),
        sa.Column("fiber_target_g", sa.Integer(), nullable=True, server_default="25"),
        sa.Column("sugar_target_g", sa.Integer(), nullable=True, server_default="50"),
        sa.Column("sodium_target_mg", sa.Integer(), nullable=True, server_default="2300"),
        sa.Column("saturated_fat_target_g", sa.Integer(), nullable=True, server_default="20"),
        sa.Column("current_weight_kg", sa.Float(), nullable=True, server_default="79"),
        sa.Column("target_weight_kg", sa.Float(), nullable=True, server_default="72"),
        sa.Column("height_cm", sa.Integer(), nullable=True, server_default="172"),
        sa.Column("age", sa.Integer(), nullable=True, server_default="34"),
        sa.Column("created_at", sa.String(), nullable=True, server_default=""),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_profile_user"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_profile_user_id"),
    )


def downgrade() -> None:
    op.drop_table("profile")
    op.drop_table("daily_metrics")
    op.drop_table("food_entries")
    op.drop_table("users")
