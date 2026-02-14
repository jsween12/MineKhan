# UI System

## Files
- `src/js/ui/button.js` - Button class (96 lines)
- `src/js/ui/slider.js` - Slider class (83 lines)
- `src/js/ui/screens.js` - Scene management (166 lines)
- `src/js/ui/hud.js` - HUD overlay (98 lines)
- `src/js/ui/menus.js` - Menu definitions (225 lines)

## Screen State Machine

The game uses a screen string (`state.screen`) to determine what's displayed and how input is handled.

### Screens
`main menu` → `loadsave menu` → `creation menu` → `loading` → `play`
`play` ↔ `pause` ↔ `options` ↔ `controls`
`play` ↔ `inventory`
`play` ↔ `chat`
`play` ↔ `npc menu`
`main menu` → `multiplayer menu`
`main menu` → `changelog`

### `changeScene(newScene)` (screens.js)
1. Pushes current screen to `state.screenPath` (for "back" navigation)
2. Hides HTML elements for old screen, shows for new screen
3. Calls `onenter`/`onexit` hooks defined in `state.html`
4. Redraws buttons and sliders

### `play()` (screens.js)
Transitions to "play" screen: locks pointer, sets up 3D rendering, draws crosshair/HUD/hotbar.

## Button Class (`ui/button.js`)

Static collection in `Button.all`. Each button has:
- Position (x, y, w, h)
- Labels (array for toggle buttons)
- Scenes (which screens it appears on)
- Callback, disabled check, hover text

### Static Methods
- `Button.add(...)` - Create and register a button
- `Button.draw()` - Draw all buttons for current screen
- `Button.click()` - Test click against all buttons

## Slider Class (`ui/slider.js`)

Same pattern as Button. Used for render distance, FOV, mouse sensitivity, reach.
- `Slider.drag()` - Called on mouse move to update value
- `Slider.release()` - Stop dragging

## HUD (`ui/hud.js`)

### `hud(clear)`
Draws debug info (FPS, coords, frame times) in top-left corner. Optimized to only redraw changed characters. Three debug levels (cycle with F3): none → basic → detailed.

### `crosshair()`
Simple white crosshair in center of screen.

### `hotbar()`
Updates lantern light uniform based on held block's light level.

## Menu Definitions (`ui/menus.js`)

### `initButtons()`
Creates all Button and Slider instances for every screen. Called on startup and resize.

### `initWorldsMenu()`
Loads saved worlds from IndexedDB + cloud, populates the world list DOM.

### `initMultiplayerMenu()`
Fetches server list from willard.fun, displays available worlds, auto-refreshes every 5s.

### NPC Menu Buttons
5 buttons on the `"npc menu"` screen: Spawn Panda, Idle, Wander, Follow Me, Delete NPC, Close. Each returns to gameplay after action. Spawn/Delete are disabled based on whether an NPC exists. State buttons show `[active]` indicator. See [NPC_SYSTEM.md](NPC_SYSTEM.md) for full details.

## HTML Elements
Each screen can show/hide HTML elements via `state.html[screen].enter/exit` arrays. Elements include:
- `#hotbar` - Hotbar display
- `#worlds` - World/server list
- `#boxcentertop` - Text input (world name, save code)
- `#chatbar` / `#chat` - Chat input/output
- `#inv-container` - Inventory grid
- `#controls-container` - Key binding table
- `#loading-text` - Loading progress

## State it reads/writes
- `state.screen`, `state.screenPath` - Current/previous screens
- `state.drawScreens` - Map of screen → render function
- `state.html` - Map of screen → HTML element arrays
- `state.worlds`, `state.selectedWorld` - World list state
