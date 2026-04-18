# Commission Business Version

> Audience: non-technical team members, new joiners (onboarding)
>
> Goal: explain **how the business process works** in plain language.

---

## 1) Booking Commission 怎么算

Booking 的佣金是按「员工每个月的完成业绩」来算。

- 只计算 **已完成（COMPLETED）** 的 booking
- 以月份为单位统计（每月 1 号到下个月 1 号）
- 每位员工独立计算自己的当月总销售
- 总销售达到不同门槛，会进入不同 Tier
- Tier 会决定该员工当月的佣金比例

简单理解：

- 做越多、达到更高门槛，佣金比例通常越高

---

## 2) Ecommerce Commission 怎么算

Ecommerce 佣金来自两类来源：

- 产品（product）
- 配套/配套服务（package）

核心逻辑：

- 同一笔单可以分给多位员工（split）
- 每位员工只拿自己被分配到的那一部分
- 系统会把该员工当月所有“可计算佣金的销售额”加总
- 再按 Tier 规则算当月佣金

重点是：

- 不是整张单都给一个人
- 是按员工分到的部分，各自计算

---

## 3) Tier 是什么（重点）

Tier 可以理解为「业绩级别」。

- 每个月看员工当月总销售
- 到不同门槛，就进入不同级别
- 每个级别对应不同佣金 %

常见示例（业务设定）：

- RM 0 → 0%
- RM 5000 → 5%
- RM 8000 → 10%

意思就是：

- 当月销售越高，可能进入更高 Tier，拿到更高比例

---

## 4) Commission 是怎么算

一句话：

- **佣金 = 本月销售 × Tier %**

---

## 5) Override（非常重要）

Override = 管理员手动指定佣金额。

- Admin 可手动修改某员工某月份佣金
- 一旦该月启用 Override：
  - 系统自动计算结果不再作为最终佣金
  - 以手动金额为准
- 只有移除 Override，系统计算结果才会再次成为最终佣金

---

## 6) Frozen / Reopen

### Frozen

可以理解为「月结锁账」。

- 该月份被锁住
- 不会再自动更新
- 一般也不允许再修改（例如不能直接 override）

### Reopen

可以理解为「解锁重开」。

- 把该月份重新打开
- 之后才可以重新计算或调整

---

## 7) Recalculate 是做什么的

Recalculate = 手动重新计算指定范围的数据。

通常用于：

- 数据修正后要重跑
- 月结前再确认一次
- 发现异常后回算

它会更新：

- 销售汇总
- Tier
- 佣金（如果该月没有 Override）

---

## 8) 重要规则（务必知道）

- **Booking 和 Ecommerce 分开计算**（互不混在一起）
- **Tier 调整不会自动改掉旧月份结果**（旧月通常需手动重算）
- **Frozen 月份默认不会被改动**
- **Override 永远优先于系统计算结果**

---

## 9) 例子（业务视角）

### Example 1：单人月业绩

- Staff A 当月可计算销售：RM 9000
- 对应 Tier：10%
- 最终佣金：RM 900

业务理解：

- 这个月 A 达到高门槛，所以吃到更高比例

### Example 2：一笔 split 单

- 某产品订单金额：RM 9000
- Staff A 分配 40%
- Staff B 分配 60%

业务理解：

- A 的可计算份额是这笔单的 40%
- B 的可计算份额是这笔单的 60%
- 他们各自再并入“自己当月总额”，各自看自己 Tier、算自己佣金
- 不会把整笔单都算给同一个人

---

## 10) 给 Onboarding 新人的一句话总结

Commission 系统本质上是：

- 先按模块（Booking/Ecommerce）
- 再按员工、按月份
- 汇总可计算销售
- 套 Tier
- 得出佣金
- 必要时可 Override
- 月结后用 Frozen 锁住
