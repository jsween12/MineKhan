// input.js - Keyboard, mouse, and touch event handlers and control bindings
import { state } from './state.js'
import { saveToDB } from './indexDB.js'
import { inventory } from './inventory.js'
import { Button } from './ui/button.js'
import { Slider } from './ui/slider.js'
import { changeScene, getPointer, releasePointer, play } from './ui/screens.js'
import { changeWorldBlock, newWorldBlock, lookingAt } from './raytrace.js'
import { hotbar, crosshair, hud } from './ui/hud.js'
import { chat, sendChat, sendCommand, setAutocomplete } from './ui/chat.js'

const setControl = (name, key, shift = false, ctrl = false, alt = false) => {
	let override = Boolean(state.controlMap[name])
	if (override) {
		if (""+[name, key, shift, ctrl, alt] !== ""+state.settings.controls[name]) {
			state.settings.controls[name] = [name, key, shift, ctrl, alt]
			saveToDB("settings", state.settings).catch(e => console.error(e))
		}
		Object.assign(state.controlMap[name], {key, shift, ctrl, alt})
		state.controlMap[name].button.value = (ctrl ? "Ctrl + " : "") + (alt ? "Alt + " : "") + (shift ? "Shift + " : "") + key
	}
	else {
		let button = document.createElement("input")
		state.controlMap[name] = {
			key, shift, ctrl, alt, pressed: false, button,
			triggered() {
				let pressed = Boolean(state.Key[this.key] && (!this.shift || state.Key.shift) && (!this.ctrl || state.Key.ctrl) && (!this.alt || state.Key.alt))
				if (pressed && !this.pressed) return this.pressed = true
				return false
			},
			released() {
				let pressed = Boolean(state.Key[this.key] && (!this.shift || state.Key.shift) && (!this.ctrl || state.Key.ctrl) && (!this.alt || state.Key.alt))
				if (!pressed && this.pressed) { this.pressed = false; return true }
				return false
			}
		}
		let tr = document.createElement("tr")
		let td = document.createElement("td")
		td.textContent = name
		tr.append(td)
		button.type = "button"
		button.value = (ctrl ? "Ctrl + " : "") + (alt ? "Alt + " : "") + (shift ? "Shift + " : "") + key
		button.onmousedown = event => {
			if (button.value === "          ") {
				event.stopPropagation(); event.preventDefault()
				let buttonName = ["leftMouse", "middleMouse", "rightMouse"][event.button] || "mouse" + event.button
				setControl(name, buttonName, event.shiftKey, event.ctrlKey, event.altKey)
				button.value = (event.ctrlKey ? "Ctrl + " : "") + (event.altKey ? "Alt + " : "") + (event.shiftKey ? "Shift + " : "") + buttonName
			} else { button.value = "          " }
		}
		button.onkeydown = e => { e.preventDefault() }
		button.onkeyup = event => {
			if (button.value === "          ") {
				event.stopPropagation(); event.preventDefault()
				if (event.code === "Escape") {
					button.value = (ctrl ? "Ctrl + " : "") + (alt ? "Alt + " : "") + (shift ? "Shift + " : "") + key
				} else {
					setControl(name, event.code, event.shiftKey, event.ctrlKey, event.altKey)
					button.value = (event.ctrlKey ? "Ctrl + " : "") + (event.altKey ? "Alt + " : "") + (event.shiftKey ? "Shift + " : "") + event.code
				}
			}
		}
		button.onblur = () => {
			if (state.settings.controls[name]) { [name, key, shift, ctrl, alt] = state.settings.controls[name] }
			if (button.value === "          ") { button.value = (ctrl ? "Ctrl + " : "") + (alt ? "Alt + " : "") + (shift ? "Shift + " : "") + key }
		}
		td = document.createElement("td")
		td.style.textAlign = "right"
		td.append(button)
		tr.append(td)
		tr.className = "control-row"
		document.getElementById('controls-page').append(tr)
	}
}

const initControls = () => {
	setControl("jump", "Space")
	setControl("walkForwards", "KeyW")
	setControl("strafeLeft", "KeyA")
	setControl("walkBackwards", "KeyS")
	setControl("strafeRight", "KeyD")
	setControl("sprint", "KeyQ")
	setControl("openInventory", "KeyE")
	setControl("openChat", "KeyT")
	setControl("pause", "KeyP")
	setControl("hyperBuilder", "KeyH")
	setControl("superBreaker", "KeyB")
	setControl("toggleSpectator", "KeyL")
	setControl("zoom", "KeyZ")
	setControl("sneak", "shift")
	setControl("breakBlock", "leftMouse")
	setControl("placeBlock", "rightMouse")
	setControl("pickBlock", "middleMouse")
	setControl("cycleDebug", "F3")
	setControl("npcMenu", "Tab")
}

const controlEvent = (name, event) => {
	let p = state.p
	if (state.screen === "play") {
		if (document.pointerLockElement !== state.canvas) {
			getPointer()
			p.lastBreak = state.now
		} else {
			if (state.controlMap.breakBlock.triggered()) changeWorldBlock(0)
			if (state.controlMap.placeBlock.triggered() && state.holding) newWorldBlock()
			if (state.controlMap.pickBlock.triggered() && state.hitBox.pos) {
				let block = state.world.getBlock(state.hitBox.pos[0], state.hitBox.pos[1], state.hitBox.pos[2]) & 0x3ff
				inventory.hotbar.pickBlock(block)
				state.holding = inventory.hotbar.hand.id
				hotbar()
			}
			if (state.controlMap.pause.triggered()) { releasePointer(); changeScene("pause") }
			if (state.controlMap.openChat.triggered()) { event.preventDefault(); changeScene("chat") }
			if (name === "Slash") { changeScene("chat"); document.getElementById("chatbar").value = "/" }
			if (state.controlMap.superBreaker.triggered()) { p.autoBreak = !p.autoBreak; hud() }
			if (state.controlMap.hyperBuilder.triggered()) { p.autoBuild = !p.autoBuild; hud() }
			if (state.controlMap.jump.triggered() && !p.spectator) {
				if (state.now < p.lastJump + 400) p.flying = !p.flying
				else p.lastJump = state.now
			}
			if (state.controlMap.zoom.triggered()) p.FOV(10, 300)
			if (state.controlMap.sneak.triggered() && !p.flying) {
				p.sneaking = true
				if (p.sprinting) p.FOV(state.settings.fov, 100)
				p.sprinting = false; p.speed = 0.05; p.bottomH = 1.32
			}
			if (state.controlMap.toggleSpectator.triggered()) {
				p.spectator = !p.spectator; p.flying = true; p.onGround = false
				if (!p.spectator) { hotbar(); crosshair(); hud(true) }
				else state.ctx.clearRect(0, 0, state.ctx.canvas.width, state.ctx.canvas.height)
			}
			if (state.controlMap.openInventory.triggered()) { changeScene("inventory"); releasePointer() }
			if (state.controlMap.npcMenu.triggered()) { event.preventDefault(); releasePointer(); changeScene("npc menu") }
			if (name === "Semicolon") { releasePointer(); state.freezeFrame = state.now + 500 }
			if (state.controlMap.cycleDebug.triggered()) {
				state.settings.showDebug = (state.settings.showDebug + 1) % 3
				saveToDB("settings", state.settings).catch(e => console.error(e)); hud()
			}
			if (name === "KeyI" && state.hitBox.pos) {
				chat(`Block light: ${state.world.getLight(...state.hitBox.pos, 1)}, Sky light: ${state.world.getLight(...state.hitBox.pos, 0)}`)
			}
		}
	}
	else if (state.screen === "pause" && state.controlMap.pause.triggered()) play()
	else if (state.screen === "npc menu" && state.controlMap.npcMenu.triggered()) { event.preventDefault(); play() }
	else if (state.screen === "inventory") {
		if (name === "leftMouse") { inventory.heldItem = null; document.getElementById("heldItem")?.classList.add("hidden") }
		if (state.controlMap.openInventory.triggered()) play()
	}
}

const initEventHandlers = () => {
	const win = state.win
	const canvas = state.canvas
	const chatInput = document.getElementById("chatbar")

	const mmoved = (e) => {
		let mouseS = state.settings.mouseSense / 30000
		state.p.rx -= e.movementY * mouseS
		state.p.ry += e.movementX * mouseS
		while (state.p.ry > Math.PI * 2) state.p.ry -= Math.PI * 2
		while (state.p.ry < 0) state.p.ry += Math.PI * 2
		if (state.p.rx > Math.PI / 2) state.p.rx = Math.PI / 2
		if (state.p.rx < -Math.PI / 2) state.p.rx = -Math.PI / 2
	}
	const trackMouse = (e) => {
		if (state.screen !== "play") {
			state.cursor?.("") // cursor from state
			state.mouseX = e.x; state.mouseY = e.y
			state.drawScreens[state.screen]()
			Button.draw(); Slider.draw(); Slider.drag()
		}
		if (state.screen === "inventory") {
			const heldItemCanvas = document.getElementById("heldItem")
			heldItemCanvas.style.left = (e.x - inventory.iconSize / 2 | 0) + "px"
			heldItemCanvas.style.top = (e.y - inventory.iconSize / 2 | 0) + "px"
		}
	}

	document.onmousemove = trackMouse
	document.onpointerlockchange = function() {
		if (document.pointerLockElement === canvas) {
			document.onmousemove = mmoved
		} else {
			document.onmousemove = trackMouse
			if (state.screen === "play" && state.now > state.freezeFrame) {
				changeScene("pause")
				state.unpauseDelay = state.now + 500
			}
		}
		for (let key in state.Key) state.Key[key] = false
	}
	canvas.onmousedown = function(e) {
		state.mouseX = e.x; state.mouseY = e.y; state.mouseDown = true
		let name = ["leftMouse", "middleMouse", "rightMouse"][event.button] || "mouse" + e.button
		state.Key[name] = true
		controlEvent(name, e)
		for (let n in state.controlMap) { if (!state.controlMap[n].pressed) state.controlMap[n].triggered() }
		Button.click(); Slider.click()
	}
	canvas.onmouseup = function(e) {
		let name = ["leftMouse", "middleMouse", "rightMouse"][event.button] || "mouse" + e.button
		state.Key[name] = false; state.mouseDown = false
		for (let n in state.controlMap) { if (state.controlMap[n].pressed) state.controlMap[n].released() }
		Slider.release()
	}
	canvas.onkeydown = function(e) {
		let code = e.code
		if (!state.Key.ControlLeft && !state.Key.ControlRight && code !== "F12" && code !== "F11") e.preventDefault()
		if (e.repeat || state.Key[code]) return
		state.Key[code] = true
		state.Key.shift = e.shiftKey; state.Key.ctrl = e.ctrlKey; state.Key.alt = e.altKey
		controlEvent(code, e)
		for (let n in state.controlMap) { if (!state.controlMap[n].pressed) state.controlMap[n].triggered() }
		if (state.screen === "play" && Number(e.key)) {
			inventory.hotbar.setPosition(e.key - 1)
			state.holding = inventory.hotbar.hand.id; hotbar()
		}
	}
	canvas.onkeyup = function(e) {
		state.Key[e.code] = false
		state.Key.shift = e.shiftKey; state.Key.ctrl = e.ctrlKey; state.Key.alt = e.altKey
		if (e.code === "Escape" && state.screenPath[0] === "play" && state.now > state.unpauseDelay) play()
		if (state.controlMap.zoom.released()) state.p.FOV(state.settings.fov, 300)
		if (state.controlMap.sneak.released() && state.p.sneaking) {
			state.p.sneaking = false; state.p.speed = 0.11; state.p.bottomH = 1.62
		}
		for (let n in state.controlMap) { if (state.controlMap[n].pressed) state.controlMap[n].released() }
	}
	canvas.onblur = function() {
		for (let key in state.Key) state.Key[key] = false
		state.mouseDown = false; Slider.release()
	}
	canvas.oncontextmenu = function(e) { e.preventDefault() }
	win.onbeforeunload = e => {
		if (state.screen === "play" && state.Key.control) {
			releasePointer(); e.preventDefault()
			e.returnValue = "Q is the default sprint button; Ctrl + W closes the page."
			return true
		}
	}
	canvas.onwheel = e => {
		e.preventDefault(); e.stopPropagation()
		if (state.screen === "play") {
			inventory.hotbar.shiftPosition(e.deltaY)
			state.holding = inventory.hotbar.hand.id; hotbar()
		}
	}
	document.onwheel = () => {}
	win.onresize = () => {
		const { use3d, initDirt } = window.parent.exports["src/js/renderer.js"]
		const { initButtons } = window.parent.exports["src/js/ui/menus.js"]
		state.width = win.innerWidth; state.height = win.innerHeight
		canvas.height = state.height; canvas.width = state.width
		if (!state.gl) return
		state.gl.canvas.height = state.height; state.gl.canvas.width = state.width
		state.gl.viewport(0, 0, state.width, state.height)
		initButtons()
		initDirt()
		inventory.size = Math.min(state.width, state.height) / 15 | 0
		use3d()
		state.p.FOV(state.p.currentFov + 0.0001)
		if (state.screen === "play") play()
		else { state.drawScreens[state.screen](); Button.draw(); Slider.draw() }
	}
	chatInput.oninput = () => {
		if (chatInput.value.length > 512) chatInput.value = chatInput.value.slice(0, 512)
	}
	chatInput.onkeydown = e => e.key === "Tab" ? e.preventDefault() : 0
	chatInput.onkeyup = e => {
		if (e.key === "Enter") {
			let msg = chatInput.value.trim()
			if (msg) {
				e.preventDefault(); e.stopPropagation()
				if (msg.startsWith("/")) sendCommand(msg)
				else sendChat(msg)
				chatInput.value = ""
			} else play()
		} else {
			let msg = chatInput.value
			if (msg.startsWith("/")) {
				let words = msg.split(" ")
				if (words.length > 1) {
					let cmd = words[0].slice(1)
					if (state.commands.has(cmd)) state.commands.get(cmd).autocomplete(msg)
				} else {
					let possible = state.commandList.filter(n => n.startsWith(msg))
					if (possible.length === 1) state.commands.get(possible[0].slice(1)).autocomplete(msg)
					else setAutocomplete(state.commandList)
				}
			}
		}
	}
	document.onkeyup = e => {
		if (e.key === "Escape" && state.screen === "chat") {
			e.preventDefault(); e.stopPropagation()
			chatInput.value = ""; play()
		}
		else if (state.screen === "chat" && !chatInput.hasFocus) chatInput.focus()
	}

	// Touch support
	let pTouch = { x: 0, y: 0 }
	canvas.addEventListener("touchstart", function(e) {
		pTouch.x = e.changedTouches[0].pageX; pTouch.y = e.changedTouches[0].pageY
	}, false)
	canvas.addEventListener("touchmove", function(e) {
		e.movementY = e.changedTouches[0].pageY - pTouch.y
		e.movementX = e.changedTouches[0].pageX - pTouch.x
		pTouch.x = e.changedTouches[0].pageX; pTouch.y = e.changedTouches[0].pageY
		mmoved(e); e.preventDefault()
	}, false)
}

export { setControl, initControls, initEventHandlers }
