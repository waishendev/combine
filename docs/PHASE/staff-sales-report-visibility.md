# Staff Sales Report visibility

## Contract

`staffs.show_in_sales_report` is a global Staff presentation preference and defaults to `true`. It is independent of operational `is_active`: inactive Staff can remain on the normal report roster, and active Staff can be removed from zero-activity rosters.

The canonical Staff-summary rule for the visual, selected-period Sales Report, and Daily Sales detail is:

> include configured-visible Staff relevant to the selected Branch scope, union Staff IDs with existing summary activity in the selected period.

Activity is the already-calculated product-sales or booking service activity used by the Staff cards. No amount, commission, package, refund, booking-count, or payment calculation changed. Activity is aggregated first; therefore a hidden or currently reassigned former Staff member is still included when persisted transactions in the selected Branch and period attribute activity to them. Activity outside the selected period does not affect its roster.

For a Specific Branch, configured zero rows require a current `staff_store_location` assignment to that Branch. Activity can force a row without that current assignment because the Order's persisted `store_location_id`, not today's Staff assignment, scopes historical activity. For ALL, configured zero rows require assignment to at least one authenticated accessible Branch, and activity is restricted by the existing authenticated `ReportBranchScope`. The flag remains global; branch-specific visibility is a possible future enhancement.

The Staff management list is unchanged and does not filter on this preference. Create and Edit expose **Show in Sales Report**, default checked. Existing create/update authorization protects the field. Staff CSV export includes the field for round trips; import accepts it optionally and defaults missing values to `true`, preserving old templates. Raw Sales Report exports and transaction/detail rows are intentionally unchanged because this is only a summary-roster preference.

## Deployment

Run only:

```bash
php artisan migrate
```

The non-null database default applies `true` to existing rows, so no backfill or reconciliation command is required.

## Manual QA

1. Set **NO 15 Artisan** to hidden, confirm it has RM0 today, and open Daily Sales: its Staff summary row is absent while transaction/detail tables remain intact.
2. With the same hidden Staff attributed RM500 on 2026-06-20, open that Daily report: its Staff row appears with the unchanged RM500.
3. Set a zero-activity Staff to visible: today's Daily Sales continues to show its zero row, regardless of Active/Inactive status.
4. Assign a visible zero-activity Staff only to PNG: PNG shows the row; `asdsadas` does not. Then verify a historical `asdsadas` transaction still forces the row there.
5. Repeat visibility checks on `/reports/sales/visual`, `/reports/sales`, and `/reports/sales/daily`, including a selected range where activity falls just outside the range.
6. In ALL Branches as a branch-restricted user, verify inaccessible Branch transactions do not contribute.
7. Export and re-import Staff CSV; verify false round-trips and an older CSV without the column creates/updates with the safe true default.
