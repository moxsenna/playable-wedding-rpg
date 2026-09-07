# REALTIME_PROTOCOL.md
## Wedding Room Protocol V1

## 1. Transport

WebSocket connection terminates at Cloudflare Worker / WeddingRoom Durable Object.

Room key concept:

```text
wedding:{projectPublicRoomId}:{mapId}
```

Do not use user-editable slug alone as a security boundary.

## 2. Authorization

Connection upgrade resolves project + guest/public access server-side.

Never trust client-supplied:
- guest identity
- display name
- project ID
- room ID

Nametag identity is server canonical.

## 3. Connection Lifecycle

```text
CONNECTING
→ AUTHENTICATING
→ JOINED
→ ACTIVE
→ RECONNECTING
→ CLOSED
```

Realtime is optional enhancement.
Local game remains usable without it.

## 4. Envelope

V1 uses bounded JSON.

```ts
type RealtimeEnvelope<T> = {
  v: 1;
  type: string;
  seq?: number;
  ts?: number;
  payload: T;
};
```

All inbound messages:
- Zod validated
- size bounded
- enum allowlisted

## 5. Client → Server

### `client.hello`

```json
{
  "v": 1,
  "type": "client.hello",
  "payload": {
    "mapId": "garden-village-v1",
    "avatarId": "guest_01",
    "clientVersion": "1.0.0"
  }
}
```

Avatar may be accepted only if allowed for wedding.

### `player.move`

Default target send interval: ~100 ms while moving.

```json
{
  "v": 1,
  "type": "player.move",
  "seq": 120,
  "ts": 1780000000000,
  "payload": {
    "x": 412.4,
    "y": 731.2,
    "vx": 82,
    "vy": 0,
    "facing": "right",
    "movement": "walk"
  }
}
```

Never send every render frame.

### `player.idle`

Send immediately after movement stops.

```json
{
  "v": 1,
  "type": "player.idle",
  "seq": 121,
  "payload": {
    "x": 420,
    "y": 731,
    "facing": "right"
  }
}
```

### `player.emote`

```json
{
  "v": 1,
  "type": "player.emote",
  "payload": { "emote": "wave" }
}
```

Allowed:
```text
wave
heart
celebrate
laugh
blessing
```

Rate limited.

### `client.ping`
Optional app-level heartbeat only if needed.

## 6. Server → Client

### `room.welcome`

```json
{
  "v": 1,
  "type": "room.welcome",
  "payload": {
    "self": {
      "playerId": "p_...",
      "displayName": "Dinda",
      "avatarId": "guest_01"
    },
    "room": {
      "mapId": "garden-village-v1",
      "onlineCount": 8
    },
    "players": []
  }
}
```

### `player.joined`

```json
{
  "v": 1,
  "type": "player.joined",
  "payload": {
    "playerId": "p_...",
    "displayName": "Maya",
    "avatarId": "guest_03",
    "x": 300,
    "y": 800,
    "facing": "up"
  }
}
```

### `player.snapshot`

```json
{
  "v": 1,
  "type": "player.snapshot",
  "seq": 44,
  "ts": 1780000000020,
  "payload": {
    "playerId": "p_...",
    "x": 315.2,
    "y": 784.8,
    "vx": 0,
    "vy": -78,
    "facing": "up",
    "movement": "walk"
  }
}
```

### `player.left`

```json
{
  "v": 1,
  "type": "player.left",
  "payload": { "playerId": "p_..." }
}
```

### `player.emote`

```json
{
  "v": 1,
  "type": "player.emote",
  "payload": {
    "playerId": "p_...",
    "emote": "wave",
    "expiresAt": 1780000002000
  }
}
```

### `room.presence`

```json
{
  "v": 1,
  "type": "room.presence",
  "payload": { "onlineCount": 12 }
}
```

### `server.error`
Safe code/message only.
No stack trace.

## 7. Room State

```ts
type RoomPlayer = {
  connectionId: string;
  playerId: string;
  guestId?: string;
  displayName: string;
  avatarId: string;
  mapId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Direction;
  movement: MovementState;
  lastSeq: number;
  lastUpdateAt: number;
};
```

Do not write this to PostgreSQL every tick.

## 8. Movement Validation

Server validates:
- finite coordinates
- world bounds
- max displacement vs elapsed time
- velocity budget
- monotonic sequence
- allowed enums
- message rate

Server may:
- clamp
- ignore
- strike/disconnect abusive clients

V1 server does not simulate full Phaser collision map.

## 9. Identity Security

Clients cannot choose another user's:
- playerId
- guestId
- canonical displayName

Room join authorization controls wedding scope.

## 10. Interest Management

Phase A:
- DO tracks all room players
- broadcasts broadly
- client renders nearest capped set

Phase B only if measurement requires:
- grid/spatial cell subscriptions

Do not over-engineer Phase B before data.

## 11. Snapshot Buffer

Per remote:

```ts
type TransformSnapshot = {
  serverTs: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Direction;
  movement: MovementState;
};
```

Keep a small rolling ordered buffer.

## 12. Interpolation

Render target:

```text
renderTime = estimatedServerNow - interpolationDelay
```

Initial delay:
~100–150 ms.

Between A and B:

```text
t = (renderTime - A.ts) / (B.ts - A.ts)
x = lerp(A.x, B.x, t)
y = lerp(A.y, B.y, t)
```

If B absent:
- short bounded extrapolation
- then settle

Do not teleport on each ~10 Hz snapshot.

## 13. Local Prediction

Local movement is immediate.

Server reconciliation is minimal because V1 is noncompetitive.

Any future correction:
- soft if small
- hard snap only for extreme invalid delta

## 14. Network Throttle

```text
while moving:
  snapshot ~ every 100 ms

on stop:
  immediate idle

if unchanged:
  do not send
```

## 15. Durable Object Hibernation

Use WebSocket Hibernation API where appropriate.

Code must not assume ordinary in-memory JS state survives hibernation.

Connection metadata needed after wake must be reconstructable from:
- WebSocket attachments
- DO storage when necessary
- client resync

Do not move wedding business records into DO storage.

## 16. Reconnect

Client:
- exponential backoff
- cap
- jitter
- reauthorize if needed
- fresh `room.welcome` after rejoin

During reconnect:
- local game works
- subtle HUD status only

## 17. Duplicate Guest Connections

V1 recommended policy:
- allow multiple connection instances
- unique ephemeral playerId per connection
- same display name may appear twice

Avoid tab-kicking complexity initially.

## 18. Rate Limits

Bound:
- movement packets
- emote frequency
- malformed message strikes
- message size

No frame-rate network flood.

## 19. Protocol Version

`v: 1`

Breaking changes increment major protocol version.

## 20. Multiplayer E2E

Two contexts Dinda/Maya must prove:

1. both join same room
2. each sees other
3. Dinda moves
4. Maya sees smooth movement
5. Dinda waves
6. Maya sees emote
7. Maya disconnects
8. Dinda removes Maya
9. local quest continues

If realtime service fails:
- local world works
- Wedding Book works
- RSVP works
