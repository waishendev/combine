# 产品图片上传 API 使用说明

## 概述

产品创建和更新 API 现在支持同时上传多张图片。图片会被存储在 `storage/app/public/products/{product_id}/` 目录下。

## 📥 快速开始 - Postman Collection

我们提供了一个可以直接导入到 Postman 的 Collection 文件：

**文件位置：** `docs/product-image-upload-postman-collection.json`

### 导入步骤：

1. 打开 Postman
2. 点击左上角的 **Import** 按钮
3. 选择 `docs/product-image-upload-postman-collection.json` 文件
4. Collection 将被导入，包含以下预配置的请求：
   - 登录认证（Token 和 Session）
   - 创建产品（带图片上传）
   - 更新产品（添加/删除图片）
   - 查看产品列表和详情

### 配置说明：

- **base_url**: 默认 `http://localhost:8000/api`，可在 Collection 变量中修改
- **token**: 登录后会自动保存到 Collection 变量
- **product_id**: 创建产品后会自动保存，用于后续更新操作

### 使用提示：

1. 先运行 **Login (Token)** 或 **Login (Session)** 请求进行认证
2. Token 登录会自动保存 token 到 Collection 变量
3. 在 **Create Product with Images** 请求中：
   - 找到 `images[]` 字段
   - 将类型改为 **File**
   - 点击选择文件上传图片
   - 可以添加多个 `images[]` 字段上传多张图片
4. 创建产品后，`product_id` 会自动保存，可用于后续的更新请求

## 支持的图片格式

- JPEG / JPG
- PNG
- GIF
- WebP

**文件大小限制：** 每张图片最大 5MB

## API 端点

### 创建产品并上传图片

```
POST /api/ecommerce/products
```

### 更新产品并上传/删除图片

```
PUT /api/ecommerce/products/{product_id}
```

## 请求格式

由于需要上传文件，请求必须使用 **multipart/form-data** 格式，而不是 JSON。

## 创建产品示例（使用 curl）

```bash
curl -X POST "https://your-domain.com/api/ecommerce/products" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "name=iPhone 15" \
  -F "slug=iphone-15" \
  -F "sku=IP15-BLACK" \
  -F "type=single" \
  -F "description=最新款 iPhone" \
  -F "price=999.99" \
  -F "cost_price=800" \
  -F "stock=50" \
  -F "low_stock_threshold=5" \
  -F "is_active=true" \
  -F "is_featured=false" \
  -F "meta_title=iPhone 15" \
  -F "meta_description=最新款 iPhone" \
  -F "meta_keywords=iphone,phone" \
  -F "meta_og_image_file=@/path/to/og-image.jpg" \
  -F "category_ids[]=2" \
  -F "images[]=@/path/to/image1.jpg" \
  -F "images[]=@/path/to/image2.jpg" \
  -F "images[]=@/path/to/image3.jpg" \
  -F "main_image_index=0"
```

## 创建产品示例（使用 JavaScript / FormData）

```javascript
const formData = new FormData();

// 产品基本信息
formData.append('name', 'iPhone 15');
formData.append('slug', 'iphone-15');
formData.append('sku', 'IP15-BLACK');
formData.append('type', 'single');
formData.append('description', '最新款 iPhone');
formData.append('price', '999.99');
formData.append('cost_price', '800');
formData.append('stock', '50');
formData.append('low_stock_threshold', '5');
formData.append('is_active', 'true');
formData.append('is_featured', 'false');
formData.append('meta_title', 'iPhone 15');
formData.append('meta_description', '最新款 iPhone');
formData.append('meta_keywords', 'iphone,phone');
// meta_og_image 可以是文件或字符串路径
formData.append('meta_og_image_file', ogImageFile); // 上传文件
// 或者
// formData.append('meta_og_image', '/uploads/iphone.jpg'); // 使用字符串路径
formData.append('category_ids[]', '2');

// 上传多张图片
formData.append('images[]', file1);
formData.append('images[]', file2);
formData.append('images[]', file3);

// 指定主图片索引（可选，默认为第一张）
formData.append('main_image_index', '0');

fetch('https://your-domain.com/api/ecommerce/products', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
  },
  body: formData
})
  .then(response => response.json())
  .then(data => console.log(data));
```

## 更新产品示例

### 添加新图片

```bash
curl -X PUT "https://your-domain.com/api/ecommerce/products/1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "name=iPhone 15 Pro" \
  -F "images[]=@/path/to/new-image.jpg" \
  -F "main_image_index=0"
```

### 删除现有图片并添加新图片

```bash
curl -X PUT "https://your-domain.com/api/ecommerce/products/1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "delete_image_ids[]=5" \
  -F "delete_image_ids[]=6" \
  -F "images[]=@/path/to/new-image.jpg"
```

## 使用 Postman

1. 选择请求方法：`POST` 或 `PUT`
2. 输入 URL：`/api/ecommerce/products` 或 `/api/ecommerce/products/{id}`
3. 在 **Body** 标签页，选择 **form-data**
4. 添加产品基本信息的字段（键值对）
5. 对于图片，点击 **Key** 字段，从下拉菜单中选择 **File**
6. 在 **Key** 输入框中输入 `images[]`（注意方括号）
7. 点击 **Select Files** 选择图片文件
8. 可以添加多个 `images[]` 字段来上传多张图片
9. 可选：添加 `main_image_index` 字段（数字）来指定哪张图片是主图片

## 参数说明

### 创建产品 (POST)

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 产品名称 |
| `slug` | string | 是 | URL 友好的标识符 |
| `sku` | string | 是 | 产品 SKU |
| `type` | string | 否 | 产品类型：`single` 或 `package` |
| `description` | string | 否 | 产品描述 |
| `price` | number | 是 | 价格 |
| `cost_price` | number | 否 | 成本价格 |
| `stock` | integer | 否 | 库存数量 |
| `low_stock_threshold` | integer | 否 | 低库存阈值 |
| `is_active` | boolean | 否 | 是否激活（默认：true） |
| `is_featured` | boolean | 否 | 是否精选（默认：false） |
| `meta_title` | string | 否 | SEO 标题 |
| `meta_description` | string | 否 | SEO 描述 |
| `meta_keywords` | string | 否 | SEO 关键词 |
| `meta_og_image` | string | 否 | Open Graph 图片路径（字符串 URL） |
| `meta_og_image_file` | file | 否 | Open Graph 图片文件上传（与 meta_og_image 二选一） |
| `category_ids[]` | array | 否 | 分类 ID 数组 |
| `images[]` | file | 否 | 产品图片数组（可多张） |
| `main_image_index` | integer | 否 | 主图片的索引（从 0 开始），不指定时第一张自动成为主图片 |

### 更新产品 (PUT)

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 产品名称 |
| `slug` | string | 否 | URL 友好的标识符 |
| `sku` | string | 否 | 产品 SKU |
| `type` | string | 否 | 产品类型：`single` 或 `package` |
| `description` | string | 否 | 产品描述 |
| `price` | number | 否 | 价格 |
| `cost_price` | number | 否 | 成本价格 |
| `stock` | integer | 否 | 库存数量 |
| `low_stock_threshold` | integer | 否 | 低库存阈值 |
| `is_active` | boolean | 否 | 是否激活 |
| `is_featured` | boolean | 否 | 是否精选 |
| `meta_title` | string | 否 | SEO 标题 |
| `meta_description` | string | 否 | SEO 描述 |
| `meta_keywords` | string | 否 | SEO 关键词 |
| `meta_og_image` | string | 否 | Open Graph 图片路径（字符串 URL） |
| `meta_og_image_file` | file | 否 | Open Graph 图片文件上传（与 meta_og_image 二选一） |
| `category_ids[]` | array | 否 | 分类 ID 数组 |
| `images[]` | file | 否 | 新上传的图片数组 |
| `main_image_index` | integer | 否 | 新上传图片中主图片的索引 |
| `delete_image_ids[]` | array | 否 | 要删除的图片 ID 数组 |

## 响应示例

```json
{
  "data": {
    "id": 1,
    "name": "iPhone 15",
    "slug": "iphone-15",
    "sku": "IP15-BLACK",
    "type": "single",
    "description": "最新款 iPhone",
    "price": "999.99",
    "cost_price": "800.00",
    "stock": 50,
    "low_stock_threshold": 5,
    "is_active": true,
    "is_featured": false,
    "meta_title": "iPhone 15",
    "meta_description": "最新款 iPhone",
    "meta_keywords": "iphone,phone",
    "meta_og_image": "/uploads/iphone.jpg",
    "images": [
      {
        "id": 1,
        "product_id": 1,
        "image_path": "products/1/abc123.jpg",
        "is_main": true,
        "sort_order": 0
      },
      {
        "id": 2,
        "product_id": 1,
        "image_path": "products/1/def456.jpg",
        "is_main": false,
        "sort_order": 1
      }
    ],
    "categories": [
      {
        "id": 2,
        "name": "电子产品",
        ...
      }
    ],
    ...
  },
  "message": "Product created successfully."
}
```

## 图片访问 URL

上传的图片可以通过以下 URL 访问：

```
https://your-domain.com/storage/products/{product_id}/{filename}
```

例如：
```
https://your-domain.com/storage/products/1/abc123.jpg
```

**注意：** 确保已运行 `php artisan storage:link` 命令来创建存储符号链接。

## 注意事项

1. **必须使用 multipart/form-data 格式**：由于包含文件上传，不能使用 `application/json`
2. **图片数组格式**：使用 `images[]` 作为字段名（注意方括号）
3. **主图片**：如果不指定 `main_image_index`，第一张上传的图片会自动成为主图片
4. **存储位置**：图片存储在 `storage/app/public/products/{product_id}/` 目录
5. **文件大小限制**：每张图片最大 5MB
6. **支持的格式**：jpeg, jpg, png, gif, webp
7. **`images[]` vs `meta_og_image` vs `meta_og_image_file`**：
   - `images[]`：用于上传产品展示图片（多张），会被存储并创建 `ProductImage` 记录
   - `meta_og_image`：SEO 用的 Open Graph 图片路径（字符串），可以是一个外部 URL 路径
   - `meta_og_image_file`：上传 Open Graph 图片文件，文件会被存储到服务器，路径会自动保存到 `meta_og_image` 字段
   - `meta_og_image` 和 `meta_og_image_file` 二选一，如果同时提供，优先使用 `meta_og_image_file`

## 常见问题

### Q: 可以只上传图片而不更新其他字段吗？
A: 可以。在更新产品时，只需要提供 `images[]` 字段即可，其他字段都是可选的。

### Q: 如何设置主图片？
A: 使用 `main_image_index` 参数指定图片数组中的索引（从 0 开始）。如果不指定，第一张图片会自动成为主图片。

### Q: 如何删除图片？
A: 在更新产品时，使用 `delete_image_ids[]` 参数传入要删除的图片 ID 数组。

### Q: 图片路径是什么格式？
A: 图片路径存储在数据库中，格式为：`products/{product_id}/{unique_filename}.{ext}`

