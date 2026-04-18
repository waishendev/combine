# Commission Commands

## Artisan Command

```bash
php artisan booking:commission-recalculate \
  {year?} {month?} \
  [--staff_id=] \
  [--type=BOOKING] \
  [--all] \
  [--force]
```

## Parameters

- `year` (optional positional)
  - required unless `--all` is provided
- `month` (optional positional)
  - required unless `--all` is provided
  - must be `1..12`
- `--type=BOOKING|ECOMMERCE`
  - default: `BOOKING`
  - invalid/unknown values normalize to `BOOKING`
- `--staff_id=<id>`
  - target a single staff
  - if omitted, operate on all staff in scope
- `--all`
  - process all available months discovered from source data
- `--force`
  - allow recalculation even when monthly row is `FROZEN`

---

## Behavior Summary

### 1) Specific month, all staff

```bash
php artisan booking:commission-recalculate 2026 3 --type=BOOKING
```

Behavior:

- recalculates all staff rows for `2026-03`, `type=BOOKING`
- frozen rows are skipped unless `--force` is added
- writes `RECALCULATE` logs for each row

### 2) Specific month, single staff

```bash
php artisan booking:commission-recalculate 2026 3 --type=ECOMMERCE --staff_id=12
```

Behavior:

- recalculates only staff `#12` for `2026-03`, `type=ECOMMERCE`
- frozen row skipped unless `--force`
- writes one `RECALCULATE` log (if row exists/created)

### 3) All months, all staff

```bash
php artisan booking:commission-recalculate --all --type=ECOMMERCE
```

Behavior:

- service resolves all available ecommerce months from source data
- for each month, recalculates all staff found in that month
- frozen rows skipped unless `--force`
- logs each recalculated row

### 4) All months, one staff

```bash
php artisan booking:commission-recalculate --all --type=BOOKING --staff_id=12
```

Behavior:

- resolves all available booking months for staff `#12`
- recalculates that staff month by month
- frozen rows skipped unless `--force`

### 5) Force recalculation

```bash
php artisan booking:commission-recalculate 2026 3 --type=BOOKING --force
```

Behavior:

- bypass frozen guard for targeted rows
- useful for controlled corrections where admin intentionally recalculates frozen data

---

## Validation errors

- If `year/month` missing without `--all`: command fails.
- If `month` not in `1..12`: command fails.

