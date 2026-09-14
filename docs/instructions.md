# The Canteen — Backend Implementation Guide

> **Stack:** Node.js · Express · Mongoose · JWT
> **Structure:** `routes/` · `controllers/` · `models/` · `utils/` · `middleware/`

---

## Project Structure

```
src/
├── server.js
├── config/
│   └── db.js
├── middleware/
│   ├── auth.js           # verifyToken, requireAdmin
│   └── errorHandler.js
├── utils/
│   ├── generateToken.js
│   └── apiError.js
├── models/
│   ├── User.js
│   ├── Admin.js
│   ├── MenuItem.js
│   ├── Order.js
│   └── PickupSlot.js
├── controllers/
│   ├── authController.js
│   ├── menuController.js
│   ├── orderController.js
│   ├── pickupSlotController.js
│   └── reportController.js
└── routes/
    ├── auth.js
    ├── menu.js
    ├── orders.js
    ├── pickupSlots.js
    └── admin/
        ├── menu.js
        ├── orders.js
        ├── pickupSlots.js
        └── reports.js
```

---

## Environment Variables

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/thecanteen
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h
SLOT_CAPACITY=10          # max orders per pickup slot
SLOT_DURATION_MINUTES=15  # interval between slots
```

---

## Mongoose Models

### 1. `User` (`models/User.js`)

```js
{
  name:         { type: String, required: true, trim: true },
  phone:        { type: String, required: true, unique: true, trim: true },  // e.g. "03001234567"
  password:     { type: String, required: true, minlength: 8 },  // bcrypt hashed
  createdAt:    { type: Date, default: Date.now }
}
```

- `id` format: use Mongo's `_id`
- Pre-save hook: hash password with `bcrypt`
- Method: `comparePassword(plain)` → boolean
- Phone number should be stored as a plain string — validate format (e.g. Pakistani mobile: `/^03[0-9]{9}$/`) in the controller before saving

---

### 2. `Admin` (`models/Admin.js`)

```js
{
  username:   { type: String, required: true, unique: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true },   // bcrypt hashed
  role:       { type: String, default: 'admin' },
  createdAt:  { type: Date, default: Date.now }
}
```

- Pre-save hook: hash password with `bcrypt`
- Login accepts either `username` or `email` as the identifier — look up with `{ $or: [{ username }, { email }] }`

---

### 3. `MenuItem` (`models/MenuItem.js`)

```js
{
  name:          { type: String, required: true, trim: true },
  category:      { type: String, required: true, enum: ['Snacks', 'Drinks', 'Meals', 'Desserts'] },
  price:         { type: Number, required: true, min: 1 },
  description:   { type: String, default: '' },
  imageUrl:      { type: String, default: '' },
  isAvailable:   { type: Boolean, default: true },
  createdAt:     { type: Date, default: Date.now }
}
```

- `id` in responses: use `_id` cast to string (numeric-style IDs as referenced in the spec can be auto-incremented using a counter collection, or simply use Mongo ObjectIds and map in the response)

---

### 4. `Order` (`models/Order.js`)

```js
{
  orderId:      { type: String, unique: true },  // e.g. ORD-1020, auto-generated
  user:         { type: ObjectId, ref: 'User', required: true },
  items: [{
    menuItem:   { type: ObjectId, ref: 'MenuItem', required: true },
    name:       { type: String },   // snapshot at time of order
    price:      { type: Number },   // snapshot at time of order
    quantity:   { type: Number, required: true, min: 1, max: 10 }
  }],
  totalAmount:  { type: Number, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  pickupSlot:   { type: ObjectId, ref: 'PickupSlot', required: true },
  pickupTime:   { type: String },   // human-readable snapshot, e.g. "10:15 AM"
  placedAt:     { type: Date, default: Date.now }
}
```

**Important:** Store `name` and `price` as snapshots on each order item so historical orders stay accurate even if menu changes.

**Auto-increment `orderId`:** Use a `Counter` model or an atomic `findOneAndUpdate` on a `counters` collection to generate sequential `ORD-XXXX` IDs in a pre-save hook.

**Status transition map** (enforce in controller):
```js
const ALLOWED_TRANSITIONS = {
  'Pending':          ['Confirmed', 'Cancelled'],
  'Confirmed':        ['Preparing'],
  'Preparing':        ['Ready for Pickup'],
  'Ready for Pickup': ['Completed'],
  'Completed':        [],
  'Cancelled':        []
};
```

---

### 5. `PickupSlot` (`models/PickupSlot.js`)

```js
{
  time:         { type: String, required: true },   // e.g. "10:00 AM"
  label:        { type: String },
  date:         { type: String, required: true },   // "YYYY-MM-DD"
  maxCapacity:  { type: Number, default: 10 },
  orderCount:   { type: Number, default: 0 },
  createdAt:    { type: Date, default: Date.now }
}
```

- Virtual `available`: `orderCount < maxCapacity`
- Virtual `remaining`: `maxCapacity - orderCount`
- Slots are generated fresh each day (via a cron job or lazily on first request)
- Only return slots for today and future time windows in the public endpoint

---

## Middleware

### `middleware/auth.js`

**`verifyToken`**
- Reads `Authorization: Bearer <token>` header
- Verifies JWT with `JWT_SECRET`
- Attaches decoded payload to `req.user`
- Returns `401` if missing or invalid

**`requireAdmin`**
- Runs after `verifyToken`
- Checks `req.user.role === 'admin'`
- Returns `403` if not admin

---

### `middleware/errorHandler.js`

Central error handler (last `app.use`):

```js
(err, req, res, next) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.name || 'Error',
    message: err.message,
    fields: err.fields || undefined
  });
}
```

---

### `utils/apiError.js`

Custom error class:

```js
class ApiError extends Error {
  constructor(statusCode, message, fields = null) {
    super(message);
    this.statusCode = statusCode;
    this.fields = fields;
  }
}
```

Throw anywhere: `throw new ApiError(404, 'Item not found')`

---

## Routes & Controllers

### Auth — `routes/auth.js`

| Method | Path                  | Controller Function        | Auth     |
|--------|-----------------------|----------------------------|----------|
| POST   | `/auth/login`         | `customerLogin`            | Public   |
| POST   | `/auth/register`      | `customerRegister`         | Public   |
| POST   | `/auth/admin/login`   | `adminLogin`               | Public   |

**`customerLogin`**
- Expect `{ phone, password }` in body
- Find user by `phone`
- Compare password with `bcrypt`
- Sign JWT with `{ id, role: 'customer' }`
- Return `200` with `token` and `user` object
- Errors: `401` bad credentials, `422` validation

**`customerRegister`**
- Expect `{ name, phone, password }` in body
- Validate phone format (e.g. `/^03[0-9]{9}$/`)
- Check uniqueness of `phone` — return `409` if already registered
- Create `User` document
- Return `201` with `user` object (no token — user must login separately)
- Errors: `409` duplicate phone, `422` validation

**`adminLogin`**
- Expect `{ identifier, password }` in body — `identifier` is either `username` or `email`
- Find admin with `{ $or: [{ username: identifier }, { email: identifier }] }`
- Compare password
- Sign JWT with `{ id, role: 'admin' }`
- Return `200` with `token` and `admin` object
- Errors: `401`, `403`

---

### Menu Items (Public) — `routes/menu.js`

| Method | Path             | Controller Function | Auth   |
|--------|------------------|---------------------|--------|
| GET    | `/menu-items`    | `listMenuItems`     | Public |
| GET    | `/menu-items/:id`| `getMenuItem`       | Public |

**`listMenuItems`**
- Accept query params: `category`, `search`, `available`
- Build Mongoose filter object dynamically
- `search`: use case-insensitive regex on `name`
- `available`: cast string `"true"`/`"false"` to boolean
- Return `200` with `{ items: [...] }`

**`getMenuItem`**
- Find by `_id`, return `404` if not found

---

### Menu Items (Admin) — `routes/admin/menu.js`

All routes: `verifyToken` + `requireAdmin`

| Method | Path                                      | Controller Function      |
|--------|-------------------------------------------|--------------------------|
| GET    | `/admin/menu-items`                       | `listMenuItems`          |
| POST   | `/admin/menu-items`                       | `createMenuItem`         |
| PUT    | `/admin/menu-items/:id`                   | `updateMenuItem`         |
| DELETE | `/admin/menu-items/:id`                   | `deleteMenuItem`         |
| PATCH  | `/admin/menu-items/:id/availability`      | `toggleAvailability`     |

**`createMenuItem`**
- Validate required fields (`name`, `category`, `price`)
- Create and return item with `201`

**`updateMenuItem`**
- Accept partial body — only update provided fields
- Return updated doc with `{ new: true }`

**`deleteMenuItem`**
- Find and delete, return `{ message: 'Item deleted' }`

**`toggleAvailability`**
- Expect `{ isAvailable: Boolean }` in body
- Update only `isAvailable` field

---

### Orders (Customer) — `routes/orders.js`

All routes: `verifyToken`

| Method | Path          | Controller Function | Auth     |
|--------|---------------|---------------------|----------|
| POST   | `/orders`     | `placeOrder`        | Customer |
| GET    | `/orders`     | `listMyOrders`      | Customer |
| GET    | `/orders/:id` | `getOrderDetail`    | Customer |

**`placeOrder`**
1. Validate `items` array (each needs `menuItemId`, `quantity` 1–10) and `pickupSlotId`
2. Find pickup slot — return `400` if not found, not available, or full
3. Fetch each `MenuItem` — validate all exist and are available
4. Calculate `totalAmount`
5. Snapshot `name` and `price` onto each order item
6. Atomically increment `slot.orderCount` (use `$inc` + check capacity)
7. Create `Order` document with auto-generated `orderId`
8. Return `201` with order object including `pickupTime`

**`listMyOrders`**
- Filter by `user: req.user.id`
- `status=active`: return orders with status in `['Pending', 'Confirmed', 'Preparing', 'Ready for Pickup']`
- `status=past`: return orders with status in `['Completed', 'Cancelled']`
- Sort by `placedAt` descending

**`getOrderDetail`**
- Find by `_id` AND `user: req.user.id`
- Return `403` if order belongs to another user, `404` if not found

---

### Orders (Admin) — `routes/admin/orders.js`

All routes: `verifyToken` + `requireAdmin`

| Method | Path                          | Controller Function   |
|--------|-------------------------------|-----------------------|
| GET    | `/admin/orders`               | `listAllOrders`       |
| PATCH  | `/admin/orders/:id/status`    | `updateOrderStatus`   |

**`listAllOrders`**
- Optional filters: `status`, `date` (match `placedAt` date range for that day)
- Pagination: `page` (default `1`), `perPage` (default `20`)
- Populate user for `studentName` and `rollNumber`
- Return `{ orders, pagination }`

**`updateOrderStatus`**
1. Find order by `_id`
2. Validate transition using `ALLOWED_TRANSITIONS` map
3. Return `400` with message `'Invalid status transition'` if not allowed
4. Save and return updated order

---

### Pickup Slots — `routes/pickupSlots.js` and `routes/admin/pickupSlots.js`

| Method | Path                   | Controller Function    | Auth    |
|--------|------------------------|------------------------|---------|
| GET    | `/pickup-slots`        | `listAvailableSlots`   | Public  |
| GET    | `/admin/pickup-slots`  | `listAllSlotsAdmin`    | Admin   |

**`listAvailableSlots`**
- Filter by `date = today` and `time >= now`
- Return `{ slots }` with `available` and `remaining` computed virtuals

**`listAllSlotsAdmin`**
- Return all slots for today with `orderCount` and `maxCapacity`
- Return `{ date, slots }`

**Slot generation strategy:**
- On server start (or via cron at midnight), generate slots for the day using `SLOT_DURATION_MINUTES` and `SLOT_CAPACITY` from env
- Use `upsert` so re-runs are idempotent

---

### Reports (Admin) — `routes/admin/reports.js`

All routes: `verifyToken` + `requireAdmin`

| Method | Path                    | Controller Function   |
|--------|-------------------------|-----------------------|
| GET    | `/admin/reports`        | `getSalesSummary`     |
| GET    | `/admin/reports/orders` | `getOrderHistory`     |

**`getSalesSummary`**
- Accept `date` query param, default to today (`YYYY-MM-DD`)
- Compute for the given date:
  - `totalRevenue`: sum of `totalAmount` for `Completed` orders
  - `totalOrders`: count of all non-cancelled orders
  - `avgOrderValue`: `totalRevenue / completedOrders`
  - `completionRate`: `(completed / total) * 100`%
  - `ordersByStatus`: count grouped by status
  - `dailyBreakdown`: for the current week (Mon–Sun), revenue and order count per day using `$group` aggregation
  - `topItems`: aggregate order items, group by `name`, sum `quantity` and `revenue`, sort by `quantitySold` desc, limit 5
- All computed via Mongoose aggregation pipeline

**`getOrderHistory`**
- Accept `date`, `page` (default `1`), `perPage` (default `10`), `sort` (default `-placedAt`)
- Parse sort: strip `-` prefix → `{ field: -1 }` for desc, `{ field: 1 }` for asc
- Populate user fields
- Return `{ orders, pagination }`

---

## Shared Conventions

### Response Shapes

**Success:**
```js
res.status(200).json({ /* data */ });
```

**Error (via `ApiError` + `errorHandler`):**
```json
{
  "error": "ValidationError",
  "message": "Human-readable description",
  "fields": { "email": "Invalid email format" }
}
```

### Validation

- Use `express-validator` or manual checks in controllers
- For missing required fields return `422` with `fields` map
- For duplicate unique fields return `409`

### Pagination Helper (`utils/paginate.js`)

```js
// Usage in any paginated controller:
const page = parseInt(req.query.page) || 1;
const perPage = parseInt(req.query.perPage) || 20;
const skip = (page - 1) * perPage;

const [items, totalItems] = await Promise.all([
  Model.find(filter).skip(skip).limit(perPage),
  Model.countDocuments(filter)
]);

return {
  items,
  pagination: {
    page,
    perPage,
    totalItems,
    totalPages: Math.ceil(totalItems / perPage)
  }
};
```

### JWT Token Generation (`utils/generateToken.js`)

```js
const jwt = require('jsonwebtoken');

const generateToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });

module.exports = generateToken;
```

---

## Key Implementation Notes

- **Password hashing:** Always hash with `bcrypt` (salt rounds ≥ 10) in a pre-save hook. Never store plain text.
- **Token payload:** Include `{ id, role }`. Role is either `'customer'` or `'admin'`. The `requireAdmin` middleware uses this role check.
- **Price/name snapshots on orders:** Always copy `menuItem.name` and `menuItem.price` into the order item subdocument at the time of placement. Do not rely on a populated reference for historical accuracy.
- **Slot concurrency:** Use `findOneAndUpdate` with `$inc: { orderCount: 1 }` and a filter that checks `orderCount < maxCapacity` to safely handle concurrent orders without over-booking.
- **Order ID generation:** Use a `counters` collection with `findOneAndUpdate + $inc` in a pre-save hook to generate sequential `ORD-XXXX` IDs atomically.
- **Admin seeding:** Seed at least one admin account on first startup via a setup script (`scripts/seedAdmin.js`). Do not expose a public registration endpoint for admins.
- **CORS:** Enable `cors` middleware, restrict origins to your frontend URL in production.
- **Date filtering for orders:** For `date=YYYY-MM-DD` filters, query `placedAt` between start-of-day and end-of-day using UTC boundaries.