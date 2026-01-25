#!/bin/bash
# 在服务器上运行此脚本来下载 wkhtmltopdf 文件

cd /usr/share/nginx/combine/backend/ecommerce_gentlegurl_backend_api

echo "Downloading wkhtmltopdf..."

# 尝试多个下载源
wget -O wkhtmltopdf.tar.xz "https://github.com/wkhtmltopdf/wkhtmltopdf/releases/download/0.12.4/wkhtmltox-0.12.4_linux-generic-amd64.tar.xz" || \
wget -O wkhtmltopdf.tar.xz "https://github.com/wkhtmltopdf/wkhtmltopdf/releases/download/0.12.5/wkhtmltox_0.12.5-1.static-amd64.tar.xz" || \
wget -O wkhtmltopdf.tar.xz "https://github.com/wkhtmltopdf/wkhtmltopdf/releases/download/0.12.6-1/wkhtmltox-0.12.6-1.static-amd64.tar.xz"

if [ -f wkhtmltopdf.tar.xz ] && [ -s wkhtmltopdf.tar.xz ]; then
    echo "✓ Download successful!"
    echo "File size: $(du -h wkhtmltopdf.tar.xz | cut -f1)"
    echo "Now you can rebuild: docker compose --env-file .env.production -f docker-compose-prod.yml up -d --build"
else
    echo "✗ Download failed. Please try manual download or check network connectivity."
fi
