#!/bin/sh
set -e

# 如果 node_modules 不存在或为空，安装依赖
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules)" ]; then
  echo "Installing dependencies..."
  npm ci --ignore-scripts --no-audit --no-fund
fi

# 执行传入的命令
exec "$@"

