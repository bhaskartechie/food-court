# Architecture Guide

## System Overview

Society Food Platform is a peer-to-peer marketplace connecting home food sellers with apartment residents. This guide explains the system design, components, and data flows.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React PWA)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Buyer UI    │  │  Seller UI   │  │  Admin Dashboard     │  │
│  └────────┬─────┘  └────────┬─────┘  └──────────┬───────────┘  │
└───────────┼─────────────────┼─────────────────────┼──────────────┘
            │                 │                     │
            └─────────────────┼─────────────────────┘
                              │ HTTPS / WebSocket
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway / Load Balancer                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ↓             ↓             ↓
         ┌────────────────────────────────┐
         │  FastAPI Backend Application   │
         │  ┌──────────────────────────┐  │
         │  │ Routes                   │  │
         │  │ - auth.py (OTP login)    │  │
         │  │ - sellers.py             │  │
         │  │ - menus.py               │  │
         │  │ - orders.py              │  │
         │  │ - ratings.py             │  │
         │  │ - admin.py               │  │
         │  └──────────────────────────┘  │
         │  ┌──────────────────────────┐  │
         │  │ Services & Business Logic│  │
         │  │ - OTP service            │  │
         │  │ - Seller service         │  │
         │  │ - Order service          │  │
         │  │ - Rating service         │  │
         │  └──────────────────────────┘  │
         └────────────┬────────────────────┘
                      │
         ┌────────────┼────────────┐
         ↓            ↓            ↓
    ┌─────────┐  ┌────────┐  ┌──────────┐
    │PostgreSQL│  │ Redis  │  │ Email    │
    │ Database │  │ Cache  │  │ Service  │
    └─────────┘  └────────┘  └──────────┘
```

## Core Components

### 1. Frontend (React PWA)

**Technology Stack:**
- React 18+ with Hooks
- Redux Toolkit for state management
- Material-UI for components
- PWA capabilities (offline, installable)

**Components:**
- **Auth**: OTP login, registration
- **Seller**: Menu manager, order dashboard
- **Buyer**: Menu browser, order tracker, cart
- **Admin**: Seller approval, analytics

**Key Features:**
- Mobile-first responsive design
- Offline support with service workers
- Real-time WebSocket updates
- Progressive Web App installable

### 2. Backend (FastAPI)

**Technology Stack:**
- FastAPI for API framework
- SQLAlchemy for ORM
- PostgreSQL for database
- Redis for caching (optional)
- Alembic for database migrations

**API Routes:**
```
/api/v1/
├── auth/
│   ├── POST /register (OTP)
│   ├── POST /login (OTP verification)
│   ├── POST /refresh (JWT)
│   └── GET /me (current user)
├── sellers/
│   ├── GET /sellers (list available)
│   ├── POST /register (seller signup)
│   ├── GET /{seller_id} (seller profile)
│   └── GET /{seller_id}/ratings (seller rating)
├── menus/
│   ├── GET /sellers/{seller_id}/menus
│   ├── POST /sellers/{seller_id}/menus (seller only)
│   ├── PUT /menus/{menu_id} (seller only)
│   └── DELETE /menus/{menu_id} (seller only)
├── orders/
│   ├── POST /orders (place order)
│   ├── GET /orders (my orders)
│   ├── GET /orders/{order_id} (order detail)
│   ├── PUT /orders/{order_id}/status (seller)
│   └── GET /sellers/{seller_id}/orders (seller orders)
├── ratings/
│   ├── POST /orders/{order_id}/rate (buyer)
│   └── GET /sellers/{seller_id}/ratings (seller ratings)
└── admin/
    ├── GET /sellers/pending (pending approvals)
    ├── POST /sellers/{seller_id}/approve (approve)
    └── GET /analytics (platform stats)
```

## Data Models

### User
```
id (PK)
name
email
phone
role (seller | buyer | admin)
flat_number (for resident verification)
is_verified
otp_secret
created_at
updated_at
```

### Seller Profile
```
id (FK to User)
bio
photo_url
bank_account (encrypted)
upi_id (encrypted)
rating (avg)
review_count
is_approved
created_at
updated_at
```

### Menu
```
id (PK)
seller_id (FK)
name
description
category (veg | non-veg | snacks | desserts)
price
is_available (daily)
created_at
updated_at
```

### Order
```
id (PK)
buyer_id (FK to User)
seller_id (FK to User)
items (JSON: [{ menu_id, quantity, price }])
total_price
status (pending | accepted | ready | completed | cancelled)
notes
delivery_date
created_at
completed_at
```

### Rating
```
id (PK)
order_id (FK)
rater_id (FK to User - buyer)
seller_id (FK to User)
score (1-5)
review_text
created_at
```

## Data Flows

### 1. OTP Authentication Flow

```
User (Frontend)
   │
   └─→ POST /api/v1/auth/register
       {"email": "user@example.com", "role": "buyer"}
       │
       ↓
   FastAPI Backend
       │
       ├─→ Generate OTP (6 digits, 10 min expiry)
       ├─→ Store in Redis with TTL
       ├─→ Send email with OTP
       │
   User receives email with OTP
       │
       └─→ POST /api/v1/auth/login
           {"email": "user@example.com", "otp": "123456"}
           │
           ↓
       FastAPI Backend
           │
           ├─→ Validate OTP from Redis
           ├─→ Create User in DB (if new)
           ├─→ Generate JWT token
           └─→ Return token + user data
                     │
   Frontend stores JWT in localStorage
                     │
       └─→ All subsequent requests include JWT in Authorization header
```

### 2. Seller Menu Creation Flow

```
Seller Dashboard (Frontend)
   │
   └─→ GET /api/v1/sellers/{seller_id}/menus
       │ Get existing menus
       ↓
   Seller adds new menu item
   │
   └─→ POST /api/v1/menus
       {
         "name": "Masala Dosa",
         "category": "veg",
         "price": 60,
         "description": "Crispy dosa with sambar"
       }
       │
       ↓
   FastAPI Backend
       │
       ├─→ Validate seller ownership (JWT)
       ├─→ Store in PostgreSQL
       ├─→ Update Redis cache
       └─→ Return created menu
       │
   Frontend updates UI
```

### 3. Order Placement Flow

```
Buyer Dashboard (Frontend)
   │
   └─→ GET /api/v1/sellers
       Get all available sellers
       │
       ↓
   Buyer selects seller → GET /api/v1/sellers/{id}/menus
   │
   └─→ Browse menu items
       │
       ├─→ Add to cart: [{ menu_id: 1, qty: 2 }, ...]
       │
       └─→ POST /api/v1/orders
           {
             "seller_id": 5,
             "items": [{"menu_id": 1, "quantity": 2}],
             "notes": "Less spicy"
           }
           │
           ↓
       FastAPI Backend
           │
           ├─→ Calculate total price
           ├─→ Create Order (status: pending)
           ├─→ Store in PostgreSQL
           ├─→ Notify seller (email/notification)
           └─→ Return order ID
           │
   Frontend shows "Order placed" confirmation
           │
   Buyer + Seller can track real-time status
```

### 4. Order Status Update Flow

```
Seller Dashboard (Frontend)
   │
   └─→ GET /api/v1/sellers/{seller_id}/orders
       See pending orders
       │
       ↓
   Seller clicks "Mark as Ready"
   │
   └─→ PUT /api/v1/orders/{order_id}/status
       {
         "status": "ready",
         "notes": "Order ready for pickup"
       }
       │
       ↓
   FastAPI Backend
       │
       ├─→ Update Order status in DB
       ├─→ Emit WebSocket event to buyer
       └─→ Send notification
       │
   Buyer Frontend (subscribed to WebSocket)
       │
       └─→ Receives status update
           Updates order tracking page
           Shows "Ready for pickup" alert
```

### 5. Rating Flow

```
Buyer Dashboard (Frontend - after order completed)
   │
   └─→ GET /api/v1/orders/{order_id}
       │
       ↓
   Buyer submits rating
   │
   └─→ POST /api/v1/orders/{order_id}/rate
       {
         "score": 5,
         "review": "Great food, fresh ingredients!"
       }
       │
       ↓
   FastAPI Backend
       │
       ├─→ Create Rating in DB
       ├─→ Recalculate seller average rating
       ├─→ Update seller profile
       └─→ Return rating
       │
   Frontend updates seller profile with new rating
```

## Authentication & Security

### OTP Strategy
- **Generation**: 6-digit random code
- **Delivery**: Email (primary), WhatsApp (optional)
- **Storage**: Redis with 10-minute TTL
- **Validation**: One-time use, rate-limited
- **Token**: JWT (access + refresh tokens)

### JWT Token Flow
- **Access Token**: Short-lived (30 min), includes user_id, role
- **Refresh Token**: Long-lived (7 days), stored in HTTP-only cookie
- **Payload**: Sub (user_id), role, exp, iat
- **Secret**: 256-bit key, rotated regularly

### Password-less Auth
- No password storage needed for Phase 1
- OTP-only authentication
- Future: Add optional password option in Phase 2

## Deployment Architecture

### Development
```
Local Machine
├── Docker Compose
│   ├── PostgreSQL
│   ├── Redis
│   ├── FastAPI backend (uvicorn --reload)
│   └── React frontend (npm start)
└── Hot-reload enabled
```

### Staging
```
Cloud Server (AWS/GCP)
├── RDS PostgreSQL 14
├── ElastiCache Redis 7
├── ECS Fargate Backend
├── CloudFront + S3 Frontend
└── GitHub Actions auto-deploy on merge to develop
```

### Production
```
Cloud Server (AWS/GCP)
├── RDS PostgreSQL (multi-AZ, backup)
├── ElastiCache Redis (cluster mode)
├── ECS Fargate Backend (auto-scaling)
├── CloudFront + S3 Frontend (CDN)
├── Application Load Balancer
└── GitHub Actions auto-deploy on release tag
```

## Performance Considerations

### Database Indexing
```sql
CREATE INDEX idx_seller_menus ON menus(seller_id, is_available);
CREATE INDEX idx_orders_status ON orders(status, created_at);
CREATE INDEX idx_ratings_seller ON ratings(seller_id);
```

### Caching Strategy
- Menu listings: 1 hour TTL
- Seller profiles: 30 minutes TTL
- Ratings: 24 hours TTL
- Session data: 7 days TTL

### API Optimization
- Pagination: 20 items per page default
- Lazy loading for large lists
- Request compression (gzip)
- HTTP caching headers

## Error Handling

### Standard Response Format
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### Error Responses
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [...]
  }
}
```

### HTTP Status Codes
- 200: OK
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict (duplicate)
- 500: Internal Server Error

## Monitoring & Logging

### Structured Logging
- JSON format with: timestamp, level, module, message
- Levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
- Centralized logging (ELK stack or CloudWatch)

### Metrics
- API response times (p50, p95, p99)
- Database query times
- Error rates by endpoint
- Active users
- Order volume

### Alerts
- API error rate > 5%
- Database connection pool exhaustion
- Redis memory usage > 90%
- Order processing delay > 5 minutes

## Future Enhancements (Phase 2+)

- Payment gateway integration
- Real delivery with tracking
- Advanced matching algorithm
- Machine learning recommendations
- Mobile app (native)
- Subscription meal plans
- Bulk orders for events
- Analytics dashboard
