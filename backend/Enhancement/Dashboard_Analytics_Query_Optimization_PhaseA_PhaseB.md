# Dashboard Analytics — Query Optimization (Phase A + Phase B)

**Date:** 2026-08-01  
**Frontend:** `frontend/ecommerce_gentlegurl_crm` → `/dashboard`（**未改**）  
**APIs:**

| Method | Path | Controller |
|--------|------|------------|
| GET | `/api/admin/dashboard/analytics/ecommerce` | `DashboardAnalyticsController::ecommerce` |
| GET | `/api/admin/dashboard/analytics/packages/summary` | `PackageDashboardAnalyticsController::summary` |
| GET | `/api/admin/dashboard/analytics/packages/filter-options` | `PackageDashboardAnalyticsController::filterOptions` |
| GET | `/api/admin/dashboard/analytics/packages/customer-packages` | `PackageDashboardAnalyticsController::customerPackages` |
| GET | `/api/admin/dashboard/analytics/packages/customer-packages/{id}` | `PackageDashboardAnalyticsController::customerPackageDetail` |

**Goal:** 只加快 production dashboard 查询，**不改变**既有 FLOW、业务规则、API 结构、筛选 / 排序 / 分页、计算结果。

---

## Verdict（结论）

| Check | Result |
|--------|--------|
| Frontend CRM dashboard page / components | **未改** |
| API routes (`routes/api.php`) | **未改** |
| Response JSON keys / pagination shape | **未改** |
| Filters / sort / `per_page` 行为 | **未改** |
| 业务计算公式（库存成本、sales、refunds、package liability 等） | **未改** |
| Payload byte-stable SHA（vs Phase B 改动前 baseline） | **全部 MATCH** |
| `reserved_qty` 新旧算法等价 | **MATCH** `[[1,1],[2,0],[3,0]]` |
| HTTP status | 全部 **200** |

**最终安全复核（2026-08-01）：** 用改动后的 controller 重新打 API，与 Phase B **改代码前**落盘的 payload 文件比对 SHA —— 4 个主 endpoint **全部一致**。

| Endpoint | Payload SHA-256（改前 = 改后） |
|----------|--------------------------------|
| ecommerce | `fa45f6d4055af421b2b424d88d241561755a5adbdfdb789da933abfd1c01ac02` |
| packages/summary | `6d610455f2df391dbfbd6b5b9e2c645e6c664b95005e8ad6c02f786903f83ca4` |
| packages/filter-options | `099f7c030fda41b1fb429be3e12a63c527bd829be4124b22c23c43735dd63527` |
| packages/customer-packages | `918e4ead5438ea767da3fa6cdba223e7656b45ab7f6e2b70aa8b7f8d294d3fa4` |
| packages/customer-packages/{id} | `d7ee65be9e648833444f6a9e2171ad278d5c9f111c25a29da17065a250b4feca` |

Frontend 仍依赖的 contract 字段齐全（`products` / `inventory` / `sales` / `items.*`；package `templates` / `customers` / `balances` / `sales` / `redemptions` / `status`；liability 分页 + row 字段含 `reserved_qty`）。

---

## What was NOT changed（刻意保留的 production FLOW）

1. **页面流程** — CRM 仍并行拉 ecommerce + package summary + filter-options + customer-packages；两端都 ready 才去掉 loading。
2. **API 合同** — 同一套 JSON keys、分页字段、金额 round 规则、status 文案逻辑。
3. **业务规则** — active / inactive 过滤、`is_package = false` 产品销售额、payment_status / order status 集合、package active+remaining、expiring_days 等全部原样。
4. **Frontend** — `dashboard/page.tsx` 与 analytics components **零改动**。
5. **Routes / permissions middleware** — 未动。
6. **无 Redis / 跨请求缓存** — Schema memo 仅 request 内实例缓存；索引是 DB 层。

---

## Phase A — Indexes only（索引，零业务代码）

### 问题
EXPLAIN 显示销售 / 退款 / inventory UNION / package liability 等路径对以下列 **Seq Scan**，且若干 FK 列 **缺少索引**：

- `order_items.order_id`（FK 无索引）
- `orders(payment_status, status)`
- `product_variants.product_id`
- `customer_service_package_usages.customer_service_package_id`
- `customer_service_packages.service_package_id`
- 等

### 改动文件

| File | Change |
|------|--------|
| `database/migrations/2026_08_01_000100_add_dashboard_analytics_indexes.php` | Postgres `CREATE INDEX CONCURRENTLY`；`$withinTransaction = false`（PG 不允许 CONCURRENTLY 包在事务里） |

### 创建的 8 个索引

| Index | Columns | 说明 |
|-------|---------|------|
| `order_items_order_id_is_package_index` | `(order_id, is_package)` | **合并**了原先提议的 `order_id` + `(is_package, order_id)`，避免冗余；leftmost 覆盖 FK 查找 |
| `orders_payment_status_status_index` | `(payment_status, status)` | sales / refunds 过滤 |
| `product_variants_product_id_is_active_index` | `(product_id, is_active)` | inventory UNION / anti-join |
| `products_is_active_name_index` | `(is_active, name)` | active 过滤 + `ORDER BY name` |
| `csp_usages_csp_id_status_index` | `(customer_service_package_id, status)` | reserved 查找（旧 `(status, booking_id)` 形状不对） |
| `csp_status_expires_at_index` | `(status, expires_at)` | summary status / active 过滤 |
| `csp_service_package_id_index` | `(service_package_id)` | FK + filter-options group |
| `csp_balances_remaining_qty_partial` | `(customer_service_package_id) WHERE remaining_qty > 0` | active-with-remaining subquery |

### EXPLAIN 验证

- **本地数据量很小**（约 17 products / 55 orders / 3 packages）时，多数 natural plan 仍选 Seq Scan（成本更低，正常）。
- `enable_seqscan = off` 时，**每个新索引均可被 planner 选中**。
- Natural plan **已直接使用** `csp_balances_remaining_qty_partial`（Index Only Scan）。

### Phase A 本地 wall-clock

索引本身在极小数据集上几乎不改变 wall time（噪声级 ±几 ms）。价值在 **production 数据变大后的 plan 质量**；应用代码路径完全不变。

---

## Phase B — Request-local query assembly（仍保持同一 payload）

### 问题

1. 每次请求大量重复 `Schema::hasTable` / `hasColumn` → 打爆 `pg_catalog`（ecommerce 一次可达 **35** 次 schema 查询）。
2. Ecommerce 的 inventory `UNION ALL` 子查询被组装多次（summary + detail）。
3. Liability 列表对 `reserved_qty` 使用 **correlated SubPlan**（每个 package 一组循环）。
4. Summary / list 聚合路径 `LEFT JOIN booking_services` 但 **从不 select** `bs.*`。

### 改动文件

| File | Change |
|------|--------|
| `app/Http/Controllers/Concerns/MemoizesSchemaLookups.php` | **新建** request-scoped schema memo |
| `DashboardAnalyticsController.php` | 使用 memo；`inventoryRowsQuery()` 只 build 一次再 `clone` |
| `PackageDashboardAnalyticsController.php` | memo；`reserved_qty` → `leftJoinSub` + `MAX`；聚合/列表路径去掉无用 `booking_services` |
| `tests/Unit/DashboardReservedQtyAggregateEquivalenceTest.php` | reserved 新旧算法等价测试（CI 无表时 skip） |

### 每个优化如何保证 FLOW 不变

| 优化 | 为何安全 |
|------|----------|
| Schema memo | 同一请求内同一 `(table, column)` 答案不变；只少打 catalog，SQL 表达式仍相同 |
| Inventory clone | 同一 Builder 编译出相同 UNION SQL；summary / detail 语义不变 |
| `reserved_qty` join + `MAX` | 与 correlated `SUM(used_qty) WHERE status='reserved'` 数值等价；用 `MAX` 避免 balances 行放大后误 `SUM` |
| 去掉无用 `booking_services` | 仅在 **不 select 服务名** 的 summary / list；detail / redemptions 仍 join `bs` |

### Phase B 冷请求 benchmark（每次 new controller，贴近真实 HTTP）

Local Postgres · 2026-08-01 · median of 5 runs：

| Endpoint | Before wall | After wall | Δ | Schema Q before → after |
|----------|------------:|-----------:|---|:------------------------|
| ecommerce | **132.28 ms** | **62.99 ms** | **−52%** | 35 → **14** |
| packages/summary | 49.78 ms | 40.95 ms | −18% | 15 → **11** |
| packages/filter-options | 11.81 ms | 16.36 ms | ~噪声 | 6 → 6 |
| packages/customer-packages | 45.03 ms | 34.24 ms | −24% | 16 → **11** |

说明：

- **Business SQL 条数不变**（ecommerce 仍 5 条业务查询等）；变快主要来自 **去掉重复 schema introspection** + 更干净的 join。
- `filter-options` 几乎全是「各查一次不同 table」，memo 收益有限；wall 波动属噪声。
- 本地行数很少；**production 行数上去后**，Phase A 索引 + Phase B 去掉 SubPlan 的收益会更明显。

同一 controller 实例内连打（warm memo）时 schema_q 可到 **0**，ecommerce wall 可到 ~18 ms —— 说明 schema 税曾是主瓶颈；真实 HTTP 按 **cold 表** 评估更公允。

---

## 前端 contract 抽样（未改 frontend，仅确认后端仍满足）

Ecommerce top-level keys: `products`, `inventory`, `sales`, `items`  
Package summary: `templates`, `customers`, `balances`, `sales`, `redemptions`, `status`  
Liability row 仍含: `id`, `customer`, `package`, `purchased_from`, `purchase_reference`, `purchase_date`, `started_at`, `expires_at`, `status`, `purchase_amount`, `total_qty`, `used_qty`, `reserved_qty`, `remaining_qty`, `remaining_service_value`, `missing_values`

---

## Deploy notes

1. **先跑 migration（Phase A）**  
   `php artisan migrate --path=database/migrations/2026_08_01_000100_add_dashboard_analytics_indexes.php`  
   - 使用 `CREATE INDEX CONCURRENTLY`，`$withinTransaction = false`  
   - Production 上建议在低峰执行；CONCURRENTLY 仍会消耗 IO，但避免长时间写锁表。

2. **再部署 Phase B 代码**（controllers + trait）  
   - 无 DB 结构依赖（indexes 可选但推荐先上）  
   - 回滚：还原 controllers / 删 trait 即可；索引可留可 `DROP INDEX CONCURRENTLY`。

3. **建议在 prod replica 再跑一次 `EXPLAIN (ANALYZE, BUFFERS)`**，确认大表上 indexes 被 natural plan 选中。

---

## 未做（刻意留给以后）

- 合并多个 dashboard API 为单一 endpoint（会改前端 flow）
- Redis / 跨请求缓存 summary
- `pg_trgm` 处理 `LIKE %search%`
- 单独简化 `paginate` COUNT 路径（Phase C 候选）
- 强制跑 analytics snapshot migration（本地缺 snapshot 列时仍走 `spi.redemption_value` —— 与改前一致）

---

## 文件清单（本优化相关）

```
backend/ecommerce_gentlegurl_backend_api/
  database/migrations/2026_08_01_000100_add_dashboard_analytics_indexes.php   # Phase A
  app/Http/Controllers/Concerns/MemoizesSchemaLookups.php                      # Phase B
  app/Http/Controllers/Ecommerce/DashboardAnalyticsController.php              # Phase B
  app/Http/Controllers/Ecommerce/PackageDashboardAnalyticsController.php       # Phase B
  tests/Unit/DashboardReservedQtyAggregateEquivalenceTest.php                  # Phase B
```

**Frontend / routes：无变更。**
