# Sales Visual Report — Query Optimization (P0)

**Date:** 2026-08-01  
**Page:** `frontend/ecommerce_gentlegurl_crm` → `/reports/sales/visual`  
**Backend APIs:**

| Frontend call | Backend |
|---------------|---------|
| `GET …/ecommerce/reports/sales/visual-daily/all` | `SalesVisualDailyReportService::allPeriod` |
| `GET …/ecommerce/reports/sales/ecommerce` | `SalesChannelReportService::ecommerce` |
| `GET …/ecommerce/reports/sales/booking` | `SalesChannelReportService::booking` |

**Goal:** 加快 production 已上线的 Daily Sales Visual 报表查询，**不改变**业务 FLOW、API、筛选、分页、排序、金额计算与前端交互。

---

## Verdict（结论）

| Check | Result |
|--------|--------|
| Production 页面 FLOW / 用户操作 | **未改**（前端 `page.tsx` 未动） |
| API routes / request params / response 字段结构 | **未改** |
| 分页 / 排序 / 筛选 / 日期语义 | **未改** |
| Refund / package redemption / gateway / staff commission 公式 | **未改**（P1 gateway 合并未做） |
| Booking 列表 `package_applied` / `applied_package_name` 规则 | **等价**（同 scope；多命中时改为明确 `ORDER BY id`） |
| Canonical JSON hash（本地 10 组代表 case） | **全部 match** |
| P1（gateway 多次 SUM 合并、summary 聚合 CTE） | **故意未做** |

**本地 benchmark 说明：** 数据量仅 **55 orders**。绝对毫秒数不代表 production；**query count 下降**才是稳定信号。Production 数据更大时，索引收益通常更明显。

---

## 什么没改（Production FLOW 保留）

以下刻意保持原样：

1. **前端** — `/reports/sales/visual` 仍是：权限检查 → `PosCashShiftGate` → `SalesVisualWorkspaceClient`；默认 `mode=all` 仍并行打 visual-daily + ecommerce + booking。
2. **API 契约** — 路由、参数、JSON 字段名与嵌套结构不变。
3. **业务规则** — 订单纳入 scope、`COALESCE(placed_at, created_at)` 账单日、退款过滤、package usage 状态（`reserved`/`consumed`）、POS cart snapshot 解析逻辑不变。
4. **金额 / 汇总** — summary、grand_totals、refund 正负号、分页 total 计算方式不变（refund 只算一次再复用，结果相同）。
5. **无跨请求缓存** — 所有 batch map / `$refundRows` 都是 method 内局部变量；无 static / Redis / Octane 长驻缓存。
6. **Gateway 按支付方式多次 SUM** — 仍按原逻辑逐个 gateway 查询（P1 待验证后再做）。

---

## 根因（为什么慢）

默认 All 模式会打 3 个后端；其中 **booking 列表**最重：

1. **N+1** — 每一行调用 `resolveLinePackageApplied` + `resolveLinePackageName`，内部再查 `order_item_staff_splits.snapshot` 与 `customer_service_package_usages`（本地约 **96/131** 条查询）。
2. **`bookingRefundReportRows` 同一请求算最多 3 次** — rows / net total / orders_count。
3. **缺索引** — Postgres 不会给 FK 自动建索引；`order_item_staff_splits` 去掉 unique 后只剩 PK。报表大量用 `COALESCE(placed_at, created_at)`，普通日期索引用不上。

---

## P0 改了什么

### 1) 索引（生产安全 concurrent）

**File:** `database/migrations/2026_08_01_000200_add_sales_visual_report_indexes.php`

- `$withinTransaction = false`
- Postgres：`CREATE INDEX CONCURRENTLY IF NOT EXISTS` / `DROP INDEX CONCURRENTLY IF EXISTS`
- 非 Postgres 的 Schema drop 不会走 pgsql 路径

| Index | 作用 |
|-------|------|
| `order_item_staff_splits_order_item_id_index` | 按 `order_item_id` 读 snapshot（FK 无自动索引） |
| `orders_bill_at_coalesce_index` | `((COALESCE(placed_at, created_at)))`，匹配报表 `whereBetween` |
| `order_items_line_type_order_id_index` | `line_type` + `order_id` 过滤 / EXISTS |
| `csp_usages_booking_service_id_status_index` | package usage `(booking_service_id, status)` |

**Deploy：** migration 可在线执行；仍会占 CPU/IO，大表建议低峰。小表 planner 可能仍选 Seq Scan；`enable_seqscan=off` 已验证四个索引都能被命中。

### 2) Booking 列表去掉 N+1（同规则 batch）

**Files:**

- `app/Services/Reports/SalesChannelReportService.php`
- `app/Services/Booking/CustomerServicePackageService.php`

| Before | After |
|--------|--------|
| 每行 `resolveLinePackageApplied` + `resolveLinePackageName` | 页内一次 `resolveLinePackageMetaForOrderItems` |
| 每行 `resolvePosCartServiceItemIdsForOrderItem` | 一次 `resolvePosCartServiceItemIdsForOrderItems` |
| Scope SQL 在 DB 里过滤 | 相同 scope 条件在 PHP `usageMatchesOrderItemPackageScope` |

**选择优先级（与原逻辑对齐）：**

- `package_applied`：存在 `reserved|consumed` 且 scope 命中 → `true`
- `applied_package_name`：命中 usage → `customerServicePackage.servicePackage.name`（**当前**套餐名，不是 usage 上的 snapshot 字段）
- 无 `booking_service_id` → `applied=false`, `name=null`
- cancelled 等状态：仍排除（只认 `reserved`/`consumed`）

**多命中确定性（安全加固，非业务 FLOW 变更）：**

- 原 `first()` **没有** `ORDER BY`，多条 usage 时结果可能不稳定。
- 现 **单条路径 + batch 路径** 都加了 `orderBy('id')`，取 **最小 id**。
- Staff split 批量读取也 `orderBy('id')`，再提取 `cart_service_item_id` 去重。

### 3) Refund rows 只算一次

`booking()` 内：

```text
$refundRows = bookingRefundReportRows(...)   // 最多一次
→ concat 到 rows
→ refundNetTotal = $refundRows->sum('net_amount')
→ orders_count 用 $refundRows->count()
```

过滤、符号、字段内容与原先三次调用结果一致，只是少打重复 SQL。

### 4) 回归测试

**File:** `tests/Unit/SalesChannelBookingPackageMetaBatchTest.php`

覆盖：无 usage、同 service 多 usage、cancelled vs consumed、套餐改名（live name）、无 POS snapshot、无/空 staff split、多 staff split、refund 风格行保持 `false/null`。Batch 与 per-line resolver **逐项 assertSame**。

**结果：** 11 tests / 31 assertions passed。

---

## 速度 / 查询量（本地）

### 单次 before → after（全历史 range，55 orders）

| Case | Queries before → after | Wall before → after | Payload hash |
|------|------------------------:|--------------------:|--------------|
| `booking_default` | **131 → 23** (−82%) | 657 → 151 ms | match |
| `booking_offline` | 114 → 26 | 351 → 105 ms | match |
| `booking_cash` | 80 → 22 | 233 → 82 ms | match |
| `visual_all_full_range` | 34 → 34 | 1461 → 302 ms* | match |
| `ecommerce_default` | 15 → 15 | 219 → 52 ms* | match |

\* visual / ecommerce 的 query count 未降（P0 未动 gateway SUM）；wall 波动主要来自索引 + 机器缓存，production 需再量。

### Median（P0 后，7 次迭代 + 1 warmup）

| Case | Median wall | Median DB time | Median queries |
|------|------------:|---------------:|---------------:|
| `booking_default` | 144.8 ms | 39.6 ms | **23** |
| `booking_offline` | 151.5 ms | 46.0 ms | 26 |
| `booking_cash` | 109.4 ms | 38.8 ms | 22 |
| `visual_all_full_range` | 160.5 ms | 95.5 ms | 34 |
| `ecommerce_default` | 50.2 ms | 25.3 ms | 15 |

**核心收益：** Booking API 从约 **131 queries → 23 queries**（本地默认分页）。这是本次对用户可感知加载最直接的优化。

---

## FLOW 等价核对清单

| 项目 | 状态 |
|------|------|
| 路由 / Controller 方法签名 | 未改 |
| Response keys（summary / totals_page / grand_totals / rows / pagination） | 未改 |
| Row 字段（含 `package_applied`、`applied_package_name`、refund 字段） | 结构未改 |
| 日期：`COALESCE(placed_at, created_at)` timestamp range | 未改表达式 |
| Package scope（booking_id / POS used_from+used_ref_id / cart ids） | 规则相同 |
| Refund 过滤（void reason、channel、method、customer） | 未改 |
| Frontend page / WorkspaceClient 请求方式 | 未改 |
| 10 case canonical JSON hash | 全部一致 |
| 跨请求缓存 | 无 |

**唯一刻意差异：** 同一 `booking_service_id` **多条**匹配 usage 时，名称选择从「DB 无序 first」改为「**最小 id**」。正常一单一条 usage 时结果与上线前一致；多条并存时现在更稳定。

---

## 文件清单

| File | Role |
|------|------|
| `database/migrations/2026_08_01_000200_add_sales_visual_report_indexes.php` | Concurrent indexes |
| `app/Services/Reports/SalesChannelReportService.php` | Batch package meta + refund reuse + `orderBy(id)` |
| `app/Services/Booking/CustomerServicePackageService.php` | Batch POS cart snapshot ids |
| `tests/Unit/SalesChannelBookingPackageMetaBatchTest.php` | Equivalence / edge regression |
| Frontend `…/reports/sales/visual/page.tsx` | **未修改** |

---

## Deploy 注意

1. 跑 migration（Postgres concurrent，可不锁表写，但仍占资源）。
2. Deploy 后用 production 量级再看 `booking` 的 query count / p95 latency。
3. **不要**在未做金额等价证明前合并 P1 gateway SUM。

---

## 未做（P1，明确推迟）

- 把 visual-daily 里「每个 gateway × online/offline」多次 `SUM` 收成一次 grouped aggregate  
- 把 ecommerce/booking 的 count / page / summary / gross / discount 多次 clone 收成单次 CTE  

需先证明 totals 与现网逐字段一致后再做。
