# Changelog

All notable changes to Society Food Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-09-23

### Added
- **Chef Menu Management & Power Tools**:
  - Interactive **Edit Dish** dialog with pre-populated form state supporting name, category, pricing, portions, spice level, description, and photo updates via `PUT /api/v1/menus/{menu_id}`.
  - 1-Click **"Duplicate / Clone Dish"** button cloning active menu items into new drafts titled `Dish Name (Copy)`.
  - **Spice Level Indicator**: Database schema & Alembic migration `ea7fe3ab7835` adding `spice_level` (`mild`, `medium`, `hot`), displayed with badges (`🌶️ Mild`, `🌶️🌶️ Medium`, `🌶️🌶️🌶️ Hot`).
  - **Low Stock Urgency Badge**: Automated `⚠️ Only X portions left` indicators when inventory is between 1 and 3 portions.
  - **Local Device Photo Browsing**: Native file picker supporting `.jpg`, `.jpeg`, `.png`, and `.webp` with client-side 5MB size check, instant thumbnail previews, and upload to `/api/v1/menus/{id}/image`.
- **In-Flight Cart Concurrency & Real-Time Price Protection**:
  - Guard in `order_service.py` comparing cart item prices against current database prices at checkout.
  - Rejects transactions with HTTP 400 if prices differ by $> ₹0.01$, prompting buyers to review updated prices and preventing silent overcharging.
- **Automated Test Matrix Expansion**:
  - Added `seller-menu-edit.test.jsx` (Edit modal, clone workflow, spice badges, low stock alerts).
  - Added backend pytest cases for cart concurrency price guards and spice level CRUD in `test_orders.py`.
  - Backend test coverage reached **41/41 passing tests (100%)**; Frontend test coverage reached **27/27 passing tests across 11 test suites (100%)**.

### Fixed
- Resolved symptom where menu items were not rendering after creation due to `{ items: [...], total: N }` payload response parsing in `SellerDashboard.jsx`.

---

## [1.2.0] - 2026-09-15

### Added
- **Direct P2PM UPI & Zero-MDR Payment Flow**:
  - Direct buyer-to-seller UPI QR code generation with pre-populated chef VPA and order amount.
  - 12-digit bank UTR reference input and chef 1-tap confirmation workflow.
- **SaaS Pass Platform Maintenance Quota**:
  - 50 free orders per month platform allowance per chef.
  - Flat ₹5.00/order maintenance fee after quota via prepaid platform credit wallet.
  - Platform maintenance balance topup with QR code and UTR submission.
- **Community Cravings Demand Matching**:
  - Culinary algorithm matching community craving requests to resident chefs with real-time scoring.
  - 1-click batch launch directly from cravings radar.

---

## [1.1.0-beta.1] - 2026-08-30

### Added
- **Automated Punctuality & Speed Reliability Engine**:
  - Decoupled subjective customer star ratings from objective, automated punctuality scores (`on_time_delivery_rate`, `punctuality_rating`, `avg_delivery_minutes`, `total_orders_completed`).
  - Automated `punctuality_service.py` calculation engine for both instant orders (estimated prep time + 10m grace period) and pre-order batches (scheduled slot deadline + 10m grace period).
  - Automated profile recalculation hook whenever an order transitions to `OrderStatus.completed`.
  - Frontend trust badges rendered on Seller Cards, Menus, Buyer Dashboard, and Kitchen Command Center (`⚡ 98% On-Time`, `⏱️ ~22m avg`).
- **Multimodal AI Endpoints**:
  - `POST /api/v1/ai/analyze-dish`: Analyzes dish image/description to extract dietary tags (Veg, Vegan, Jain, Gluten-Free), allergens, estimated calories, macros, spice level, and fair price range.
  - `POST /api/v1/ai/meal-advisor`: Conversational society meal advisor assisting residents in discovering meals based on pantry cravings and dietary preferences.
  - Frontend API service wrapper `aiAPI` in `services/api.js`.
- **Staging Deployment & Pre-Flight Migration Verification**:
  - Multi-container staging stack (`docker-compose.staging.yml`) configured for `postgres`, `redis`, `backend`, and `frontend`.
  - Container `entrypoint.sh` upgraded with 30-attempt exponential retry loop against PostgreSQL and pre-flight `alembic upgrade head` validation check.
- **Frontend End-to-End Integration Test Suite**:
  - Comprehensive Jest + React Testing Library integration tests covering Cart Drawer multi-item checkout, Pre-Order batch scheduling, Community Cravings board & chef claiming, Kitchen Command Center health metrics, and Navigation/Auth routing (`4 test suites, 6 tests, 100% passing`).
- **Shopping Cart & Checkout Polish**:
  - Itemized subtotal, eco-packaging fee, doorstep delivery badge, and freshness/punctuality guarantee banner.

---

## [1.2.0-alpha.1] - 2026-08-30


### Added
- **Pre-Order Engine**:
  - Slot-based scheduled ordering supporting `lunch_today`, `dinner_today`, `lunch_tomorrow`, `dinner_tomorrow`, and `weekend_special`.
  - Configurable daily cutoff times (`preorder_cutoff_time`) and max portion batch sizes (`max_batch_quantity`) per menu item.
  - Doorstep delivery to apartment flat door vs. self-pickup selection (`delivery_type`).
- **Community Dish Suggestions & Wishlist Marketplace**:
  - Resident craving proposal endpoint (`POST /api/v1/suggestions/`).
  - Community upvoting system (`POST /api/v1/suggestions/{id}/upvote`) with live counter.
  - Chef claim flow (`POST /api/v1/suggestions/{id}/claim`) automatically spawning linked pre-order batch menu items.
- **Frontend Architecture & UX Overhaul**:
  - Warm Culinary design system (`#E05A2B` Terracotta, `#F6BD60` Warm Saffron, `#2EC4B6` Fresh Mint, `#12121A` Slate Obsidian).
  - Interactive slide-out **Cart Drawer** (`CartDrawer.jsx`) with multi-item quantities, dietary badges, delivery slot picker, and notes.
  - **Community Cravings Hub** (`SuggestionsBoard.jsx`) with dish proposal dialog and chef claim pre-order launcher.
  - **Menu Tabs & Countdown Cutoffs** (`Menu.jsx`) separating instant meals from pre-order batches.
  - **Seller Kitchen Command Center** (`SellerDashboard.jsx`) with morning batch prep sheets, master store open/closed switch, and 1-tap order advances.
  - **Buyer Live Stepper Tracker** (`BuyerDashboard.jsx`) for real-time order lifecycle and scheduled pre-order monitoring.

---

## [1.1.0-alpha.1] - 2026-08-30


### Added
- **Authentication & Authorization**:
  - JWT authentication with Bcrypt password hashing, access tokens, and refresh tokens (`/api/v1/auth/register`, `/login`, `/refresh`, `/me`, `/me/password`).
  - Role-Based Access Control (RBAC) supporting `buyer`, `seller`, and `admin`.
- **Seller Management**:
  - Seller onboarding and profile management (`/api/v1/sellers/register`, `/me`, `/me/open`, `/{id}`).
  - Instant store open/closed toggle (`PATCH /api/v1/sellers/me/open`).
  - Bank account and UPI ID storage with secure validation.
- **Menu Management**:
  - Complete menu item CRUD endpoints (`/api/v1/menus/`, PUT, DELETE).
  - Daily availability toggle (`PATCH /api/v1/menus/{id}/availability`).
  - Category filtering (`veg`, `non_veg`, `snacks`, `desserts`, `beverages`) and search functionality.
  - Menu item image upload support with local static serving (`/uploads/menus/`).
- **Order Management & Real-Time Tracking**:
  - Order creation and lifecycle status transitions (`pending`, `accepted`, `ready`, `completed`, `cancelled`).
  - Real-time WebSocket connection manager (`/ws/orders/{order_id}`) for push updates to buyers and sellers.
  - Buyer and seller order history endpoints (`/buyers/me/orders`, `/sellers/me/orders`).
- **Async Notification Engine**:
  - Asynchronous background email delivery via `aiosmtplib` for order placements, status updates, and deliveries.
- **Ratings & Reviews**:
  - Order rating submission with score (1-5 stars) and review text (`/api/v1/ratings/orders/{id}`).
  - Automated average rating score and review count recalculation.
  - Public seller reviews listing endpoint (`/api/v1/ratings/sellers/{id}`).
- **Payments & Financial Ledger (v1.1)**:
  - Razorpay payment order initiation and HMAC signature verification (`/api/v1/payments/orders/{id}/initiate`, `/capture`).
  - Automated Razorpay Webhook processor (`/api/v1/payments/webhook`).
  - Double-entry financial ledger service (`LedgerEntry`) with real-time seller balance tracking (`/payments/balance/me`).
  - Admin payment refund handler (`/api/v1/admin/orders/{id}/refund`).
- **Seller Payouts (v1.1)**:
  - Payout initiation, confirmation, and failure state management (`/api/v1/payouts/`).
- **In-Building Delivery Tracking (v1.1)**:
  - In-building delivery dispatching, status tracking (`dispatched`, `delivered`, `failed`), and ETA alerts (`/api/v1/deliveries/`).
- **Admin Governance & Analytics**:
  - Pending seller approval / rejection workflow (`/api/v1/admin/sellers/pending`, `/approve`, `/reject`).
  - Resident user listing and account activation toggle (`/api/v1/admin/residents`, `/users/{id}/status`).
  - Platform-wide telemetry and gross/net revenue analytics (`/api/v1/admin/analytics`).
- **Testing & Telemetry**:
  - Pytest unit and integration test suite (`test_auth.py`, `test_orders.py`, `test_delivery.py`, `test_payments.py`).
  - Automated end-to-end API regression test runner (`api_test_runner.py`) with latency profiling and failure root-cause analysis.
- **Frontend React PWA**:
  - Material-UI dark mode theme, AuthContext state management, and protected routes.
  - Interactive seller listings, menu browser, orders tracker, seller dashboard, and star rating forms.
  - Experimental multimodal UI components (`AICenterSearch`, `GenerativeBento`, `CuratedRow`, `FlavorRadar`).

---

## [1.0.0-alpha.1] - Phase 1 Planning

### Added
- Repository initialized
- README with complete documentation
- Architecture documentation
- Developer setup guide
- User guide for buyers and sellers
- Environment variables template
- GitHub Actions CI/CD workflow
- Code quality and linting setup

---

## Release Notes Template

For future releases:

```markdown
## [Version] - Date

### Added
- New features

### Changed
- Breaking changes
- Improvements

### Fixed
- Bug fixes

### Security
- Security improvements
```

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)

Example: `1.2.3`
- 1 = MAJOR (breaking changes)
- 2 = MINOR (new features)
- 3 = PATCH (bug fixes)

---

## Phase 1 & v1.1 Roadmap

- **v1.0.0-alpha.1**: Infrastructure, documentation, project setup ✅
- **v1.1.0-alpha.1**: Core backend APIs, auth, menus, orders, WebSockets, payments, ledger, payouts, deliveries, & React PWA ✅
- **v1.1.0-beta.1**: Cart checkout polish, E2E integration test suite, and staging deployment
- **v1.1.0**: Public society release
- **v2.0.0**: Multimodal AI search, meal subscriptions, and multi-node Redis pub/sub scaling

