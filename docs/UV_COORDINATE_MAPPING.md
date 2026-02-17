# UV Coordinate Mapping - Standard Minecraft Player Model

## Overview

This document describes the UV coordinate mapping for the player model, which has been updated to match the standard Minecraft skin format. All coordinates are in 256x256 texture space (standard Minecraft skin coordinates multiplied by 4).

## Face Order Mapping

The player model uses 6 directions for each body part:

- **Direction 0** = Bottom (-Y)
- **Direction 1** = Top (+Y)
- **Direction 2** = North/Back (-Z)
- **Direction 3** = South/Front (+Z)
- **Direction 4** = East/Right (+X)
- **Direction 5** = West/Left (-X)

## Face Index Mapping

Each direction has 12 faces (indices 0-11):

- **Index 0** = Head inner
- **Index 1** = Head overlay
- **Index 2** = Body inner
- **Index 3** = Body overlay
- **Index 4** = LeftArm inner
- **Index 5** = LeftArm overlay
- **Index 6** = RightArm inner
- **Index 7** = RightArm overlay
- **Index 8** = LeftLeg inner
- **Index 9** = LeftLeg overlay
- **Index 10** = RightLeg inner
- **Index 11** = RightLeg overlay

## Complete UV Coordinate Table (256x256 Texture Space)

### Head (8×8 pixels per face)

**Inner Layer (Index 0):**
- Bottom (dir 0): tx=64, ty=0
- Top (dir 1): tx=32, ty=0
- Back (dir 2): tx=96, ty=32
- Front (dir 3): tx=32, ty=32
- Right (dir 4): tx=64, ty=32
- Left (dir 5): tx=0, ty=32

**Overlay Layer (Index 1):**
- Bottom (dir 0): tx=192, ty=0
- Top (dir 1): tx=160, ty=0
- Back (dir 2): tx=224, ty=32
- Front (dir 3): tx=160, ty=32
- Right (dir 4): tx=192, ty=32
- Left (dir 5): tx=128, ty=32

### Body/Torso (variable face sizes)

**Inner Layer (Index 2):**
- Bottom (dir 0): tx=112, ty=64
- Top (dir 1): tx=80, ty=64
- Back (dir 2): tx=128, ty=80
- Front (dir 3): tx=80, ty=80
- Right (dir 4): tx=112, ty=80
- Left (dir 5): tx=64, ty=80

**Overlay Layer (Index 3):**
- Bottom (dir 0): tx=112, ty=128
- Top (dir 1): tx=80, ty=128
- Back (dir 2): tx=128, ty=144
- Front (dir 3): tx=80, ty=144
- Right (dir 4): tx=112, ty=144
- Left (dir 5): tx=64, ty=144

### Right Arm (4×12 main faces, 4×4 top/bottom)

**Inner Layer (Index 6):**
- Bottom (dir 0): tx=192, ty=64
- Top (dir 1): tx=176, ty=64
- Back (dir 2): tx=208, ty=80
- Front (dir 3): tx=176, ty=80
- Right (dir 4): tx=192, ty=80
- Left (dir 5): tx=160, ty=80

**Overlay Layer (Index 7):**
- Bottom (dir 0): tx=192, ty=128
- Top (dir 1): tx=176, ty=128
- Back (dir 2): tx=208, ty=144
- Front (dir 3): tx=176, ty=144
- Right (dir 4): tx=192, ty=144
- Left (dir 5): tx=160, ty=144

### Left Arm (Modern skins - separate UV region)

**Inner Layer (Index 4):**
- Bottom (dir 0): tx=160, ty=192
- Top (dir 1): tx=144, ty=192
- Back (dir 2): tx=176, ty=208
- Front (dir 3): tx=144, ty=208
- Right (dir 4): tx=160, ty=208
- Left (dir 5): tx=128, ty=208

**Overlay Layer (Index 5):**
- Bottom (dir 0): tx=224, ty=192
- Top (dir 1): tx=208, ty=192
- Back (dir 2): tx=240, ty=208
- Front (dir 3): tx=208, ty=208
- Right (dir 4): tx=224, ty=208
- Left (dir 5): tx=192, ty=208

### Right Leg (4×12 main faces, 4×4 top/bottom)

**Inner Layer (Index 10):**
- Bottom (dir 0): tx=32, ty=64
- Top (dir 1): tx=16, ty=64
- Back (dir 2): tx=48, ty=80
- Front (dir 3): tx=16, ty=80
- Right (dir 4): tx=32, ty=80
- Left (dir 5): tx=0, ty=80

**Overlay Layer (Index 11):**
- Bottom (dir 0): tx=32, ty=128
- Top (dir 1): tx=16, ty=128
- Back (dir 2): tx=48, ty=144
- Front (dir 3): tx=16, ty=144
- Right (dir 4): tx=32, ty=144
- Left (dir 5): tx=0, ty=144

### Left Leg (Modern skins - separate UV region)

**Inner Layer (Index 8):**
- Bottom (dir 0): tx=96, ty=192
- Top (dir 1): tx=80, ty=192
- Back (dir 2): tx=112, ty=208
- Front (dir 3): tx=80, ty=208
- Right (dir 4): tx=96, ty=208
- Left (dir 5): tx=64, ty=208

**Overlay Layer (Index 9):**
- Bottom (dir 0): tx=32, ty=192
- Top (dir 1): tx=16, ty=192
- Back (dir 2): tx=48, ty=208
- Front (dir 3): tx=16, ty=208
- Right (dir 4): tx=32, ty=208
- Left (dir 5): tx=0, ty=208

## Standard Minecraft 64x64 Skin Layout Reference

For reference, here are the original 64x64 coordinates (before conversion to 256x256):

### Head
- Inner: x=8-15, y=8-15 (all faces use different regions)
- Overlay: x=40-47, y=8-15 (offset by 32 pixels horizontally)

### Body
- Inner: x=20-27, y=20-31 (front/back), x=16-19/28-31, y=20-31 (sides)
- Overlay: x=20-27, y=36-47 (front/back), x=16-19/28-31, y=36-47 (sides)

### Right Arm
- Inner: x=44-47, y=20-31
- Overlay: x=44-47, y=36-47

### Left Arm (Modern)
- Inner: x=36-39, y=52-63
- Overlay: x=48-51, y=52-63

### Right Leg
- Inner: x=4-7, y=20-31
- Overlay: x=0-3, y=36-47

### Left Leg (Modern)
- Inner: x=20-23, y=52-63
- Overlay: x=16-19, y=52-63

## Coordinate System Verification

The `mapCoords` function in `shapes.js` divides texture coordinates by 256:
```javascript
const tex = [tx+w,ty, tx,ty, tx,ty+h, tx+w,ty+h].map(c => c / 16 / textureAtlasWidth)
```
Where `textureAtlasWidth = 16`, so division is by 256 (16 × 16).

This confirms that tx/ty values in the model are in 256x256 pixel space, which matches our coordinate system.

## Implementation Status

✅ **Completed**: All 72 face definitions (6 directions × 12 faces) have been updated with standard Minecraft UV coordinates.

✅ **Verified**: The system has been tested and works correctly with:
- Standard Minecraft skins (64x64 format)
- Default skin generator
- Custom skins loaded via `loadSkinFromUrl()` and `loadSkinFromImage()`
- Both inner and overlay layers render correctly
- All body parts (head, body, arms, legs) display with correct textures

## Texture Scaling

The UV coordinates are in 256x256 space, but Minecraft skins are 64x64. The system handles this by:

1. **Default Skin Generator**: Creates pixel data directly in 256x256 space (all coordinates × 4)
2. **Image Loading**: Scales 64x64 images to 256x256 using nearest-neighbor scaling (preserves pixel art)
3. **Rendering**: UV coordinates map directly to the 256x256 texture space

This ensures compatibility with standard Minecraft skins while using the correct coordinate system for rendering.

## Notes

- Each face has specific UV coordinates (not shared across faces of the same body part)
- Coordinates are in 256x256 texture space (64x64 skin coords × 4)
- The `x, y, z, w, h` values define 3D geometry and must NOT be changed
- Only `tx` and `ty` (texture coordinates) were updated
- Modern skins (1.8+) have separate UV regions for left arm and leg
- Classic skins mirror right side UVs for left side (handled separately if needed)
