# Project Board - Phase 1

**Status**: Phase 1 Development (60% Complete)

## Epics Overview

| Epic | Tasks | Status | Owner |
|------|-------|--------|-------|
| Infrastructure | 8 | 🟢 Complete | DevOps |
| Authentication | 5 | 🟡 In Progress | Backend |
| Seller Management | 6 | ⏳ Planned | Backend |
| Menu Management | 5 | ⏳ Planned | Backend |
| Buyer Experience | 6 | ⏳ Planned | Frontend |
| Order Management | 7 | ⏳ Planned | Backend |
| Ratings System | 4 | ⏳ Planned | Backend |
| Admin Panel | 5 | ⏳ Planned | Frontend |
| Payment (v1.1) | - | 🔴 Blocked | TBD |

---

## Epic 1: Infrastructure ✅ Complete

| # | Task | Priority | Status | Estimate |
|---|------|----------|--------|----------|
| 1.1 | Set up repository with Git Flow | P0 | ✅ Done | 2h |
| 1.2 | Configure CI/CD pipeline | P0 | ✅ Done | 4h |
| 1.3 | Create project documentation | P0 | ✅ Done | 6h |
| 1.4 | Docker setup (local dev) | P0 | ✅ Done | 3h |
| 1.5 | Environment configuration | P0 | ✅ Done | 2h |
| 1.6 | Database schema foundation | P0 | ✅ Done | 4h |
| 1.7 | API scaffolding (FastAPI) | P1 | ✅ Done | 3h |
| 1.8 | Frontend scaffolding (React) | P1 | ✅ Done | 2h |

---

## Epic 2: Authentication (OTP)

| # | Task | Priority | Status | Estimate | Assigned |
|---|------|----------|--------|----------|----------|
| 2.1 | OTP generation service | P0 | 🟡 In Progress | 4h | Backend |
| 2.2 | Email sending integration | P0 | ⏳ Planned | 3h | Backend |
| 2.3 | WhatsApp OTP (Twilio) | P1 | ⏳ Planned | 4h | Backend |
| 2.4 | JWT token management | P0 | ⏳ Planned | 3h | Backend |
| 2.5 | OTP login frontend | P0 | ⏳ Planned | 4h | Frontend |

---

## Epic 3: Seller Management

| # | Task | Priority | Status | Estimate | Assigned |
|---|------|----------|--------|----------|----------|
| 3.1 | Seller registration endpoint | P0 | ⏳ Planned | 4h | Backend |
| 3.2 | Flat verification system | P0 | ⏳ Planned | 3h | Backend |
| 3.3 | Seller profile management | P1 | ⏳ Planned | 3h | Backend |
| 3.4 | Seller registration form | P0 | ⏳ Planned | 4h | Frontend |
| 3.5 | Seller profile page | P1 | ⏳ Planned | 3h | Frontend |
| 3.6 | Bank details storage (secure) | P1 | ⏳ Planned | 4h | Backend |

---

## Epic 4: Menu Management

| # | Task | Priority | Status | Estimate | Assigned |
|---|------|----------|--------|----------|----------|
| 4.1 | Menu item CRUD endpoints | P0 | ⏳ Planned | 5h | Backend |
| 4.2 | Menu availability (daily/weekly) | P0 | ⏳ Planned | 4h | Backend |
| 4.3 | Price management | P0 | ⏳ Planned | 2h | Backend |
| 4.4 | Menu category system | P0 | ⏳ Planned | 3h | Backend |
| 4.5 | Menu dashboard (seller) | P0 | ⏳ Planned | 6h | Frontend |

---

## Epic 5: Buyer Experience

| # | Task | Priority | Status | Estimate | Assigned |
|---|------|----------|--------|----------|----------|
| 5.1 | Browse available sellers | P0 | ⏳ Planned | 4h | Frontend |
| 5.2 | Browse seller menus | P0 | ⏳ Planned | 4h | Frontend |
| 5.3 | Category filtering | P1 | ⏳ Planned | 3h | Frontend |
| 5.4 | Search functionality | P1 | ⏳ Planned | 3h | Frontend |
| 5.5 | Seller ratings display | P1 | ⏳ Planned | 2h | Frontend |
| 5.6 | Shopping cart | P0 | ⏳ Planned | 4h | Frontend |

---

## Epic 6: Order Management

| # | Task | Priority | Status | Estimate | Assigned |
|---|------|----------|--------|----------|----------|
| 6.1 | Order creation endpoint | P0 | ⏳ Planned | 4h | Backend |
| 6.2 | Order status enum | P0 | ⏳ Planned | 2h | Backend |
| 6.3 | Real-time status updates (WebSocket) | P1 | ⏳ Planned | 6h | Backend |
| 6.4 | Order history endpoint | P1 | ⏳ Planned | 3h | Backend |
| 6.5 | Place order form | P0 | ⏳ Planned | 4h | Frontend |
| 6.6 | Order tracking page (buyer) | P0 | ⏳ Planned | 5h | Frontend |
| 6.7 | Order dashboard (seller) | P0 | ⏳ Planned | 5h | Frontend |

---

## Epic 7: Ratings & Reviews

| # | Task | Priority | Status | Estimate | Assigned |
|---|------|----------|--------|----------|----------|
| 7.1 | Rating endpoint (POST) | P0 | ⏳ Planned | 3h | Backend |
| 7.2 | Rating aggregation (avg, count) | P1 | ⏳ Planned | 2h | Backend |
| 7.3 | Review display endpoint | P0 | ⏳ Planned | 2h | Backend |
| 7.4 | Rating form (1-5 stars) | P0 | ⏳ Planned | 3h | Frontend |

---

## Epic 8: Admin Panel

| # | Task | Priority | Status | Estimate | Assigned |
|---|------|----------|--------|----------|----------|
| 8.1 | Seller approval page | P0 | ⏳ Planned | 4h | Frontend |
| 8.2 | Resident verification | P0 | ⏳ Planned | 3h | Frontend |
| 8.3 | Platform activity dashboard | P1 | ⏳ Planned | 4h | Frontend |
| 8.4 | Admin user management | P1 | ⏳ Planned | 3h | Backend |
| 8.5 | Seller approval endpoint | P0 | ⏳ Planned | 3h | Backend |

---

## Priority Levels

- **P0**: Critical - Must have for Phase 1
- **P1**: High - Should have for Phase 1
- **P2**: Medium - Nice to have
- **P3**: Low - Future phases

---

## Task Status Legend

- ✅ Done
- 🟡 In Progress
- ⏳ Planned
- 🔴 Blocked
- ⚠️ At Risk

---

## Phase 1 Summary

**Total Tasks**: 51
**Completed**: ~15 (29%)
**In Progress**: ~2 (4%)
**Planned**: ~34 (67%)

**Estimated Timeline**: 4-6 weeks
**Team Size**: 2-3 developers

---

## Key Milestones

### Milestone 1: Core Infrastructure ✅
- Git setup and CI/CD
- Database and API scaffolding
- **Timeline**: Done
- **Status**: Completed

### Milestone 2: Authentication (Current)
- OTP-based login system
- Seller & buyer user types
- **Timeline**: 1-2 weeks
- **Status**: In Progress

### Milestone 3: Seller Features
- Seller registration & verification
- Menu management system
- **Timeline**: 2-3 weeks
- **Status**: Starting

### Milestone 4: Buyer Experience
- Browse and order
- Order tracking
- **Timeline**: 2-3 weeks
- **Status**: Planned

### Milestone 5: Polish & Testing
- Integration testing
- Performance optimization
- Security hardening
- **Timeline**: 1-2 weeks
- **Status**: Planned

---

## Known Blockers

None currently.

## Risks

1. **OTP Integration**: WhatsApp integration might have rate limits
   - Mitigation: Start with email, add WhatsApp later
2. **Real-time Updates**: WebSocket complexity
   - Mitigation: Start with polling, upgrade to WebSockets in v1.1
3. **Team Availability**: May impact timeline
   - Mitigation: Prioritize P0 tasks first

---

## Next Steps

1. Complete authentication (OTP) implementation
2. Begin seller management features
3. Set up testing framework
4. Prepare staging environment
