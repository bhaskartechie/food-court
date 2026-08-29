# Society Food Platform — Backend API (`v1.1.0-alpha.1`)

FastAPI backend application powering the Society Food Platform marketplace.

## Features & Implementation Status

| Module | Status | Description |
|--------|--------|-------------|
| **Auth & Security** | 🟢 Complete | JWT access/refresh tokens, Bcrypt password hashing, RBAC (`buyer`, `seller`, `admin`). |
| **Seller Management** | 🟢 Complete | Profile registration, update, open/closed store toggle (`PATCH /sellers/me/open`). |
| **Menu Management** | 🟢 Complete | Menu CRUD, availability toggle, category filtering, search, and image uploads (`/uploads/menus`). |
| **Order Processing** | 🟢 Complete | Order placement, lifecycle state machine (`pending` → `accepted` → `ready` → `completed`), history. |
| **WebSockets** | 🟢 Complete | Real-time push updates for order status and delivery tracking (`/ws/orders/{id}`). |
| **Email Notifications** | 🟢 Complete | Asynchronous event-driven emails (`aiosmtplib` BackgroundTasks) for orders & deliveries. |
| **Ratings & Reviews** | 🟢 Complete | Buyer order ratings (1-5 stars), review text, automatic rating aggregation. |
| **Payments (Razorpay)** | 🟢 Complete | Order payment creation, signature verification capture, automated webhooks, refunds. |
| **Ledger & Payouts** | 🟢 Complete | Double-entry accounting ledger (`LedgerEntry`), seller balance tracking, payout lifecycle. |
| **In-Building Delivery** | 🟢 Complete | Delivery creation, door-to-door dispatch/delivered status tracking, flat routing. |
| **Admin Panel** | 🟢 Complete | Seller verification approval/rejection, user management, platform analytics & revenue. |

---

## API Endpoints Overview

- **Auth**: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me`, `PATCH /api/v1/auth/me/password`
- **Sellers**: `GET /api/v1/sellers/`, `POST /api/v1/sellers/register`, `GET /api/v1/sellers/me`, `PUT /api/v1/sellers/me`, `PATCH /api/v1/sellers/me/open`, `GET /api/v1/sellers/{id}`
- **Buyers**: `GET /api/v1/buyers/me`, `PUT /api/v1/buyers/me`, `GET /api/v1/buyers/me/orders`
- **Menus**: `GET /api/v1/menus/sellers/{id}`, `POST /api/v1/menus/`, `PUT /api/v1/menus/{id}`, `DELETE /api/v1/menus/{id}`, `PATCH /api/v1/menus/{id}/availability`, `POST /api/v1/menus/{id}/image`
- **Orders**: `POST /api/v1/orders/`, `GET /api/v1/orders/{id}`, `PUT /api/v1/orders/{id}/status`
- **Ratings**: `POST /api/v1/ratings/orders/{id}`, `GET /api/v1/ratings/sellers/{id}`
- **Payments**: `POST /api/v1/payments/orders/{id}/initiate`, `POST /api/v1/payments/orders/{id}/capture`, `POST /api/v1/payments/webhook`, `GET /api/v1/payments/balance/me`, `GET /api/v1/payments/ledger/me`
- **Payouts**: `GET /api/v1/payouts/me`, `GET /api/v1/payouts/`, `POST /api/v1/payouts/{seller_id}/initiate`, `PUT /api/v1/payouts/{id}/confirm`, `PUT /api/v1/payouts/{id}/fail`
- **Deliveries**: `POST /api/v1/deliveries/orders/{id}`, `PATCH /api/v1/deliveries/{id}/status`, `GET /api/v1/deliveries/me`, `GET /api/v1/deliveries/orders/{id}`
- **Admin**: `GET /api/v1/admin/sellers/pending`, `POST /api/v1/admin/sellers/{id}/approve`, `POST /api/v1/admin/sellers/{id}/reject`, `GET /api/v1/admin/residents`, `PATCH /api/v1/admin/users/{id}/status`, `GET /api/v1/admin/analytics`, `POST /api/v1/admin/orders/{id}/refund`
- **WebSockets**: `WS /ws/orders/{order_id}`

---

## Quick Start

### 1. Environment Setup

```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

### 2. Database Migrations

```bash
alembic upgrade head
```

### 3. Run Development Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API Docs (Swagger): `http://localhost:8000/api/v1/docs`
- ReDoc: `http://localhost:8000/api/v1/redoc`

---

## Testing

```bash
# Run pytest test suite
pytest tests/ -v

# Run full API regression & telemetry runner against active server
python tests/api_test_runner.py
```
