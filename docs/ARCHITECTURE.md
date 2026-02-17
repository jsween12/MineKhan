# MineKhan Architecture

## Overview

MineKhan is a browser-based Minecraft clone built with vanilla JavaScript and WebGL. It runs entirely client-side with an optional multiplayer server.

## Module Dependency Graph

```
main.js (orchestrator)
├── js/state.js          - Shared mutable state + drawing helpers
├── js/camera.js         - Camera class (FOV, frustum, transforms)
├── js/workers.js        - Web Worker pool for cave generation
├── js/renderer.js       - WebGL init, mode switching, icons, shapes
├── js/physics.js        - Collision, gravity, movement
├── js/raytrace.js       - Block targeting, ray tracing, block interaction
├── js/input.js          - Keyboard/mouse/touch handlers, control bindings
├── js/multiplayer.js    - WebSocket, commands, player sync
├── js/world.js          - World class (chunks, lighting, save/load)
├── js/ui/
│   ├── button.js        - Button UI class
│   ├── slider.js        - Slider UI class
│   ├── chat.js          - Chat display, alerts, command routing
│   ├── hud.js           - HUD, crosshair, debug overlay
│   ├── screens.js       - Scene management, transitions
│   └── menus.js         - Button definitions, world/multiplayer menus
└── js/ (existing, unchanged)
    ├── 3Dutils.js       - PVector, Matrix, Plane math
    ├── blockData.js     - Block definitions and properties
    ├── chunk.js         - Chunk class (storage, gen, mesh, light)
    ├── arrow.js         - Arrow projectile entity class
    ├── entity.js        - Base entity class
    ├── glUtils.js       - WebGL shader compilation
    ├── indexDB.js       - IndexedDB save/load
    ├── inventory.js     - Inventory system (see INVENTORY_SYSTEM.md)
    ├── item.js          - Item entity class
    ├── player.js        - Player entity rendering (multiplayer cubes)
    ├── skinnedPlayer.js - NPC entity with Minecraft skin, AI, walk animation
    ├── random.js        - Noise and RNG
    ├── section.js       - Chunk sections
    ├── shapes.js        - Block geometry data
    ├── sky.js           - Skybox rendering
    ├── texture.js       - Texture atlas
    └── utils.js         - Compression, bit arrays
```

## Shared State Pattern

All modules share state through `js/state.js` which exports a single mutable `state` object. This replaces the original closure-variable approach without requiring circular imports.

Key state properties:
- `state.gl`, `state.glCache` - WebGL context and uniform/attribute cache
- `state.world` - Current World instance
- `state.p` - Player/Camera instance
- `state.screen` - Current screen name (e.g. "play", "pause", "main menu")
- `state.settings` - User-configurable settings
- `state.controlMap` - Key binding map
- `state.multiplayer` - WebSocket connection (or null)
- `state.npc` - Current skinned NPC entity (or null)

## Game Loop

```
main.js
├── tickLoop (20 TPS via setInterval)
│   ├── world.tick()        - World gen queues, entity updates (incl. NPC AI)
│   ├── controls()          - Read input, update velocity
│   ├── runGravity()        - Apply gravity
│   └── resolveContacts()   - Collision detection + position update
│
└── renderLoop (requestAnimationFrame)
    ├── drawScreens[screen]()  - Render current screen
    └── analytics update       - FPS, frame time tracking
```

## Build System

The custom bundler in `index.js` (not webpack):
1. Follows imports from `src/main.js`
2. Transforms `import/export` to `window.parent.exports` assignments
3. Inlines everything into `dist/index.html`
4. Watches for changes and auto-rebuilds

Run with: `node index.js` → http://localhost:4000

## Entity System

Entities are objects in the world that can move and be rendered. All entity classes extend the base `Entity` class.

### Entity Types

1. **Item** (`item.js`) - Dropped blocks with physics and bobbing animation
2. **Player** (`player.js`) - Multiplayer player entities (simple cubes)
3. **SkinnedPlayer** (`skinnedPlayer.js`) - NPC with full Minecraft skin, AI, and animations
4. **Arrow** (`arrow.js`) - Projectile entity shot from bow

### Entity Lifecycle

```javascript
// Entities are stored in world.entities[]
world.entities.push(newEntity)

// Updated each tick in world.tick()
for (let entity of world.entities) {
    entity.update()  // Calls updateVelocity() and move()
    if (entity.canDespawn) {
        // Remove from array
    }
}

// Rendered each frame in world.render()
for (let entity of world.entities) {
    entity.render()  // Uses programEntity shader
}
```

## Bow and Arrow System

### Overview
The bow and arrow system adds a projectile weapon that players can use. Arrows are physical entities with gravity-based physics that stick into blocks on impact.

### Components

**Bow Item** (`blockData.js`)
- Added as a block item with `solid: false` and `transparent: true`
- Uses oak planks texture for wooden appearance
- Automatically appears in creative inventory (decor category)
- Block ID: `blockIds.bow`

**Arrow Entity** (`arrow.js`)
- Extends `Entity` base class
- Custom 3D geometry: cylindrical shaft + conical tip + tail fins
- Physics: gravity-only (no air drag) for realistic arc trajectory
- Rendering: rotates to point in flight direction using velocity vector
- Sticking behavior: detects collision and freezes in place on impact
- Lifetime: 30 seconds after sticking before despawn

**Input Handling** (`input.js`)
- Right-click (placeBlock control) is intercepted when bow is held
- Checks `state.holding === blockIds.bow` before normal block placement
- Calls `state.world.shootArrow()` instead of `newWorldBlock()`

**Arrow Spawning** (`world.js`)
- `World.shootArrow()` method creates new Arrow entity
- Spawn position: player's eye position (camera.x, camera.y, camera.z) + 0.5 blocks forward
- Velocity: camera direction vector × 1.5 blocks/tick
- Arrow added to `world.entities[]` for automatic update/render

### Arrow Physics Details

**Flight Phase**
- Gravity: -0.025 per tick (slower than normal entity gravity)
- No air drag applied (maintains horizontal velocity)
- Max fall speed: -2 blocks/tick
- Rotation: dynamically calculated from velocity using `atan2(vely, horizontalDist)` and `atan2(velx, velz)`

**Collision Detection**
- Uses base `Entity.move()` collision from entity.js
- Compares expected distance vs actual distance moved
- If actual < 50% of expected: arrow has hit something
- Collision threshold: prevents false positives from slow arrows

**Stuck Behavior**
- Stores stuck position (stuckX, stuckY, stuckZ) and orientation (pitch, yaw)
- Zeros all velocity components
- Checks each tick if stuck block still exists (`world.getBlock()`)
- If block destroyed: arrow resumes falling and can stick again
- Despawn timer starts when stuck (30 second lifetime)

### Usage
1. Open creative inventory (E key)
2. Select bow item from decor category
3. Place in hotbar
4. Right-click while holding bow to shoot arrow
5. Arrows follow ballistic trajectory and stick into blocks
6. Breaking the block causes arrow to fall

### Implementation Notes
- Arrows currently have infinite ammo (no inventory count yet)
- No entity-to-entity collision (arrows pass through NPCs/players)
- Texture binding uses `state.blockAtlasTexture` with entity shader
- Arrow geometry created procedurally with 8-segment cylinders/cones
