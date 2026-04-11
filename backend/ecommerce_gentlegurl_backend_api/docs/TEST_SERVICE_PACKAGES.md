# TEST SERVICE PACKAGES / POS SERVICES (Zero-Setup)

## 1) 先准备（不用手工造资料）

1. 启动 backend (`php artisan serve`)
2. 跑 migration：
   ```bash
   php artisan migrate
   ```
3. 跑 seed（会自动带 ServicePackageTestingSeeder）：
   ```bash
   php artisan db:seed
   ```

> `ServicePackageTestingSeeder` 会自动准备：
> - booking services（含 package eligibility / price）
> - service packages + package items
> - customer owned packages
> - balances
> - 至少一笔 usage log（方便马上验证 usage 列表）

4. 用 Postman import：
   - `docs/api/postman_collection.json`
   - `docs/postman_collection.json`

---

## 2) Staff Service Commission 测试

### Case A: 建立 staff
- API: `POST /api/staffs`
- body 要有：
  - `commission_rate`
  - `service_commission_rate`

**Expected**
- 回传 staff 里包含 `service_commission_rate`。

### Case B: 更新 staff
- API: `PUT /api/staffs/{id}`
- 修改 `service_commission_rate`。

**Expected**
- 再 `GET /api/staffs/{id}` 时值已更新。

---

## 3) Service Package CRUD 测试

### Case A: Create Package
- API: `POST /api/service-packages`
- 最少带：
  - `name`
  - `selling_price`
  - `total_sessions`
  - `items[]` (`booking_service_id`, `quantity`)

**Expected**
- 建立成功
- `service_package_items` 有对应 rows

### Case B: List / Show / Update / Delete
- `GET /api/service-packages`
- `GET /api/service-packages/{id}`
- `PUT /api/service-packages/{id}`
- `DELETE /api/service-packages/{id}`

**Expected**
- CRUD 全部正常，update 后 items 会刷新。


### Case C: CRUD API Example Payloads (for FE integration)

> `{{base_url}}` should point to `/api` root, e.g. `http://localhost:8000/api`.

#### Create (POST)
`{{base_url}}/service-packages`

```json
{
  "name": "10x Haircut Package",
  "description": "Package for 10 sessions",
  "is_active": true,
  "selling_price": "520.00",
  "total_sessions": 10,
  "items": [
    {
      "booking_service_id": 1,
      "quantity": 10
    }
  ]
}
```

#### Update (PUT)
`{{base_url}}/service-packages/{{service_package_id}}`

```json
{
  "name": "10x Haircut Package (Updated)",
  "description": "Updated package",
  "is_active": true,
  "selling_price": "520.00",
  "total_sessions": 10,
  "items": [
    {
      "booking_service_id": 1,
      "quantity": 10
    }
  ]
}
```

#### Show (GET)
`{{base_url}}/service-packages/{{service_package_id}}`

#### List (GET)
`{{base_url}}/service-packages`

**Expected response shape (Create/Update/Show/List item):**
```json
{
  "data": {
    "id": 2,
    "name": "10x Haircut Package (Updated)",
    "description": "Updated package",
    "selling_price": "520.00",
    "total_sessions": 10,
    "valid_days": 365,
    "is_active": true,
    "items": [
      {
        "id": 5,
        "service_package_id": 2,
        "booking_service_id": 1,
        "quantity": 10,
        "booking_service": {
          "id": 1,
          "name": "Haircut",
          "image_url": null
        }
      }
    ]
  },
  "message": null,
  "success": true
}
```

### Case D: Service Dropdown Source (for package item selection)

- API: `GET /api/admin/booking/services?page=1&per_page=200`
- Purpose: provide dropdown options when selecting `booking_service_id` in package form.

**Expected item fields:**
- `id`
- `name`
- `is_package_eligible`
- `price` / `service_price`
- `image_url`

---

## 4) Customer Package / Balance / Usage 测试

### Case A: POS 购买 package 给 customer
- API: `POST /api/pos/packages/purchase`
- body:
  - `customer_id`
  - `service_package_id`

**Expected**
- `customer_service_packages` 新增 1 笔
- `customer_service_package_balances` 按 package items 建立
- `started_at` 有值
- `expires_at` 按 `valid_days` 推算（若有）

### Case B: 查 customer 拥有 package
- `GET /api/customers/{id}/service-packages`
- `GET /api/customers/{id}/service-package-balances`
- `GET /api/customers/{id}/service-package-usages`

**Expected**
- 能看到 package / balance / usage 列表。

---

## 5) Redeem 测试

### Case A: 可用额度查询
- API: `GET /api/customers/{id}/service-package-available-for/{serviceId}`

**Expected**
- 有 `remaining_qty > 0` 的 balance 会被回传。

### Case B: Redeem 1 次
- API: `POST /api/service-packages/redeem`
- body:
  - `customer_id`
  - `booking_service_id`
  - `source` = `POS` / `BOOKING` / `ADMIN`
  - `used_qty` (default 1)

**Expected**
- `remaining_qty` 减少
- `used_qty` 增加
- `customer_service_package_usages` 新增 usage log
- 若 package 全部用完，status 变 `exhausted`

---

## 6) POS Service Item + Commission 测试

### Case A: 加服务到 POS cart
- API: `POST /api/pos/cart/add-service`
- body:
  - `booking_service_id`
  - `assigned_staff_id`
  - `qty`

**Expected**
- cart response 出现 `service_items`
- service item 有 `commission_rate_used`
- `commission_rate_used` 应取 staff 的 `service_commission_rate`

### Case B: POS checkout
- API: `POST /api/pos/checkout`

**Expected**
- `order_service_items` 有新增
- `commission_rate_used` 和 `commission_amount` 有写入
- commission 逻辑使用 `service_commission_rate`（不是 `commission_rate`）

---

## 7) Booking Service 字段检查

- API:
  - `GET /api/booking/services`
  - `GET /api/booking/services/{id}`

**Expected**
- 回传含 `price`
- 回传含 `is_package_eligible`
- `service_type` 正常（`standard` / `premium`）

---

## 8) UI 快速验证（重点）

1. CRM：`/booking/service-packages` 应直接看到 list（支持 create 后自动刷新）
2. CRM：`/booking/customer-service-packages` 支持下拉 customer，选完即加载
3. Booking Shop Header：应有 `Packages` 菜单，点击到 `/booking/packages`
4. Booking cart：登录 customer 可点 `Claim package session`
5. CRM POS service line：member 选定后可点 `Claim Package`

---

## 9) 常见问题

1. `403`：账号没权限，先给
   - `service-packages.*`
   - `customer-service-packages.*`
2. `422`：确认 `booking_service_id`、`service_package_id`、`customer_id` 都存在。
3. Redeem 失败：通常是 balance 不足或 package 已过期/非 active。
4. 页面显示空：先确认 `php artisan db:seed` 有执行成功。

---

## UI 跟点测试

- 请参考：`docs/TEST_UI_SERVICE_FLOW.md`（给业务同学的点点点测试步骤）。
