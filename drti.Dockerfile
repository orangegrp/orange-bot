FROM node:20-alpine3.19
RUN adduser --disabled-password --home /home/container container
RUN echo https://dl-cdn.alpinelinux.org/alpine/v3.19/main > /etc/apk/repositories
RUN echo https://dl-cdn.alpinelinux.org/alpine/v3.19/community >> /etc/apk/repositories
RUN echo @edge https://dl-cdn.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories
RUN echo @edge https://dl-cdn.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories
WORKDIR /home/container
RUN apk add --no-cache --update udev ttf-freefont chromium@edge nss@edge fontconfig pango-dev libxcursor libxdamage cups-libs dbus-libs libxrandr libxscrnsaver libc6-compat
RUN npm install -g typescript
CMD ["echo", "orange🟠 Docker Runtime Image (DRTI)"]