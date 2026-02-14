# MineKhan

A browser-based Minecraft clone built with vanilla JavaScript and WebGL. Originally created by [Willard21](https://github.com/Willard21/MineKhan) for Khan Academy — this fork is a personal playground for experimenting with the codebase, learning game engine architecture, and hacking on new features.

## Running Locally

```bash
npm install
node index.js
```

Open http://localhost:4000. The bundler watches `src/` for changes and auto-rebuilds on save.

## Project Structure

The codebase has been refactored from the original monolithic `main.js` into focused modules:

```
src/
├── main.js              # Orchestrator (~290 lines) — game loop, init
├── js/
│   ├── state.js         # Shared mutable state + drawing helpers
│   ├── camera.js        # Camera, FOV, frustum culling
│   ├── world.js         # World class — chunks, lighting, save/load
│   ├── physics.js       # Collision, gravity, movement
│   ├── raytrace.js      # Block targeting and interaction
│   ├── renderer.js      # WebGL init, shaders, icons
│   ├── input.js         # Keyboard/mouse/touch, control bindings
│   ├── multiplayer.js   # WebSocket, commands, player sync
│   ├── workers.js       # Web Worker pool for cave generation
│   ├── ui/
│   │   ├── button.js    # Button UI class
│   │   ├── slider.js    # Slider UI class
│   │   ├── screens.js   # Scene management and transitions
│   │   ├── hud.js       # HUD, crosshair, debug overlay
│   │   ├── menus.js     # Menu definitions, world selection
│   │   └── chat.js      # Chat display, alerts, commands
│   └── (existing modules: chunk, blockData, shapes, inventory, etc.)
├── shaders/             # GLSL vertex/fragment shaders
├── workers/             # Cave generation WebWorker (WASM)
└── c/                   # C source for cave noise (compiled to WASM)
```

## Documentation

Detailed docs for each major system live in the `docs/` folder. These are designed to be attached as context when using AI tools, so you can ask targeted questions without scanning the entire codebase.

| Doc | Covers |
|-----|--------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System overview, module graph, game loop, shared state |
| [WORLD_AND_CHUNKS.md](docs/WORLD_AND_CHUNKS.md) | World class, terrain gen, caves, save/load format |
| [RENDERING.md](docs/RENDERING.md) | WebGL pipeline, shaders, camera, mesh generation |
| [PHYSICS.md](docs/PHYSICS.md) | Collision detection, gravity, player movement |
| [INPUT_AND_CONTROLS.md](docs/INPUT_AND_CONTROLS.md) | Key bindings, mouse/touch handlers, pointer lock |
| [UI_SYSTEM.md](docs/UI_SYSTEM.md) | Buttons, sliders, screen state machine, menus |
| [MULTIPLAYER.md](docs/MULTIPLAYER.md) | WebSocket protocol, packet types, chat commands |
| [BLOCK_DATA.md](docs/BLOCK_DATA.md) | Block definitions, shapes, textures, adding new blocks |

## Original Project

- [Khan Academy program](https://www.khanacademy.org/computer-programming/minekhan/5647155001376768)
- [GitHub release](https://willard21.github.io/MineKhan/dist/)
- [Multiplayer](https://willard.fun/minekhan) (upstream, may have bugs)
- [Discord](https://discord.gg/j3SzCQU)
