# World and Chunks

## Files
- `src/js/world.js` - World class (495 lines)
- `src/js/chunk.js` - Chunk class (1,654 lines, original)
- `src/js/section.js` - Section class (536 lines)
- `src/c/caves.c` - WASM cave noise (114 lines)
- `src/workers/Caves.js` - Cave WebWorker (74 lines)

## World Class (`js/world.js`)

Manages chunks, lighting, and save/load. Uses `state.world` globally.

### Key Methods
- `setSeed(seed)` - Seeds noise + cave workers
- `loadChunks(cx, cz)` - Loads/unloads chunks around player position
- `getBlock(x, y, z)` / `setBlock(x, y, z, id, lazy, remote, doNotLog)` - Block access
- `getLight(x, y, z, blockLight)` / `setLight(...)` / `updateLight(...)` - Lighting system
- `tick()` - Async tick: processes gen/populate/load/light/mesh queues, yields thread between
- `render()` - Renders all visible chunks, entities, skybox
- `getSaveString()` / `loadSave(data)` - Binary serialization via BitArrayBuilder

### State it reads/writes
- `state.p` (player position for chunk loading)
- `state.settings.renderDistance`
- `state.generatedChunks`, `state.fogDist`, `state.renderedChunks`
- `state.multiplayer` (for block sync)
- `state.blockLog` (for edit history)

## Chunk Class (`js/chunk.js`)

A 16x256x16 column of blocks.

### Key Methods
- `generate()` - Terrain gen using noise (hills, rivers, bedrock/stone/dirt/grass layers)
- `populate(details)` - Places trees, flowers, tall grass
- `carveCaves()` - Sends chunk to Cave WebWorker, receives air/carve lists
- `optimize()` - Determines which block faces are visible
- `genMesh(indexBuffer, bigArray)` - Generates WebGL vertex buffer from visible faces
- `fillLight()` - Initial sunlight fill from top down
- `spreadLight/unSpreadLight/reSpreadLight` - BFS light propagation

### Block Storage
- `this.blocks` - Uint16Array, indexed as `y * 256 + x * 16 + z`
- `this.light` - Packed: high nibble = skylight, low nibble = blocklight

## Terrain Generation Flow
1. `world.loadChunks()` - Creates Chunk objects, queues for generation
2. `chunk.generate()` - Noise-based heightmap, fills stone/dirt/grass
3. `chunk.carveCaves()` - WASM worker carves caves using 3D OpenSimplex noise
4. `chunk.populate()` - Trees, flowers (requires neighboring chunks generated)
5. `chunk.load()` - Applies saved edits
6. `chunk.fillLight()` - Sunlight propagation
7. `chunk.optimize()` - Hidden face removal
8. `chunk.genMesh()` - GPU vertex buffer creation

## Save Format
Binary encoding using `BitArrayBuilder`:
1. World name (length-prefixed)
2. Version (3 bytes)
3. Seed (32 bits), tick count (32 bits)
4. Player position, rotation, flags
5. Inventory (36 slots x 22 bits each)
6. Per-section: palette + RLE-encoded block diffs from generated terrain
