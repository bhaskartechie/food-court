"""Pytest configuration and shared fixtures."""

import os
from collections.abc import Generator
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.dependencies import get_db
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.models import User
from app.db.models.enums import UserRole
from app.main import app

# Use in-memory SQLite for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db(setup_db) -> Generator[Session, None, None]:
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def test_buyer(db: Session) -> User:
    user = User(
        name="Test Buyer",
        email="buyer@test.com",
        hashed_password=hash_password("password123"),
        role=UserRole.buyer,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def buyer_token(test_buyer: User) -> str:
    return create_access_token(test_buyer.id, str(test_buyer.role))

@pytest.fixture
def buyer_headers(buyer_token: str) -> dict:
    return {"Authorization": f"Bearer {buyer_token}"}

@pytest.fixture
def test_seller(db: Session) -> User:
    user = User(
        name="Test Seller",
        email="seller_fixture@test.com",
        hashed_password=hash_password("password123"),
        role=UserRole.seller,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def seller_token(test_seller: User) -> str:
    return create_access_token(test_seller.id, str(test_seller.role))

@pytest.fixture
def seller_headers(seller_token: str) -> dict:
    return {"Authorization": f"Bearer {seller_token}"}

