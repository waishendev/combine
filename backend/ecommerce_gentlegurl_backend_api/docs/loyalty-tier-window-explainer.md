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

目前代码里 **这两个并没有强制同步**，所以你可以：
- 让所有等级的 `months_window` 与 `evaluation_cycle_months` 相同（效果最直觉）
- 或者对不同等级设置不同的 `months_window`

---

## 4) Story line（用情境解释更直白）

> 下面用「消费统计窗口」的故事线来说明**当两者不一样会发生什么**。

### 情境 A：两个值一样（最直觉）
- `evaluation_cycle_months = 6`
- `months_window = 6`（所有等级规则都设 6）

**你会看到的效果**：  
客户列表/详情里的 `spent_in_window` 统计 6 个月；  
会员等级进度（`buildLoyaltyProgress`）也统计 6 个月。  
**所以两个地方会「对得上」，不会觉得矛盾。**

### 情境 B：全局 6 个月，但等级规则 3 个月
- `evaluation_cycle_months = 6`
- `months_window = 3`（例如 Gold 只看 3 个月）

**你会看到的效果**：  
客户列表/详情显示过去 6 个月消费（`spent_in_window`）。  
但会员等级进度/复评是用 3 个月去算。  
**结果：**同一个人，列表/详情看起来“消费很多”，  
但进度条或复评可能显示“没达标/快到期”。  
这就是两套窗口不一致带来的差异。

### 情境 C：全局 6 个月，但等级规则 12 个月
- `evaluation_cycle_months = 6`
- `months_window = 12`

**你会看到的效果**：  
客户列表/详情显示过去 6 个月消费。  
等级进度却统计 12 个月，所以进度看起来更高、比较容易达标。  
**结果：**列表/详情“看起来没那么多”，  
但等级进度却可能显示“已经达标/快升级”。

> 总结：  
`evaluation_cycle_months` 影响「展示给后台看到的统计窗口」；  
`months_window` 影响「等级进度与复评的统计窗口」。  
如果两个设定不同，你就会看到“展示统计”和“等级进度”不一致。

---

## 5) 你问到的具体例子（3 个月 vs 5 个月）

**设定**：  
- `months_window = 3`  
- `evaluation_cycle_months = 5`  
- 顾客 2 个月内花了 3000，5 个月累计花了 5000  
- BASIC → GOLD 门槛 = 2000  

**什么时候从 BASIC 看到 GOLD？**  
这取决于**你看的画面**：  

1) **客户列表/详情 API**（使用 `evaluation_cycle_months = 5`）  
   - 只看 5 个月消费，所以会显示“已达标/可升级”。  
   - 因为 5 个月累计 5000，已经超过 2000。  

2) **会员等级进度/复评 API**（使用 `months_window = 3`）  
   - 只看 3 个月消费，所以只要 3 个月内 ≥ 2000，就会显示“已达标/进度 100%”。  
   - 如果这个顾客在 2 个月内就已经花 3000，那么**马上就会在等级进度里看到 GOLD 达标**。  

**如果到第 4 个月，他过去 3 个月消费不到 2000 会怎样？**  
- 在 **等级进度/复评逻辑** 里，`months_window = 3` 会滚动计算。  
- 当过去 3 个月消费不足 2000 时，进度会下降，`tier_review_at` 也会推进。  
- **是否“降级”取决于后续有没有写自动降级逻辑**。当前代码只负责计算进度/复评时间，并不会自动降级（除非有其他 job/逻辑在处理）。  

---

## 6) 客户列表/详情显示的是哪里？

文档中提到的：  
> “客户列表/详情显示过去 X 个月消费”  

这里指的是后台的 **Customers API**（`GET /customers` 与 `GET /customers/{id}`），  
主要给后台管理使用，不是前台 Shop 页面直接用的显示逻辑。

---

## 7) 小结

| 字段 | 所在表 | 目前用途 | 影响范围 |
|------|--------|----------|----------|
| evaluation_cycle_months | loyalty_settings | 客户列表/详情统计窗口 | 全局 |
| months_window | membership_tier_rules | 会员等级进度与复评窗口 | 每个等级 |

如果希望只保留一种窗口逻辑，可以考虑统一使用其中一个字段（但需要改代码逻辑）。
