"""Database models"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class User(Base):
    """User model for buyers, sellers, and admins"""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    flat_number = Column(String(50), nullable=True, index=True)
    role = Column(String(50), nullable=False, default="buyer")  # buyer, seller, admin
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    otp_secret = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    seller_profile = relationship("SellerProfile", back_populates="user", uselist=False)
    orders_as_buyer = relationship(
        "Order", back_populates="buyer", foreign_keys="Order.buyer_id"
    )
    orders_as_seller = relationship(
        "Order", back_populates="seller", foreign_keys="Order.seller_id"
    )


class SellerProfile(Base):
    """Seller profile information"""

    __tablename__ = "seller_profiles"

    id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    bio = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    bank_account = Column(String(255), nullable=True)  # Encrypted
    upi_id = Column(String(255), nullable=True)  # Encrypted
    rating = Column(Float, default=0)
    review_count = Column(Integer, default=0)
    is_approved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="seller_profile")
    menus = relationship("Menu", back_populates="seller")
    ratings = relationship("Rating", back_populates="seller")


class Menu(Base):
    """Menu items offered by sellers"""

    __tablename__ = "menus"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id"), index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False)  # veg, non-veg, snacks, desserts
    price = Column(Float, nullable=False)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    seller = relationship("SellerProfile", back_populates="menus")


class Order(Base):
    """Orders placed by buyers"""

    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), index=True)
    seller_id = Column(Integer, ForeignKey("users.id"), index=True)
    status = Column(String(50), default="pending")  # pending, accepted, ready, completed, cancelled
    items = Column(Text, nullable=False)  # JSON: [{"menu_id": 1, "quantity": 2}]
    total_price = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    buyer = relationship("User", back_populates="orders_as_buyer", foreign_keys=[buyer_id])
    seller = relationship("User", back_populates="orders_as_seller", foreign_keys=[seller_id])


class Rating(Base):
    """Ratings and reviews for sellers"""

    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, nullable=False, index=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id"), index=True)
    rater_id = Column(Integer, ForeignKey("users.id"), index=True)
    score = Column(Integer, nullable=False)  # 1-5
    review_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    seller = relationship("SellerProfile", back_populates="ratings")
    rater = relationship("User")
