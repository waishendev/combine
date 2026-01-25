# Billplz Callback Test - Postman Collection

这个 Postman collection 用于测试 Billplz webhook 回调的签名验证功能。

## 使用方法

### 1. 导入 Collection

1. 打开 Postman
2. 点击左上角的 **Import** 按钮
3. 选择文件 `billplz-callback-test.postman_collection.json`
4. 点击 **Import**

### 2. 设置环境变量

在导入 collection 后，你需要设置 `x_signature_key` 变量：

1. 在 Postman 中，点击 collection 名称
2. 选择 **Variables** 标签
3. 找到 `x_signature_key` 变量
4. 将值设置为你的 `.env` 文件中的 `BILLPLZ_X_SIGNATURE_KEY` 值
5. 点击 **Save**

**重要**: 如果不设置这个变量，签名生成会失败！

### 3. 设置 Base URL

默认的 `base_url` 是 `http://localhost:8000/api`。如果你的后端运行在不同的地址，请修改这个变量。

### 4. 运行测试

Collection 包含 5 个测试请求：

1. **Billplz Callback - Test with Original Signature**
   - 使用日志中的原始签名进行测试
   - 用于验证后端是否能正确处理真实的回调

2. **Billplz Callback - Generate Signature (Method 1: All Fields)**
   - 使用 Method 1 生成签名：包含所有字段（即使为空）
   - 格式：`billplzid|billplzpaid_at|billplzpaid|billplztransaction_id|billplzamount|billplzcollection_id|billplzreference_1`
   - 在 Console 中查看生成的签名是否与原始签名匹配

3. **Billplz Callback - Generate Signature (Method 2: Non-Empty Only)**
   - 使用 Method 2 生成签名：只包含非空字段
   - 在 Console 中查看生成的签名是否与原始签名匹配

4. **Billplz Callback - Generate Signature (Method 3: Values Only)**
   - 使用 Method 3 生成签名：只使用值，不带字段名前缀
   - 格式：`id|paid_at|paid|transaction_id|amount|collection_id|reference_1`
   - 在 Console 中查看生成的签名是否与原始签名匹配

5. **Billplz Callback - With reference_1**
   - 测试包含 `reference_1` 字段的情况

### 5. 查看结果

#### 在 Postman Console 中查看

1. 点击 Postman 左下角的 **Console** 图标
2. 运行任何一个测试请求
3. 查看 Pre-request Script 的输出：
   - 签名字符串（用于生成签名的原始字符串）
   - 生成的签名
   - 是否与原始签名匹配

#### 在 Laravel 日志中查看

运行测试后，检查你的 Laravel 日志文件（通常在 `storage/logs/laravel.log`），你会看到：

- 签名验证的详细信息
- 所有尝试的签名格式
- 每种格式计算出的期望签名值

## 如何确定正确的签名格式

1. 运行 Method 1、Method 2 和 Method 3 的测试
2. 在 Postman Console 中查看哪个方法生成的签名与原始签名匹配
3. 如果某个方法匹配，说明那就是 Billplz 使用的签名格式
4. 然后我们可以更新后端代码，只使用那个匹配的方法

## 示例输出

在 Postman Console 中，你会看到类似这样的输出：

```
Method 1 - Signature string: billplzidfdc428fa53d7e874|billplzpaid_at2026-01-26 01:30:58 +0800|billplzpaidtrue|billplztransaction_id1B2EA3BD4BC06B2DB439|billplzamount100|billplzcollection_iddpiytx7r|billplzreference_1
Method 1 - Generated signature: abc123...
Original signature from log: f716309650c144d45776470cfe410ac527fd9c28dc9fa36016c3fb090cda57e7
Match: NO
```

如果看到 `Match: YES!`，说明找到了正确的签名格式！

## 注意事项

- 确保你的后端服务正在运行
- 确保数据库中有一个订单，订单号是 `ORD20260126013023387`，或者修改请求中的 `reference_1` 字段
- 如果测试失败，检查 Laravel 日志以获取更多详细信息

## 故障排除

### 错误：x_signature_key not set
- 确保你已经设置了 `x_signature_key` 变量

### 错误：order not found
- 确保数据库中存在对应的订单
- 或者修改请求中的 `reference_1` 字段为实际存在的订单号

### 签名不匹配
- 这是正常的，因为我们正在测试不同的签名格式
- 查看 Console 输出和 Laravel 日志来确定正确的格式
