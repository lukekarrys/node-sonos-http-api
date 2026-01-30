# node-sonos-https API

Originally forked from [jishi/node-sonos-http-api](https://github.com/jishi/node-sonos-http-api). This is a stripped down rewrite that uses [@svrooij/sonos](https://github.com/svrooij/node-sonos-ts) for Sonos management.

## Routes

### General

| Method | Route                   | Description                        |
| ------ | ----------------------- | ---------------------------------- |
| GET    | `/hc`                   | Health check                       |
| GET    | `/devices`              | Get all devices                    |
| GET    | `/devices/name`         | Get device names                   |
| GET    | `/devices/name/arduino` | Get device names in Arduino format |

### Device Routes

All device routes are prefixed with `/d/:device` where `:device` is the device name.

#### Playback Actions

| Method | Route              | Description                                                                                       |
| ------ | ------------------ | ------------------------------------------------------------------------------------------------- |
| POST   | `/play`            | Start playback                                                                                    |
| POST   | `/pause`           | Pause playback                                                                                    |
| POST   | `/toggle-playback` | Toggle play/pause                                                                                 |
| POST   | `/next`            | Skip to next track                                                                                |
| POST   | `/prev`            | Go to previous track                                                                              |
| POST   | `/playmode/:param` | Set play mode (`shuffle`, `repeat`, `repeatone`, `normal`, `shufflenorepeat`, `shufflerepeatone`) |

#### Queue Management

| Method | Route                   | Description                                                                                  |
| ------ | ----------------------- | -------------------------------------------------------------------------------------------- |
| POST   | `/replace-queue/:param` | Replace queue with URI from param                                                            |
| POST   | `/replace-queue`        | Replace queue with music URL from body (`url`, optional `play`, `playMode`, `shuffleOnType`) |

#### Getters

| Method | Route    | Description       |
| ------ | -------- | ----------------- |
| GET    | `/info`  | Get device state  |
| GET    | `/queue` | Get current queue |

#### Arduino Routes (GET-based actions)

| Method | Route               | Description                               |
| ------ | ------------------- | ----------------------------------------- |
| GET    | `/previous`         | Go to previous track                      |
| GET    | `/next`             | Skip to next track                        |
| GET    | `/playpause`        | Toggle play/pause                         |
| GET    | `/togglemute`       | Toggle mute                               |
| GET    | `/volume/:delta`    | Adjust volume by delta (e.g., `+5`, `-5`) |
| GET    | `/shuffle/toggle`   | Toggle shuffle mode                       |
| GET    | `/repeat/toggle`    | Cycle repeat mode (Off → All → One → Off) |
| GET    | `/trackseek/:track` | Seek to track number in queue             |

#### Server-Sent Events

| Method | Route            | Description                                                             |
| ------ | ---------------- | ----------------------------------------------------------------------- |
| GET    | `/events`        | SSE stream for all events (transport-state, volume-change, mute-change) |
| GET    | `/events/volume` | SSE stream for volume changes only                                      |

## Deploying

**Build docker image**

```shell
./scripts/build.sh
```

**Run docker image**

```shell
./scripts/run.sh
```

**Push docker image**

```shell
./scripts/push.sh
```
