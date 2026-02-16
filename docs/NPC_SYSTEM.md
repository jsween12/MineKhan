# NPC System

## Files
- `src/js/skinnedPlayer.js` - SkinnedPlayer entity, AI, animation, skin loading (~310 lines)

## Overview

The NPC system adds a skinned character entity with AI behaviors and walk animation. The NPC uses the full Minecraft player model (`shapes.player`) with a dedicated 64x64 skin texture, separate from the block texture atlas.

## Skin System

### Texture Pipeline
1. A 64x64 Minecraft skin is generated procedurally by `generateDefaultSkin()` (or loaded from an image via `loadSkinFromImage()` or `loadSkinFromUrl()`)
2. The skin is scaled to 256x256 texture space — this is required because `shapes.player` UV coordinates are in 256x256 space (64x64 coordinates × 4)
3. `createSkinTexture(gl, pixels256)` uploads the 256x256 RGBA array to a dedicated WebGL texture
4. During render, the skin texture is bound to texture unit 1 (unit 0 keeps the block atlas)
5. The default skin generator (`generateDefaultSkin()`) creates pixel data directly in 256x256 space
6. `loadSkinFromImage()` scales a 64x64 image to fill a 256x256 canvas using nearest-neighbor scaling (no smoothing)

### Minecraft Skin Layout (64x64)
The skin follows the standard Minecraft format:
- **Head** (rows 0-15): Top, bottom, 4 sides at 8x8 pixels each
- **Body** (rows 16-31): 8x12 front/back, 4x12 sides
- **Right Arm** (origin 40,16): 4x12 per face
- **Right Leg** (origin 0,16): 4x12 per face
- **Left Arm** (origin 32,48): Modern skins use separate region; classic skins mirror right arm
- **Left Leg** (origin 16,48): Modern skins use separate region; classic skins mirror right leg
- **Overlay layers** (rows 32-63): Transparent by default; used for hats/accessories

### Loading Custom Skins

The system works with any standard Minecraft skin (64x64 PNG format). Skins are automatically scaled to 256x256 to match the UV coordinate system.

```javascript
import { spawnNPC, loadSkinFromUrl, loadSkinFromImage } from './skinnedPlayer.js'

// From a URL (returns Promise<WebGLTexture>)
const customSkin = await loadSkinFromUrl(gl, "https://example.com/skin.png")
spawnNPC(world, customSkin)

// From an Image element
const img = document.getElementById("skinImage")
const customSkin = loadSkinFromImage(gl, img)
spawnNPC(world, customSkin)

// Use default skin (no custom texture needed)
spawnNPC(world)
```

**Important Notes:**
- Skins must be 64x64 pixels (standard Minecraft format)
- The system automatically scales to 256x256 for rendering
- Modern skins (1.8+) with separate left arm/leg regions are supported
- Classic skins that mirror right side for left side also work
- Overlay layers (rows 32-63) are rendered if present in the skin

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
- Has full physics: gravity, block collision, step-up (1 block), and jump-over (2 blocks)

### `follow`
- Tracks the player's position (`state.p`)
- Walks toward the player when distance > 3 blocks
- Stops and faces the player when within 3 blocks
- Smooth yaw interpolation for natural turning
- Can navigate terrain by stepping over 1-block obstacles and jumping over 2-block obstacles

### Deletion
Setting `canDespawn = true` causes the existing entity cleanup loop in `world.tick()` to remove the NPC on the next tick.

## Movement and Obstacle Navigation

The NPC has intelligent obstacle navigation capabilities that allow it to traverse terrain naturally:

### Step-Up (1 Block)
- When the NPC encounters a 1-block-high obstacle while walking, it automatically steps up onto it
- The system checks if the obstacle is between 0.5 and 1.5 blocks above the entity's feet
- Before stepping up, it verifies that the space above the obstacle is clear for the entity's full bounding box
- The entity's position is adjusted so its feet align with the top of the obstacle
- Works in both X and Z movement directions

### Jump-Over (2 Blocks)
- When the NPC encounters a 2-block-high obstacle, it can jump over it
- Detects when there's 1 block above the obstacle but space above that is clear
- Adds upward velocity (`vely = 0.4`) to jump over the obstacle
- Gravity handles the landing naturally
- The entity must be on the ground to attempt either step-up or jump-over

### Implementation Details
- Obstacle detection happens during horizontal movement collision checks
- The system checks all blocks in the entity's bounding box to ensure safe traversal
- Step-up and jump-over only activate when `onGround` is true
- The logic is implemented in `Entity.move()` in `src/js/entity.js`

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
- `spawnNPC(world, skinTexture = null)` — Creates an NPC 4 blocks in front of the player, adds to `world.entities`, sets `state.npc`. If no `skinTexture` is provided, uses the default skin generator.
- `deleteNPC(world)` — Marks the NPC for despawn, clears `state.npc`
- `setNPCState(aiState)` — Changes AI behavior ("idle", "wander", "follow")

### Tab Menu
Press **Tab** to open the NPC Control menu during gameplay. Buttons:
- **Spawn NPC** — disabled if NPC already exists
- **Idle / Wander / Follow Me** — set AI state (shows [active] indicator)
- **Delete NPC** — disabled if no NPC exists
- **Close** — returns to gameplay

## State Properties
- `state.npc` — Reference to current SkinnedPlayer entity (or null)

## UV Coordinate System

The player model uses standard Minecraft UV coordinates in 256x256 texture space. All coordinates in `shapes.player` are multiplied by 4 from the original 64x64 skin coordinates. See [UV_COORDINATE_MAPPING.md](UV_COORDINATE_MAPPING.md) for complete per-face UV coordinate tables.

**Key Points:**
- UV coordinates are in 256x256 pixel space
- Each face of each body part has specific UV coordinates (not shared)
- Inner and overlay layers use separate UV regions
- Modern skins (1.8+) have separate UV regions for left arm and leg
- Classic skins mirror right side UVs for left side

## Implementation Details

### Texture Scaling
- `generateDefaultSkin()`: Creates pixel data directly in 256x256 space (all coordinates × 4)
- `loadSkinFromImage()`: Takes a 64x64 image and scales it to 256x256 using canvas 2D context
- `loadSkinFromUrl()`: Loads an image from URL then processes via `loadSkinFromImage()`
- Scaling uses nearest-neighbor (no smoothing) to preserve pixel art quality

### Rendering
- Skin texture is bound to WebGL texture unit 1
- Block atlas remains on texture unit 0
- Each body part is rendered with its own transform matrix for animation
- All body parts share a single VAO (Vertex Array Object) for efficiency
