# Staff Consumables: branch and authorization contract

## Header branch context

`GET /api/me/store-locations` is the authoritative CRM branch list. It delegates to
`StoreLocationAccessService`, which reads active `store_location_user` access (with the existing
platform bypass only); a Staff assignment does not broaden User access.

* Zero active accessible branches clears persisted selection and displays **No active branches**.
  Operational modules cannot submit transactions.
* One active accessible branch is selected automatically. The Header renders its name rather than
  a selector or **All Branches**, and overwrites stale/`all` persisted state.
* Two or more active accessible branches render the selector. A valid saved branch survives;
  invalid state resolves to **All Branches**. All is an overview scope, never an operational branch.

This selection is context only. Global Permission and Permission Group definitions remain global.

## Staff Consumables contract

The workspace is authorized exclusively through existing global permissions:
`pos.staff_consumables.access`, `pos.staff_consumables.checkout`, and
`pos.staff_consumables.view_logs`. Role names and Staff identity are not authorization signals.
The Sidebar/Header and server page use `access`; the dedicated API independently enforces the
corresponding permission middleware. An authorized Admin or custom-role User need not have a Staff
record and no synthetic Staff is created.

The CRM workspace uses the bounded contracts:

* `GET /api/admin/staff-consumables/catalog?store_location_id=...`
* `POST /api/admin/staff-consumables/checkout`
* `GET /api/admin/staff-consumables/logs[?store_location_id=...]`

Catalog and checkout require a concrete, active, accessible branch. Catalog eligibility is applied
in SQL through `store_location_product.is_available`; quantities come from
`store_location_product_inventories`. Checkout reauthorizes the supplied branch and branch
inventory validation/deduction is transactional. The resulting Order stores `store_location_id`
and `created_by_user_id`; `order_items.staff_id` is optional attribution only.

With **All Branches**, checkout is disabled and the API rejects a missing concrete branch. History
is limited to the caller's accessible active branches and includes a Branch column. At a specific
or sole branch it is filtered to that branch and the redundant column is hidden.

## POS non-regression and endpoint audit

The normal `/pos` page, product catalog/search, Staff selection, commission, service assignment,
and checkout contracts were not changed. The old `/pos/staff-consumables/*` namespace was an
internal staff-free Order flow: it required `user.staff_id`, resolved a POS cart branch, and used
normal product stock for display before invoking branch deduction. It did not calculate commission,
but coupling this workspace to a POS cart caused the reported **All Branches is not operational**
failure. The dedicated admin namespace removes that public coupling while reusing the established
Order and branch-inventory services. Compatibility routes remain for existing clients.

History attribution answers actor, branch, product, quantity, and timestamp from the existing Order,
OrderItem, and stock-movement records; no separate audit subsystem is introduced.
