# Service Package 的 `total_sessions` 是什么？（给前端/产品看的说明）

> 结论先说：
>
> - `total_sessions` **不是天数**。
> - `total_sessions` 是这个 package 的「总疗程次数 / 总 session 数」的展示字段。
> - 实际可扣次数是按 `items[].quantity` 建立到每个服务余额（`remaining_qty`）来扣减。
> - 天数逻辑是另一个字段：`valid_days`（会换算成 `expires_at`）。

---

## 1) `total_sessions` 的定义

在 backend migration 里，`service_packages` 表有这两个字段：

- `total_sessions`（unsigned integer）
- `valid_days`（unsigned integer, nullable）

意思是：

- `total_sessions`：套餐总次数（业务展示/配置）
- `valid_days`：有效天数（用来算过期时间）

---

## 2) 天数是怎么算的？

购买套餐时，系统会这样算：

- `started_at = now()`
- 如果 `valid_days` 有值：`expires_at = started_at + valid_days`
- 如果 `valid_days` 为空：`expires_at = null`（通常表示不限期）

所以：**天数来自 `valid_days`，不是 `total_sessions`**。

---

## 3) 实际扣减次数是看哪里？

购买套餐时，系统会把 package 的 `items` 写入客户余额表：

- `total_qty = item.quantity`
- `remaining_qty = item.quantity`

之后每次 redeem/consume，扣的是 `remaining_qty`。  
扣到全部余额总和 <= 0，套餐状态会变成 `exhausted`。

因此在技术实现上：

- 真正影响能用几次的是 `items[].quantity`
- `total_sessions` 目前更像「套餐总次数标签/主字段」

---

## 4) 为什么会让人误会？

因为 UI 常会同时显示：

- Sessions: `total_sessions`
- Validity: `valid_days`

视觉上容易让人以为 sessions 会自动换算成天数。  
但后端逻辑没有做 `total_sessions -> 天数` 的换算。

---

## 5) 业务上建议（不改代码，仅建议）

1. 如果你们规则是「次数型套餐 + 可选有效期」，当前模型是合理的：
   - 次数看 `items[].quantity` / `total_sessions`
   - 时间看 `valid_days`

2. 最好在 UI 文案上明确：
   - `Total Sessions`（次数）
   - `Validity (days)`（天数）

3. 若要避免数据不一致，可在后端加规则（未来可做）：
   - 验证 `total_sessions === sum(items[].quantity)`

---

## 6) 一个例子

假设创建 package：

- `total_sessions = 10`
- `valid_days = 180`
- `items = [{ booking_service_id: Haircut, quantity: 10 }]`

购买当下：

- 得到 `started_at = 今天`
- `expires_at = 今天 + 180 天`
- Haircut 的 `remaining_qty = 10`

客户每用一次 Haircut：

- `remaining_qty` 递减
- 用完后状态变 `exhausted`

可以看到：

- 10 次来自 quantity / sessions
- 180 天来自 valid_days

---

## 7) 简短版（你可以直接发给同事）

- `total_sessions` = 套餐总次数，不是天数。
- 天数看 `valid_days`，购买时会算出 `expires_at`。
- 真正可扣次数由 `items[].quantity -> remaining_qty` 决定。
