# UI 手动测试（跟点版）— Service Packages / Booking Shop / POS Claim

> 这份是你可以直接「照着点」的版本，重点覆盖：
> 1) CRM `/booking/service-packages` 列表要能看到资料
> 2) CRM `/booking/customer-service-packages` 不要再手打 customer id
> 3) Booking Shop Header 有 `Packages` 可点

---

## 0. 前置条件（这次不用自己慢慢造数据）

1. backend 已起：`php artisan serve`
2. CRM 前端已起（例如 `npm run dev`）
3. Booking Shop 前端已起（例如 `npm run dev`）
4. 先跑：
   ```bash
   php artisan migrate
   php artisan db:seed
   ```

> `db:seed` 已包含 `ServicePackageTestingSeeder`，会自动准备 package / balance / usage 测试数据。

---

## 1) CRM：Service Packages 页面应直接看到数据

### 路径
- CRM：`/booking/service-packages`

### Case 1.1 页面打开即有列表
1. 进入 `/booking/service-packages`
2. 看下方 `Service Package Listing`

### 预期
- 不是空白
- 至少看得到 seed 进来的 package（例如 `Seed Hair Wash 10x`、`Seed Premium Care Combo`）
- 每笔能看到 items（服务 x 数量）

---

### Case 1.2 Create 后列表立即刷新
1. 在上方 CRUD 区创建一个新 package
2. 点击 `Create Package`

### 预期
- 提示成功
- 下方列表立即出现新建 package（不需要手动刷新页面）

---

## 2) CRM：Customer Service Packages 页面可直接选 customer

### 路径
- CRM：`/booking/customer-service-packages`

### Case 2.1 不用手输 id
1. 打开页面
2. 在下拉选择一个 customer
3. 点击 `Refresh`

### 预期
- 能看到三个区块：
  - Owned Packages
  - Balances
  - Usage Logs
- 如果 seed 已跑，至少会看到一部分测试资料，不应全部是空

---

## 3) Booking Shop：Header 出现 Packages 可点

### 路径
- Booking Shop 任意页面（例如 `/booking`）

### Case 3.1 Header 导航
1. 看顶部 Header
2. 你会看到：`Home` / `Book` / `Packages`
3. 点击 `Packages`

### 预期
- 可进入 `/booking/packages`
- 页面显示 package 列表（名称、价格、sessions、valid days）

---

## 4) Booking Shop：从服务页看到可 redeem 提示 + cart claim

### Case 4.1 服务详情提示
1. 登录 customer（需有 package balance）
2. 进入某个 service 详情页 `/booking/service/{id}`

### 预期
- 若该服务有余额，看到提示：
  - `You have X package session(s) remaining for this service.`

### Case 4.2 Cart claim
1. 选时段加入 cart
2. 打开 cart drawer
3. 点击 `Claim package session`

### 预期
- 可成功 claim
- 提示成功讯息
- `Package sessions` 数字递减

---

## 5) POS：Service line claim package

### 路径
- CRM：`/pos`

### Case 5.1 Service claim
1. 指定 member
2. 切到 `SERVICES` tab，加一条 service line
3. 在 cart service line 点 `Claim Package`

### 预期
- 若 member 该服务有余额：claim 成功
- 显示 `Package balance` 数字减少

---

## 6) 失败排查

1. `403 Forbidden`
   - 请确认账号有：
     - `service-packages.*`
     - `customer-service-packages.*`
2. 页面空白/没资料
   - 大概率尚未跑 `php artisan db:seed`
3. Booking Shop 看不到 Packages 菜单
   - 确认前端进程是最新代码（重启 dev server）

---

## 7) 建议截图清单（给开发回报）

1. `/booking/service-packages` 列表有 seed 数据
2. `/booking/customer-service-packages` 下拉选择 customer 后有资料
3. Booking Shop Header 的 `Packages` 菜单
4. `/booking/packages` 列表页
5. booking cart 的 `Claim package session` 操作前后
6. CRM POS service line 的 `Claim Package` 操作前后
