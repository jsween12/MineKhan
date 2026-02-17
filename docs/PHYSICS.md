# Physics

## File
- `src/js/physics.js` (219 lines)

## Overview
Handles player movement, collision detection, and gravity. Called every tick (20 TPS) from the main game loop.

## Tick Flow
```
tickLoop()
├── controls()                        - Read input → velocity
├── runGravity()                      - Apply gravity + jump
└── resolveContactsAndUpdatePosition() - Collide + move
```

## Key Functions

### `controls()`
Reads `state.controlMap` to build a movement vector (`state.move`), applies sprint/fly multipliers, then converts to world-space velocity using `sin(ry)/cos(ry)` rotation. Also clamps pitch/yaw.

### `runGravity()`
Applies `gravityStrength` (-0.091) to `velocity.y`. Caps at `maxYVelocity` (4.5). Triggers jump if on ground + jump pressed.

### `resolveContactsAndUpdatePosition()`
1. Collects all solid block faces near the player into `contacts`
2. Steps through velocity in increments of player width
3. For each axis (Y, X, Z):
   - Move along axis
   - Check collision with `collide()`
   - If colliding: attempt step-up (Y+0.5) for X/Z
   - If sneaking + on ground: prevent walking off edges
4. Applies drag (ground: 0.5, air: 0.85, flying: 0.9)
5. Calls `lookingAt()` to update block targeting

### `collide(faces, compare, index, offset)`
Tests AABB overlap between player and a list of block faces. Returns the collision position or `false`.

### `contacts` object
Accumulates nearby block faces sorted by direction (6 arrays: bottom, top, south, north, east, west). Each face is `[minX, minY, minZ, maxX, maxY, maxZ]` relative to `state.p2`.

## Player Properties Used
- `p.x/y/z` - Position
- `p.velocity` - PVector with `.x/.y/.z/.mag()`
- `p.w` - Half-width (6/16)
- `p.bottomH` (1.62), `p.topH` (0.18) - Bounding box
- `p.onGround`, `p.flying`, `p.sneaking`, `p.spectator`
- `p.speed` (0.11 walk, 0.05 sneak), `p.sprintSpeed` (1.5x), `p.flySpeed` (3.75x)

## State it reads/writes
- `state.p`, `state.p2` - Player position
- `state.controlMap` - Input bindings
- `state.Key` - Raw key state
- `state.world` - For `getBlock()` during collision
- `state.settings.fov` - For sprint FOV change

## Entity Physics

Entities (arrows, dropped items, NPCs) use a separate physics system in `entity.js` that differs from player physics:

### Base Entity Physics (`Entity` class)
- Gravity: Applied in `updateVelocity()` with drag multiplier (0.9)
- Collision: Uses same world block checking as player
- Velocity capping: Limits fall speed to -1.5 blocks/tick
- No step-up behavior (entities can't climb blocks)

### Arrow Physics (`Arrow` class)
Arrows override the default entity physics for realistic projectile behavior:

**Custom Gravity:**
```javascript
updateVelocity(now) {
    this.vely += -0.025 * dt  // Slower gravity than normal entities
    if (this.vely < -2) this.vely = -2  // Higher terminal velocity
    // NO drag applied to X/Z axes (arrows maintain horizontal speed)
}
```

**Collision Detection:**
- Uses `Entity.move()` which handles block collision
- Custom stuck detection: compares expected vs actual movement distance
- If `actualDistance < expectedDistance * 0.5`: arrow has hit something
- Stores stuck position and orientation, zeros all velocity

**Stuck Behavior:**
- Arrow remains at impact point with locked orientation (pitch/yaw)
- Checks each tick if stuck block still exists
- If block destroyed: resumes falling (vely = -0.1)
- 30-second despawn timer starts when stuck

**Key Differences from Player/Base Entity:**
- No air drag (maintains trajectory)
- Lower gravity for longer flight arcs
- Higher terminal velocity
- Collision causes complete stop (stick) rather than slide
