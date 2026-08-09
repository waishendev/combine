# Phase 7 global benefits and Branch attribution runbook

## First-version business rule

Gentlegurls operates one shared Ecommerce website. Customers do not select a Branch before browsing, applying a Voucher, or redeeming a Reward. The first multi-Branch version therefore keeps Customer identity, Member Points, Package catalogue/ownership/remaining entitlement, Vouchers, Redeem Vouchers, and Redeem Products globally usable.

Branch is transaction attribution—**where an operation happened**—not benefit eligibility. A deterministic POS or Booking operation records its persisted Branch. Ecommerce records NULL while fulfilment Branch is genuinely unknown. NULL never means PNG, the first/current Branch, or All Branches.

Existing Voucher rules remain authoritative: active dates, total/customer limits, minimum spend, Product/Category scope, and reward ownership. No Voucher or Reward is rejected because of Branch. Reward Product redemption does not require a Branch initially and does not consult Product Branch availability before fulfilment is known. Phase 6 `store_location_product` remains intact for POS and later fulfilment; global Product/ProductVariant stock remains production authority.

Packages remain global and are naturally constrained by eligible Booking Services. Their shared balance is row-locked during reservation/consumption. Package purchase/use records Order, Booking, or POS Branch when deterministic without partitioning ownership. Point earn/spend uses one global FIFO balance and records Branch only on transaction history.

## Applicability correction

The initial Phase 7 development commit introduced `voucher_store_location` and `loyalty_reward_store_location`. They were not part of an earlier production migration series and are unnecessary under the corrected rule. The original Phase 7 migration no longer creates them. A follow-up compatibility migration drops them if an environment already ran the initial development migration. Those pivots held configuration only—not Voucher usages, claims, points, Package balances, stock, or other transaction history.

CRM Branch applicability checklists and backend assignment/eligibility enforcement are removed. Branch-specific Voucher/Reward applicability can be designed later only if the business requests it; dormant UI/schema is deliberately not retained as an apparent source of truth.

## Deployment and deterministic backfill

1. Back up the database and deploy both Phase 7 migrations plus corrected code.
2. Confirm the correction migration removes only the two obsolete applicability pivots.
3. Run and archive the zero-write report:
   `php artisan benefit-branch:backfill --dry-run`
4. Reconcile attributable Package usage, Order-backed points, Order-backed Voucher usages, and Order-backed reward claims. Review unresolved NULL records; do not assign defaults.
5. In an approved write window only, run (not run by this implementation):
   `php artisan benefit-branch:backfill --force`
6. Re-run dry-run. Force is idempotent because it updates only NULL attribution from deterministic parent transactions.

The command never changes Customer identity, point batches/balances, Package ownership/balances, Voucher eligibility, loyalty claim value/status, Product/Variant stock, Phase 6 Product availability, or Branch Inventory.

## Reconciliation and rollback

Before and after deployment compare Customer counts, per-Customer available points, Package ownership and remaining quantities, Voucher usage counts, loyalty claims, global Product/Variant stock, and Branch Inventory rows. Only deterministic attribution columns and removal of obsolete configuration pivots should differ.

For application rollback, retain nullable attribution columns so history is not lost. Rolling back the compatibility migration recreates empty applicability pivots for schema rollback only; it cannot restore obsolete assignments, which must not be treated as active rules. Rolling back the original Phase 7 migration removes attribution and idempotency columns, so export them first if historical attribution must be retained.

## Phase 8/9 deferrals

Deferred: Ecommerce fulfilment Branch selection, self-pickup inventory validation, delivery routing, Branch Inventory activation/reservation/deduction/restoration, stock transfers, per-Branch pricing, and full Branch reporting. No tenant, organization, or `tenant_id` architecture is introduced.
