# API Documentation

## Postman Collection

这个文件夹包含可以导入到 Postman 的 API Collection 文件。

### 导入方法

1. 打开 Postman
2. 点击左上角的 **Import** 按钮
3. 选择 `postman_collection.json` 文件
4. Collection 将被导入到你的 Postman 工作区

### 配置环境变量

Collection 使用了一个环境变量 `base_url`，默认值为 `http://localhost:8000`。

你可以在 Postman 中：
1. 创建或选择一个环境
2. 添加变量 `base_url`，设置为你的 API 服务器地址
3. 例如：`http://localhost:8000` 或 `https://your-domain.com`

### 使用说明

#### 认证

由于这个 API 使用基于 Session 的认证（statefulApi），你需要：

1. 首先调用 **Login** 端点进行登录
2. Postman 会自动保存 session cookie
3. 之后的所有需要认证的请求都会自动使用这个 session

#### 权限要求

大部分端点都需要特定的权限：
- **Admins**: 需要 `users.view`, `users.create`, `users.update`, `users.delete`
- **Roles**: 需要 `roles.view`, `roles.create`, `roles.update`, `roles.delete`
- **Permissions**: 需要 `permissions.view`, `permissions.create`, `permissions.update`, `permissions.delete`
- **Permission Groups**: 需要 `permission-groups.view`, `permission-groups.create`, `permission-groups.update`, `permission-groups.delete`

### API 端点列表

#### Authentication
- `POST /api/login` - 登录
- `POST /api/logout` - 登出
- `GET /api/profile` - 获取当前用户信息

#### Admins
- `GET /api/admins` - 获取管理员列表
- `POST /api/admins` - 创建管理员
- `GET /api/admins/{admin}` - 获取单个管理员
- `PUT /api/admins/{admin}` - 更新管理员
- `DELETE /api/admins/{admin}` - 删除管理员

#### Roles
- `GET /api/roles` - 获取角色列表
- `POST /api/roles` - 创建角色
- `GET /api/roles/{role}` - 获取单个角色
- `PUT /api/roles/{role}` - 更新角色
- `DELETE /api/roles/{role}` - 删除角色

#### Permissions
- `GET /api/permissions` - 获取权限列表
- `POST /api/permissions` - 创建权限
- `GET /api/permissions/{permission}` - 获取单个权限
- `PUT /api/permissions/{permission}` - 更新权限
- `DELETE /api/permissions/{permission}` - 删除权限

#### Permission Groups
- `GET /api/permission-groups` - 获取权限组列表
- `POST /api/permission-groups` - 创建权限组
- `GET /api/permission-groups/{group}` - 获取单个权限组
- `PUT /api/permission-groups/{group}` - 更新权限组
- `DELETE /api/permission-groups/{group}` - 删除权限组

