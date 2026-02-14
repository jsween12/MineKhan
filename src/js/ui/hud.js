// hud.js - HUD, crosshair, and debug overlay
import { state } from '../state.js'
import { blockData } from '../blockData.js'

const { floor, round, max, min, sqrt } = Math

const hotbar = () => {
	if (state.screen !== "play") return
	let heldLight = blockData[state.holding].lightLevel / 15 || 0
	state.gl.useProgram(state.program3D)
	state.gl.uniform1f(state.glCache.uLantern, heldLight)
	state.gl.useProgram(state.program3DFogless)
	state.gl.uniform1f(state.glCache.uLanternFogless, heldLight)
}

const crosshair = () => {
	if (state.p.spectator) return
	let x = state.width / 2 + 0.5
	let y = state.height / 2 + 0.5
	state.ctx.lineWidth = 1
	state.ctx.strokeStyle = "white"
	state.ctx.beginPath()
	state.ctx.moveTo(x - 10, y)
	state.ctx.lineTo(x + 10, y)
	state.ctx.moveTo(x, y - 10)
	state.ctx.lineTo(x, y + 10)
	state.ctx.stroke()
}

const hud = (clear) => {
	if (state.p.spectator || state.screen !== "play") return
	if (clear) state.debugLines.length = 0

	let x = 5
	let lineHeight = 24
	let y = lineHeight + 3
	let heightOffset = floor(lineHeight / 5)
	let lines = 0

	if (state.settings.showDebug === 3) {
		state.newDebugLines[0] = "Press F3 to cycle debug info."
		lines = 1
	} else {
		if (state.settings.showDebug >= 1) {
			state.newDebugLines[lines++] = state.analytics.fps + "/" + state.analytics.displayedwFps + "fps, C: " + state.renderedChunks.toLocaleString()
			state.newDebugLines[lines++] = "XYZ: " + state.p2.x + ", " + state.p2.y + ", " + state.p2.z
		}
		if (state.settings.showDebug >= 2) {
			state.newDebugLines[lines++] = "Average Frame Time: " + state.analytics.displayedFrameTime + "ms"
			state.newDebugLines[lines++] = "Worst Frame Time: " + state.analytics.displayedwFrameTime + "ms"
			state.newDebugLines[lines++] = "Render Time: " + state.analytics.displayedRenderTime + "ms"
			state.newDebugLines[lines++] = "Tick Time: " + state.analytics.displayedTickTime + "ms"
			state.newDebugLines[lines++] = "Generated Chunks: " + state.generatedChunks.toLocaleString()
		}
	}
	if (state.p.autoBreak) state.newDebugLines[lines++] = "Super breaker enabled"
	if (state.p.autoBuild) state.newDebugLines[lines++] = "Hyper builder enabled"
	if (state.multiplayer) {
		state.playerDistances.length = 0
		let closest = Infinity
		let cname = "Yourself"
		for (let name in state.playerPositions) {
			let pos = state.playerPositions[name]
			let distance = sqrt((pos.x - state.p2.x) * (pos.x - state.p2.x) + (pos.y - state.p2.y) * (pos.y - state.p2.y) + (pos.z - state.p2.z) * (pos.z - state.p2.z))
			state.playerDistances.push({ name, distance })
			if (distance < closest) { closest = distance; cname = name }
		}
		state.newDebugLines[lines++] = `Closest player: ${cname} (${round(closest)} blocks away)`
	}

	state.ctx.textAlign = 'left'
	for (let i = 0; i < lines; i++) {
		if (state.debugLines[i] !== state.newDebugLines[i]) {
			let start = 0
			if (state.debugLines[i]) {
				for (let j = 0; j < state.debugLines[i].length; j++) {
					if (state.debugLines[i][j] !== state.newDebugLines[i][j]) { start = j; break }
				}
				state.ctx.clearRect(x + start * state.charWidth, y + lineHeight * (i - 1) + heightOffset, (state.debugLines[i].length - start) * state.charWidth, lineHeight)
			}
			state.ctx.fillStyle = "rgba(50, 50, 50, 0.4)"
			state.ctx.fillRect(x + start * state.charWidth, y + lineHeight * (i - 1) + heightOffset, (state.newDebugLines[i].length - start) * state.charWidth, lineHeight)
			state.ctx.fillStyle = "#fff"
			state.ctx.fillText(state.newDebugLines[i].slice(start), x + start * state.charWidth, y + lineHeight * i)
			state.debugLines[i] = state.newDebugLines[i]
		}
	}
	if (lines < state.debugLines.length) {
		let maxWidth = 0
		for (let i = lines; i < state.debugLines.length; i++) {
			maxWidth = Math.max(maxWidth, state.debugLines[i].length)
		}
		state.ctx.clearRect(x, y + (lines - 1) * lineHeight + heightOffset, maxWidth * state.charWidth, lineHeight * (state.debugLines.length - lines))
		state.debugLines.length = lines
	}
}

export { hotbar, crosshair, hud }
