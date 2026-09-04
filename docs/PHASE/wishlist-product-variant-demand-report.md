# Wishlist Product/Variant Demand Report

## Data ownership and identity

Wishlist intent remains a **global Ecommerce/customer metric**. Neither the Header Branch, POS Branch, staff assignment, `store_location_product`, nor branch inventory determines ownership. The two persisted sources are `customer_wishlist_items` (unique customer + Product) and `guest_wishlist_items` (unique session + Product). Both contain `product_id`; neither contains a Product Variant foreign key. Demand is therefore Product-level and customer/guest classification is unchanged.

The report includes historical demand even when the Product is currently inactive. Product search and both date boundaries consistently scope the cards, rows, tie calculation, and on-demand detail response.

## Inventory and availability

The current global Ecommerce inventory fields are `products.stock` / `products.track_stock` for a Product without Variants and `product_variants.stock` / `product_variants.track_stock` for Variant Products. Active Variants are the relevant currently purchasable choices; inactive Variants remain visible in details but do not make an active Product's availability look worse. Untracked stock is treated as available.

Stock status rules are:

| Shape | State | Report status |
| --- | --- | --- |
| No active Variants | tracked Product stock > 0, or stock is untracked | In stock (quantity is included only when tracked) |
| No active Variants | tracked Product stock <= 0 | Out of stock |
| Active Variants | all available | In stock |
| Active Variants | some, but not all, unavailable | Some variants out of stock (unavailable/total) |
| Active Variants | all unavailable | Out of stock |

The “Out-of-stock Products With Wishlist Demand” card counts Products that are fully unavailable in the filtered report. A partial Variant stock-out is deliberately excluded. The previous implementation inspected only `products.stock`, which could mark a Variant Product unavailable without considering its purchasable Variants.

## Management recommendations

Recommendations are deterministic display metadata with no writes or operational side effects:

| Filtered demand / stock state | Recommendation |
| --- | --- |
| No demand | No action |
| Demand + available | Monitor |
| Demand + partial Variant stock-out | Restock selected variants |
| Demand + fully unavailable | Restock recommended |

No fallback or arbitrary low-stock number is used. Existing thresholds are consequently not reinterpreted as a report-wide policy.

## Top demand and detail UX

All rows at the filtered maximum are retained for the Top calculation. One leader displays its Product name; two or more leaders display `Tie — N products (X each)`; an empty scope displays `No wishlist data`.

The initial list stays Product-grained and compact. The View action calls `GET /api/ecommerce/reports/wishlist/{product}/detail` with the same Product search/date scope. Its modal contains the Product summary, overall status and recommendation, followed by one bulk-loaded Variant table (name, SKU, stock, availability, and demand placeholders). Because persisted wishlists have no Variant identity, the UI explicitly says Variant demand and timestamps are not tracked; it never duplicates or divides Product counts among Variants. Detail is loaded on demand, so the initial response does not carry every Variant and the endpoint does not perform per-Variant queries.
