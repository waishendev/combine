# Booking Add-on QA 测试指南（Seeder 版）

这份文档给你一个**可直接跟着做**的测试流程，目标是验证：

1. POS Appointment Settlement 能区分  
   - 主服务结算  
   - Add-on 已付款（online/offline）  
   - Add-on 待付  
2. Booking Sales Report 有 `Add-on Revenue`  
3. Booking Customer Sales Report 有 `Add-on Revenue`  
4. Package 覆盖主服务时，Add-on 仍然独立收费

---

## 1) 先准备数据库（建议本地开发环境）

在 `backend/ecommerce_gentlegurl_backend_api` 执行：

```bash
php artisan migrate
php artisan db:seed --class=Database\\Seeders\\BookingTestingSeeder
php artisan db:seed --class=Database\\Seeders\\ServicePackageTestingSeeder
```

> 如果你习惯先清库重建，也可以先 `php artisan migrate:fresh` 再执行上面两个 seed。

---

## 2) Seeder 会帮你准备的关键场景

## BookingTestingSeeder

会生成两类和 add-on 相关的 QA 场景（备注写在 booking notes）：

- `QA_SCENARIO=ADDON_PAID_ONLINE`  
  - 已有 booking_addon paid 订单  
  - POS 应显示 add-on 已付，不应重复收

- `QA_SCENARIO=ADDON_DUE_AT_POS`  
  - 仅有 deposit paid，add-on 还没付  
  - POS 应显示 add-on balance due > 0

## ServicePackageTestingSeeder

会生成 package + add-on 场景：

- `QA_SCENARIO=PACKAGE_COVERED_MAIN_WITH_ADDON_CHARGE`  
  - 主服务被 package usage 覆盖  
  - add-on 仍是 booking_addon 独立收费

---

## 3) POS Settlement 测试步骤（CRM）

路径：`/pos` -> `APPOINTMENTS` -> 打开 appointment 详情

重点看这些字段：

- `Service Total (Main Service)`
- `Add-on Total`
- `Add-on Paid Online`
- `Add-on Paid at POS`
- `Add-on Paid Total`
- `Add-on Balance Due`
- `Main Service Balance Due`
- `Amount Due Now (Main + Add-ons)`

### 预期

- 对 `ADDON_PAID_ONLINE`：  
  `Add-on Balance Due = 0`
- 对 `ADDON_DUE_AT_POS`：  
  `Add-on Balance Due > 0`

如点击收款（collect payment）：

- 主服务欠款会落 `booking_settlement`
- add-on 欠款会落 `booking_addon`

---

## 4) Booking Sales 报表测试（CRM）

路径：`/reports/sales/booking`

### 检查点

- Filter 里有 `Type = Add-on`
- Summary 有：
  - `Total Booking Revenue`
  - `Booking Deposits`
  - `Add-on Revenue`
  - `Package Sales`
  - `Booking Settlements`
- Page Totals / Grand Totals 有显示 add-on breakdown

### 快速验证

1. `Type=Add-on` 应看到 booking_addon 相关行  
2. 清空 Type（All）后，`Add-on Revenue` 不应为 0（有 seed 数据时）

---

## 5) Booking Customer Sales 报表测试（CRM）

路径：`/reports/sales/customers-booking`

### 检查点

表格列应包含：

- Booking Deposit
- Booking Settlement
- **Add-on Revenue**
- Package Purchase
- Total Revenue

并且 Page Totals / Grand Totals 都有 `Add-on Revenue`。

---

## 6) 常见排查

- 看不到数据：
  - 确认 date filter 包含今天/seed 日期区间
  - 确认 seed 成功执行
- 报表没有 add-on：
  - 检查 `order_items.line_type = booking_addon` 是否有记录
- POS 还显示 due 异常：
  - 检查对应订单 payment_status 是否是 `paid`

---

## 7) 你现在只有这两个 booking seed（没问题）

你目前只有：

- `BookingTestingSeeder.php`
- `ServicePackageTestingSeeder.php`

这版已经把 add-on / package / settlement 的 QA 场景都放进这两个 seed 里了，直接重复执行即可做回归。

