// screens.js - Screen/scene management and transitions
import { state, fill, text, textSize, strokeWeight, sleep } from '../state.js'
import { Button } from './button.js'
import { Slider } from './slider.js'
import { saveToDB } from '../indexDB.js'
import { inventory } from '../inventory.js'

const changeScene = (newScene) => {
	if (newScene === "play" || newScene === "main menu") state.screenPath = [newScene]
	else if (newScene === "back") {
		newScene = state.screenPath.pop()
	} else {
		state.screenPath.push(state.screen)
	}

	document.getElementById('background-text').classList.add('hidden')
	if (state.screen === "options") {
		saveToDB("settings", state.settings).catch(e => console.error(e))
	}

	if (state.html[state.screen] && state.html[state.screen].exit) {
		for (let element of state.html[state.screen].exit) element.classList.add("hidden")
	}
	if (state.html[newScene] && state.html[newScene].enter) {
		for (let element of state.html[newScene].enter) element.classList.remove("hidden")
	}
	if (state.html[newScene] && state.html[newScene].onenter) state.html[newScene].onenter()
	if (state.html[state.screen] && state.html[state.screen].onexit) state.html[state.screen].onexit()

	state.screen = newScene
	state.mouseDown = false
	state.drawScreens[state.screen]()
	Button.draw()
	Slider.draw()
}

const getPointer = () => {
	if (state.canvas.requestPointerLock) state.canvas.requestPointerLock()
}

const releasePointer = () => {
	if (document.exitPointerLock) document.exitPointerLock()
}

const play = () => {
	// Import these lazily to avoid circular dependencies
	const { use3d } = window.parent.exports["src/js/renderer.js"]
	const { crosshair, hud, hotbar } = window.parent.exports["src/js/ui/hud.js"]

	state.canvas.onblur()
	state.p.lastBreak = state.now
	state.holding = inventory.hotbar.hand.id
	use3d()
	getPointer()
	fill(255, 255, 255)
	textSize(20)
	state.canvas.focus()
	changeScene("play")
	state.ctx.clearRect(0, 0, state.width, state.height)
	crosshair()
	hud(true)
	inventory.hotbar.render()
	hotbar()
}

const save = async () => {
	let saveObj = {
		id: state.world.id,
		edited: state.now,
		name: state.world.name,
		version: state.version,
		code: state.world.getSaveString()
	}
	await saveToDB(state.world.id, saveObj).catch(e => console.error(e))
	state.world.edited = state.now
	if (location.href.startsWith("https://willard.fun/")) {
		console.log('Saving to server')
		await fetch(`https://willard.fun/minekhan/saves?id=${state.world.id}&edited=${saveObj.edited}&name=${encodeURIComponent(state.world.name)}&version=${encodeURIComponent(state.version)}`, {
			method: "POST",
			headers: { "Content-Type": "application/octet-stream" },
			body: saveObj.code.buffer
		})
	}
}

// Initialize the screen draw functions
const initDrawScreens = (dirt) => {
	const title = () => {
		let titleText = "MINEKHAN"
		let subtext = "JAVASCRIPT EDITION"
		let font = "monospace"
		strokeWeight(1)
		state.ctx.textAlign = 'center'
		const scale = Math.min(state.width / 600, 1.5)
		for (let i = 0; i < 15; i++) {
			if (i < 12) fill(i * 10)
			else if (i > 11) fill(125)
			state.ctx.font = `bold ${80 * scale + i}px ${font}`
			text(titleText, state.width / 2, 158 - i)
			state.ctx.font = `bold ${32 * scale + i/4}px ${font}`
			text(subtext, state.width / 2, 140 + 60 * scale - i / 2)
		}
	}
	const clear = () => state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height)

	state.drawScreens["main menu"] = () => {
		state.ctx.clearRect(0, 0, state.width, state.height)
		title()
		fill(220)
		state.ctx.font = "20px monospace"
		state.ctx.textAlign = 'left'
		text("MineKhan " + state.version, state.width - (state.width - 2), state.height - 2)
	}
	state.drawScreens.play = () => {
		let renderStart = performance.now()
		state.p.setDirection()
		state.world.render()
		state.analytics.totalRenderTime += performance.now() - renderStart
	}
	state.drawScreens.loading = () => {
		let standing = true
		let cx = state.p.x >> 4
		let cz = state.p.z >> 4
		for (let x = cx - 1; x <= cx + 1; x++) {
			for (let z = cz - 1; z <= cz + 1; z++) {
				if (!state.world.getChunk(x * 16, z * 16).buffer) standing = false
			}
		}
		if (!standing) {
			state.world.tick()
		} else {
			play()
			if (state.p.y === 0 && !state.p.flying && !state.p.spectator) {
				state.p.y = state.world.getChunk(state.p.x|0, state.p.z|0).tops[(state.p.x & 15) * 16 + (state.p.z & 15)] + 2
			}
			return
		}
		let progress = Math.round(100 * state.generatedChunks / 9)
		document.getElementById("loading-text").textContent = `Loading... ${progress}% complete (${state.generatedChunks} / 9)`
	}
	state.drawScreens.pause = () => { strokeWeight(1); clear() }
	state.drawScreens.options = () => { clear() }
	state.drawScreens["creation menu"] = () => {
		clear(); state.ctx.textAlign = 'center'; textSize(20); fill(255)
		text("Create New World", state.width / 2, 20)
	}
	state.drawScreens["loadsave menu"] = () => {
		clear(); state.ctx.textAlign = 'center'; textSize(20); fill(255)
		text("Select World", state.width / 2, 20)
	}
	state.drawScreens.editworld = dirt
	state.drawScreens["multiplayer menu"] = () => {
		clear(); state.ctx.textAlign = 'center'; textSize(20); fill(255)
		text("Select Server", state.width / 2, 20)
	}
	state.drawScreens.controls = () => {
		clear(); state.ctx.textAlign = 'center'; textSize(20); fill(255)
		text("Controls", state.width / 2, 20)
	}
	state.drawScreens.changelog = () => {
		clear(); state.ctx.textAlign = 'center'; textSize(20); fill(255)
		text("Change Log", state.width / 2, 20)
	}
}

export { changeScene, getPointer, releasePointer, play, save, initDrawScreens }
