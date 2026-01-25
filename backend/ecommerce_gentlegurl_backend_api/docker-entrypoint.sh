#!/bin/sh
set -e

# 修复 storage 目录权限
# 当使用命名卷时，首次挂载可能权限不正确
if [ -d /var/www/storage ]; then
    echo "Fixing storage directory permissions..."

    # 确保所有必要的 storage 子目录存在
    mkdir -p /var/www/storage/framework/views
    mkdir -p /var/www/storage/framework/cache/data
    mkdir -p /var/www/storage/framework/sessions
    mkdir -p /var/www/storage/framework/testing
    mkdir -p /var/www/storage/logs
    mkdir -p /var/www/storage/app/public
    mkdir -p /var/www/storage/app/private

    # 修复权限（如果当前用户是 root，则修改为 www-data）
    if [ "$(id -u)" = "0" ]; then
        chown -R www-data:www-data /var/www/storage
        chmod -R 775 /var/www/storage
        echo "Storage directory permissions fixed (as root)."
    else
        # 如果不是 root，尝试修复权限（可能已经正确）
        chmod -R 775 /var/www/storage 2>/dev/null || true
        echo "Storage directory permissions checked (as $(id -un))."
    fi
fi

# 修复 bootstrap/cache 目录权限
if [ -d /var/www/bootstrap/cache ]; then
    echo "Fixing bootstrap/cache directory permissions..."
    if [ "$(id -u)" = "0" ]; then
        chown -R www-data:www-data /var/www/bootstrap/cache
        chmod -R 775 /var/www/bootstrap/cache
        echo "Bootstrap/cache directory permissions fixed (as root)."
    else
        chmod -R 775 /var/www/bootstrap/cache 2>/dev/null || true
        echo "Bootstrap/cache directory permissions checked (as $(id -un))."
    fi
fi

# 如果以 root 运行，切换到 www-data 用户执行命令
if [ "$(id -u)" = "0" ]; then
    # 使用 su-exec（Alpine 的轻量级 su 替代品）切换到 www-data
    # su-exec 已经在 Dockerfile 中安装
    exec su-exec www-data "$@"
else
    # 已经以正确用户运行，直接执行
    exec "$@"
fi
