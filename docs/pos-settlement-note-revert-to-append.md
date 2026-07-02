# POS Edit Settlement — Settlement Note：改回「追加 (Append)」模式

本文说明如何把 **Settlement Note** 从目前的 **编辑替换 (Replace)** 行为，改回早期的 **每次保存追加一条 (Append)** 行为。

适用场景：希望每次在 EDIT SETTLEMENT 里只写「新备注」，系统自动加上时间、员工姓名，并接在旧备注后面，而不是覆盖整段内容。

---

## 目前行为（Replace）

| 环节 | 行为 |
|------|------|
| 打开 EDIT SETTLEMENT | 文本框预填 `bookings.settlement_notes` 全文 |
| 保存 | 用文本框内容**整段替换** `settlement_notes` |
| 空内容保存 | 清空 `settlement_notes` |

涉及 API：`POST /api/pos/appointments/{id}/edit-settlement`  
字段：`settlement_note`（单数，请求体）

---

## 旧行为（Append）

| 环节 | 行为 |
|------|------|
| 打开 EDIT SETTLEMENT | 文本框为**空白** |
| 保存 | 仅当有新文字时，追加一条记录到 `settlement_notes` |
| 每条格式 | `Y-m-d H:i` + 换行 + `员工名:` + 换行 + 备注正文 |
| 多条之间 | 用 `\n\n` 分隔 |

---

## 要改的文件（共 3 处）

### 1. 后端 — 改回追加逻辑

**文件：** `backend/ecommerce_gentlegurl_backend_api/app/Http/Controllers/Ecommerce/PosController.php`  
**方法：** `editAppointmentSettlement`  
**约行：** `if ($request->has('settlement_note')) { ... }`

**现在（Replace）：**

```php
if ($request->has('settlement_note')) {
    $note = trim((string) ($validated['settlement_note'] ?? ''));
    $booking->settlement_notes = $note !== '' ? $note : null;
}
```

**改回（Append）：**

```php
if ($request->has('settlement_note')) {
    $note = trim((string) ($validated['settlement_note'] ?? ''));
    if ($note !== '') {
        $author = trim((string) ($request->user()?->name ?? ''));
        if ($author === '') {
            $author = 'Staff #' . (int) $request->user()->id;
        }
        $entry = now()->format('Y-m-d H:i') . "\n" . $author . ":\n" . $note;
        $existingNotes = trim((string) ($booking->settlement_notes ?? ''));
        $booking->settlement_notes = $existingNotes !== '' ? ($existingNotes . "\n\n" . $entry) : $entry;
    }
}
```

说明：

- 空字符串**不会**清空已有备注（与旧版一致）。
- 时间戳、作者由后端自动写入，前端只传「本条新备注」正文。

---

### 2. 前端 — POS Appointments 页

**文件：** `frontend/ecommerce_gentlegurl_crm/src/components/pos/PosAppointmentsWorkspace.tsx`

#### 2a. 打开弹窗时清空草稿（不要预填旧备注）

在 `openEditSettlement` 内，找到：

```ts
setEditSettlementNoteDraft(String(appointmentDetail.settlement_notes ?? '').trim())
```

改回：

```ts
setEditSettlementNoteDraft('')
```

#### 2b. 保存时仅在有新内容时才提交

在 `saveEditSettlement` 内，找到：

```ts
payload.settlement_note = editSettlementNoteDraft.trim()
```

改回：

```ts
const settlementNote = editSettlementNoteDraft.trim()
if (settlementNote) {
  payload.settlement_note = settlementNote
}
```

#### 2c. 文案改回「追加」提示

Settlement Note 的 `textarea` 区域：

| 项目 | Replace（现在） | Append（改回） |
|------|----------------|----------------|
| `placeholder` | `Edit settlement note...` | `Add new settlement note...` |
| 下方说明 | `Changes replace the current note when you save.` | `This note will be appended after saving.` |

历史备注仍可在预约详情侧的 **Settlement Notes**（`SettlementNotesHistory`）查看，不必在编辑框里显示。

---

### 3. 前端 — POS Checkout 购物车里的 Edit Settlement

**文件：** `frontend/ecommerce_gentlegurl_crm/src/components/PosPageContent.tsx`

与上一节相同的三处改动，对应名称如下：

| Replace（现在） | Append（改回） |
|-----------------|----------------|
| `setCartEditSettlementNoteDraft(String(settlement.settlement_notes ?? '').trim())` | `setCartEditSettlementNoteDraft('')` |
| `payload.settlement_note = cartEditSettlementNoteDraft.trim()` | 仅 `trim()` 后非空才 `payload.settlement_note = settlementNote` |
| placeholder / 说明文案 | 同 2c |

函数：`openCartEditSettlement`、`saveCartEditSettlement`（或同文件内保存 cart edit settlement 的逻辑）。

---

## 改完后如何自测

1. 找一笔已有 `settlement_notes` 的预约，打开 **EDIT SETTLEMENT**。
2. **Append 模式预期：** 备注框为空；输入 `note A` 保存后，库里多一段带时间/员工的新记录，旧内容仍在。
3. 关闭再打开，框仍为空；再输入 `note B` 保存，应出现第三段，而不是覆盖 `note A`。
4. **Replace 模式（若未改回）：** 打开即看到全文；保存会整段替换。

Deposit 单独保存（只传 `adjusted_deposit_amount`）**不应**改动 `settlement_notes`——两种模式都一样，无需额外修改。

---

## 相关但不必改动的部分

- 数据库字段：`bookings.settlement_notes`（`text`，可空）
- 展示组件：`SettlementNotesHistory`（按 `\n\n` 分段、倒序显示）
- 只读展示：`DailyBookingPageClient`、`OrderViewPanel`、`BookingAppointmentHistoryPage` 等读 `settlement_notes`，与 Append/Replace 无关
- Deposit 调整：`saveEditSettlementDeposit` 不传 `settlement_note`，行为不变

---

## 快速对照

```
Replace（现在）                    Append（改回）
─────────────────────────────────────────────────────────
打开 → 显示旧备注全文              打开 → 空白输入框
保存 → 整段替换 / 可清空           保存 → 仅追加新条（非空时）
后端 → settlement_notes = note     后端 → 旧内容 + "\n\n" + 时间/员工/新内容
前端 → 总是传 settlement_note      前端 → 有内容才传 settlement_note
```

---

*文档对应改动：EDIT SETTLEMENT Settlement Note 由 Append 改为 Replace（预填 + 覆盖保存）。*
