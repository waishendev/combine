# wkhtmltopdf 安装说明

如果 Docker 构建时在线下载失败，可以手动下载文件。

## 方法 1: 手动下载文件（推荐）

1. 下载静态二进制文件：
   ```bash
   wget https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.static-amd64.tar.xz
   # 或者
   wget https://github.com/wkhtmltopdf/wkhtmltopdf/releases/download/0.12.6-1/wkhtmltox_0.12.6-1.static-amd64.tar.xz
   ```

2. 将文件放到项目根目录：
   ```bash
   cp wkhtmltox_0.12.6-1.static-amd64.tar.xz /usr/share/nginx/combine/backend/ecommerce_gentlegurl_backend_api/
   ```

3. 修改 Dockerfile-prod，使用本地文件：
   ```dockerfile
   # 在安装 wkhtmltopdf 的部分，替换为：
   COPY wkhtmltox_0.12.6-1.static-amd64.tar.xz /tmp/wkhtmltopdf.tar.xz
   RUN set -eux; \
       apk add --no-cache tar xz; \
       cd /tmp && \
       tar -xf wkhtmltopdf.tar.xz && \
       mkdir -p /usr/local/bin && \
       cp wkhtmltox/bin/wkhtmltopdf /usr/local/bin/wkhtmltopdf && \
       chmod +x /usr/local/bin/wkhtmltopdf && \
       ln -sf /usr/local/bin/wkhtmltopdf /usr/bin/wkhtmltopdf && \
       rm -rf /tmp/wkhtmltopdf.tar.xz /tmp/wkhtmltox && \
       wkhtmltopdf --version
   ```

## 方法 2: 使用 Alpine 社区仓库（如果可用）

如果 Alpine 仓库有 wkhtmltopdf 包，可以直接安装：
```dockerfile
RUN apk add --no-cache wkhtmltopdf
```

## 方法 3: 在服务器上手动下载后构建

在服务器上执行：
```bash
cd /usr/share/nginx/combine/backend/ecommerce_gentlegurl_backend_api
wget -O wkhtmltopdf.tar.xz https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.static-amd64.tar.xz
```

然后修改 Dockerfile 使用本地文件（见方法 1）。
