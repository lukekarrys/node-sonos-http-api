FROM node:23.6.0-alpine
LABEL org.opencontainers.image.source="https://github.com/lukekarrys/node-sonos-http-api"

WORKDIR /app
COPY .gitignore /app/.dockerignore
COPY . /app

RUN apk add --no-cache curl && \
  npm install --production && \
  rm -rf /tmp/* /root/.npm

EXPOSE 5005

USER node

HEALTHCHECK --interval=1m --timeout=2s \
  CMD curl -LSfs http://localhost:5005/hc || exit 1

CMD node src/index.ts
