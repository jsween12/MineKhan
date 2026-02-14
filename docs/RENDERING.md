# Rendering

## Files
- `src/js/renderer.js` - WebGL init, mode switching, icons, shape setup (379 lines)
- `src/js/camera.js` - Camera/projection/frustum (164 lines)
- `src/js/glUtils.js` - Shader compilation (59 lines)
- `src/js/texture.js` - Texture atlas (181 lines)
- `src/js/sky.js` - Skybox (128 lines)
- `src/shaders/` - 10 GLSL files (8-34 lines each)

## WebGL Programs
Four shader programs, cached in `state`:
- `program3D` - Main block rendering with fog
- `program3DFogless` - Close blocks + hitbox outline (no fog)
- `program2D` - UI, dirt background, block icons
- `programEntity` - Player/item entities

## Render Pipeline (per frame)
1. `state.p.setDirection()` - Update camera direction + frustum planes
2. `world.render()` calls:
   - `animateTextures(gl)` - Water/lava animation
   - Clear depth + color buffers
   - Set fog distance uniform
   - `drawHitbox(p)` - Outline of targeted block
   - `initModelView(p)` - Upload view-projection matrix
   - Render sorted chunks (near → far, fog kicks in at distance)
   - `skybox(time, matrix)` - Sky dome
   - Render transparent chunks (water) with depth write off
   - Render entities + multiplayer players

## Key Functions in renderer.js
- `initWebgl(shaders...)` - Creates GL context, compiles shaders, caches uniforms
- `use2d()` / `use3d()` - Switch between 2D and 3D rendering modes
- `dirt()` / `initDirt()` - Dirt background texture for menus
- `initShapes()` - Creates GL buffers for all block shapes + slab/stair variants
- `genIcons()` - Renders 3D block preview icons to canvas
- `initModelView(camera)` - Uploads camera matrix to GPU
- `drawHitbox(camera)` - Draws wireframe outline around targeted block

## Camera Class (`camera.js`)
- `FOV(fov, time)` - Set/animate field of view, updates projection matrix
- `transform()` - Build view matrix from position/rotation (interpolated)
- `getMatrix()` - Multiply projection * view, return combined matrix
- `setDirection()` - Compute look direction + frustum planes
- `canSee(x, y, z, maxY)` - Frustum culling test for chunks
- `computeFrustum()` - 5-plane frustum from camera direction

## Chunk Mesh Format
Per visible face, 10 floats: `x, y, z, u, v, shadow, skylight, blocklight, nx, ny`
Uploaded as a single interleaved VBO per chunk.

## State it reads/writes
- `state.gl`, `state.glCache`, `state.glExtensions` - WebGL handles
- `state.program3D/2D/Entity/3DFogless` - Shader programs
- `state.indexBuffer`, `state.dirtBuffer`, `state.hitBox.buffer`
- `state.matrix` - Temporary 4x4 matrix (reused to avoid allocation)
