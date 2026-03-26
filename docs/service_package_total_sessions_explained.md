# Service Package 更新说明：`total_sessions` 已移除

## 变更结论

- `total_sessions` 已从当前实现中移除，不再作为 Service Package 字段。
- Service Package 的时效现在只看 `valid_days`（可为空，表示不设到期）。
- 可兑换次数继续由 `items[].quantity` 写入 customer balances 的 `remaining_qty` 决定。

## 现在的规则

1. **创建/编辑 Service Package**
   - 使用字段：`name`, `description`, `selling_price`, `valid_days`, `is_active`, `items[]`。
   - 不再提交 `total_sessions`。

2. **有效期**
   - 购买时：`expires_at = started_at + valid_days`（当 `valid_days` 有值时）。
   - `valid_days` 为空时，`expires_at` 为 `null`。

3. **可用次数**
   - 每个 item 的 `quantity` 会成为对应服务的 `remaining_qty`。
   - redeem 时按 `remaining_qty` 扣减，与 `valid_days`（是否过期）共同决定可用性。

## 前端显示

- CRM / Booking Shop 的 package 展示改为 `valid_days`。
- 不再显示 `Sessions`（`total_sessions`）。
