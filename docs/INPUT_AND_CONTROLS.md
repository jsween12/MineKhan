# Input and Controls

## File
- `src/js/input.js` (313 lines)

## Overview
Manages all user input: keyboard, mouse, touch, and the configurable control binding system. Connects input events to game actions.

## Control System

### `setControl(name, key, shift, ctrl, alt)`
Registers a named control (e.g. "jump" → "Space"). Creates a DOM button in the controls menu for rebinding. Each control has:
- `.pressed` - Whether currently held
- `.triggered()` - Returns true once on press (edge-detected)
- `.released()` - Returns true once on release

### Default Bindings
| Action | Default Key |
|--------|-------------|
| Jump | Space |
| Walk Forward/Back | W / S |
| Strafe Left/Right | A / D |
| Sprint | Q |
| Sneak | Shift |
| Open Inventory | E |
| Open Chat | T |
| Pause | P |
| Break Block | Left Mouse |
| Place Block | Right Mouse |
| Pick Block | Middle Mouse |
| Cycle Debug | F3 |
| Zoom | Z |
| Hyper Builder | H |
| Super Breaker | B |
| Toggle Spectator | L |
| NPC Menu | Tab |

## Event Handlers (`initEventHandlers()`)

### Mouse
- `onmousedown` - Track mouse position, trigger controls, click buttons/sliders
- `onmouseup` - Release controls and sliders
- `onmousemove` - Two modes: pointer-locked (camera rotation) or free (UI interaction)
- `onwheel` - Scroll hotbar selection
- `oncontextmenu` - Prevented (right-click = place block)

### Keyboard
- `onkeydown` - Set key state, trigger controls, number keys for hotbar
- `onkeyup` - Clear key state, handle Escape (unpause), release sneak/zoom

### Pointer Lock
- `onpointerlockchange` - Switch between camera mode and UI mode
- Entering play: pointer is locked to canvas
- Exiting play (Esc, clicking outside): pointer released, game pauses

### Touch
- `touchstart` / `touchmove` - Maps to mouse movement for mobile

### Resize
- `onresize` - Updates dimensions, re-creates buttons/sliders, recalculates FOV

## `controlEvent(name, event)`
The main input dispatcher. Routes input based on current screen:
- **play**: break/place/pick blocks, toggle fly/sprint/sneak/spectator, open inventory/chat
- **pause**: resume on P
- **inventory**: click to place items, E to close

### Special Item Handling

**Bow and Arrow**
Right-click behavior is intercepted when holding a bow:
```javascript
if (state.controlMap.placeBlock.triggered() && state.holding === blockIds.bow) {
    state.world.shootArrow()  // Shoot arrow instead of placing block
}
else if (state.controlMap.placeBlock.triggered() && state.holding) {
    newWorldBlock()  // Normal block placement
}
```

This check happens in `controlEvent()` during the "play" screen, before normal block placement. The bow uses Block ID from `blockIds.bow` defined in `blockData.js`.

## Inventory Event Handling

The inventory system uses separate canvas elements (`#inventory` and `#container`) that have their own keyboard event handlers. To prevent race conditions and double-handling of events:

1. **Event Propagation**: Inventory canvas handlers call `e.stopPropagation()` to prevent events from bubbling to the main canvas
2. **Direct Handler Calls**: Inventory canvas handlers explicitly call `window.parent.canvas.onkeydown(e)` to process the event, ensuring it's handled even when the event target is the inventory canvas
3. **Duplicate Prevention**: The main canvas handler checks `if (e.repeat || state.Key[code])` to prevent processing the same keypress twice

This design ensures that when pressing 'E' to close the inventory:
- The event is captured by the inventory canvas handler
- It's forwarded to the main canvas handler for processing
- Natural event bubbling is prevented to avoid double-handling
- The inventory closes correctly regardless of which canvas has focus

## State it reads/writes
- `state.Key` - Raw key state map
- `state.controlMap` - Named control bindings
- `state.mouseX/Y/Down` - Mouse position and button state
- `state.holding` - Current held block ID
- `state.hitBox` - Targeted block info
- `state.screen` - Current scene (determines which inputs are active)
