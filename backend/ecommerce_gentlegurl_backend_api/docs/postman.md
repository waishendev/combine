# Ecommerce Backend API - Postman/调试文档

## 1. Overview
- 这是 ecommerce-backend_api 的 API 文档，便于在 Postman / Thunder Client / Hoppscotch 直接调试。
- 技术栈：Laravel 11 / PostgreSQL / Sanctum。
- 管理端接口使用 `auth:web,sanctum` + `permission:*` 中间件进行鉴权与 RBAC 控制。
- 前台商城接口以 `/public/shop/...` 开头，无需登录即可访问。

## 2. 环境 & Base URL
- 本地默认：`http://localhost:8000/api`
- 说明：下文的所有路径均默认拼在 `/api` 后。例如：
  - `POST /login` 实际请求为 `POST http://localhost:8000/api/login`
  - `GET /public/shop/products` 实际为 `GET http://localhost:8000/api/public/shop/products`

## 3. 鉴权说明（Session + Token）
- Session 登录：`POST /login`
  - Body（JSON）：`{ "email": "infrax1@example.com", "password": "password" }`
  - 成功后通过 Cookie 维持会话，需在后续请求中携带返回的 Cookie（Postman 先调用一次 `/login`，自动保存 Set-Cookie）。
  - 仅支持 `email` + `password`，未实现 username 登录。
- Token 登录：`POST /login/token`
  - Body 示例：
    ```json
    { "email": "infrax1@example.com", "password": "password" }
    ```
  - Response 示例：
    ```json
    { "data": { "token": "<sanctum-token>", "user": { "id": 1, "name": "Admin", "email": "infrax1@example.com", "username": "admin" } } }
    ```
  - 后续请求在 Header 携带 `Authorization: Bearer <sanctum-token>`。
  - 使用 Sanctum token guard（`auth:web,sanctum` 中的 sanctum 部分）。
- `/profile`：获取当前登录用户及权限，验证 Cookie/Token 是否有效，同时可确认 RBAC 权限集合。

## 4. Core Auth & RBAC API
> 所有下列接口均在 `auth:web,sanctum` 保护下，需先登录并持有对应 `permission:*` 权限。

### Auth
- `POST /login`（Session 登录，不需权限）
- `POST /logout`（需已登录）
- `POST /login/token`（Token 登录，不需权限）
- `GET /profile`：返回当前用户、角色、permissions 列表。

### Admins
- `GET /admins` — 列表；权限：`permission:users.view`；Query：`search`, `per_page`。
- `POST /admins` — 创建；权限：`permission:users.create`；Body：`name`, `email`, `username`, `password`, `is_active?`, `role_ids: []`。
- `GET /admins/{id}` — 详情；权限：`permission:users.view`。
- `PUT /admins/{id}` — 更新；权限：`permission:users.update`；Body 支持同上（`password` 可为空时忽略）。
- `DELETE /admins/{id}` — 删除；权限：`permission:users.delete`。

### Roles
- `GET /roles` — 权限：`permission:roles.view`；Query：`per_page`。
- `POST /roles` — 权限：`permission:roles.create`；Body：`name`, `description?`, `is_active?`, `permission_ids: []`。
- `GET /roles/{id}` — 权限：`permission:roles.view`。
- `PUT /roles/{id}` — 权限：`permission:roles.update`；Body 同创建（字段均可选）。
- `DELETE /roles/{id}` — 权限：`permission:roles.delete`。

### Permissions
- `GET /permissions` — 权限：`permission:permissions.view`；Query：`per_page`, `grouped`（`true` 返回按分组的数据）。
- `POST /permissions` — 权限：`permission:permissions.create`；Body：`group_id?`, `name`, `slug`, `description?`。
- `GET /permissions/{id}` — 权限：`permission:permissions.view`。
- `PUT /permissions/{id}` — 权限：`permission:permissions.update`；Body 同上（均可选）。
- `DELETE /permissions/{id}` — 权限：`permission:permissions.delete`。

### Permission Groups
- `GET /permission-groups` — 权限：`permission:permission-groups.view`。
- `POST /permission-groups` — 权限：`permission:permission-groups.create`；Body：`name`, `sort_order?`。
- `GET /permission-groups/{id}` — 权限：`permission:permission-groups.view`；Query：`with_permissions=true` 可携带权限列表。
- `PUT /permission-groups/{id}` — 权限：`permission:permission-groups.update`；Body：`name?`, `sort_order?`。
- `DELETE /permission-groups/{id}` — 权限：`permission:permission-groups.delete`。

### Customers（含积分摘要）
- `GET /customers` — 权限：`permission:customers.view`；Query：`search`, `per_page`。返回每个客户的 `available_points`, `spent_in_window`, `next_tier`, `amount_to_next_tier` 摘要字段。
- `POST /customers` — 权限：`permission:customers.create`；Body：`name`, `email`, `phone?`, `password?`, `tier?`, `is_active?`。
- `GET /customers/{id}` — 权限：`permission:customers.view`。返回 `loyalty_summary` 对象，包含 `available_points`, `total_earned`, `total_redeemed`, `window`（`months_window`, `start_date`, `end_date`, `spent_in_window`）以及 `next_tier`（`tier`, `threshold_amount`, `amount_to_reach`）。
- `PUT /customers/{id}` — 权限：`permission:customers.update`；Body 同创建，字段可选。
- `DELETE /customers/{id}` — 权限：`permission:customers.delete`。

## 5. Ecommerce Admin API
所有接口前缀 `/ecommerce`，均需登录并持有对应 `ecommerce.*` 权限。

### 5.1 分类管理 (Categories)
- `GET /ecommerce/categories` — 权限：`permission:ecommerce.categories.view`；Query：`name`, `is_active`, `per_page`；返回每条记录的 `menu_ids` + `menus`（当前挂载的 Shop Menu 列表）。
- `POST /ecommerce/categories` — 权限：`permission:ecommerce.categories.create`；Body：`parent_id?`, `menu_ids? (int[])`, `name`, `slug`, `description?`, `meta_title?`, `meta_description?`, `meta_keywords?`, `meta_og_image?`, `is_active?`, `sort_order?`。
- `GET /ecommerce/categories/{id}` — 权限：`permission:ecommerce.categories.view`；返回包含 `children` 及 `menus` 信息。
- `PUT /ecommerce/categories/{id}` — 权限：`permission:ecommerce.categories.update`；Body 同创建，字段均可选且 `slug` 唯一，更新后 `menu_ids` 会同步关联。
- `DELETE /ecommerce/categories/{id}` — 权限：`permission:ecommerce.categories.delete`。

### 5.2 商品管理 (Products)
- `GET /ecommerce/products` — 权限：`permission:ecommerce.products.view`；Query：`name`, `sku`, `category_id`, `is_active`, `per_page`。
- `POST /ecommerce/products` — 权限：`permission:ecommerce.products.create`；Body 关键字段：
  ```json
  {
    "name": "iPhone 15",
    "slug": "iphone-15",
    "sku": "IP15-BLACK",
    "type": "single",
    "description": "...",
    "price": 999.99,
    "cost_price": 800,
    "stock": 50,
    "low_stock_threshold": 5,
    "is_active": true,
    "is_featured": false,
    "meta_title": "iPhone 15",
    "meta_description": "...",
    "meta_keywords": "iphone,phone",
    "meta_og_image": "/uploads/iphone.jpg",
    "category_ids": [1, 2]
  }
  ```
- `GET /ecommerce/products/{id}` — 权限：`permission:ecommerce.products.view`；返回包含 `categories`、`images`、`packageChildren`。
- `PUT /ecommerce/products/{id}` — 权限：`permission:ecommerce.products.update`；Body 同创建，字段可选，`category_ids` 会重置关联。
- `DELETE /ecommerce/products/{id}` — 权限：`permission:ecommerce.products.delete`。

### 5.3 SHOP 菜单管理 (ShopMenuItem)
- `GET /ecommerce/shop-menu-items` — 权限：`permission:ecommerce.shop-menu.view`；Query：`is_active`。返回包含 `categories` 关联（该菜单下的分类列表，可空）。
- `POST /ecommerce/shop-menu-items` — 权限：`permission:ecommerce.shop-menu.create`；Body：`name`, `slug`, `sort_order?`, `is_active?`。
- `PUT /ecommerce/shop-menu-items/{id}` — 权限：`permission:ecommerce.shop-menu.update`；Body 同上，可选。
- `DELETE /ecommerce/shop-menu-items/{id}` — 权限：`permission:ecommerce.shop-menu.delete`。

### 5.4 门店管理 (StoreLocation)
- `GET /ecommerce/store-locations` — 权限：`permission:ecommerce.stores.view`；Query：`is_active`。
- `POST /ecommerce/store-locations` — 权限：`permission:ecommerce.stores.create`；Body：`name`, `code`, `address_line1`, `address_line2?`, `city`, `state`, `postcode`, `country?`, `phone?`, `is_active?`。
- `GET /ecommerce/store-locations/{id}` — 权限：`permission:ecommerce.stores.view`。
- `PUT /ecommerce/store-locations/{id}` — 权限：`permission:ecommerce.stores.update`；Body 同创建，字段可选，`code` 唯一。
- `DELETE /ecommerce/store-locations/{id}` — 权限：`permission:ecommerce.stores.delete`。

### 5.5 全局 SEO (SeoGlobal)
- `GET /ecommerce/seo-global` — 权限：`permission:ecommerce.seo.view`；返回默认 SEO 配置。
- `PUT /ecommerce/seo-global` — 权限：`permission:ecommerce.seo.update`；Body：`default_title?`, `default_description?`, `default_keywords?`, `default_og_image?`。

### 5.6 积分 & 等级规则
- `GET /ecommerce/loyalty-settings` — 权限：`permission:ecommerce.loyalty.settings.view`。返回 `current`（当前生效规则）及 `history`（全部记录）。
- `POST /ecommerce/loyalty-settings` — 权限：`permission:ecommerce.loyalty.settings.create`；Body：`base_multiplier`, `expiry_months`, `evaluation_cycle_months`, `rules_effective_at?`。
- `GET /ecommerce/loyalty-settings/{id}` — 权限：`permission:ecommerce.loyalty.settings.view`。
- `PUT /ecommerce/loyalty-settings/{id}` — 权限：`permission:ecommerce.loyalty.settings.update`；Body 同创建。
- `DELETE /ecommerce/loyalty-settings/{id}` — 权限：`permission:ecommerce.loyalty.settings.delete`。
- `GET /ecommerce/membership-tiers` — 权限：`permission:ecommerce.loyalty.tiers`；返回各 tier 规则（含 `product_discount_percent` 字段，可用于未来商品折扣）。
- `PUT /ecommerce/membership-tiers/{tier}` — 权限同上；Body：`min_spent_last_x_months`, `months_window`, `multiplier`, `product_discount_percent?`, `is_active?`。

### 5.7 Loyalty 概况 & 兑换 (Admin)
- `GET /ecommerce/customers/{id}/loyalty-summary` — 权限：`permission:ecommerce.customers.view`。响应示例：
  ```json
  {
    "customer": {"id": 1, "name": "Customer A", "email": "customer@example.com", "tier": "gold"},
    "summary": {
      "current_tier": {"code": "gold", "multiplier": 2, "product_discount_percent": 5},
      "points": {
        "available": 800,
        "total_earned": 1200,
        "total_redeemed": 300,
        "total_expired": 100,
        "expiring_soon": [{"expires_at": "2026-01-31", "points": 120}]
      }
    }
  }
  ```
- `GET /ecommerce/customers/{id}/loyalty-history` — 权限：`permission:ecommerce.customers.view`；Query：`type?`, `per_page?`。返回分页的积分流水（`type`, `points_change`, `source_type`, `source_id`, `meta`）。
- `GET /ecommerce/loyalty/rewards` — 权限：`permission:ecommerce.loyalty.rewards.view`；Query：`is_active?`, `type?`。返回 reward 列表。
- `POST /ecommerce/loyalty/rewards` — 权限：`permission:ecommerce.loyalty.rewards.create`；Body 示例：
  ```json
  {"title": "RM10 Discount Voucher", "type": "voucher", "points_required": 500, "voucher_id": 1, "description": "", "is_active": true}
  ```
- `PUT /ecommerce/loyalty/rewards/{id}` — 权限：`permission:ecommerce.loyalty.rewards.update`；Body 同创建，可改 `sort_order`/`is_active`。
- `DELETE /ecommerce/loyalty/rewards/{id}` — 权限：`permission:ecommerce.loyalty.rewards.delete`。
- `GET /ecommerce/loyalty/redemptions` — 权限：`permission:ecommerce.loyalty.redemptions.view`；Query：`status?`, `customer_email?`, `customer_phone?`, `reward_id?`。
- `GET /ecommerce/loyalty/redemptions/{id}` — 权限同上；返回兑换详情（含 `reward_title_snapshot`, `points_spent`, `meta`）。
- `PUT /ecommerce/loyalty/redemptions/{id}/status` — 权限：`permission:ecommerce.loyalty.redemptions.update`；Body：`status`（`completed`/`cancelled`），`admin_note?`。

### 5.8 通知模板 (NotificationTemplate)
- `GET /ecommerce/notification-templates` — 权限：`permission:ecommerce.notifications.templates.view`。
- `POST /ecommerce/notification-templates` — 权限：`permission:ecommerce.notifications.templates.create`；Body：`key`, `channel`, `name`, `subject_template?`, `body_template`, `variables? (object)`, `is_active?`。
- `GET /ecommerce/notification-templates/{id}` — 权限：`permission:ecommerce.notifications.templates.view`。
- `PUT /ecommerce/notification-templates/{id}` — 权限：`permission:ecommerce.notifications.templates.update`；Body 字段同上均可选。
- `DELETE /ecommerce/notification-templates/{id}` — 权限：`permission:ecommerce.notifications.templates.delete`。
- 返回字段示例：`key`, `channel`, `name`, `variables`, `subject_template`, `body_template`, `is_active`。

## 6. Public Shop API（给商城前台用）
无需登录，前缀 `/public/shop`。
- `GET /public/shop/menu` — 返回 active 的 shop menu items，字段：`id`, `name`, `slug`, `sort_order`, `is_active`，并带有 `categories`（按 pivot `sort_order`/`name` 排序的激活分类）。
- `GET /public/shop/menu/{slug}` — 根据菜单 slug 返回单条记录，携带其 `categories`。
- `GET /public/shop/categories` — 返回 active 分类列表，字段：`id`, `name`, `slug`, `parent_id`, `sort_order`, `menu_ids[]`；Query：`menu_id?`, `menu_slug?`。
- `GET /public/shop/products` — Query：`page`, `per_page`, `category_id?`, `keyword?`, `menu_id?`, `menu_slug?`；返回含 `data` + `meta` 分页结构。
- `GET /public/shop/products/{slug}` — 根据 slug 返回单个产品，包含基础字段、`categories`、`images`、`packageChildren`。

### Loyalty
- `GET /public/shop/loyalty/summary` — Query：`customer_id`。返回当前积分摘要（可用积分、累计、已用、即将过期）。
- `GET /public/shop/loyalty/history` — Query：`customer_id`, `type?`, `page?`。返回积分流水分页。
- `GET /public/shop/loyalty/rewards` — Query：`type?`。返回当前上架的积分礼品/券。
- `POST /public/shop/loyalty/redeem` — Body：`customer_id`, `reward_id`。可用积分足够时扣除并生成兑换记录，响应示例：
  ```json
  {
    "redemption_id": 12,
    "status": "pending",
    "points_spent": 500,
    "reward": {"id": 5, "title": "RM10 Discount Voucher", "type": "voucher"},
    "current_points_balance": 300
  }
  ```

### Cart（Guest + 登录共用）
- `GET /public/shop/cart` — Query：`session_token?`, `customer_id?`。示例响应：
  ```json
  {
    "session_token": "c3f15e5a-...",
    "customer_id": 1,
    "items": [
      {"id": 10, "product_id": 1, "product_name": "Product A", "product_slug": "product-a", "quantity": 2, "unit_price": 100, "line_total": 200}
    ],
    "totals": {"items_count": 2, "subtotal": 200}
  }
  ```
- `POST /public/shop/cart/items` — Body：`session_token?`, `customer_id?`, `product_id`, `quantity`（=0 删除该商品）。示例：
  ```json
  {"session_token": "c3f15e5a-...", "customer_id": 1, "product_id": 1, "quantity": 2}
  ```
  返回结构同 `GET /public/shop/cart`，若是全新 guest 会返回新的 `session_token`。
- `DELETE /public/shop/cart/items/{item}` — Path 参数 `item` 为 cart_item id；Query 可带 `session_token` 或 `customer_id` 用于确认所属购物车；返回删除后的购物车摘要。

### Wishlist
- `GET /public/shop/wishlist` — Query：`customer_id`。返回收藏的商品列表（含 `product_id`, `product_name`, `product_slug`, `thumbnail`, `created_at`）。
- `POST /public/shop/wishlist/toggle` — Body：`customer_id`, `product_id`；切换收藏状态，响应：
  ```json
  {"customer_id": 1, "product_id": 1, "is_favorited": true}
  ```

### Returns / Refunds（Public）
- `POST /public/shop/orders/{order}/returns` — Body 示例：
  ```json
  {
    "customer_id": 1,
    "request_type": "return",
    "reason": "wrong_item",
    "description": "I received the wrong color.",
    "item_ids": [
      { "order_item_id": 10, "quantity": 1 },
      { "order_item_id": 11, "quantity": 2 }
    ],
    "image_urls": ["https://cdn.example.com/uploads/returns/img1.jpg"]
  }
  ```
  Response 示例（关键字段）：
  ```json
  {
    "id": 5,
    "order_id": 14,
    "customer_id": 1,
    "request_type": "return",
    "status": "pending_review",
    "item_summaries": [
      {"order_item_id": 10, "product_name": "Product A", "quantity": 1}
    ]
  }
  ```
- `GET /public/shop/returns` — Query：`customer_id`（必填）, `status?`, `order_id?`。返回当前顾客的申请列表（含状态、件数、数量汇总）。
- `GET /public/shop/returns/{id}` — Query：`customer_id`。返回单笔申请详情（items、当前状态、快递信息、时间线）。
- `POST /public/shop/returns/{id}/tracking` — 仅在 `approved_waiting_return` 状态可用。Body 示例：
  ```json
  {
    "customer_id": 1,
    "courier_name": "J&T",
    "tracking_no": "JT123456789MY",
    "shipped_at": "2025-12-01T10:00:00",
    "image_urls": ["https://cdn.example.com/uploads/returns/shipping_label.jpg"]
  }
  ```
  Response：更新后的退货申请（状态会进入 `in_transit`，包含快递信息）。

## 7. 常见错误状态码说明
- `200 / 201`：成功。
- `401`：未登录或 Token 无效（访问受保护路由未带 Cookie/Token）。
- `403`：权限不足（缺少对应 `permission:*`）。
- `422`：验证失败（示例：创建产品缺少必填 `name/slug/sku/price` 时返回字段错误）。
- `500`：服务器错误（请查看服务端日志）。

## 8. TODO / 尚未实现的接口
- 订单管理 Admin API（未提供路由）。
- 会员前台下单/结账接口（未提供路由）。
- 积分发放 & 过期的 Cron 文档。
- 其他客户/会员管理前台接口（当前仅有后台 Customer CRUD）。

### 5.x Customers Admin（新）
- `GET /ecommerce/customers` — 权限：`permission:ecommerce.customers.view`；Query：`name`, `email`, `phone`, `tier`, `is_active`, `created_from`, `created_to`, `page`, `per_page`。返回积分摘要、最近消费、下一等级等信息。
- `POST /ecommerce/customers` — 权限：`permission:ecommerce.customers.create`；Body：`name`, `email`, `phone?`, `tier?`, `is_active?`。
- `GET /ecommerce/customers/{id}` — 权限：`permission:ecommerce.customers.view`。返回 `loyalty_summary`（可用/累计/已用积分、周期消费、下一等级）。
- `PUT /ecommerce/customers/{id}` — 权限：`permission:ecommerce.customers.update`；可更新 `name`, `phone`, `tier`, `is_active`。
- `DELETE /ecommerce/customers/{id}` — 权限：`permission:ecommerce.customers.delete`。

### 5.x Orders Admin（新）
- `GET /ecommerce/orders` — 权限：`permission:ecommerce.orders.view`；Query：`status`, `payment_status`, `customer_id`, `order_no`, `reference`, `date_from`, `date_to`, `store_location_id`, `page`, `per_page`。返回基础金额与顾客摘要。
- `GET /ecommerce/orders/{id}` — 权限：`permission:ecommerce.orders.view`；包含 items、vouchers、payment_info、uploads。
- `PUT /ecommerce/orders/{id}/status` — 权限：`permission:ecommerce.orders.update`；Body：`status`, `shipping_courier?`, `shipping_tracking_no?`, `shipped_at?`。
- `PUT /ecommerce/orders/{id}/confirm-payment` — 权限：`permission:ecommerce.orders.confirm-payment`；Body：`paid_at?`, `note?`。确认付款后扣库存并发放积分。

### 5.x Cart Merge（登录后合并购物车）
- `POST /ecommerce/cart/merge` — 权限：`permission:ecommerce.carts.merge`；Body：
  ```json
  {"customer_id": 1, "session_token": "c3f15e5a-..."}
  ```
  将 guest cart 与该顾客的 open cart 合并，同品项数量累加，guest cart 标记为 `converted`。

### 5.x Voucher Admin（新）
- `GET /ecommerce/vouchers` — 权限：`permission:ecommerce.vouchers.view`；Query：`code`, `type`, `is_active`, `per_page`。
- `POST /ecommerce/vouchers` — 权限：`permission:ecommerce.vouchers.create`；Body：`code`, `type`(`fixed`|`percent`), `amount`, `min_order_amount?`, `max_uses?`, `max_uses_per_customer?`, `start_at?`, `end_at?`, `is_active?`。
- `GET /ecommerce/vouchers/{id}` — 权限：`permission:ecommerce.vouchers.view`。
- `PUT /ecommerce/vouchers/{id}` — 权限：`permission:ecommerce.vouchers.update`；字段同创建可选。
- `DELETE /ecommerce/vouchers/{id}` — 权限：`permission:ecommerce.vouchers.delete`。

### 5.x Returns Admin（新）
- `GET /ecommerce/returns` — 权限：`permission:ecommerce.returns.view`；Query：`status?`, `order_no?`, `customer_name?`, `customer_email?`, `date_from?`, `date_to?`, `per_page?`。返回每笔退货申请的订单/顾客摘要与件数、数量汇总。
- `GET /ecommerce/returns/{id}` — 权限：`permission:ecommerce.returns.view`。响应包含 return_request 基本字段、订单与顾客信息、items（含 `product_name_snapshot`, `sku_snapshot`, `requested_quantity`）、时间线。
- `PUT /ecommerce/returns/{id}/status` — 权限：`permission:ecommerce.returns.update`；Body 示例：
  ```json
  { "action": "approve", "admin_note": "OK to return." }
  ```
  `action` 支持 `approve` / `reject` / `mark_received` / `complete`，对应更新状态与时间戳。

### 5.x Ecommerce / Reports / Sales
- `GET /ecommerce/reports/sales/overview` — 权限：`permission:ecommerce.reports.sales.view`。销售概况（订单数、件数、营业额、按状态）。Query：`date_from?`, `date_to?`（默认今天）。
- `GET /ecommerce/reports/sales/daily` — 权限：`permission:ecommerce.reports.sales.view`。按天或按月汇总销售。Query：`date_from?`, `date_to?`（默认最近 30 天），`group_by=day|month`。
- `GET /ecommerce/reports/sales/by-category` — 权限：`permission:ecommerce.reports.sales.view`。按分类汇总销售。Query：`date_from?`, `date_to?`（默认最近 30 天），`per_page?`（默认 15），`page?`（默认 1）。
- `GET /ecommerce/reports/sales/top-products` — 权限：`permission:ecommerce.reports.sales.view`。热销产品榜。Query：`date_from?`, `date_to?`（默认最近 30 天），`per_page?`（默认 15），`page?`（默认 1）。
- `GET /ecommerce/reports/sales/top-customers` — 权限：`permission:ecommerce.reports.sales.view`。顾客消费榜。Query：`date_from?`, `date_to?`（默认最近 30 天），`per_page?`（默认 15），`page?`（默认 1）。
  
  Response 示例详见任务需求：均返回 `date_range`（from/to），以及对应报表的 `rows`/`totals` 字段。

## 6. Public Checkout / Orders API
前台商城无需登录，可选配 rate limit。

- `POST /public/shop/checkout/preview` — Body：`items:[{product_id,quantity}]`, `voucher_code?`, `shipping_method`(`pickup|shipping`), `store_location_id?`, `shipping_postcode?`。返回价格明细、优惠、运费。
- `POST /public/shop/orders` — 新版 Body 要求 `customer_id`（必填）+ 可选 `session_token`，示例：
  ```json
  {
    "customer_id": 1,
    "session_token": "c3f15e5a-...",
    "items": [
      {"product_id": 1, "quantity": 2},
      {"product_id": 5, "quantity": 1}
    ],
    "voucher_code": "WELCOME10",
    "shipping_method": "pickup",
    "store_location_id": 1,
    "shipping_name": "John Doe",
    "shipping_phone": "123456789",
    "shipping_address_line1": "...",
    "shipping_city": "Penang",
    "shipping_state": "Penang",
    "shipping_postcode": "11000"
  }
  ```
  响应示例：`{ "order_id": 123, "order_no": "ORD20251130001", "grand_total": 190, "payment_status": "unpaid", "status": "pending" }`。若附带 `session_token`，下单后对应 open cart 会被标记为 `converted`。
- `POST /public/shop/orders/{id}/upload-slip` — Body：`file_url`（已上传的付款凭证 URL）；记录到订单附件，供后台确认付款。
