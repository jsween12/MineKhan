# NPC System

## Files
- `src/js/skinnedPlayer.js` - SkinnedPlayer entity, AI, animation, skin loading (~310 lines)

## Overview

The NPC system adds a skinned character entity (currently a panda) with AI behaviors and walk animation. The NPC uses the full Minecraft player model (`shapes.player`) with a dedicated 64x64 skin texture, separate from the block texture atlas.

## Skin System

### Texture Pipeline
1. A 64x64 Minecraft skin is generated procedurally by `generatePandaSkin()` (or loaded from an image via `loadSkinFromImage()`)
2. The 64x64 pixels are placed at (0,0) in a 256x256 texture — this is required because `shapes.player` UV coordinates divide by 256
3. `createSkinTexture(gl, pixels)` uploads the 256x256 RGBA array to a dedicated WebGL texture
4. During render, the skin texture is bound to texture unit 1 (unit 0 keeps the block atlas)

### Minecraft Skin Layout (64x64)
The skin follows the standard Minecraft format:
- **Head** (rows 0-15): Top, bottom, 4 sides at 8x8 pixels each
- **Body** (rows 16-31): 8x12 front/back, 4x12 sides
- **Right Arm** (origin 40,16): 4x12 per face, black for panda
- **Right Leg** (origin 0,16): 4x12 per face, black for panda
- **Left Arm** (origin 32,48): Mirror of right arm
- **Left Leg** (origin 16,48): Mirror of right leg
- **Overlay layers** (rows 32-63): Transparent by default; used for hats/accessories

### Loading Custom Skins
```javascript
import { loadSkinFromUrl, loadSkinFromImage } from './skinnedPlayer.js'

// From a URL (returns Promise<WebGLTexture>)
const tex = await loadSkinFromUrl(gl, "path/to/skin.png")

// From an Image element
const tex = loadSkinFromImage(gl, imageElement)
```

## AI State Machine

The NPC has three behavior states, controlled via `setNPCState(stateName)`:

### `idle`
- Stands still, slowly rotates to look around randomly
- Picks a new target yaw direction every 3-7 seconds
- Smooth rotation interpolation

### `wander`
- Alternates between walking and pausing
- Picks a random direction, walks for 2-4 seconds at speed ~0.04
- Pauses for 1-3 seconds, then picks a new direction
- Has full physics: gravity, block collision, step-up

### `follow`
- Tracks the player's position (`state.p`)
- Walks toward the player when distance > 3 blocks
- Stops and faces the player when within 3 blocks
- Smooth yaw interpolation for natural turning

### Deletion
Setting `canDespawn = true` causes the existing entity cleanup loop in `world.tick()` to remove the NPC on the next tick.

## Walk Animation

The player model's 72 quads (12 per face direction × 6 directions) are organized by body part in a single VAO:

| Body Part | Quad Indices per Direction | Pivot Point |
|-----------|--------------------------|-------------|
| Head | 0, 1 | (0, 1.0, 0) — neck |
| Body | 2, 3 | none (root) |
| Left Arm | 4, 5 | (-0.375, 1.0, 0) — shoulder |
| Right Arm | 6, 7 | (0.375, 1.0, 0) — shoulder |
| Left Leg | 8, 9 | (-0.125, 0.25, 0) — hip |
| Right Leg | 10, 11 | (0.125, 0.25, 0) — hip |

Each body part is drawn as a contiguous range from the single VAO using `gl.drawElements` with byte offset. Each part gets its own model-view-projection matrix with limb-specific rotation:

- Arms swing forward/back (X-axis rotation) opposite to each other
- Legs swing opposite to arms (standard walk cycle)
- Head has a subtle vertical bob
- Swing amplitude: `sin(walkCycle) * 0.6` radians
- Walk cycle increments proportional to horizontal velocity

## NPC Management

### Single NPC Pattern
`state.npc` holds a reference to the current NPC (or `null`). Only one NPC is allowed at a time.

### Helper Functions
- `spawnNPC(world)` — Creates a panda NPC 4 blocks in front of the player, adds to `world.entities`, sets `state.npc`
- `deleteNPC(world)` — Marks the NPC for despawn, clears `state.npc`
- `setNPCState(aiState)` — Changes AI behavior ("idle", "wander", "follow")

### Tab Menu
Press **Tab** to open the NPC Control menu during gameplay. Buttons:
- **Spawn Panda** — disabled if NPC already exists
- **Idle / Wander / Follow Me** — set AI state (shows [active] indicator)
- **Delete NPC** — disabled if no NPC exists
- **Close** — returns to gameplay

## State Properties
- `state.npc` — Reference to current SkinnedPlayer entity (or null)

## Adding New Skins
1. Create a 64x64 PNG following the Minecraft skin layout
2. Either embed pixel data via a generator function (like `generatePandaSkin`) or load at runtime with `loadSkinFromUrl()`
3. Pass the resulting WebGL texture to the `SkinnedPlayer` constructor
