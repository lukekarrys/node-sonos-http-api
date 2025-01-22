#!/usr/bin/env sh

docker run --net=host --name sonos --restart=always -d ghcr.io/lukekarrys/node-sonos-http-api:latest
