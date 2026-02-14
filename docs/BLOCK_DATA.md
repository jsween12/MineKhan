# Block Data

## Files
- `src/js/blockData.js` - Block definitions (628 lines)
- `src/js/shapes.js` - Block geometry (590 lines)
- `src/js/texture.js` - Texture atlas management (181 lines)

## Block Definition (`blockData.js`)

### `blockData` Array
Indexed by block ID (0-255 base, with flags for variants). Each entry is a `BlockData` object:

```javascript
{
  name: "Grass Block",
  transparent: false,   // Light passes through
  shadow: true,         // Casts ambient occlusion
  solid: true,          // Has collision
  lightLevel: 0,        // 0-15 emitted light
  hideInterior: true,   // Don't render faces between same blocks
  shape: shapes.cube,   // Geometry reference
  textures: [[tx,ty], ...], // 6 faces: [ny, py, pz, nz, px, nx]
  iconImg: canvas,      // 64x64 preview icon
  rotate: false,        // Can be placed in 4 orientations
  flip: false,          // Can be placed upside-down
  uniqueShape: false,   // Has custom shape (no slab/stair variants)
}
```

### `blockIds` Object
Named constants: `blockIds.grass`, `blockIds.stone`, `blockIds.water`, etc.

### Block ID Encoding
Block IDs use bit flags for variants:
- Bits 0-7: Base block ID (0-255)
- Bit 8: SLAB flag
- Bit 9: STAIR flag
- Bits 10-12: Rotation/flip flags (FLIP, SOUTH, EAST, WEST)

Constants from `shapes.js`:
- `CUBE = 0`, `SLAB = 0x100`, `STAIR = 0x200`
- `FLIP = 0x400`, `SOUTH = 0x800`, `EAST = 0x1000`, `WEST = 0x1800`

## Block Shapes (`shapes.js`)

Each shape defines vertex data for 6 face directions:
```javascript
shapes.cube = {
  verts: [bottomFaces, topFaces, southFaces, northFaces, eastFaces, westFaces],
  texVerts: [...],  // UV coordinates per face
  size: 6,          // Number of quads
  buffer: null,     // WebGL buffer (set at runtime)
  variants: [...],  // Rotated/flipped versions
}
```

Available shapes: `cube`, `slab`, `stair`, `flower`, `door`, `fence`, `lantern`, `torch`, `liquid`

### Variant Generation (`renderer.js/initShapes`)
For each base block, the renderer auto-generates:
- Slab variant (half-height, can be flipped)
- Stair variant (can be rotated 4 ways + flipped)
- Rotated cube variants (for directional blocks like furnaces)

## Texture Atlas (`texture.js`)

All block textures are packed into a single 256x256 texture atlas. Each block face references a UV coordinate pair `[tx, ty]` into this atlas.

### Key Functions
- `initTextures(gl, glCache)` - Loads the atlas onto the GPU
- `animateTextures(gl)` - Updates water/lava animation frames
- `hitboxTextureCoords` - Black texture coords for block outline

## Adding a New Block

1. Add texture coordinates in `blockData.js`
2. Create a `BlockData` entry with the appropriate properties
3. Add to `blockIds` for named access
4. The renderer automatically generates slab/stair variants unless `uniqueShape: true`
5. Block icons are generated at startup by `genIcons()` in `renderer.js`
