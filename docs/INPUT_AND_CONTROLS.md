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

## State it reads/writes
- `state.Key` - Raw key state map
- `state.controlMap` - Named control bindings
- `state.mouseX/Y/Down` - Mouse position and button state
- `state.holding` - Current held block ID
- `state.hitBox` - Targeted block info
- `state.screen` - Current scene (determines which inputs are active)
