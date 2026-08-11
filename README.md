# Society Food Platform

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/yourusername/society-food-platform/actions)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18.0%2B-blue)](https://react.dev/)
[![ISO 9001](https://img.shields.io/badge/ISO-9001:2015-green)]()
[![ISO 27001](https://img.shields.io/badge/ISO-27001:2022-green)]()

A home-based food seller platform for residential societies. Connect home chefs with residents for fresh, home-cooked meals delivered daily.

## Table of Contents

- [Overview](#overview)
- [Phase 1 Features](#phase-1-features)
- [Tech Stack](#tech-stack)
- [Screenshots](#screenshots)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Documentation](#documentation)
- [License](#license)

## Overview

**Society Food Platform** is a peer-to-peer food marketplace connecting home food sellers with residents of apartment societies. Phase 1 focuses on core functionality: seller menus, order placement, and pickup management.

**Key Benefits:**
- 🏠 Fresh, home-cooked meals from trusted neighbors
- 👨‍🍳 Fair compensation for home food entrepreneurs
- 📱 Simple, mobile-friendly interface
- ✅ Community-verified sellers
- 🚫 No delivery charges – pickup only
- 💬 Direct communication between seller and buyer

## Phase 1 Features

### For Sellers
- ✅ Seller registration (admin verification by flat number)
- ✅ Daily menu creation (Veg, Non-Veg, Snacks, Desserts)
- ✅ Price setting and menu updates
- ✅ Order management dashboard
- ✅ Mark orders as "Ready for Pickup"
- ✅ View order history and earnings
- ✅ Accept/reject orders (optional)
- ✅ Receive ratings from buyers

### For Buyers
- ✅ Browse available sellers and menus
- ✅ Filter by category (Veg, Non-Veg, Snacks, Desserts)
- ✅ Place orders (cash on pickup)
- ✅ Track order status in real-time
- ✅ Rate sellers (1-5 stars)
- ✅ View seller ratings and reviews
- ✅ Order history

### Admin Features
- ✅ Approve/reject seller registrations
- ✅ Manage society residents database
- ✅ Verify flat numbers
- ✅ Monitor platform activity

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Backend** | Python (FastAPI) | 3.10+ |
| **Frontend** | React + PWA | 18.0+ |
| **Database** | PostgreSQL | 14+ |
| **Authentication** | OTP (Email/WhatsApp) | - |
| **Cache** | Redis (optional) | 7+ |
| **Containerization** | Docker | 20+ |
| **CI/CD** | GitHub Actions | - |

## Screenshots

> [TODO: Add screenshots]
> - Seller dashboard with menu management
> - Buyer dashboard browsing available meals
> - Order tracking interface
> - Rating system

## Quick Start

### Prerequisites

- Python 3.10 or higher
- Node.js 16 or higher
- PostgreSQL 14 or higher
- Docker & Docker Compose (optional but recommended)
- Git

### Installation

#### Clone Repository

```bash
git clone https://github.com/yourusername/society-food-platform.git
cd society-food-platform

# Switch to develop branch
git checkout develop

# Create your feature branch
git checkout -b feature/your-feature-name
```

#### Backend Setup (FastAPI)

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
venv\Scripts\activate
# Or on macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env with your settings

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup (React PWA)

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your API URL

# Start development server
npm start

# Access at http://localhost:3000
```

#### Docker Setup (Recommended)

```bash
# Build and start all services
docker-compose up -d

# Run migrations
docker-compose exec backend alembic upgrade head

# Access the app
# Frontend: http://localhost:3000
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

## Usage

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Production Build

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### API Documentation

Once backend is running:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Project Structure

```
society-food-platform/
├── backend/                          # FastAPI backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # Entry point
│   │   ├── config.py                 # Configuration
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py          # Authentication (OTP)
│   │   │   │   ├── sellers.py       # Seller endpoints
│   │   │   │   ├── menus.py         # Menu management
│   │   │   │   ├── orders.py        # Order management
│   │   │   │   ├── ratings.py       # Ratings & reviews
│   │   │   │   └── admin.py         # Admin endpoints
│   │   ├── core/
│   │   │   ├── security.py          # Authentication logic
│   │   │   └── config.py            # Settings
│   │   ├── db/
│   │   │   ├── base.py              # SQLAlchemy base
│   │   │   └── models.py            # Database models
│   │   ├── schemas/                 # Pydantic schemas
│   │   ├── services/                # Business logic
│   │   └── utils/
│   │       ├── logger.py
│   │       ├── exceptions.py
│   │       └── otp.py               # OTP generation/validation
│   ├── tests/                       # Unit & integration tests
│   ├── migrations/                  # Alembic migrations
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   ├── setup.cfg
│   └── README.md
│
├── frontend/                         # React PWA
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json            # PWA manifest
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/              # Shared components
│   │   │   │   ├── Header.jsx
│   │   │   │   ├── Footer.jsx
│   │   │   │   └── Navigation.jsx
│   │   │   ├── Auth/
│   │   │   │   ├── OTPLogin.jsx
│   │   │   │   └── Registration.jsx
│   │   │   ├── Seller/
│   │   │   │   ├── MenuManager.jsx
│   │   │   │   ├── OrderDashboard.jsx
│   │   │   │   └── Stats.jsx
│   │   │   ├── Buyer/
│   │   │   │   ├── FoodBrowser.jsx
│   │   │   │   ├── Cart.jsx
│   │   │   │   └── OrderTracker.jsx
│   │   │   └── Rating/
│   │   │       └── RatingForm.jsx
│   │   ├── pages/
│   │   │   ├── SellerDashboard.jsx
│   │   │   ├── BuyerDashboard.jsx
│   │   │   ├── Menu.jsx
│   │   │   ├── Orders.jsx
│   │   │   └── Profile.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── utils/
│   │   │   ├── auth.js
│   │   │   └── constants.js
│   │   ├── App.jsx
│   │   └── index.js
│   ├── package.json
│   ├── .env.example
│   ├── .eslintrc.json
│   ├── .prettierrc
│   ├── Dockerfile
│   └── README.md
│
├── docs/                             # Documentation
│   ├── architecture.md               # System design
│   ├── developer-guide.md            # Setup & development
│   └── user-guide.md                 # User documentation
│
├── .github/
│   ├── workflows/
│   │   └── ci.yml                    # CI/CD pipeline
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
│
├── .gitignore
├── .pre-commit-config.yaml
├── docker-compose.yml
├── docker-compose.prod.yml
├── README.md
├── BRANCHING.md
├── COMMIT_CONVENTIONS.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── PROJECT_BOARD.md
├── LICENSE
└── .env.example
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Documentation

- **[README.md](./README.md)** - Project overview
- **[Architecture Guide](./docs/architecture.md)** - System design
- **[Developer Guide](./docs/developer-guide.md)** - Setup and testing
- **[User Guide](./docs/user-guide.md)** - Feature documentation
- **[Branching Strategy](./BRANCHING.md)** - Git workflow
- **[Commit Conventions](./COMMIT_CONVENTIONS.md)** - Commit format
- **[Project Board](./PROJECT_BOARD.md)** - Phase 1 roadmap

## Standards & Compliance

This project adheres to:
- **ISO 9001:2015** - Quality Management System
- **ISO/IEC 12207** - Software lifecycle processes
- **ISO/IEC 27001:2022** - Information security management

## Testing

```bash
# Backend
cd backend
pytest tests/ --cov=app

# Frontend
cd frontend
npm test -- --coverage
```

## Deployment

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

See [docs/developer-guide.md](./docs/developer-guide.md#troubleshooting) for common issues.

## License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) file for details.

## Support

- 📧 **Email**: support@societyfood.local
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/society-food-platform/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/society-food-platform/discussions)

---

**Made with ❤️ for food-loving communities**
