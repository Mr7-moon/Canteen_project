# Canteen API Reference

Base path: `/` (routes mount at root)

**Auth header**: `Authorization: Bearer <token>`

---

## Standard Response Format

All endpoints follow this shape:

### Success
```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Error description",
  "data": {
    "fields": { "fieldName": "Validation error detail" }
  }
}
```

| HTTP | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict |
| 422 | Validation failed |

---

## Auth (Public)

### `POST /auth/register`

| Field | Type | Required |
|---|---|---|
| name | string | yes |
| phone | string (03XXXXXXXXX) | yes |
| password | string (min 8) | yes |

**Response `201`**
```json
{
  "success": true,
  "message": "Registered successfully",
  "data": { "user": { "id": "...", "name": "...", "phone": "..." } }
}
```

### `POST /auth/login`

| Field | Type | Required |
|---|---|---|
| phone | string | yes |
| password | string | yes |

**Response `200`**
```json
{
  "success": true,
  "message": "Login successful",
  "data": { "token": "...", "user": { "id": "...", "name": "...", "phone": "..." } }
}
```

### `POST /auth/admin/login`

| Field | Type | Required |
|---|---|---|
| identifier | string (username or email) | yes |
| password | string | yes |

**Response `200`**
```json
{
  "success": true,
  "message": "Login successful",
  "data": { "token": "...", "admin": { "id": "...", "username": "...", "email": "..." } }
}
```

---

## Menu (Public)

### `GET /menu-items`

| Query | Type | Description |
|---|---|---|
| category | string | Filter: Snacks, Drinks, Meals, Desserts |
| search | string | Name regex search |
| available | string | `"true"` or `"false"` |

**Response `200`**
```json
{
  "success": true,
  "message": "Menu items fetched",
  "data": { "items": [{ "_id": "...", "name": "...", "category": "...", "price": 0, "description": "...", "imageUrl": "...", "isAvailable": true }] }
}
```

### `GET /menu-items/:id`

**Response `200`**
```json
{
  "success": true,
  "message": "Menu item fetched",
  "data": { "item": { "_id": "...", "name": "...", "category": "...", "price": 0, "description": "...", "imageUrl": "...", "isAvailable": true } }
}
```

---

## Pickup Slots (Public)

### `GET /pickup-slots`

**Response `200`**
```json
{
  "success": true,
  "message": "Slots fetched",
  "data": { "date": "2026-05-01", "slots": [{ "_id": "...", "time": "9:00 AM", "label": "9:00 AM", "date": "2026-05-01", "maxCapacity": 10, "orderCount": 3, "available": true }] }
}
```

---

## Orders (Customer — requires auth)

### `POST /orders`

| Field | Type | Required |
|---|---|---|
| items | array[{ menuItemId, quantity }] | yes (min 1) |
| pickupSlotId | string | yes |

`quantity`: integer, min 1, max 10.

**Response `201`**
```json
{
  "success": true,
  "message": "Order placed",
  "data": { "order": { "_id": "...", "user": "...", "items": [{ "menuItem": "...", "name": "...", "price": 0, "quantity": 1 }], "totalAmount": 0, "pickupSlot": "...", "pickupTime": "9:00 AM", "status": "Pending", "placedAt": "..." } }
}
```

### `GET /orders`

| Query | Type | Description |
|---|---|---|
| status | string | `"active"` or `"past"`. Omit for all. |

**Response `200`**
```json
{
  "success": true,
  "message": "Orders fetched",
  "data": { "orders": [{ "_id": "...", "user": "...", "items": [...], "totalAmount": 0, "pickupSlot": { "time": "...", "label": "...", "date": "..." }, "status": "Pending", "placedAt": "..." }] }
}
```

### `GET /orders/:id`

**Response `200`**
```json
{ "success": true, "message": "Order fetched", "data": { "order": { ... } } }
```

---

## Admin (requires admin auth)

### Menu Management

| Method | Path | Description | Success message |
|---|---|---|---|
| GET | `/admin/menu-items` | List all | "Menu items fetched" |
| POST | `/admin/menu-items` | Create | "Menu item created" |
| PUT | `/admin/menu-items/:id` | Update | "Menu item updated" |
| DELETE | `/admin/menu-items/:id` | Delete | "Item deleted" |
| PATCH | `/admin/menu-items/:id/availability` | Toggle availability | "Availability updated" |

**POST body:** `{ name, category (Snacks/Drinks/Meals/Desserts), price (min 1), description?, imageUrl?, isAvailable? }`

**PATCH availability body:** `{ "isAvailable": true }`

**Response `201/200`**
```json
{ "success": true, "message": "...", "data": { "item": { ... } } }
```

### Order Management

| Method | Path | Description | Success message |
|---|---|---|---|
| GET | `/admin/orders` | List all (paginated) | "Orders fetched" |
| PATCH | `/admin/orders/:id/status` | Update status | "Order status updated" |

**GET query:** `?status=` `?date=YYYY-MM-DD` `?page=` `?perPage=` (default 20)

**Response `200`**
```json
{
  "success": true,
  "message": "Orders fetched",
  "data": { "orders": [...], "pagination": { "page": 1, "perPage": 20, "total": 100, "totalPages": 5 } }
}
```

**PATCH body:** `{ "status": "Confirmed" }`

Allowed transitions: Pending → Confirmed → Preparing → Ready for Pickup → Completed. Any status → Cancelled.

### Pickup Slots

| Method | Path | Description |
|---|---|---|
| GET | `/admin/pickup-slots` | All slots today (including full/expired) |

**Response `200`**
```json
{ "success": true, "message": "Slots fetched", "data": { "date": "2026-05-01", "slots": [...] } }
```

### Reports

| Method | Path | Description |
|---|---|---|
| GET | `/admin/reports` | Sales summary |
| GET | `/admin/reports/orders` | Order history (paginated) |

**GET /admin/reports query:** `?date=YYYY-MM-DD` (default today)

**Response `200`**
```json
{
  "success": true,
  "message": "Sales summary fetched",
  "data": {
    "date": "2026-05-01",
    "totalRevenue": 0,
    "totalOrders": 0,
    "avgOrderValue": 0,
    "completionRate": "0%",
    "ordersByStatus": { "Pending": 0, "Completed": 0 },
    "dailyBreakdown": [{ "date": "...", "revenue": 0, "orderCount": 0 }],
    "topItems": [{ "name": "...", "quantitySold": 0, "revenue": 0 }]
  }
}
```

**GET /admin/reports/orders query:** `?date=` `?page=` `?perPage=` (default 10) `?sort=` (prefix `-` for desc, e.g. `-placedAt`)

**Response `200`**
```json
{
  "success": true,
  "message": "Order history fetched",
  "data": { "orders": [...], "pagination": { "page": 1, "perPage": 10, "total": 50, "totalPages": 5 } }
}