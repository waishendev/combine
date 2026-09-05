# Leave and stock-movement Branch follow-up

## Ownership decisions

`product-branch:backfill` creates missing Product-to-Branch availability rows. It never changes inventory quantities or `product_stock_movements`. `stock-movement-branch:backfill` is the separate, explicit legacy attribution operation and updates only movements whose `store_location_id` is NULL.

Leave Balance remains global per Staff and Leave Type. Its CRM page is Branch-aware only through the Staff-to-Branch assignment: a concrete Branch shows assigned Staff, while ALL shows the de-duplicated accessible Staff union and their accessible active Branch names. Staff without an active accessible Branch assignment are excluded in both modes; they are never silently assigned to PNG or the header Branch. The controller eager-loads assignments and bulk-loads entitlements and approved usage, avoiding per-Staff Branch/balance queries. No Branch-specific entitlement is created.

A Leave Request (including manual and generated Off Day and a day-change child) belongs to exactly one Branch. Leave Logs obtain Branch from their persisted Leave Request; approval time-offs copy that Branch. No read path infers historical ownership from current Staff assignments.

Under a concrete header Branch, creation uses that authorized Branch. Under ALL, the backend intersects the User's accessible Branches with the selected Staff's assignments: one match resolves automatically, multiple matches require an explicit Branch, and no matches blocks creation. ALL is only an accessible visibility union. Operational edits, cancellations, approvals and rejections authorize the persisted record Branch. Legacy NULL means **Unassigned**, while a non-NULL relation with missing metadata means **Unknown Branch**.

The Leave creation UI mirrors those rules before submission. In a concrete header context it hides the redundant Branch selector. In ALL it displays a no-eligible warning, a fixed label for one eligible Branch, or a required dropdown containing only active accessible Staff assignments. Changing Staff recomputes the options and clears an invalid previous choice. Monthly and yearly generated Off Days use the same concrete selection.

The Leave Calendar filters events and Staff by the concrete Branch or accessible union. In ALL, compact events and Details identify Branch by name; the Staff list is de-duplicated. Generated Off Days receive the selected/schedule operation Branch when written, rather than looking up a later Staff assignment.

## Production rollout

1. Deploy application code.
2. `php artisan migrate --force`
3. `php artisan product-branch:backfill --store-code=PNG --dry-run` then `--force` where Product availability still needs reconciliation.
4. `php artisan stock-movement-branch:backfill --store-code=PNG --dry-run`; review target identity, counts and sample IDs; then repeat with `--force`.
5. Retain the existing `branch-inventory:initialize` / `branch-inventory:activate` sequence appropriate to the cutover. These commands initialize or activate Branch inventory and are not substitutes for movement attribution.
6. `php artisan leave-branch:backfill --store-code=PNG --dry-run`; review Leave Request and linked time-off counts; then repeat with `--force`.
7. Re-run both new commands in dry-run mode. Each should report zero pending rows.

PNG is valid only because this rollout concerns known legacy single-store data. Neither command installs a NULL-to-PNG runtime fallback, and neither overwrites non-NULL attribution.
