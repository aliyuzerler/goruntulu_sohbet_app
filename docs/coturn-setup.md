# RandChat — coturn Setup (TURN Server Fallback)

## Overview

coturn is a free open-source TURN (Traversal Using Relays around NAT) server.
RandChat uses Agora for primary RTC, but coturn is configured as a **fallback TURN relay**
for edge cases where Agora's media servers are unreachable (corporate firewalls, restrictive NATs).

## Docker Setup

### 1. coturn config file

See `infra/coturn/turnserver.conf` for the full config.

### 2. Docker Compose integration

Add to `infra/docker-compose.yml`:

```yaml
  coturn:
    image: coturn/coturn:4.6
    container_name: randchat-coturn
    restart: unless-stopped
    network_mode: host  # Required for TURN to work (needs public IP for relay)
    volumes:
      - ./coturn/turnserver.conf:/etc/turnserver.conf:ro
    ports:
      - '3478:3478'     # TURN/STUN UDP+TCP
      - '3478:3478/udp'
      - '5349:5349'     # TURNS (TURN over TLS)
      - '5349:5349/udp'
      - '49152-49200:49152-49200/udp'  # Relay port range
```

### 3. Generate TURN credentials

The API generates per-call TURN credentials (HMAC-SHA1 of (username, expiry)):
- username: `<callId>-<userId>` (expires in 1h)
- credential: HMAC-SHA1(secret, username)

Set `TURN_STATIC_AUTH_SECRET` in `.env` (shared between API + coturn).

### 4. Production deployment

In production, deploy coturn on a dedicated server with:
- Public IP (not behind NAT)
- UDP ports 3478 + 49152-49200 open
- TLS cert for TURNS (Let's Encrypt or self-signed for internal use)

## Agora fallback configuration

In `AgoraVideoCallService` (Flutter), configure TURN servers as fallback:

```dart
await _engine!.setParameters(jsonEncode({
  "rtc": {
    "turn": {
      "Enable": true,
      "Server": [{"host": "turn:your-server.com:3478", "username": "...", "credential": "..."}]
    }
  }
}));
```

The API exposes `GET /api/calls/:id/turn-credentials` (Phase 12 stub) that returns
per-call TURN credentials for the Agora SDK to use as fallback.
