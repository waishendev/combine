# POS booking and checkout customer identity (legacy fix)

This is a legacy POS correction, not a Multi-Branch phase or redesign.

## Identity boundaries

- **Booking customer identity** is stored on the booking (or its pre-checkout POS service line). A null `customer_id` plus the guest snapshot represents a Guest booking.
- **Checkout/Order Member** is the transaction recipient stored on `orders.customer_id`. It drives the existing receipt, loyalty, voucher, and customer-account behavior where those features already use the Order customer.
- Selecting a checkout Member never copies that Member into existing Guest booking/service lines. A Guest remains Guest unless an operator uses the explicit booking customer edit flow.

Points and the receipt continue to use the checkout Order Member. This does not assert ownership of each booking represented by an order line.

## Settlement compatibility

Settlement validation collects distinct, non-null booking `customer_id` values. Zero or one distinct Member is allowed, so any number of Guest bookings may be combined with Member A bookings. Two or more distinct Members are rejected with: `Bookings belonging to different Members cannot be settled together.` Guest name, phone, and email snapshots are contact data, not Member identities.

For Guest + Member A, Member A becomes the checkout context by default while every Guest booking remains unchanged. For guest-only settlements, a Member may be selected for Order-level receipt/points attribution without changing booking ownership.

## Safety boundaries retained

- Customer Balance still requires and charges the concrete checkout/Order Member, with existing balance and audit checks.
- Package eligibility and consumption continue to resolve from each Booking's own Member and reserved claim. Selecting a checkout Member does not give a Guest booking that Member's package.
- Package purchase ownership and voucher/promotion eligibility checks are unchanged.
- Booking Branch, POS cart Branch, Cash Shift, inventory, payment methods, staff splits, commission, and reporting behavior are unchanged. Cross-Branch settlement remains prohibited.

## Existing data

No historical backfill is provided. Old accidental reassignment cannot be identified reliably without an independent audit trail proving the prior Guest identity; automatically guessing would risk corrupting legitimate Member bookings.
