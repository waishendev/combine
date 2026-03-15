# UI 手动测试（跟点版）— Service Commission / Booking Service / POS Service

> 这份给你「照着点」用。每一步都写了：去哪页、点什么、预期看到什么。

---

## 0. 前置条件

1. 后端已起：`php artisan serve`
2. CRM 前端已起（例如 `npm run dev`）
3. 使用有权限账号登录 CRM（至少含 staff / booking services / pos 权限）

---

## 1) Staff：验证 Product / Service 两种 Commission Rate

### 路径
- CRM：`/staffs`

### Case 1.1 新建 Staff
1. 进入 `Staffs` 页面
2. 点击 `Create Staff`
3. 填写：
   - Name / Email / Password
   - **Product Commission Rate (%)** = `5`
   - **Service Commission Rate (%)** = `12`
4. 点击 `Create`

### 预期
- 列表出现新 staff
- 表格里能看到两列：
  - Product Commission Rate (%) ≈ `5.00%`
  - Service Commission Rate (%) ≈ `12.00%`

---

### Case 1.2 编辑 Staff
1. 在同一列点击该 staff 的 `Edit`
2. 修改：
   - Product Commission Rate (%) = `8`
   - Service Commission Rate (%) = `15`
3. 点击 `Save Changes`

### 预期
- 回列表后，该 staff 两个比例都更新
- 状态切换（Active/Inactive）仍正常可用

---

## 2) Booking Services：验证服务价格字段仍可在 UI 维护

### 路径
- CRM：`/booking/services`

### Case 2.1 新建 Booking Service
1. 进入 `Booking Services`
2. 点击 `Create Booking Service`
3. 填写：
   - Name
   - Duration
   - Service Price
   - Deposit Amount
   - Buffer
4. 点击 `Create`

### 预期
- 新服务出现在列表
- `Service Price` 显示正确

---

### Case 2.2 编辑 Booking Service
1. 点击某条服务的 `Edit`
2. 修改 `Service Price`
3. 点击 `Save Changes`

### 预期
- 列表价格即时更新
- 没出现 422/500 错误

---

## 3) POS：验证原 POS 页面可正常打开（回归）

### 路径
- CRM：`/pos`

### Case 3.1 页面加载
1. 进入 POS 页面
2. 搜索一个商品并加入购物车
3. 观察小计、结账按钮

### 预期
- POS 页面可正常打开
- 现有商品加购/结账流程不被本次改动破坏

> 备注：
> - 本次后端已支持 `POST /api/pos/cart/add-service`（服务项）
> - 若当前 UI 还没有“Add Service”按钮，属前端入口未做完，不是后端接口缺失

---

## 4) 用浏览器 DevTools 快速确认 Staff API 入参与回参

### Case 4.1 新建 staff 时
1. 打开浏览器 DevTools -> Network
2. 在 `/staffs` 做一次 Create
3. 点开 `POST /api/proxy/staffs`

### 预期
- Request JSON 含：`service_commission_rate`
- Response data 含：`service_commission_rate`

---

### Case 4.2 编辑 staff 时
1. 再做一次 Edit
2. 点开 `PUT /api/proxy/staffs/{id}`

### 预期
- Request JSON 含：`service_commission_rate`
- Response data 含：`service_commission_rate`

---

## 5) 失败排查（你点到报错时先看这里）

1. `403 Forbidden`
   - 账号缺权限（staff.view/create/update、booking.services.*、pos.checkout）
2. `422 Unprocessable Entity`
   - 输入格式不合法（例如比例 > 100、空必填）
3. POS 打得开但没有服务按钮
   - 当前版本通常是 UI 入口未接好，后端接口可用（可先用 Postman 测）

---

## 6) 建议你回报给开发的截图清单

请至少给 4 张图：
1. Staff 列表显示两个 commission 列
2. Staff Create modal（有 Service Commission Rate 输入框）
3. Staff Edit modal（有 Service Commission Rate 输入框）
4. Booking Services 列表/编辑成功后的价格显示

