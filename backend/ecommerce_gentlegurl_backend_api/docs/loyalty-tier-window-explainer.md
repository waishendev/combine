# Loyalty evaluation_cycle_months & membership tier months_window 说明

本文件说明 `loyalty_settings.evaluation_cycle_months` 与 `membership_tier_rules.months_window` 在目前后端的用途与计算逻辑。

## 1) evaluation_cycle_months（loyalty_settings）

**用途**：用来定义「会员升级/统计」的通用消费统计窗口（过去 N 个月）。

**当前使用位置**：
- `App\Http\Controllers\CustomerController`
- `App\Http\Controllers\Ecommerce\CustomerController`

在这两个 Controller 里，系统会读取最新生效的 `loyalty_settings`，并用 `evaluation_cycle_months` 计算统计窗口：

```php
$window = $this->getWindowDates($loyaltySetting?->evaluation_cycle_months ?? 6);
```

然后用这个时间窗去计算：
- `spent_in_window`（过去 N 个月内的消费）
- `next_tier` 与 `amount_to_next_tier`（下一个等级门槛）

**结果体现**：
- `GET /customers` 回传 `spent_in_window`, `next_tier`, `amount_to_next_tier`
- `GET /customers/{id}` 回传 `loyalty_summary.window`（含 `months_window`, `start_date`, `end_date`, `spent_in_window`）

> 简单讲：`evaluation_cycle_months` 是**全局/系统层级**的“消费统计窗口月份”。

---

## 2) months_window（membership_tier_rules）

**用途**：用来定义「某个会员等级」在计算消费进度时的窗口（过去 N 个月）。

**当前使用位置**：
- `App\Services\Ecommerce\MembershipTierService::buildLoyaltyProgress`

在 `buildLoyaltyProgress` 中，会读取 **当前会员等级规则** 的 `months_window`：

```php
$windowMonths = $currentRule?->months_window ?? 0;
$windowStart = $now->copy()->subMonths($windowMonths);
```

然后用这个窗口去统计 `total_spent` 并计算：
- `amount_to_next_tier`
- `progress_percent`
- `tier_review_at`（以 `tier_effective_at + months_window` 作为复评时间）

> 简单讲：`months_window` 是**等级规则层级**的“消费统计窗口月份”。

---

## 3) 两者的差别（为什么会有两个）

- `evaluation_cycle_months`：
  - 由 `loyalty_settings` 决定
  - 主要影响「客户列表/详情」API 的消费统计与下一级门槛显示
  - 是 **全局统一的窗口**

- `months_window`：
  - 由 `membership_tier_rules` 决定
  - 主要影响 `MembershipTierService` 里的消费进度/复评逻辑
  - 是 **针对某个等级** 的窗口（可不同）

如果你现在看到「有 2 个窗口月份」的感觉，那是因为：
- 一个是系统统一的“统计窗口”（`evaluation_cycle_months`）
- 一个是当前会员等级的“进度/复评窗口”（`months_window`）

目前代码里 **这两个并没有强制同步**，所以你可以：
- 让所有等级的 `months_window` 与 `evaluation_cycle_months` 相同（效果最直觉）
- 或者对不同等级设置不同的 `months_window`

---

## 4) 小结

| 字段 | 所在表 | 目前用途 | 影响范围 |
|------|--------|----------|----------|
| evaluation_cycle_months | loyalty_settings | 客户列表/详情统计窗口 | 全局 |
| months_window | membership_tier_rules | 会员等级进度与复评窗口 | 每个等级 |

如果希望只保留一种窗口逻辑，可以考虑统一使用其中一个字段（但需要改代码逻辑）。
