#!/usr/bin/env sh

docker container stop sonos
docker container rm sonos
docker pull ghcr.io/lukekarrys/node-sonos-http-api:latest
./scripts/run.sh
