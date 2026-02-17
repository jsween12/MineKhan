---
name: Update Player Model to Standard Minecraft UV Coordinates
overview: Update the player model in shapes.js to use exact Minecraft UV coordinates (256x256 texture space) with per-face UV mapping matching the standard Minecraft skin layout. Each face of each body part has specific UV coordinates as defined in the Minecraft skin format.
todos:
  - id: map_face_order
    content: Map Minecraft face order (Top, Bottom, Left, Front, Right, Back) to current direction indices (0-5)
    status: completed
  - id: calculate_head_uvs
    content: Calculate Head inner and overlay UV coordinates for all 6 faces in 256x256 space (multiply 64x64 coords by 4)
    status: completed
  - id: calculate_torso_uvs
    content: Calculate Torso (Body) inner and overlay UV coordinates for all 6 faces with correct dimensions
    status: completed
  - id: calculate_arm_uvs
    content: Calculate RightArm and LeftArm inner and overlay UV coordinates for all 6 faces
    status: completed
  - id: calculate_leg_uvs
    content: Calculate RightLeg and LeftLeg inner and overlay UV coordinates for all 6 faces
    status: completed
  - id: update_shapes_uvs
    content: Update all 72 face definitions in shapes.js player.verts array with calculated UV coordinates
    status: completed
    dependencies:
      - map_face_order
      - calculate_head_uvs
      - calculate_torso_uvs
      - calculate_arm_uvs
      - calculate_leg_uvs
  - id: verify_coordinate_system
    content: Verify that coordinates are correctly converted from 64x64 to 256x256 space
    status: completed
  - id: update_documentation
    content: Update UV_COORDINATE_MAPPING.md with complete per-face UV coordinate table
    status: completed
    dependencies:
      - update_shapes_uvs
  - id: test_standard_skin
    content: Test rendering with a standard Minecraft skin to verify all faces display correctly
    status: completed
    dependencies:
      - update_shapes_uvs
---

# Update Player Model to Standard Minecraft UV Coordinates

## Overview

Update `shapes.js` to use exact Minecraft UV coordinates following the standard Minecraft skin format. Each face of each body part has specific UV coordinates (not shared across faces). Coordinates are in 64x64 skin space and must be converted to 256x256 texture space by multiplying by 4.

## Face Order Mapping

Minecraft standard face order:

1. Top
2. Bottom
3. Left
4. Front
5. Right
6. Back

Current direction mapping in shapes.js:

- Direction 0 = Bottom (-Y)
- Direction 1 = Top (+Y)
- Direction 2 = North (-Z) = Back
- Direction 3 = South (+Z) = Front
- Direction 4 = East (+X) = Right
- Direction 5 = West (-X) = Left

Mapping:

- Top → Direction 1
- Bottom → Direction 0
- Left → Direction 5
- Front → Direction 3
- Right → Direction 4
- Back → Direction 2

## Standard Minecraft UV Coordinates (64x64 → 256x256)

### Head (8×8 pixels per face)

**Inner Layer:**

- Top: (8, 0) → tx=32, ty=0
- Bottom: (16, 0) → tx=64, ty=0
- Left: (0, 8) → tx=0, ty=32
- Front: (8, 8) → tx=32, ty=32
- Right: (16, 8) → tx=64, ty=32
- Back: (24, 8) → tx=96, ty=32

**Overlay Layer (offset by 32 pixels horizontally):**

- Top: (40, 0) → tx=160, ty=0
- Bottom: (48, 0) → tx=192, ty=0
- Left: (32, 8) → tx=128, ty=32
- Front: (40, 8) → tx=160, ty=32
- Right: (48, 8) → tx=192, ty=32
- Back: (56, 8) → tx=224, ty=32

### Torso/Body (variable face sizes)

**Inner Layer:**

- Top (8×4): (20, 16) → tx=80, ty=64
- Bottom (8×4): (28, 16) → tx=112, ty=64
- Left (4×12): (16, 20) → tx=64, ty=80
- Front (8×12): (20, 20) → tx=80, ty=80
- Right (4×12): (28, 20) → tx=112, ty=80
- Back (8×12): (32, 20) → tx=128, ty=80

**Overlay Layer (offset by 16 pixels vertically):**

- Top (8×4): (20, 32) → tx=80, ty=128
- Bottom (8×4): (28, 32) → tx=112, ty=128
- Left (4×12): (16, 36) → tx=64, ty=144
- Front (8×12): (20, 36) → tx=80, ty=144
- Right (4×12): (28, 36) → tx=112, ty=144
- Back (8×12): (32, 36) → tx=128, ty=144

### Right Arm (4×12 main faces, 4×4 top/bottom)

**Inner Layer:**

- Top (4×4): (44, 16) → tx=176, ty=64
- Bottom (4×4): (48, 16) → tx=192, ty=64
- Left (4×12): (40, 20) → tx=160, ty=80
- Front (4×12): (44, 20) → tx=176, ty=80
- Right (4×12): (48, 20) → tx=192, ty=80
- Back (4×12): (52, 20) → tx=208, ty=80

**Overlay Layer:**

- Top (4×4): (44, 32) → tx=176, ty=128
- Bottom (4×4): (48, 32) → tx=192, ty=128
- Left (4×12): (40, 36) → tx=160, ty=144
- Front (4×12): (44, 36) → tx=176, ty=144
- Right (4×12): (48, 36) → tx=192, ty=144
- Back (4×12): (52, 36) → tx=208, ty=144

### Left Arm (Modern skins - separate UV region)

**Inner Layer:**

- Top (4×4): (36, 48) → tx=144, ty=192
- Bottom (4×4): (40, 48) → tx=160, ty=192
- Left (4×12): (32, 52) → tx=128, ty=208
- Front (4×12): (36, 52) → tx=144, ty=208
- Right (4×12): (40, 52) → tx=160, ty=208
- Back (4×12): (44, 52) → tx=176, ty=208

**Overlay Layer:**

- Top (4×4): (52, 48) → tx=208, ty=192
- Bottom (4×4): (56, 48) → tx=224, ty=192
- Left (4×12): (48, 52) → tx=192, ty=208
- Front (4×12): (52, 52) → tx=208, ty=208
- Right (4×12): (56, 52) → tx=224, ty=208
- Back (4×12): (60, 52) → tx=240, ty=208

### Right Leg (4×12 main faces, 4×4 top/bottom)

**Inner Layer:**

- Top (4×4): (4, 16) → tx=16, ty=64
- Bottom (4×4): (8, 16) → tx=32, ty=64
- Left (4×12): (0, 20) → tx=0, ty=80
- Front (4×12): (4, 20) → tx=16, ty=80
- Right (4×12): (8, 20) → tx=32, ty=80
- Back (4×12): (12, 20) → tx=48, ty=80

**Overlay Layer:**

- Top (4×4): (4, 32) → tx=16, ty=128
- Bottom (4×4): (8, 32) → tx=32, ty=128
- Left (4×12): (0, 36) → tx=0, ty=144
- Front (4×12): (4, 36) → tx=16, ty=144
- Right (4×12): (8, 36) → tx=32, ty=144
- Back (4×12): (12, 36) → tx=48, ty=144

### Left Leg (Modern skins - separate UV region)

**Inner Layer:**

- Top (4×4): (20, 48) → tx=80, ty=192
- Bottom (4×4): (24, 48) → tx=96, ty=192
- Left (4×12): (16, 52) → tx=64, ty=208
- Front (4×12): (20, 52) → tx=80, ty=208
- Right (4×12): (24, 52) → tx=96, ty=208
- Back (4×12): (28, 52) → tx=112, ty=208

**Overlay Layer:**

- Top (4×4): (4, 48) → tx=16, ty=192
- Bottom (4×4): (8, 48) → tx=32, ty=192
- Left (4×12): (0, 52) → tx=0, ty=208
- Front (4×12): (4, 52) → tx=16, ty=208
- Right (4×12): (8, 52) → tx=32, ty=208
- Back (4×12): (12, 52) → tx=48, ty=208

## Implementation Steps

### Step 1: Create UV Coordinate Lookup Table

Create a reference table mapping:

- Body part (Head, Body, RightArm, LeftArm, RightLeg, LeftLeg)
- Layer (inner, overlay)
- Face direction (Top, Bottom, Left, Front, Right, Back)
- To tx, ty coordinates in 256x256 space

### Step 2: Map Face Indices to Directions

Current face index mapping:

- 0 = Head inner
- 1 = Head overlay
- 2 = Body inner
- 3 = Body overlay
- 4 = LeftArm inner
- 5 = LeftArm overlay
- 6 = RightArm inner
- 7 = RightArm overlay
- 8 = LeftLeg inner
- 9 = LeftLeg overlay
- 10 = RightLeg inner
- 11 = RightLeg overlay

Direction mapping:

- Direction 0 (Bottom) → Bottom face
- Direction 1 (Top) → Top face
- Direction 2 (North) → Back face
- Direction 3 (South) → Front face
- Direction 4 (East) → Right face
- Direction 5 (West) → Left face

### Step 3: Update shapes.js Player Model

In [`src/js/shapes.js`](src/js/shapes.js), update the `player.verts` array (lines 272-278).

For each of the 6 directions and 12 face indices:

1. Identify the body part and layer from the face index
2. Identify the face direction from the direction index
3. Look up the correct tx, ty coordinates from the table above
4. Update the 6th and 7th elements of the face array

**Important**: Keep `x, y, z, w, h` values unchanged - only update `tx` and `ty`.

### Step 4: Verify Coordinate System

The `mapCoords` function (line 299) divides by 256:

```javascript
const tex = [tx+w,ty, tx,ty, tx,ty+h, tx+w,ty+h].map(c => c / 16 / textureAtlasWidth)
```

Where `textureAtlasWidth = 16`, so division is by 256.

This confirms tx/ty values should be in 256x256 pixel space (which we've calculated by multiplying 64x64 coords by 4).

## Files to Modify

1. **`src/js/shapes.js`** (lines 272-278)

   - Update all 72 face definitions (6 directions × 12 faces)
   - Change only the `tx` and `ty` values (6th and 7th array elements)
   - Keep `x, y, z, w, h` values unchanged (these define geometry)

2. **`docs/UV_COORDINATE_MAPPING.md`**

   - Replace with complete per-face UV coordinate table
   - Document the face order mapping
   - Add verification checklist

## Testing Strategy

After updating:

1. Test with standard Minecraft skin (64x64 format)
2. Verify each face of each body part displays correct texture region
3. Verify both inner and overlay layers display correctly
4. Check that texture alignment matches Minecraft behavior
5. Use `logUVCoordinates()` function in `skinnedPlayer.js` to verify coordinates
6. Test with both classic (pre-1.8) and modern (1.8+) skin formats

## Notes

- Each face has specific UV coordinates (not shared across faces of the same body part)
- Coordinates are in 256x256 texture space (64x64 skin coords × 4)
- The `x, y, z, w, h` values define 3D geometry and must NOT be changed
- Only `tx` and `ty` (texture coordinates) need updating
- Modern skins (1.8+) have separate UV regions for left arm and leg
- Classic skins mirror right side UVs for left side (handled separately if needed)