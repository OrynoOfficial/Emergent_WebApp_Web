# Oryno Access Control System - High-Level Diagram

## System Overview

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           ORYNO ACCESS CONTROL ARCHITECTURE                             │
│                                                                                         │
│  Authentication Layer (JWT-based)                                                       │
│  ├── Email/Password Login                                                              │
│  ├── Phone + OTP Login (Infobip SMS)                                                   │
│  └── Optional 2FA (Authenticator App)                                                  │
│                                                                                         │
│  Authorization Layer (RBAC + Granular Permissions)                                     │
│  ├── System Roles (4 predefined)                                                       │
│  ├── Custom Roles (admin-created)                                                      │
│  └── Individual Permissions (200+ permission keys)                                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Role Hierarchy & Data Scope

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│   SUPER_ADMIN ─────────────────────────────────────────────────────────────────────────►│
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │ • BYPASSES ALL permission checks (god mode)                                     │   │
│   │ • DATA SCOPE: Entire platform (all operators, all users, all services)          │   │
│   │ • UNIQUE ACCESS: Database Management, System Roles, System Settings             │   │
│   │ • CAN: Create/delete admins, modify system config, access all audit logs        │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                               │
│                                          ▼                                               │
│   ADMIN ────────────────────────────────────────────────────────────────────────────────►│
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │ • Full management (subject to permission checks)                                │   │
│   │ • DATA SCOPE: All operators, all users, all services (platform-wide)            │   │
│   │ • RESTRICTED: No Database Management, No System Role editing                    │   │
│   │ • CAN: Manage users, operators, services, custom roles, commissions             │   │
│   │ • SPECIAL: Can create custom roles with ANY permission except system roles      │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                               │
│                                          ▼                                               │
│   OPERATOR ─────────────────────────────────────────────────────────────────────────────►│
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │ • Scoped to own operator entity only                                            │   │
│   │ • DATA SCOPE: Own services, own bookings, own team members                      │   │
│   │ • SERVICE FILTER: Only assigned service_types (hotel, travel, cinema, etc.)     │   │
│   │ • CAN: CRUD own services, respond to reviews, manage own team (if owner/admin)  │   │
│   │ • CANNOT: See other operators' data, manage platform users, system settings     │   │
│   │                                                                                 │   │
│   │ OPERATOR INTERNAL ROLES:                                                        │   │
│   │   owner ──────► Full operator control, can add/remove team, manage roles        │   │
│   │   local_admin ─► Team management, service management within operator scope      │   │
│   │   manager ────► Day-to-day operations, limited team access                      │   │
│   │   staff ──────► Read + limited write on assigned services only                  │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                               │
│                                          ▼                                               │
│   CUSTOMER ─────────────────────────────────────────────────────────────────────────────►│
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │ • Consumer role (default for self-registration)                                 │   │
│   │ • DATA SCOPE: Own profile, own orders, own receipts, own reviews                │   │
│   │ • CAN: Browse all services, make bookings, submit reviews, redeem loyalty       │   │
│   │ • CANNOT: Access any management features, see other users' data                 │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Permission Enforcement Flow

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              REQUEST LIFECYCLE                                            │
│                                                                                           │
│   1. HTTP Request Arrives                                                                 │
│      │                                                                                    │
│      ▼                                                                                    │
│   2. JWT Token Extraction (Authorization: Bearer <token>)                                 │
│      │                                                                                    │
│      ├──[Invalid/Expired]──► 401 Unauthorized                                            │
│      │                                                                                    │
│      ▼                                                                                    │
│   3. User Lookup (token.sub → users._id)                                                 │
│      │                                                                                    │
│      ├──[Not Found / Inactive]──► 403 Forbidden                                          │
│      │                                                                                    │
│      ▼                                                                                    │
│   4. Permission Resolution                                                                │
│      │                                                                                    │
│      │  ┌──────────────────────────────────────────────────────────────────────────┐     │
│      │  │                   PERMISSION SOURCES (MERGED)                            │     │
│      │  │                                                                          │     │
│      │  │  user.role ───────────────► System role permissions                      │     │
│      │  │  user.assigned_roles ─────► Custom role permissions (union)              │     │
│      │  │  user.custom_permissions ─► Direct per-user permissions                  │     │
│      │  │                                                                          │     │
│      │  │  RESULT: effective_permissions = Set(all merged permissions)             │     │
│      │  └──────────────────────────────────────────────────────────────────────────┘     │
│      │                                                                                    │
│      ▼                                                                                    │
│   5. Permission Check (require_permission / require_any_permission)                      │
│      │                                                                                    │
│      │  ┌────────────────────────────────────────────────────────────────────────┐       │
│      │  │  CHECK ORDER:                                                          │       │
│      │  │  1. is_super_admin? ─► ALLOW (bypass all checks)                       │       │
│      │  │  2. has_all_permissions flag? ─► ALLOW                                 │       │
│      │  │  3. has "*" wildcard? ─► ALLOW                                         │       │
│      │  │  4. has exact permission? (e.g., "hotels.create") ─► ALLOW             │       │
│      │  │  5. has module wildcard? (e.g., "hotels.*") ─► ALLOW                   │       │
│      │  │  6. NONE MATCHED ─► DENY (403 Forbidden)                               │       │
│      │  └────────────────────────────────────────────────────────────────────────┘       │
│      │                                                                                    │
│      ▼                                                                                    │
│   6. Data Scope Filtering (for operators)                                                │
│      │                                                                                    │
│      │  ┌────────────────────────────────────────────────────────────────────────┐       │
│      │  │  If user.role == "operator":                                           │       │
│      │  │    - Filter queries by user.operator_id                                │       │
│      │  │    - Filter service types by operator.service_types                    │       │
│      │  │    - Only return operator-owned resources                              │       │
│      │  └────────────────────────────────────────────────────────────────────────┘       │
│      │                                                                                    │
│      ▼                                                                                    │
│   7. Execute Request Handler → Return Response                                            │
│                                                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Navigation Access Control (Frontend)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                           SIDEBAR NAVIGATION BY ROLE                                      │
│                                                                                           │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐│
│  │   SUPER ADMIN   │    │      ADMIN      │    │    OPERATOR     │    │    CUSTOMER     ││
│  ├─────────────────┤    ├─────────────────┤    ├─────────────────┤    ├─────────────────┤│
│  │ Dashboard       │    │ Dashboard       │    │ Dashboard       │    │ Dashboard       ││
│  │ (Analytics)     │    │ (Admin Dash)    │    │ (Analytics)     │    │                 ││
│  ├─────────────────┤    ├─────────────────┤    ├─────────────────┤    ├─────────────────┤│
│  │ Sales           │    │ Services ▼      │    │ Sales           │    │ Services ▼      ││
│  │                 │    │ (Browse All)    │    │ (Own Operator)  │    │ (Browse All)    ││
│  ├─────────────────┤    ├─────────────────┤    ├─────────────────┤    ├─────────────────┤│
│  │ Services ▼      │    │ Service Mgmt ▼  │    │ Services ▼      │    │ My Orders       ││
│  │ (Browse All)    │    │ (All Types)     │    │ (Assigned Only) │    │                 ││
│  ├─────────────────┤    ├─────────────────┤    ├─────────────────┤    ├─────────────────┤│
│  │ Service Mgmt ▼  │    │ All Orders      │    │ Service Mgmt ▼  │    │ Receipts        ││
│  │ (All Types)     │    │ All Receipts    │    │ (Assigned Only) │    │                 ││
│  ├─────────────────┤    │ All Bookings    │    ├─────────────────┤    ├─────────────────┤│
│  │ All Orders      │    ├─────────────────┤    │ Admin Config ▼  │    │ Loyalty         ││
│  │ All Receipts    │    │ Loyalty Program │    │ ├─Team & Roles  │    │                 ││
│  │ All Bookings    │    ├─────────────────┤    │ └─Audit Log     │    ├─────────────────┤│
│  ├─────────────────┤    │ Admin Config ▼  │    ├─────────────────┤    │ My Ratings      ││
│  │ Loyalty Program │    │ ├─Users         │    │ My Orders       │    │                 ││
│  ├─────────────────┤    │ ├─Operators     │    │ Receipts        │    ├─────────────────┤│
│  │ Admin Config ▼  │    │ ├─Bills         │    ├─────────────────┤    │ Support         ││
│  │ ├─Admin Dash    │    │ ├─Sales         │    │ My Ratings      │    │                 ││
│  │ ├─Users         │    │ ├─Audit Logs    │    ├─────────────────┤    ├─────────────────┤│
│  │ ├─Operators     │    │ ├─Permissions   │    │ Support         │    │ Settings        ││
│  │ ├─Employees     │    │ └─Validation    │    ├─────────────────┤    │                 ││
│  │ ├─Commission    │    ├─────────────────┤    │ Settings        │    └─────────────────┘│
│  │ ├─Bills         │    │ All Ratings     │    └─────────────────┘                       │
│  │ ├─Audit Logs    │    │ Customer Svc    │                                              │
│  │ ├─Permissions   │    │ Settings        │                                              │
│  │ ├─Database ★    │    └─────────────────┘                                              │
│  │ └─Validation    │                                                                     │
│  ├─────────────────┤    ★ = Super Admin Only                                             │
│  │ All Ratings     │                                                                     │
│  │ Customer Svc    │                                                                     │
│  │ Settings        │                                                                     │
│  └─────────────────┘                                                                     │
│                                                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key API Endpoints & Required Permissions

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND PERMISSION MAPPING                                  │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ ENDPOINT                           │ PERMISSION(S) REQUIRED                        │ │
│  ├────────────────────────────────────┼───────────────────────────────────────────────┤ │
│  │ POST   /api/hotels/                │ hotels.create                                 │ │
│  │ PUT    /api/hotels/{id}            │ hotels.edit                                   │ │
│  │ DELETE /api/hotels/{id}            │ hotels.delete                                 │ │
│  │ GET    /api/hotels/                │ hotels.view (or public for browsing)          │ │
│  ├────────────────────────────────────┼───────────────────────────────────────────────┤ │
│  │ GET    /api/users/                 │ users.view                                    │ │
│  │ POST   /api/users/                 │ users.create                                  │ │
│  │ DELETE /api/users/{id}             │ users.delete                                  │ │
│  ├────────────────────────────────────┼───────────────────────────────────────────────┤ │
│  │ GET    /api/operators/             │ operators.view                                │ │
│  │ POST   /api/operators/             │ operators.create                              │ │
│  │ PUT    /api/operators/{id}/approve │ operators.approve                             │ │
│  ├────────────────────────────────────┼───────────────────────────────────────────────┤ │
│  │ GET    /api/access/roles           │ access.view_roles                             │ │
│  │ POST   /api/access/roles           │ access.create_roles                           │ │
│  │ PUT    /api/access/roles/{id}      │ access.edit_roles                             │ │
│  ├────────────────────────────────────┼───────────────────────────────────────────────┤ │
│  │ GET    /api/activity-log/          │ activity.view                                 │ │
│  │ GET    /api/validation/            │ validation.view                               │ │
│  │ POST   /api/validation/approve     │ validation.approve_tickets                    │ │
│  ├────────────────────────────────────┼───────────────────────────────────────────────┤ │
│  │ GET    /api/analytics/             │ analytics.view OR analytics.view_dashboard    │ │
│  │ GET    /api/database/collections   │ Super Admin only (settings.database)          │ │
│  └────────────────────────────────────┴───────────────────────────────────────────────┘ │
│                                                                                          │
│  NOTE: Super Admin bypasses ALL permission checks.                                       │
│        Operators are automatically filtered to their operator_id scope.                  │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Collections Related to Access Control

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              MONGODB COLLECTIONS                                         │
│                                                                                          │
│  users                                                                                   │
│  ├── _id: string (UUID)                                                                 │
│  ├── email: string                                                                      │
│  ├── phone: string                                                                      │
│  ├── role: "super_admin" | "admin" | "operator" | "customer"   ◄── SYSTEM ROLE          │
│  ├── assigned_roles: string[]                                  ◄── CUSTOM ROLE IDs      │
│  ├── custom_permissions: string[]                              ◄── DIRECT PERMISSIONS   │
│  ├── operator_id: string (optional)                            ◄── LINKS TO operators   │
│  ├── operator_role: "owner" | "local_admin" | "manager" | "staff" (optional)            │
│  └── status: "active" | "suspended" | "pending"                                         │
│                                                                                          │
│  roles                                                                                   │
│  ├── _id: string (UUID)                                                                 │
│  ├── name: string                                                                       │
│  ├── permissions: string[]                                     ◄── PERMISSION KEYS      │
│  ├── is_system: boolean                                        ◄── SYSTEM vs CUSTOM     │
│  ├── created_by: string                                                                 │
│  └── user_count: number                                                                 │
│                                                                                          │
│  operators                                                                               │
│  ├── _id: string (UUID)                                                                 │
│  ├── name: string                                                                       │
│  ├── service_types: string[]                                   ◄── ALLOWED SERVICES     │
│  ├── operator_type: string                                     ◄── PRIMARY SERVICE      │
│  └── status: "active" | "pending" | "suspended"                                         │
│                                                                                          │
│  operator_roles (operator-internal roles)                                               │
│  ├── _id: string (UUID)                                                                 │
│  ├── operator_id: string                                       ◄── SCOPED TO OPERATOR   │
│  ├── name: string                                                                       │
│  └── permissions: string[]                                                              │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

| Layer | File | Purpose |
|-------|------|---------|
| **Backend Auth** | `/app/backend/routes/auth.py` | Login, registration, token management |
| **Backend Middleware** | `/app/backend/middleware/auth.py` | JWT validation, user extraction |
| **Backend Permissions** | `/app/backend/utils/permissions.py` | `require_permission()` decorator |
| **Backend Access Control** | `/app/backend/routes/access_control.py` | Roles & permissions CRUD API |
| **Frontend Context** | `/app/frontend/src/contexts/PermissionsContext.jsx` | `hasPermission()`, `hasAnyPermission()` |
| **Frontend Context** | `/app/frontend/src/contexts/AuthContext.jsx` | User state, operator context |
| **Frontend Layout** | `/app/frontend/src/components/Layout.jsx` | Role-based navigation rendering |

---

## Summary

| Role | Data Scope | Permission Source | Key Restrictions |
|------|-----------|-------------------|------------------|
| **Super Admin** | All platform data | Bypasses checks | None |
| **Admin** | All platform data | System role + assigned + custom | No DB management, no system role edits |
| **Operator** | Own operator's data | System role + operator permissions | Filtered by `operator_id` and `service_types` |
| **Customer** | Own personal data | System role (minimal) | No management features |

---

*Document generated: December 2025*
*Oryno Platform v1.0*
