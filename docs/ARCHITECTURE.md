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
    ├── entity.js        - Base entity class
    ├── glUtils.js       - WebGL shader compilation
    ├── indexDB.js       - IndexedDB save/load
    ├── inventory.js     - Inventory system
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
