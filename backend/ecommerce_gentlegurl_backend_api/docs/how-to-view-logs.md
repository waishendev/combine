# 如何在 Docker 中查看日志

根据你的配置，日志有两种查看方式：

## 方法 1: 使用 Docker logs 命令（推荐）

因为 `LOG_CHANNEL=stderr`，日志会输出到容器的标准错误流，可以用 Docker logs 查看：

### 查看 Laravel 应用日志
```bash
# 查看所有日志
docker logs laravel_app_prod

# 实时查看日志（类似 tail -f）
docker logs -f laravel_app_prod

# 查看最近 100 行
docker logs --tail 100 laravel_app_prod

# 查看最近 1 小时的日志
docker logs --since 1h laravel_app_prod

# 查看特定时间的日志
docker logs --since "2026-01-26T00:00:00" laravel_app_prod
```

### 查看队列日志
```bash
docker logs -f laravel_queue_prod
```

### 查看 Nginx 日志
```bash
docker logs -f nginx_laravel_prod
```

### 只查看 Billplz 相关的日志
```bash
# 过滤包含 "Billplz" 的日志
docker logs laravel_app_prod 2>&1 | grep -i "billplz"

# 实时查看 Billplz 日志
docker logs -f laravel_app_prod 2>&1 | grep -i "billplz"
```

## 方法 2: 进入容器查看日志文件

即使使用 `stderr`，Laravel 也可能同时写入文件（取决于配置）：

```bash
# 进入 Laravel 应用容器
docker exec -it laravel_app_prod bash

# 查看日志文件
cd /var/www/storage/logs
ls -lah

# 查看最新的日志文件
tail -f laravel.log

# 或者如果是按日期分割的日志
tail -f laravel-2026-01-26.log

# 搜索 Billplz 相关日志
grep -i "billplz" laravel.log
grep -i "billplz" laravel-*.log
```

## 方法 3: 从宿主机直接查看（如果 volume 映射了）

如果 `laravel_storage` volume 映射到了本地目录，可以直接查看：

```bash
# Windows PowerShell
# 查看日志目录（需要找到 volume 的位置）
docker volume inspect combine_laravel_storage

# 或者如果映射到了本地
# 查看日志文件
Get-Content .\storage\logs\laravel.log -Tail 100 -Wait
```

## 方法 4: 使用 Docker Compose 查看

```bash
# 进入项目目录
cd backend/ecommerce_gentlegurl_backend_api

# 查看所有服务日志
docker-compose -f docker-compose-prod.yml logs

# 查看特定服务日志
docker-compose -f docker-compose-prod.yml logs laravel-app

# 实时查看
docker-compose -f docker-compose-prod.yml logs -f laravel-app

# 查看最近 50 行
docker-compose -f docker-compose-prod.yml logs --tail 50 laravel-app
```

## 查找 Billplz 支付回调日志

### 查看签名验证失败的日志
```bash
docker logs laravel_app_prod 2>&1 | grep -i "invalid signature"
```

### 查看支付处理成功的日志
```bash
docker logs laravel_app_prod 2>&1 | grep -i "callback processed successfully"
```

### 查看所有 Billplz 相关日志（包含上下文）
```bash
docker logs laravel_app_prod 2>&1 | grep -A 5 -B 5 -i "billplz"
```

## 实时监控日志（推荐用于调试）

```bash
# 实时查看所有日志，并高亮显示关键词
docker logs -f laravel_app_prod 2>&1 | grep --color=always -E "Billplz|WARNING|ERROR|INFO|invalid signature|processed successfully|$"
```

## 导出日志到文件

```bash
# 导出所有日志
docker logs laravel_app_prod > laravel_logs.txt

# 导出最近 1000 行
docker logs --tail 1000 laravel_app_prod > laravel_logs_recent.txt

# 导出特定时间段的日志
docker logs --since "2026-01-26T00:00:00" --until "2026-01-26T23:59:59" laravel_app_prod > laravel_logs_2026-01-26.txt
```

## 日志级别说明

根据代码中的日志调用：
- `Log::warning()` - 警告日志（黄色）
- `Log::info()` - 信息日志（蓝色）
- `Log::debug()` - 调试日志（灰色）

## 常见日志示例

### 签名验证失败
```
[2026-01-26 00:48:23] production.WARNING: Billplz callback invalid signature
```

### 支付处理成功
```
[2026-01-26 00:48:23] production.INFO: Billplz callback processed successfully
```

### 尽管签名失败但继续处理
```
[2026-01-26 00:48:23] production.WARNING: Billplz callback processing despite signature failure - payment confirmed
```

## 快速命令参考

```bash
# 最常用的命令
docker logs -f laravel_app_prod

# 查看最近的 Billplz 日志
docker logs --tail 200 laravel_app_prod 2>&1 | grep -i billplz

# 进入容器查看文件
docker exec -it laravel_app_prod tail -f /var/www/storage/logs/laravel.log
```
