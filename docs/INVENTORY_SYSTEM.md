# Inventory System

## File
- `src/js/inventory.js` (509 lines)

## Overview
The inventory system manages item storage, creative menu, and the hotbar. It uses canvas-based rendering for all UI elements and handles mouse/keyboard interactions for item placement and movement.

## Architecture

### Core Classes

#### `InventoryItem`
Represents a single inventory item:
- `id` - Block/item ID
- `name` - Display name
- `stackSize` - Current stack count (max 64)
- `icon` - Canvas element with item icon
- `render(ctx, x, y, width)` - Draws the item icon and stack count
- `copy()` - Creates a duplicate item

#### `InventoryPage`
Manages a grid of inventory slots (typically 9 columns):
- `items[]` - Array of `InventoryItem` or `null` for empty slots
- `size` - Total number of slots
- `creative` - Boolean flag for creative vs survival mode
- `hoverIndex` - Currently hovered slot index
- `mouseClick(heldItem)` - Handles item placement/swapping logic
- `mouseMove(event)` - Updates hover highlight and tooltip
- `render(left, top, slotSize)` - Draws the inventory grid

#### `Hotbar`
Displays the bottom 9 slots of player storage (indices 27-35):
- References `storage.items[27-35]` directly (no separate storage)
- `render()` - Redraws hotbar from storage items
- `pickBlock(blockID)` - Auto-selects or adds block to hotbar
- `setPosition(index)` - Changes selected slot
- `hand` - Getter for currently selected item

#### `InventoryManager`
Orchestrates all inventory components:
- `containers[]` - Creative menu pages (cubes, slabs, stairs, decor)
- `playerStorage` - Survival inventory (36 slots)
- `hotbar` - Hotbar instance
- `heldItem` - Item being dragged by mouse cursor
- `mouseClick(event)` - Routes clicks to creative menu or storage
- `init(creative)` - Sets up all canvases and event handlers

## Event Flow

### Creative Menu Click
1. User clicks block in creative menu
2. `InventoryManager.mouseClick()` (line 475) → `InventoryPage.mouseClick()` (line 230)
3. Returns item to hold (or increments stack if same item)

### Player Storage Click
1. User clicks slot in storage area
2. `invCanvas.onmousedown` handler (line 457) → `storage.mouseClick()` (line 230)
3. Sets `this.items[this.hoverIndex] = heldItem || null` (line 250)
4. Hotbar updates automatically because it references `storage.items[27-35]` directly
5. Hotbar is explicitly re-rendered after storage clicks (line 471)

### Keyboard Events
1. Key pressed on inventory/container canvas
2. `invCanvas.onkeydown` handler (line 437) calls `e.stopPropagation()`
3. Handler forwards event to `window.parent.canvas.onkeydown(e)`
4. Main canvas handler processes the event via `controlEvent()`
5. If 'E' is pressed and `openInventory.triggered()`, calls `play()` to close inventory

## Key Implementation Details

### Hotbar Synchronization
The hotbar reads directly from `storage.items[27-35]`, so:
- No separate hotbar storage array
- Changes to storage slots 27-35 immediately affect hotbar
- After storage clicks, `this.hotbar.render()` is called to update the visual display

### Item Placement Logic (`InventoryPage.mouseClick()`)
- **Creative mode**: Returns copy of clicked item (discards held item)
- **Survival mode**: 
  - If same item ID: merges stacks (max 64)
  - Otherwise: swaps held item with slot item
  - Returns old item (or null) to become new held item

### Event Handler Setup
In `InventoryManager.init()`:
- `containerCanvas.onkeydown = invCanvas.onkeydown` - Shared handler for both canvases
- Handler calls `e.stopPropagation()` then forwards to main canvas handler
- This prevents race conditions where the same keypress would be handled twice

## Bug Fixes

### Hotbar Rendering Bug (Fixed)
**Issue**: Code attempted to iterate over `this.hotbar.length` and assign to `this.hotbar[i]`, but `Hotbar` is not an array and has no `length` property.

**Fix**: Replaced buggy loop with `this.hotbar.render()` call after storage clicks, since hotbar reads directly from `storage.items[27-35]`.

### Inventory Close Race Condition (Fixed)
**Issue**: Pressing 'E' to close inventory after placing items in hotbar would sometimes fail due to event being handled twice (once on inventory canvas, once on main canvas after screen changed).

**Fix**: 
1. Added `e.stopPropagation()` in inventory canvas handlers to prevent natural bubbling
2. Inventory canvas explicitly calls main canvas handler to ensure processing
3. Main canvas handler checks for duplicate keypresses via `if (e.repeat || state.Key[code])`

## State it reads/writes
- `state.screen` - Current screen (must be "inventory" for inventory to be visible)
- `state.holding` - Current held block ID (updated from hotbar)
- `inventory.hotbar.hand` - Currently selected hotbar item

## Canvas Elements
- `#inventory` - Player storage grid (36 slots)
- `#container` - Creative menu pages
- `#hotbar` - Hotbar display (bottom of screen in play mode)
- `#heldItem` - Dragged item cursor (follows mouse)
