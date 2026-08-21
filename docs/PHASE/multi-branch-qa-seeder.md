# Multi-Branch QA/Test Data Seeder

This operator utility prepares a conservative, repeatable data set for an **existing** `store_locations` Branch. It is test tooling, not a new architecture phase, a migration, or Multi-Tenancy.

## Usage and workflow

```bash
cd backend/ecommerce_gentlegurl_backend_api
php artisan multibranch:test-seed --store-code=XXXX --dry-run
php artisan multibranch:test-seed --store-code=XXXX --force
```

1. Create the Branch manually in CRM and configure its active/Booking/POS/pickup capabilities.
2. Note the exact immutable Branch code.
3. Run `--dry-run` and review candidates and warnings.
4. Correct missing prerequisites where appropriate.
5. Run the same command with `--force`.
6. Start Multi-Branch QA with target, PNG/another Branch, and All Branches contexts.

Exactly one of `--dry-run` and `--force` is mandatory. The command resolves `store_locations.code` from runtime input and never creates a Branch. A missing code, unknown Branch, or production environment fails without writes. An inactive or capability-disabled Branch is reported; the command does not silently alter business configuration.

## Fixture ownership and scope

The stable prefix is `MBQA-{NORMALIZED_STORE_CODE}-`. The command reuses, and never creates or edits, global Product, Category, Staff, Booking Service, Customer/Member, Package, Point-balance, Voucher, Redeem Voucher, Redeem Product, Promotion, or loyalty identities.

For the target Branch only it safely prepares:

- up to eight existing active Product availability rows in `store_location_product`, leaving a ninth Product unavailable as a visibility control;
- canonical `store_location_product_inventories` balances with recognizable quantities (`2`, `20`, `0`, `5`, …), including a Variant where the selected Product has one;
- a low quantity of `2` for Products whose existing global threshold makes it low, plus one available Product intentionally lacking an inventory row to exercise Phase 9C's missing-row-as-zero rule;
- existing Staff assignments through `staff_store_location` and existing Booking Service assignments through `booking_service_store_location`;
- three Branch-owned Expense Categories and six Branch-matching Expenses with distinct dates and amounts. Expenses are skipped with a warning if no existing User can own their audit fields.

Category visibility remains derived from available Products; no Category is copied and no Category/Branch table is introduced. Existing inventory rows are deliberately not overwritten, because the utility cannot prove that a pre-existing physical count belongs to it. Existing unavailable Product assignments are likewise preserved.

## Dry run, idempotency, and isolation

Dry run reads candidate masters and existing prerequisites, prints the plan and warnings, and performs no insert or update. Force runs all writes in one database transaction. Composite natural keys protect pivots and inventory, while exact Expense names/numbers protect owned financial fixtures. Replays report existing records instead of multiplying them. Nothing is copied from PNG and no row attributed to another Branch is updated.

Production execution is unconditionally refused. The utility is not referenced by `DatabaseSeeder`, migrations, deployment, or application startup.

## Intentionally manual QA

Schedules and Bookings are not inserted directly: their collision, availability, holds, notifications, payments, and status workflows must be exercised through the supported UI/services. Orders, refunds, POS Cash Shifts, payment-provider state, shipping routing, printer settings, commission, Package usage, Points/Loyalty activity, Promotions, and stock movements are also left to genuine workflows. The seeded availability/inventory/service/staff prerequisites make those workflows possible without fabricating accounting or external state.

There is no cleanup command. Product/Staff/Service pivots and pre-existing inventory rows have no seeder-ownership column, so a blanket cleanup could delete legitimate configuration. Deterministically prefixed Expenses can be reviewed and removed through normal authorized Expense Management; other fixture rows should be reviewed explicitly. Safety takes precedence over convenient destructive cleanup.

## Suggested verification

- Compare Product/Category/Inventory/Low Stock for the target, another Branch, and All Branches.
- Confirm the quantity-2 and missing-balance Products appear in the target Branch's low-stock result.
- Complete a Booking and POS sale through normal workflows, then verify Booking, Appointment, Sales, Stock Movement, Staff and commission reports.
- Open/close a Cash Shift through the POS UI; do not seed a permanently open shift.
- Test pickup and shipping checkout normally so persisted fulfilment and payment state remain valid.
- Compare Expense and Profit/Loss totals and CSV output using the six recognizable Expense amounts/dates.
- Confirm global Product/Category masters, Member Points, Package entitlement, Voucher/Reward definitions and shared Ecommerce browsing remain global.
