# Developer Guide

Complete setup and development instructions for Society Food Platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Database Setup](#database-setup)
- [Backend Development](#backend-development)
- [Frontend Development](#frontend-development)
- [Docker Setup](#docker-setup)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Common Tasks](#common-tasks)
- [Debugging](#debugging)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **Python**: 3.10 or higher
- **Node.js**: 16 or higher
- **PostgreSQL**: 14 or higher
- **Git**: 2.25+
- **Docker**: 20.10+ (optional)

### Installation

#### Python
```bash
# macOS
brew install python@3.10

# Ubuntu/Debian
sudo apt-get install python3.10 python3.10-venv

# Windows
# Download from https://www.python.org/downloads/
```

#### PostgreSQL
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Windows
# Download from https://www.postgresql.org/download/windows/
```

#### Node.js
```bash
# macOS
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows
# Download from https://nodejs.org/
```

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/society-food-platform.git
cd society-food-platform
git checkout develop
```

### 2. Create Feature Branch

```bash
git checkout -b feature/your-feature develop
```

### 3. Set Up Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# nano .env
```

### 4. Set Up Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env
# REACT_APP_API_URL=http://localhost:8000
```

### 5. Database Setup

#### With Docker (Recommended)

```bash
# Start PostgreSQL
docker run --name society-food-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=society_food \
  -p 5432:5432 \
  -d postgres:14-alpine
```

#### Manual Setup

```bash
# Start PostgreSQL service
# macOS: brew services start postgresql
# Ubuntu: sudo service postgresql start

# Create database and user
psql -U postgres

postgres=# CREATE DATABASE society_food;
postgres=# CREATE USER dev WITH PASSWORD 'devpassword';
postgres=# ALTER ROLE dev SET client_encoding TO 'utf8';
postgres=# ALTER ROLE dev SET default_transaction_isolation TO 'read committed';
postgres=# ALTER ROLE dev SET timezone TO 'UTC';
postgres=# GRANT ALL PRIVILEGES ON DATABASE society_food TO dev;
postgres=# \q
```

### 6. Database Migrations

```bash
cd backend

# Apply migrations
alembic upgrade head

# Verify tables created
alembic current
```

## Backend Development

### Start Development Server

```bash
cd backend

# Activate virtual environment
source venv/bin/activate

# Start FastAPI development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Access:**
- API: http://localhost:8000
- Interactive Docs (Swagger): http://localhost:8000/docs
- Alternative Docs (ReDoc): http://localhost:8000/redoc

### File Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry
│   ├── config.py               # Settings
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py         # Authentication endpoints
│   │   │   ├── sellers.py      # Seller endpoints
│   │   │   ├── menus.py        # Menu management
│   │   │   ├── orders.py       # Order management
│   │   │   ├── ratings.py      # Ratings endpoints
│   │   │   └── admin.py        # Admin endpoints
│   ├── core/
│   │   └── security.py         # Auth helpers
│   ├── db/
│   │   ├── base.py             # SQLAlchemy base
│   │   └── models.py           # ORM models
│   ├── schemas/                # Pydantic schemas
│   ├── services/               # Business logic
│   └── utils/
│       ├── otp.py              # OTP generation
│       ├── exceptions.py       # Custom exceptions
│       └── logger.py           # Logging setup
├── tests/
│   ├── conftest.py             # pytest config
│   ├── test_auth.py
│   ├── test_sellers.py
│   └── test_orders.py
├── migrations/                 # Alembic migrations
├── requirements.txt            # Dependencies
├── requirements-dev.txt        # Dev dependencies
├── .env.example                # Environment template
└── Dockerfile
```

### Adding a New Endpoint

```python
# backend/app/api/routes/example.py

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.models import YourModel
from app.schemas import YourSchema
from app.core.security import get_current_user

router = APIRouter(prefix="/api/v1/example", tags=["example"])

@router.get("/{item_id}")
async def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get an example item"""
    item = db.query(YourModel).filter(YourModel.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("/")
async def create_item(
    item: YourSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new item"""
    db_item = YourModel(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
```

### Environment Variables

```bash
# .env file
DATABASE_URL=postgresql://dev:devpassword@localhost:5432/society_food
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# OTP
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5

# Email
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SENDER_EMAIL=noreply@example.com

# Environment
ENVIRONMENT=development
LOG_LEVEL=DEBUG
CORS_ORIGINS=http://localhost:3000
```

## Frontend Development

### Start Development Server

```bash
cd frontend

# Start React development server
npm start

# Opens browser at http://localhost:3000
```

### File Structure

```
frontend/
├── public/
│   ├── index.html              # HTML entry point
│   ├── manifest.json           # PWA manifest
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── OTPLogin.jsx
│   │   │   └── Registration.jsx
│   │   ├── Seller/
│   │   │   ├── MenuManager.jsx
│   │   │   ├── OrderDashboard.jsx
│   │   │   └── Stats.jsx
│   │   ├── Buyer/
│   │   │   ├── FoodBrowser.jsx
│   │   │   ├── Cart.jsx
│   │   │   └── OrderTracker.jsx
│   │   └── common/
│   │       ├── Header.jsx
│   │       └── Navigation.jsx
│   ├── pages/
│   │   ├── SellerDashboard.jsx
│   │   ├── BuyerDashboard.jsx
│   │   ├── Orders.jsx
│   │   └── Profile.jsx
│   ├── services/
│   │   └── api.js              # API client
│   ├── utils/
│   │   ├── auth.js
│   │   ├── constants.js
│   │   └── helpers.js
│   ├── App.jsx                 # Root component
│   └── index.js                # Entry point
├── package.json
├── .env.example
├── .eslintrc.json
├── .prettierrc
└── Dockerfile
```

### Adding a React Component

```jsx
// src/components/MyComponent.jsx

import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import './MyComponent.css';

const MyComponent = ({ data }) => {
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    // Component initialization
  }, []);

  return (
    <div className="my-component">
      <h2>{data.title}</h2>
      {loading ? <p>Loading...</p> : <p>{data.content}</p>}
    </div>
  );
};

export default MyComponent;
```

### API Calls

```jsx
// src/services/api.js

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 10000,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

## Docker Setup

### Development with Docker Compose

```bash
# Start all services
docker-compose up -d

# Check services
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Run migrations
docker-compose exec backend alembic upgrade head

# Stop services
docker-compose down
```

### Environment File

Create `.env` in root (or Docker will use defaults):

```bash
# Database
POSTGRES_PASSWORD=password
POSTGRES_DB=society_food

# Backend
DATABASE_URL=postgresql://postgres:password@postgres:5432/society_food
REDIS_URL=redis://redis:6379
SECRET_KEY=dev-secret-key
ENVIRONMENT=development

# Frontend
REACT_APP_API_URL=http://localhost:8000
```

## Testing

### Backend Testing

```bash
cd backend

# Run all tests
pytest

# Run specific test file
pytest tests/test_auth.py

# Run with coverage
pytest --cov=app tests/

# Watch mode (requires pytest-watch)
ptw
```

### Frontend Testing

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Writing Tests

```python
# backend/tests/test_example.py

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_item():
    response = client.get("/api/v1/example/1")
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_create_item(db_session):
    data = {"name": "Test Item"}
    response = client.post("/api/v1/example/", json=data)
    assert response.status_code == 201
```

## Code Quality

### Format Code

```bash
# Backend - Format with Black
cd backend && black .

# Frontend - Format with Prettier
cd frontend && npm run format
```

### Lint Code

```bash
# Backend
cd backend && flake8 .

# Frontend
cd frontend && npm run lint
```

### Type Checking

```bash
# Backend
cd backend && mypy app/

# Frontend (using JSDoc)
# Inline type hints in comments
/** @param {string} name - User name */
```

### Pre-commit Hooks

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

## Common Tasks

### Creating a Database Migration

```bash
cd backend

# Create migration file
alembic revision --autogenerate -m "Add column to users table"

# Review migration in migrations/versions/
# nano migrations/versions/xxxxx_add_column_to_users_table.py

# Apply migration
alembic upgrade head
```

### Adding a Dependency

```bash
# Backend
cd backend
pip install new-package
pip freeze > requirements.txt

# Frontend
cd frontend
npm install new-package
npm install --save-dev new-dev-package
```

### Running Async Workers

```bash
# Celery worker (if configured)
cd backend
celery -A app.workers worker --loglevel=info
```

## Debugging

### Backend Debugging

#### pdb (Python Debugger)

```python
# Add breakpoint in code
import pdb; pdb.set_trace()

# When code runs, you'll get a prompt
# Commands: l (list), n (next), c (continue), p (print), q (quit)
```

#### VSCode Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app.main:app", "--reload"],
      "jinja": true,
      "cwd": "${workspaceFolder}/backend"
    }
  ]
}
```

### Frontend Debugging

- **React DevTools**: Chrome extension
- **Network Tab**: Check API requests
- **Console**: View logs with `console.log()`
- **VSCode Debugger**: Built-in

## Troubleshooting

### Port Already in Use

```bash
# macOS/Linux - Find process using port 8000
lsof -i :8000
kill -9 <PID>

# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process
```

### PostgreSQL Connection Error

```bash
# Check if PostgreSQL is running
# macOS: brew services list
# Ubuntu: sudo service postgresql status

# Test connection
psql -U dev -d society_food -c "SELECT 1"
```

### Python Module Not Found

```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Node Modules Issue

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### CORS Error

Check `.env`:
```
CORS_ORIGINS=http://localhost:3000
```

### Environment Variables Not Loading

```bash
# Backend - ensure .env file exists
cd backend
cp .env.example .env
# Edit .env with your values

# Restart server
```

---

For more help, see [Architecture Guide](./docs/architecture.md) or [README](./README.md).
