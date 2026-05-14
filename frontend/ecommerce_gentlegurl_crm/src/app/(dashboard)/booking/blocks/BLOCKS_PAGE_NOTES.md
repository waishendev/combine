# Booking Blocks 页面说明与时间验证

## 1) `page.tsx` 这个文件是做什么的？
文件：`src/app/(dashboard)/booking/blocks/page.tsx`

这是 Booking Blocks 的**路由入口页（Next.js App Router server component）**，主要职责：

1. 读取当前登入用户（`getCurrentUser`）。
2. 未登录就 `redirect('/login')`。
3. 检查权限 `booking.blocks.view`，没权限就 `redirect('/dashboard')`。
4. 渲染页面框架（Breadcrumb + 标题）。
5. 把用户权限传给 `BlocksTable`，真正的列表、Create / Edit / Delete 都在组件里完成。

> 也就是说：`page.tsx` 本身不是业务逻辑中心，它是“页面入口 + 权限守门 + 容器”。

---

## 2) Create Block / Edit Block 时间为什么会错？

本次检查发现有两个关键点：

### A. Edit 回填时间使用了 UTC 格式
旧逻辑在 `BlockEditModal` 回填表单时用了：

- `new Date(value).toISOString().slice(0, 16)`

`toISOString()` 永远是 UTC，会把你本地时间偏移后再显示到 `datetime-local`，导致你看到的 Edit 时间“变掉”。

### B. Create / Edit 提交时统一转成 ISO UTC
旧逻辑提交 payload 时使用：

- `new Date(form.start_at).toISOString()`

这会发送 UTC 字符串（带 `Z`），如果后端或显示链路按“本地/门店时区”处理，可能出现你描述的“创建与更新后时间不对”。

---

## 3) 这次修正做了什么

### 前端已改成更稳定的本地时间字符串策略

- 新增 `toApiDateTime(value)`：把 `YYYY-MM-DDTHH:mm` 转成 `YYYY-MM-DD HH:mm:ss`（不强制转 UTC）。
- 新增 `toDateTimeLocalValue(value)`：把 API 返回时间正确转成 `datetime-local` 需要的本地格式。

应用位置：

- `BlockCreateModal.tsx`：Create 提交改用 `toApiDateTime`。
- `BlockEditModal.tsx`：
  - 回填改用 `toDateTimeLocalValue`（修正 Edit 显示偏移）
  - Update 提交改用 `toApiDateTime`

---

## 4) 建议你验证的手动流程（QA）

1. Create Block：选一个明确时间（例如 `2026-03-26 10:00 ~ 11:00`）。
2. 创建后看列表显示是否仍是 10:00~11:00。
3. 立刻点 Edit，确认表单里回填也是 10:00~11:00（不应自动偏移）。
4. 不改时间直接 Save，确认列表时间不变。
5. 再改成 12:00~13:00 保存，确认列表和再次 Edit 都一致。

如果以上 1~5 都通过，Create / Edit 时间链路就基本正确。

---

## 5) 额外建议（后续可做）

如果系统业务上要求“固定门店时区（例如 Asia/Shanghai）”，建议后续在前后端明确：

- API 字段统一时区语义（UTC 或门店时区二选一）。
- 前端显示/输入明确使用同一时区策略。
- 后端 response 可显式返回时区信息，避免浏览器自动推断差异。

