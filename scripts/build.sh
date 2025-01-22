#!/usr/bin/env sh

npm run test
docker build . --tag ghcr.io/lukekarrys/node-sonos-http-api:latest --platform linux/x86_64
