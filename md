# A. Service ↔ Service Category（预约服务 ↔ 服务分类）

把旧的单栏位 `booking_services.category_id` 合并进 pivot 表 `booking_service_category_service`，并去掉 pivot 重复行。

**不是** Service Category ↔ Product Category 的 link。

```bash
php artisan booking:migrate-service-categories --dry-run
php artisan booking:migrate-service-categories
```

跑完后可再跑 migration drop `category_id` 栏位。

### 怎么看结果？

| 栏位 | 意思 |
|------|------|
| Current Pivot `6, 6` → Target `6` | pivot 里同一分类写了两次，**去重**，不是新 link |
| Added IDs `-` | 没有从 `category_id` **新增**分类，本来就有 |
| Added IDs `5` | `category_id` 里有 5，pivot 里没有，**新加进 pivot** |
| Already correct (22) | 没分类，或 pivot 已正确、无重复 |

你 production 的 52 条 Synced：**几乎都是去重**（`6,6→6`、`4,4→4`），分类关系没变，只是 pivot 表变干净。

---

# B. Service Category ↔ Product Category（服务分类 ↔ 商品分类）

按名字把 `booking_service_categories` 和 `booking_product_categories` 建立 FK link。

```bash
php artisan booking:link-category-product-categories --dry-run
php artisan booking:link-category-product-categories

# 没有对应 Product Category 时才用
php artisan booking:link-category-product-categories --create-missing

# 可选：已 link 的，把 name/cn_name/sort_order/is_active 从 Service Category 同步到 Product Category
php artisan booking:link-category-product-categories --sync-fields
```
