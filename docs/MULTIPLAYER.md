# Multiplayer

## Files
- `src/js/multiplayer.js` - WebSocket, commands, player sync (280 lines)
- `src/js/ui/chat.js` - Chat display and command routing (99 lines)

## Connection Flow
1. User clicks "Open World To Public" (host) or selects a server (client)
2. `initMultiplayer(target)` checks login via `loggedIn()`
3. Opens WebSocket to `wss://willard.fun/ws?target=<worldId>`
4. Host sends world save data to new joiners
5. Position updates sent every 500ms

## Packet Types (JSON over WebSocket)

### Client → Server
| Type | Data | Description |
|------|------|-------------|
| `connect` | `{ password }` | Join a world |
| `init` | `{ name, version, password }` | Host announces world |
| `pos` | `{ x, y, z, vx, vy, vz }` | Position update (every 500ms) |
| `setBlock` | `[x, y, z, blockID]` | Block placement/break |
| `chat` | `string` | Chat message |
| `ban` | `username` | Ban a player (host only) |
| `fetchUsers` | - | Request online user list |

### Server → Client
| Type | Data | Description |
|------|------|-------------|
| `setBlock` | `[x, y, z, blockID, ...]` | Block update from another player |
| `pos` | `{ x, y, z, vx, vy, vz }` | Another player's position |
| `connect` | - | Player joined notification |
| `dc` | - | Player disconnected |
| `users` | `[name, ...]` | Online user list |
| `chat` | `string` | Chat from another player |
| `error` | `string` | Error message |
| `eval` | `string` | Server-only code execution |
| `ping` | - | Keepalive (respond with "pong") |

Binary messages: Host sends world save as ArrayBuffer to joining clients.

## Chat Commands

Registered via `addCommand(name, callback, usage, description, autocomplete)`.

| Command | Usage | Description |
|---------|-------|-------------|
| `/help` | `/help <cmd>` | Show command usage |
| `/ban` | `/ban <username>` | Ban player (host only) |
| `/online` | `/online` | List online players |
| `/history` | `/history [dist=20]` | Show nearby block edit history |
| `/undo` | `/undo [user] <count>` | Undo block edits |
| `/fill` | `/fill [shape] [solid\|hollow]` | Fill region (cuboid/sphere/cylinder) |
| `/time` | `/time [dawn\|noon\|dusk\|night\|N]` | Get/set world time |

## Player Sync
- `state.playerPositions` - Map of username → `{x, y, z, vx, vy, vz}`
- `state.playerEntities` - Map of username → Player entity (for rendering)
- `state.playerDistances` - Sorted list for HUD display
- Remote players rendered as block-textured cubes via Player class

## State it reads/writes
- `state.multiplayer` - WebSocket instance (null if offline)
- `state.currentUser` - `{ username }` from login
- `state.blockLog` - Per-user block edit history (for undo/history)
- `state.playerPositions/Entities/Distances`
- `state.world` - For applying remote block changes
