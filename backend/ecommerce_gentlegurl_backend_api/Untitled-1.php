extracting sha256:08e58fd9b933390b21c31e1846cd62e14956210861368efebbb16106444c1d26                  0.0s 
 => [laravel-queue php-extensions 2/9] WORKDIR /var/www                                                    0.2s 
 => [laravel-queue php-extensions 3/9] RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >>   7.2s 
 => [laravel-queue php-extensions 4/9] RUN apk add --no-cache     icu-libs     libzip     libpng     oni  17.0s 
 => ERROR [laravel-queue php-extensions 5/9] RUN apk add --no-cache wget ca-certificates &&     ALPINE_VE  2.0s 
------
 > [laravel-queue php-extensions 5/9] RUN apk add --no-cache wget ca-certificates &&     ALPINE_VERSION=$(cat /etc/alpine-release | cut -d'.' -f1,2) &&     ALPINE_MAJOR=$(echo $ALPINE_VERSION | cut -d'.' -f1) &&     ALPINE_MINOR=$(echo $ALPINE_VERSION | cut -d'.' -f2) &&     if [ "$ALPINE_MAJOR" = "3" ] && [ "$ALPINE_MINOR" -ge "17" ]; then         ALPINE_VER="3.17";     elif [ "$ALPINE_MAJOR" = "3" ] && [ "$ALPINE_MINOR" -ge "16" ]; then         ALPINE_VER="3.16";     else         ALPINE_VER="3.17";     fi &&     WKHTML_VERSION="0.12.6.1-3" &&     ARCH="amd64" &&     wget -q "https://github.com/wkhtmltopdf/packaging/releases/download/${WKHTML_VERSION}/wkhtmltox-${WKHTML_VERSION}.alpine${ALPINE_VER}-${ARCH}.apk" -O /tmp/wkhtmltopdf.apk &&     apk add --allow-untrusted /tmp/wkhtmltopdf.apk &&     rm /tmp/wkhtmltopdf.apk &&     WKHTML_BIN=$(which wkhtmltopdf 2>/dev/null || find /usr -name wkhtmltopdf -type f 2>/dev/null | head -1) &&     if [ -n "$WKHTML_BIN" ] && [ "$WKHTML_BIN" != "/usr/bin/wkhtmltopdf" ]; then         ln -sf "$WKHTML_BIN" /usr/bin/wkhtmltopdf;     fi &&     if ! command -v wkhtmltopdf >/dev/null 2>&1; then         echo "ERROR: wkhtmltopdf installation failed!" && exit 1;     fi &&     wkhtmltopdf --version &&     echo "wkhtmltopdf installed successfully at $(which wkhtmltopdf)" &&     apk del wget ca-certificates:
1.516 (1/1) Installing wget (1.25.0-r2)
1.571 Executing busybox-1.37.0-r30.trigger
1.586 OK: 176.6 MiB in 157 packages
------
Dockerfile-prod:32
--------------------
  31 |     # 检测 Alpine 版本并下载对应的包
  32 | >>> RUN apk add --no-cache wget ca-certificates && \
  33 | >>>     ALPINE_VERSION=$(cat /etc/alpine-release | cut -d'.' -f1,2) && \
  34 | >>>     ALPINE_MAJOR=$(echo $ALPINE_VERSION | cut -d'.' -f1) && \
  35 | >>>     ALPINE_MINOR=$(echo $ALPINE_VERSION | cut -d'.' -f2) && \
  36 | >>>     if [ "$ALPINE_MAJOR" = "3" ] && [ "$ALPINE_MINOR" -ge "17" ]; then \
  37 | >>>         ALPINE_VER="3.17"; \
  38 | >>>     elif [ "$ALPINE_MAJOR" = "3" ] && [ "$ALPINE_MINOR" -ge "16" ]; then \
  39 | >>>         ALPINE_VER="3.16"; \
  40 | >>>     else \
  41 | >>>         ALPINE_VER="3.17"; \
  42 | >>>     fi && \
  43 | >>>     WKHTML_VERSION="0.12.6.1-3" && \
  44 | >>>     ARCH="amd64" && \
  45 | >>>     wget -q "https://github.com/wkhtmltopdf/packaging/releases/download/${WKHTML_VERSION}/wkhtmltox-${WKHTML_VERSION}.alpine${ALPINE_VER}-${ARCH}.apk" -O /tmp/wkhtmltopdf.apk && \
  46 | >>>     apk add --allow-untrusted /tmp/wkhtmltopdf.apk && \
  47 | >>>     rm /tmp/wkhtmltopdf.apk && \
  48 | >>>     WKHTML_BIN=$(which wkhtmltopdf 2>/dev/null || find /usr -name wkhtmltopdf -type f 2>/dev/null | head -1) && \
  49 | >>>     if [ -n "$WKHTML_BIN" ] && [ "$WKHTML_BIN" != "/usr/bin/wkhtmltopdf" ]; then \
  50 | >>>         ln -sf "$WKHTML_BIN" /usr/bin/wkhtmltopdf; \
  51 | >>>     fi && \
  52 | >>>     if ! command -v wkhtmltopdf >/dev/null 2>&1; then \
  53 | >>>         echo "ERROR: wkhtmltopdf installation failed!" && exit 1; \
  54 | >>>     fi && \
  55 | >>>     wkhtmltopdf --version && \
  56 | >>>     echo "wkhtmltopdf installed successfully at $(which wkhtmltopdf)" && \
  57 | >>>     apk del wget ca-certificates
  58 |
--------------------
target laravel-queue: failed to solve: process "/bin/sh -c apk add --no-cache wget ca-certificates &&     ALPINE_VERSION=$(cat /etc/alpine-release | cut -d'.' -f1,2) &&     ALPINE_MAJOR=$(echo $ALPINE_VERSION | cut -d'.' -f1) &&     ALPINE_MINOR=$(echo $ALPINE_VERSION | cut -d'.' -f2) &&     if [ \"$ALPINE_MAJOR\" = \"3\" ] && [ \"$ALPINE_MINOR\" -ge \"17\" ]; then         ALPINE_VER=\"3.17\";     elif [ \"$ALPINE_MAJOR\" = \"3\" ] && [ \"$ALPINE_MINOR\" -ge \"16\" ]; then         ALPINE_VER=\"3.16\";     else         ALPINE_VER=\"3.17\";     fi &&     WKHTML_VERSION=\"0.12.6.1-3\" &&     ARCH=\"amd64\" &&     wget -q \"https://github.com/wkhtmltopdf/packaging/releases/download/${WKHTML_VERSION}/wkhtmltox-${WKHTML_VERSION}.alpine${ALPINE_VER}-${ARCH}.apk\" -O /tmp/wkhtmltopdf.apk &&     apk add --allow-untrusted /tmp/wkhtmltopdf.apk &&     rm /tmp/wkhtmltopdf.apk &&     WKHTML_BIN=$(which wkhtmltopdf 2>/dev/null || find /usr -name wkhtmltopdf -type f 2>/dev/null | head -1) &&     if [ -n \"$WKHTML_BIN\" ] && [ \"$WKHTML_BIN\" != \"/usr/bin/wkhtmltopdf\" ]; then         ln -sf \"$WKHTML_BIN\" /usr/bin/wkhtmltopdf;     fi &&     if ! command -v wkhtmltopdf >/dev/null 2>&1; then         echo \"ERROR: wkhtmltopdf installation failed!\" && exit 1;     fi &&     wkhtmltopdf --version &&     echo \"wkhtmltopdf installed successfully at $(which wkhtmltopdf)\" &&     apk del wget ca-certificates" did not complete successfully: exit code: 8  

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/u6cjean80cjgjcpdg5mrm4xxl      
PS C:\Users\WS\Desktop\test\ccc\combine\backend\ecommerce_gentlegurl_backend_api> 