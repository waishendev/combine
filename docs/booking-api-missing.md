# Booking API Documentation

This document describes both **existing** booking API endpoints and **missing** endpoints that are required by the booking UI.

---

## Existing Booking API Endpoints

### 1. Get Booking Services

**Endpoint:** `GET /booking/services`

**Purpose:** Get list of all active booking services.

**Request Parameters:**
- `search` (optional): Search query string

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Precision Cut",
      "service_type": "standard",
      "duration_minutes": 60,
      "duration_min": 60,
      "deposit_amount": 30.0,
      "buffer_min": 15,
      "is_active": true
    }
  ]
}
```

**Used By:**
- `getBookingServices()` in `src/lib/apiClient.ts`
- Booking page service list

---

### 2. Get Booking Service Detail

**Endpoint:** `GET /booking/services/{id}`

**Purpose:** Get detailed information about a specific service including available staff.

**Response:**
```json
{
  "data": {
    "id": 1,
    "name": "Precision Cut",
    "description": "A tailored haircut experience...",
    "service_type": "standard",
    "duration_minutes": 60,
    "duration_min": 60,
    "deposit_amount": 30.0,
    "buffer_min": 15,
    "is_active": true,
    "staffs": [
      {
        "id": 1,
        "name": "Aina"
      },
      {
        "id": 2,
        "name": "Kai"
      }
    ]
  }
}
```

**Used By:**
- `getBookingServiceDetail()` in `src/lib/apiClient.ts`
- Service detail page and booking page

---

### 3. Get Availability

**Endpoint:** `GET /booking/availability`

**Purpose:** Get available time slots for a specific service, staff member, and date.

**Request Parameters:**
- `service_id` (required): The service ID
- `staff_id` (required): The staff member ID
- `date` (required): Date in YYYY-MM-DD format

**Response:**
```json
{
  "data": {
    "date": "2024-01-15",
    "service_id": 1,
    "staff_id": 1,
    "duration_min": 60,
    "buffer_min": 15,
    "slot_step_min": 15,
    "slots": [
      {
        "start_time": "09:00",
        "end_time": "10:00",
        "start_at": "2024-01-15T09:00:00Z",
        "end_at": "2024-01-15T10:00:00Z",
        "is_available": true,
        "label": "9:00 AM - 10:00 AM"
      }
    ]
  }
}
```

**Used By:**
- `getAvailability()` in `src/lib/apiClient.ts`
- Time slot selection in booking page

**Note:** Currently requires one API call per staff member, which is inefficient when displaying all staff availability together.

---

### 4. Add Item to Cart

**Endpoint:** `POST /booking/cart/add`

**Purpose:** Add a booking slot to the cart.

**Request Headers:**
- `X-Booking-Guest-Token` (required for guests): Guest token for anonymous users

**Request Body:**
```json
{
  "service_id": 1,
  "staff_id": 1,
  "start_at": "2024-01-15T09:00:00Z"
}
```

**Response:**
```json
{
  "data": {
    "id": "cart-uuid",
    "status": "active",
    "items": [
      {
        "id": 1,
        "service_id": 1,
        "service_name": "Precision Cut",
        "staff_id": 1,
        "staff_name": "Aina",
        "service_type": "standard",
        "start_at": "2024-01-15T09:00:00Z",
        "end_at": "2024-01-15T10:00:00Z",
        "expires_at": "2024-01-15T09:15:00Z",
        "status": "active"
      }
    ],
    "deposit_total": 30.0,
    "next_expiry_at": "2024-01-15T09:15:00Z"
  }
}
```

**Used By:**
- `addCartItem()` in `src/lib/apiClient.ts`
- Booking modal when adding to cart

---

### 5. Get Cart

**Endpoint:** `GET /booking/cart`

**Purpose:** Get current booking cart with all items.

**Request Headers:**
- `X-Booking-Guest-Token` (required for guests): Guest token for anonymous users

**Response:**
```json
{
  "data": {
    "id": "cart-uuid",
    "status": "active",
    "items": [
      {
        "id": 1,
        "service_id": 1,
        "service_name": "Precision Cut",
        "staff_id": 1,
        "staff_name": "Aina",
        "service_type": "standard",
        "start_at": "2024-01-15T09:00:00Z",
        "end_at": "2024-01-15T10:00:00Z",
        "expires_at": "2024-01-15T09:15:00Z",
        "status": "active"
      }
    ],
    "deposit_total": 30.0,
    "next_expiry_at": "2024-01-15T09:15:00Z"
  }
}
```

**Used By:**
- `getBookingCart()` in `src/lib/apiClient.ts`
- Cart drawer and cart page

---

### 6. Remove Cart Item

**Endpoint:** `DELETE /booking/cart/item/{itemId}`

**Purpose:** Remove an item from the booking cart.

**Request Headers:**
- `X-Booking-Guest-Token` (required for guests): Guest token for anonymous users

**Response:**
```json
{
  "data": {
    "id": "cart-uuid",
    "status": "active",
    "items": [],
    "deposit_total": 0.0,
    "next_expiry_at": null
  }
}
```

**Used By:**
- `removeCartItem()` in `src/lib/apiClient.ts`
- Cart drawer remove button

---

### 7. Checkout Cart

**Endpoint:** `POST /booking/cart/checkout`

**Purpose:** Convert cart items into bookings (hold status).

**Request Headers:**
- `X-Booking-Guest-Token` (required for guests): Guest token for anonymous users

**Request Body:**
```json
{
  "guest_name": "John Doe",
  "guest_phone": "+60123456789",
  "guest_email": "john@example.com"
}
```

**Note:** `guest_name` and `guest_phone` are required for guest checkout. For logged-in customers, these fields are optional.

**Response:**
```json
{
  "data": {
    "status": "success",
    "booking_ids": [1, 2],
    "deposit_total": 60.0,
    "payment_expires_at": "2024-01-15T09:15:00Z",
    "payment_instruction": "Complete payment before hold expires to confirm booking."
  }
}
```

**Used By:**
- `checkoutCart()` in `src/lib/apiClient.ts`
- Cart drawer checkout flow

---

### 8. Get My Bookings

**Endpoint:** `GET /booking/my`

**Purpose:** Get all bookings for the authenticated customer.

**Authentication:** Required (customer must be logged in)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "status": "CONFIRMED",
      "service_name": "Precision Cut",
      "staff_name": "Aina",
      "starts_at": "2024-01-15T09:00:00Z",
      "deposit_amount": 30.0
    }
  ]
}
```

**Used By:**
- `getMyBookings()` in `src/lib/apiClient.ts`
- My bookings page

---

### 9. Hold Slot (Reserve without adding to cart)

**Endpoint:** `POST /booking/hold`

**Purpose:** Temporarily hold a slot without adding to cart.

**Note:** This endpoint exists but is not currently used by the frontend.

---

### 10. Pay for Booking

**Endpoint:** `POST /booking/{id}/pay`

**Purpose:** Process payment for a booking.

**Note:** This endpoint exists but payment flow is handled separately.

---

### 11. Reschedule Booking

**Endpoint:** `POST /booking/{id}/reschedule`

**Purpose:** Reschedule an existing booking.

**Note:** This endpoint exists but reschedule functionality is not yet implemented in the frontend.

---

## Missing Booking API Endpoints

The following endpoints are required by the booking UI but are not currently available in the backend API.

## 1. Bulk Availability Endpoint

### Purpose
The booking page UI displays time slots with all staff members' availability shown together. Currently, the API requires individual calls for each staff member (`GET /booking/availability?service_id=X&staff_id=Y&date=Z`), which results in multiple API calls and slower performance.

### Required Endpoint

**Endpoint:** `GET /booking/availability/bulk`

**Purpose:** Get availability for all staff members for a specific service and date in a single request.

**Request Parameters:**
- `service_id` (required): The service ID
- `date` (required): Date in YYYY-MM-DD format

**Expected Response:**
```json
{
  "data": {
    "service_id": 1,
    "date": "2024-01-15",
    "time_slots": [
      {
        "start_time": "09:00",
        "end_time": "10:00",
        "staff_availability": [
          {
            "staff_id": 1,
            "staff_name": "Aina",
            "is_available": true
          },
          {
            "staff_id": 2,
            "staff_name": "Kai",
            "is_available": false
          },
          {
            "staff_id": 3,
            "staff_name": "Suri",
            "is_available": true
          }
        ]
      },
      {
        "start_time": "10:00",
        "end_time": "11:00",
        "staff_availability": [
          {
            "staff_id": 1,
            "staff_name": "Aina",
            "is_available": false
          },
          {
            "staff_id": 2,
            "staff_name": "Kai",
            "is_available": true
          },
          {
            "staff_id": 3,
            "staff_name": "Suri",
            "is_available": true
          }
        ]
      }
    ]
  }
}
```

**Which UI Component Requires It:**
- `TimeSlotSelector` component in `src/components/booking/TimeSlotSelector.tsx`
- Main booking page in `src/app/booking/page.tsx`

**Current Workaround:**
The current implementation makes multiple API calls (one per staff member) and combines the results on the frontend. This works but is inefficient and slower.

**Benefits of New Endpoint:**
1. Single API call instead of N calls (where N = number of staff)
2. Faster page load times
3. Reduced server load
4. Better user experience

---

## 2. Service Price in Cart Item

### Purpose
The cart drawer displays booking items but currently cannot show the service price because the `BookingCartItem` type doesn't include price information.

### Required Field Addition

**Type:** `BookingCartItem` in `src/lib/types.ts`

**Current Structure:**
```typescript
export type BookingCartItem = {
  id: number;
  service_id: number;
  service_name: string;
  staff_id: number;
  staff_name: string;
  service_type: "premium" | "standard";
  start_at: string;
  end_at: string;
  expires_at: string;
  status: string;
};
```

**Expected Addition:**
```typescript
export type BookingCartItem = {
  // ... existing fields
  service_price?: number;  // Add this field
  deposit_amount?: number;  // Add this field (if different from service_price)
};
```

**Which UI Component Requires It:**
- `CartDrawer` component in `src/components/booking/CartDrawer.tsx`

**Current Workaround:**
The cart drawer currently shows "Deposit Required" instead of the actual price. The total is calculated from `deposit_total` in the cart object, but individual item prices are not displayed.

---

---

## Summary

### Existing Endpoints (12 total)
1. ✅ `GET /booking/services` - List all services
2. ✅ `GET /booking/services/{id}` - Get service detail with staff
3. ✅ `GET /booking/availability` - Get availability for service/staff/date
4. ✅ `GET /booking/availability/bulk` - Get availability for all staff for service/date (NEW - implemented)
5. ✅ `POST /booking/cart/add` - Add item to cart
6. ✅ `GET /booking/cart` - Get current cart (includes `deposit_amount` per item)
7. ✅ `DELETE /booking/cart/item/{itemId}` - Remove cart item
8. ✅ `POST /booking/cart/checkout` - Checkout cart
9. ✅ `GET /booking/my` - Get customer bookings
10. ✅ `POST /booking/hold` - Hold slot (not used in frontend)
11. ✅ `POST /booking/{id}/pay` - Pay for booking
12. ✅ `POST /booking/{id}/reschedule` - Reschedule booking

### Recently Implemented (2 items)
1. ✅ **Bulk Availability Endpoint** (`GET /booking/availability/bulk`) - ✅ IMPLEMENTED
   - Endpoint: `GET /booking/availability/bulk?service_id={id}&date={YYYY-MM-DD}`
   - Returns all staff availability for a service and date in a single request
   - Used by: Landing page booking section, booking page
   
2. ✅ **Service Deposit Amount in Cart Item** - ✅ IMPLEMENTED
   - Field: `deposit_amount` added to `BookingCartItem` response
   - Used by: Cart drawer to display individual item prices

### Notes
- All cart endpoints require `X-Booking-Guest-Token` header for guest users
- Cart items expire after 15 minutes (configurable via `BookingSetting`)
- Deposit calculation: Premium services use `deposit_amount_per_premium`, standard services use `deposit_base_amount_if_only_standard`
- Bookings created from cart checkout are in `HOLD` status and require payment before confirmation
