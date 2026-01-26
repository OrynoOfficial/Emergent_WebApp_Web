# Oryno Permission System Documentation

## Overview

The Oryno platform uses a **Role-Based Access Control (RBAC)** system with granular permissions. The system supports:
- **System Roles**: Predefined roles (super_admin, admin, operator, customer)
- **Custom Roles**: Admin-created roles with specific permission sets
- **Individual Permissions**: Per-user permission assignments

---

## User Roles Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SUPER ADMIN                                      │
│  • Full system access (bypasses ALL permission checks)                   │
│  • Can modify system roles                                               │
│  • Can delete any entity                                                 │
│  • Access to Database Management                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              ADMIN                                        │
│  • Users/Operators/Employees management                                  │
│  • Analytics & Reports (read access)                                     │
│  • All service management (hotels, travel, restaurants, etc.)            │
│  • Validation center                                                     │
│  • Customer Service management                                           │
│  • Audit logs (view only)                                               │
│  • Role management (custom roles only, not system roles)                 │
│  • Commission configuration                                              │
│  • Cannot: Delete system roles, Access Database Management               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            OPERATOR                                       │
│  • Dashboard (operator-scoped data only)                                 │
│  • Service management (OWN services only):                               │
│    - Hotels, Travel, Car Rental, Restaurants, Events                     │
│    - Cinema, Laundry, Banquet, Packages                                  │
│  • Orders & Bookings (OWN operator bookings)                             │
│  • Customer reviews (respond to reviews)                                 │
│  • Team management (for their operator)                                  │
│  • Analytics (own operator data)                                         │
│  • Cannot: See other operators' data, User management, System settings   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            CUSTOMER                                       │
│  • Browse all services                                                   │
│  • Make bookings                                                         │
│  • View OWN orders & receipts                                            │
│  • Submit reviews & ratings                                              │
│  • Loyalty program (view points, redeem rewards)                         │
│  • Support (create tickets, view own tickets)                            │
│  • Profile settings                                                      │
│  • Cannot: Any management features, See other users' data                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Permission Modules

### 1. Dashboard & Overview
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `dashboard.view` | View Dashboard | Access main dashboard |
| `dashboard.analytics` | View Analytics | See analytics data |
| `dashboard.reports` | View Reports | Access report summaries |
| `dashboard.widgets` | Customize Widgets | Add/remove dashboard widgets |
| `dashboard.export` | Export Dashboard | Export dashboard data |

### 2. Service Browsing (Customer)
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `services.browse` | Browse Services | View all services |
| `services.book` | Make Bookings | Create new bookings |
| `services.search` | Search Services | Use search functionality |
| `services.compare` | Compare Services | Compare multiple services |
| `services.reviews` | Write Reviews | Submit service reviews |
| `services.wishlist` | Manage Wishlist | Save services to wishlist |

### 3. Hotels Management
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `hotels.view` | View Hotels | See hotel listings |
| `hotels.create` | Create Hotels | Add new hotels |
| `hotels.edit` | Edit Hotels | Modify hotel details |
| `hotels.delete` | Delete Hotels | Remove hotels |
| `hotels.rooms` | Manage Rooms | Manage hotel rooms |
| `hotels.pricing` | Manage Pricing | Set room prices |
| `hotels.availability` | Manage Availability | Set room availability |
| `hotels.amenities` | Manage Amenities | Configure hotel amenities |
| `hotels.photos` | Manage Photos | Upload/delete hotel photos |
| `hotels.promotions` | Manage Promotions | Create hotel promotions |
| `hotels.reviews` | Manage Reviews | Moderate hotel reviews |

### 4. Travel & Transport
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `travel.view` | View Routes | See travel routes |
| `travel.create` | Create Routes | Add new routes |
| `travel.edit` | Edit Routes | Modify route details |
| `travel.delete` | Delete Routes | Remove routes |
| `travel.vehicles` | Manage Vehicles | Manage vehicle fleet |
| `travel.scheduling` | Manage Schedules | Set departure times |
| `travel.pricing` | Manage Pricing | Set ticket prices |
| `travel.seats` | Manage Seats | Configure seat layouts |
| `travel.drivers` | Manage Drivers | Assign drivers to routes |
| `travel.tracking` | Live Tracking | Access vehicle tracking |

### 5. Car Rental
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `car_rental.view` | View Cars | See car listings |
| `car_rental.create` | Add Cars | Add new vehicles |
| `car_rental.edit` | Edit Cars | Modify car details |
| `car_rental.delete` | Delete Cars | Remove vehicles |
| `car_rental.availability` | Manage Availability | Set availability |
| `car_rental.pricing` | Manage Pricing | Set rental prices |
| `car_rental.maintenance` | Manage Maintenance | Track vehicle maintenance |
| `car_rental.insurance` | Manage Insurance | Configure insurance options |
| `car_rental.drivers` | Manage Drivers | Optional driver services |

### 6. Restaurants
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `restaurants.view` | View Restaurants | See restaurant listings |
| `restaurants.create` | Create Restaurants | Add new restaurants |
| `restaurants.edit` | Edit Restaurants | Modify restaurant details |
| `restaurants.delete` | Delete Restaurants | Remove restaurants |
| `restaurants.menu` | Manage Menu | Edit menu items |
| `restaurants.reservations` | Manage Reservations | Handle bookings |
| `restaurants.tables` | Manage Tables | Configure seating |
| `restaurants.hours` | Manage Hours | Set operating hours |
| `restaurants.promotions` | Manage Promotions | Create special offers |

### 7. Events Management
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `events.view` | View Events | See event listings |
| `events.create` | Create Events | Add new events |
| `events.edit` | Edit Events | Modify event details |
| `events.delete` | Delete Events | Remove events |
| `events.tickets` | Manage Tickets | Handle ticket sales |
| `events.pricing` | Manage Pricing | Set ticket prices |
| `events.capacity` | Manage Capacity | Set event capacity |
| `events.checkin` | Check-in Attendees | Manage event check-in |
| `events.promotions` | Manage Promotions | Create event promotions |

### 8. Cinema
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `cinema.view` | View Cinemas | See cinema listings |
| `cinema.create` | Create Cinemas | Add new cinemas |
| `cinema.edit` | Edit Cinemas | Modify cinema details |
| `cinema.delete` | Delete Cinemas | Remove cinemas |
| `cinema.movies` | Manage Movies | Handle movie listings |
| `cinema.showtimes` | Manage Showtimes | Set screening times |
| `cinema.screens` | Manage Screens | Configure cinema screens |
| `cinema.pricing` | Manage Pricing | Set ticket prices |
| `cinema.concessions` | Manage Concessions | Handle food & drinks |

### 9. Packages (Courier/Delivery)
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `packages.view` | View Packages | See package listings |
| `packages.create` | Create Packages | Add new packages |
| `packages.edit` | Edit Packages | Modify package details |
| `packages.delete` | Delete Packages | Remove packages |
| `packages.pricing` | Manage Pricing | Set package prices |
| `packages.components` | Manage Components | Add/remove package items |

### 10. Laundry Services
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `laundry.view` | View Services | See laundry listings |
| `laundry.create` | Create Services | Add new services |
| `laundry.edit` | Edit Services | Modify service details |
| `laundry.delete` | Delete Services | Remove services |
| `laundry.pricing` | Manage Pricing | Set service prices |
| `laundry.orders` | Manage Orders | Handle laundry orders |
| `laundry.delivery` | Manage Delivery | Track pickup/delivery |

### 11. Banquet Halls
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `banquet.view` | View Venues | See venue listings |
| `banquet.create` | Create Venues | Add new venues |
| `banquet.edit` | Edit Venues | Modify venue details |
| `banquet.delete` | Delete Venues | Remove venues |
| `banquet.pricing` | Manage Pricing | Set rental prices |
| `banquet.availability` | Manage Availability | Set availability |
| `banquet.catering` | Manage Catering | Configure catering options |

### 12. Orders & Bookings
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `orders.view_own` | View Own Orders | See personal orders |
| `orders.view_all` | View All Orders | See all system orders |
| `orders.create` | Create Orders | Create new orders |
| `orders.edit` | Edit Orders | Modify order details |
| `orders.cancel` | Cancel Orders | Cancel orders |
| `orders.refund` | Process Refunds | Handle refund requests |
| `orders.confirm` | Confirm Orders | Confirm pending orders |
| `orders.assign` | Assign Orders | Assign orders to operators |
| `orders.export` | Export Orders | Export order data |
| `orders.history` | View History | See order history |

### 13. Receipts & Invoices
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `receipts.view_own` | View Own Receipts | See personal receipts |
| `receipts.view_all` | View All Receipts | See all receipts |
| `receipts.generate` | Generate Receipts | Create new receipts |
| `receipts.download` | Download Receipts | Download receipt PDFs |
| `receipts.email` | Email Receipts | Send receipts via email |
| `receipts.void` | Void Receipts | Cancel issued receipts |

### 14. Loyalty Program
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `loyalty.view_own` | View Own Points | See personal points |
| `loyalty.view_all` | View All Members | See all loyalty members |
| `loyalty.redeem` | Redeem Points | Use points for rewards |
| `loyalty.manage` | Manage Program | Configure loyalty settings |
| `loyalty.adjust` | Adjust Points | Add/remove member points |
| `loyalty.tiers` | Manage Tiers | Configure membership tiers |
| `loyalty.rewards` | Manage Rewards | Configure available rewards |

### 15. Validation Center
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `validation.view` | View Pending | See pending validations |
| `validation.approve_tickets` | Approve Tickets | Approve ticket requests |
| `validation.reject_tickets` | Reject Tickets | Reject ticket requests |
| `validation.verify_payments` | Verify Payments | Manually verify payments |
| `validation.approve_services` | Approve Services | Approve new services |
| `validation.approve_operators` | Approve Operators | Approve new operators |
| `validation.scan_qr` | Scan QR Codes | Validate tickets via QR |

### 16. User Management
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `users.view` | View Users | See user list |
| `users.create` | Create Users | Add new users |
| `users.edit` | Edit Users | Modify user details |
| `users.delete` | Delete Users | Remove users |
| `users.roles` | Manage Roles | Change user roles |
| `users.suspend` | Suspend Users | Suspend/activate accounts |
| `users.reset_password` | Reset Passwords | Reset user passwords |
| `users.export` | Export Users | Export user data |
| `users.import` | Import Users | Bulk import users |
| `users.verify` | Verify Users | Manually verify users |

### 17. Employee Management
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `employees.view` | View Employees | See employee list |
| `employees.create` | Create Employees | Add new employees |
| `employees.edit` | Edit Employees | Modify employee details |
| `employees.delete` | Delete Employees | Remove employees |
| `employees.schedule` | Manage Schedule | Set work schedules |
| `employees.performance` | View Performance | See performance metrics |
| `employees.payroll` | View Payroll | Access payroll data |

### 18. Operators
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `operators.view` | View Operators | See operator list |
| `operators.create` | Create Operators | Add new operators |
| `operators.edit` | Edit Operators | Modify operator details |
| `operators.delete` | Delete Operators | Remove operators |
| `operators.approve` | Approve Operators | Approve pending operators |
| `operators.suspend` | Suspend Operators | Suspend operator accounts |
| `operators.commission` | Set Commission | Configure commission rates |
| `operators.documents` | Manage Documents | Review operator documents |
| `operators.performance` | View Performance | See operator metrics |

### 19. Finance & Payments
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `finance.view_revenue` | View Revenue | See revenue reports |
| `finance.view_commissions` | View Commissions | See commission data |
| `finance.manage_payments` | Manage Payments | Handle payment settings |
| `finance.export_reports` | Export Reports | Download financial reports |
| `finance.bills` | Manage Bills | Handle billing |
| `finance.sales` | View Sales | See sales data |
| `finance.refunds` | Process Refunds | Handle refund requests |
| `finance.payouts` | Manage Payouts | Process operator payouts |
| `finance.reconciliation` | Reconciliation | Financial reconciliation |
| `finance.budgets` | Manage Budgets | Set and track budgets |

### 20. Analytics & Reports
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `analytics.dashboard` | Analytics Dashboard | Access analytics overview |
| `analytics.detailed` | Detailed Analytics | Deep analytics access |
| `analytics.export` | Export Data | Export analytics data |
| `analytics.trip_report` | Trip Reports | View trip reports |
| `analytics.booking` | Booking Analytics | Booking statistics |
| `analytics.revenue` | Revenue Analytics | Revenue breakdowns |
| `analytics.customer` | Customer Analytics | Customer insights |
| `analytics.operator` | Operator Analytics | Operator performance |
| `analytics.custom` | Custom Reports | Create custom reports |

### 21. Audit & Logs
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `audit.view_own` | View Own Activity | See personal activity |
| `audit.view_all` | View All Activity | See all system activity |
| `audit.export` | Export Logs | Download audit logs |
| `audit.filter` | Advanced Filtering | Use advanced log filters |
| `audit.security` | Security Logs | View security events |
| `audit.api` | API Logs | View API call logs |

### 22. Notifications
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `notifications.view_own` | View Own Notifications | See personal notifications |
| `notifications.manage` | Manage Notifications | Configure notification settings |
| `notifications.send` | Send Notifications | Send system notifications |
| `notifications.broadcast` | Broadcast Messages | Send to all users |
| `notifications.templates` | Manage Templates | Edit notification templates |

### 23. Support & Help
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `support.create_ticket` | Create Tickets | Submit support tickets |
| `support.view_own` | View Own Tickets | See personal tickets |
| `support.view_all` | View All Tickets | See all support tickets |
| `support.respond` | Respond to Tickets | Reply to tickets |
| `support.close` | Close Tickets | Mark tickets as resolved |
| `support.escalate` | Escalate Tickets | Escalate to higher support |
| `support.chat` | Live Chat | Access live chat support |

### 24. Ratings & Reviews
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `ratings.view_own` | View Own Ratings | See personal ratings |
| `ratings.view_all` | View All Ratings | See all ratings |
| `ratings.create` | Write Reviews | Submit reviews |
| `ratings.edit_own` | Edit Own Reviews | Modify own reviews |
| `ratings.delete` | Delete Reviews | Remove reviews |
| `ratings.respond` | Respond to Reviews | Reply to customer reviews |
| `ratings.flag` | Flag Reviews | Flag inappropriate reviews |
| `ratings.moderate` | Moderate Reviews | Approve/reject reviews |
| `ratings.reports` | View Reports | Access ratings analytics |

### 25. Access Control (Admin Only)
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `access.view_roles` | View Roles | See role list |
| `access.create_roles` | Create Roles | Add custom roles |
| `access.edit_roles` | Edit Roles | Modify role permissions |
| `access.delete_roles` | Delete Roles | Remove custom roles |
| `access.assign_roles` | Assign Roles | Assign roles to users |
| `access.view_groups` | View Access Groups | See access groups |
| `access.manage_groups` | Manage Groups | Create/edit access groups |
| `access.system_roles` | Modify System Roles | Edit system roles (Super Admin only) |

### 26. System Settings (Super Admin Only)
| Permission Key | Label | Description |
|---------------|-------|-------------|
| `settings.view` | View Settings | See system settings |
| `settings.edit` | Edit Settings | Modify system settings |
| `settings.integrations` | Manage Integrations | Configure API integrations |
| `settings.branding` | Manage Branding | Customize branding |
| `settings.database` | Database Management | Access database admin |
| `settings.backups` | Manage Backups | Handle system backups |

---

## Views by Role

### Super Admin Views
```
├── Dashboard (full platform metrics)
├── Services (browse all)
├── Service Management
│   ├── Hotels Management
│   ├── Travel Management
│   ├── Car Rental Management
│   ├── Restaurant Management
│   ├── Events Management
│   ├── Cinema Management
│   ├── Laundry Management
│   ├── Banquet Management
│   └── Package Management
├── Orders (all orders)
├── Receipts (all receipts)
├── Loyalty (full management)
├── Ratings (full moderation + reports)
├── Support
├── Admin
│   ├── Analytics
│   ├── All Bookings
│   ├── Users Management
│   ├── Operators Management
│   ├── Employees Management
│   ├── Commission Management
│   ├── Validation Center
│   ├── Audit Logs
│   ├── Permissions & Access Control
│   ├── Database Management ★
│   └── Document Templates
├── Customer Service Management
└── Settings
```

### Admin Views
```
├── Dashboard (platform metrics)
├── Services (browse all)
├── Service Management
│   ├── Hotels Management
│   ├── Travel Management
│   ├── Car Rental Management
│   ├── Restaurant Management
│   ├── Events Management
│   ├── Cinema Management
│   ├── Laundry Management
│   ├── Banquet Management
│   └── Package Management
├── Orders (all orders)
├── Receipts (all receipts)
├── Loyalty (view only)
├── Ratings (moderation)
├── Support
├── Admin
│   ├── Analytics
│   ├── All Bookings
│   ├── Users Management
│   ├── Operators Management
│   ├── Employees Management
│   ├── Commission Management
│   ├── Validation Center
│   ├── Audit Logs (view only)
│   ├── Permissions (custom roles only)
│   └── Document Templates
├── Customer Service Management
└── Settings
```

### Operator Views
```
├── Dashboard (operator-scoped)
├── Services (browse all)
├── Service Management (OWN services only)
│   └── Based on operator service types:
│       - Hotels, Travel, Car Rental, etc.
├── Orders (operator's bookings only)
├── Receipts (operator's receipts only)
├── Loyalty (view own program)
├── Ratings (respond to reviews)
├── Support
├── Team Management
│   ├── Team Members
│   └── Roles
└── Settings (profile only)
```

### Customer Views
```
├── Dashboard (personal stats)
├── Services (browse & book)
│   ├── Hotels
│   ├── Restaurants
│   ├── Travel
│   ├── Car Rental
│   ├── Events
│   ├── Packages
│   ├── Laundry
│   ├── Cinema
│   └── Banquet
├── My Orders
├── My Receipts
├── Loyalty (points & rewards)
├── My Ratings
├── Support (create tickets)
├── Notifications
└── Settings (profile)
```

---

## Permission Enforcement

### Backend (FastAPI)
```python
from utils.permissions import require_permission, require_any_permission

# Single permission required
@router.post("/hotels/")
async def create_hotel(
    current_user: dict = Depends(require_permission("hotels.create"))
):
    ...

# Any of multiple permissions
@router.get("/analytics/")
async def view_analytics(
    current_user: dict = Depends(require_any_permission([
        "analytics.view", 
        "analytics.view_dashboard"
    ]))
):
    ...
```

### Frontend (React)
```jsx
import { usePermissions } from '../contexts/PermissionsContext';

function MyComponent() {
  const { hasPermission, hasAnyPermission, isSuperAdmin } = usePermissions();
  
  // Check single permission
  if (!hasPermission('hotels.create')) {
    return <AccessDenied />;
  }
  
  // Check any of multiple permissions
  const canManage = hasAnyPermission(['hotels.edit', 'hotels.delete']);
  
  return (
    <div>
      {canManage && <EditButton />}
      {isSuperAdmin && <DeleteButton />}
    </div>
  );
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `/app/backend/utils/permissions.py` | Permission checking utilities |
| `/app/backend/routes/access_control.py` | Role & permission API endpoints |
| `/app/frontend/src/contexts/PermissionsContext.jsx` | Frontend permission state |
| `/app/frontend/src/pages/admin/Permissions.jsx` | Permission management UI |
| `/app/frontend/src/components/Layout.jsx` | Navigation permission checks |

---

## Database Collections

### `roles` Collection
```json
{
  "id": "uuid",
  "name": "Hotel Manager",
  "description": "Manages hotel operations",
  "permissions": ["hotels.view", "hotels.edit", "hotels.rooms"],
  "color": "bg-purple-100 text-purple-700",
  "is_system": false,
  "user_count": 5,
  "created_by": "admin-user-id",
  "created_at": "2026-01-10T12:00:00Z"
}
```

### `users` Collection (Permission Fields)
```json
{
  "role": "admin",  // System role
  "assigned_roles": ["role-id-1", "role-id-2"],  // Custom roles
  "custom_permissions": ["specific.permission"]  // Direct permissions
}
```

---

## Summary

- **Super Admin**: Unrestricted access, bypasses all permission checks
- **Admin**: Full management with some restrictions (no DB access, no system role edits)
- **Operator**: Scoped to own operator data, service-type specific permissions
- **Customer**: Consumer-focused, personal data only

The system supports:
1. **Role inheritance**: Users get permissions from their system role + assigned custom roles
2. **Permission granularity**: 200+ individual permissions across 26 modules
3. **Module wildcards**: `hotels.*` grants all hotel permissions
4. **Custom roles**: Admins can create roles with specific permission combinations
