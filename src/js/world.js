// world.js - World class: chunk management, lighting, save/load
import { state, yieldThread } from './state.js'
import { seedHash, randomSeed, noiseProfile } from './random.js'
import { blockData, blockIds, BLOCK_COUNT } from './blockData.js'
import { Chunk } from './chunk.js'
import { BitArrayBuilder, BitArrayReader, decompressString } from './utils.js'
import { InventoryItem, inventory } from './inventory.js'
import { shapes, STAIR, WEST, SOUTH, EAST } from './shapes.js'
import { animateTextures } from './texture.js'
import { renderChatAlerts } from './ui/chat.js'
import { hud } from './ui/hud.js'
import { initModelView, drawHitbox, use3d } from './renderer.js'

const { round, min, max, abs } = Math

const chunkDist = (c) => {
	let p = state.p
	let dx = p.x - c.x; let dz = p.z - c.z
	if (dx > 16) dx -= 16; else if (dx > 0) dx = 0
	if (dz > 16) dz -= 16; else if (dz > 0) dz = 0
	return Math.sqrt(dx * dx + dz * dz)
}
const sortChunks = (c1, c2) => {
	let p = state.p
	let dx1 = p.x - c1.x - 8; let dy1 = p.z - c1.z - 8
	let dx2 = p.x - c2.x - 8; let dy2 = p.z - c2.z - 8
	return dx1*dx1+dy1*dy1 - (dx2*dx2+dy2*dy2)
}
const renderFilter = (chunk) => {
	const d = state.settings.renderDistance + Math.SQRT1_2
	return chunk.distSq <= d * d
}
const debug = (message) => {
	let ellapsed = performance.now() - debug.start
	if (ellapsed > 30) console.log(message, ellapsed.toFixed(2), "milliseconds")
}

const fillReqs = (x, z, world) => {
	let done = true
	for (let i = x - 4; i <= x + 4; i++) {
		for (let j = z - 4; j <= z + 4; j++) {
			let chunk = world.loaded[(i + world.offsetX) * world.lwidth + j + world.offsetZ]
			if (!chunk.generated) { world.generateQueue.push(chunk); done = false }
			if (!chunk.populated && i >= x-3 && i <= x+3 && j >= z-3 && j <= z+3) { world.populateQueue.push(chunk); done = false }
			if (!chunk.loaded && i >= x-2 && i <= x+2 && j >= z-2 && j <= z+2) {
				if (world.loadFrom[`${chunk.x >> 4},${chunk.z >> 4}`]) { world.loadQueue.push(chunk); done = false }
				else chunk.load()
			}
			if (!chunk.lit && i >= x-1 && i <= x+1 && j >= z-1 && j <= z+1) { world.lightingQueue.push(chunk); done = false }
		}
	}
	return done
}

class World {
	constructor(empty) {
		if (!empty) this.setSeed(Math.random() * 2000000000 | 0)
		state.generatedChunks = 0
		state.fogDist = 16
		this.loaded = []
		this.sortedChunks = []
		this.doubleRenderChunks = []
		this.offsetX = 0; this.offsetZ = 0; this.lwidth = 0
		this.chunkGenQueue = []; this.populateQueue = []; this.generateQueue = []
		this.lightingQueue = []; this.loadQueue = []; this.meshQueue = []
		this.loadFrom = {}; this.entities = []
		this.lastChunk = ","
		this.caves = state.caves
		this.initTime = Date.now(); this.tickCount = 0
		this.settings = state.settings
		this.lastTick = performance.now()
		this.rivers = true
	}
	setSeed(seed) {
		this.seed = seed; seedHash(seed); noiseProfile.noiseSeed(seed)
		while (state.win.workers.length) state.win.doWork({ seed })
	}
	updateBlock(x, y, z) {
		const chunk = this.loaded[((x >> 4) + this.offsetX) * this.lwidth + (z >> 4) + this.offsetZ]
		if (chunk.buffer) chunk.updateBlock(x & 15, y, z & 15, this)
	}
	getChunk(x, z) {
		return this.loaded[((x >> 4) + this.offsetX) * this.lwidth + (z >> 4) + this.offsetZ]
	}
	getBlock(x, y, z) {
		if (y > state.maxHeight) return 0
		return this.loaded[((x >> 4) + this.offsetX) * this.lwidth + (z >> 4) + this.offsetZ].getBlock(x & 15, y, z & 15)
	}
	getSurfaceHeight(x, z) {
		return this.loaded[((x >> 4) + this.offsetX) * this.lwidth + (z >> 4) + this.offsetZ].tops[(x & 15) * 16 + (z & 15)]
	}
	spawnBlock(x, y, z, blockID) {
		let chunk = this.loaded[((x >> 4) + this.offsetX) * this.lwidth + (z >> 4) + this.offsetZ]
		x &= 15; z &= 15
		if (!chunk.getBlock(x, y, z)) { chunk.setBlock(x, y, z, blockID); if (y > chunk.maxY) chunk.maxY = y }
	}
	setWorldBlock(x, y, z, blockID) {
		this.loaded[((x >> 4) + this.offsetX) * this.lwidth + (z >> 4) + this.offsetZ].setBlock(x & 15, y, z & 15, blockID, false)
	}
	setBlock(x, y, z, blockID, lazy, remote, doNotLog) {
		const chunkX = (x >> 4) + this.offsetX; const chunkZ = (z >> 4) + this.offsetZ
		let chunk = null
		if (chunkX >= 0 && chunkX < this.lwidth && chunkZ >= 0 && chunkZ < this.lwidth) chunk = this.loaded[chunkX * this.lwidth + chunkZ]
		if (!chunk?.loaded) {
			const str = `${x >> 4},${z >> 4}`
			if (!state.world.loadFrom[str]) state.world.loadFrom[str] = { edits: [] }
			if (!state.world.loadFrom[str].edits) state.world.loadFrom[str].edits = []
			state.world.loadFrom[str].edits[y * 256 + (x&15) * 16 + (z&15)] = blockID
			return
		}
		let xm = x & 15; let zm = z & 15
		if (!remote && !doNotLog) {
			let oldBlock = chunk.getBlock(xm, y, zm)
			state.blockLog[state.currentUser.username].push([x, y, z, blockID, oldBlock, state.now])
		}
		if (blockID) {
			chunk.setBlock(xm, y, zm, blockID, !lazy)
			let data = blockData[blockID]
			if (!lazy && chunk.buffer && (!data.transparent || data.lightLevel) && state.screen !== "loading") this.updateLight(x, y, z, true, data.lightLevel)
		} else {
			let data = blockData[chunk.getBlock(xm, y, zm)]
			chunk.deleteBlock(xm, y, zm, !lazy)
			if (!lazy && chunk.buffer && (!data.transparent || data.lightLevel) && state.screen !== "loading") this.updateLight(x, y, z, false, data.lightLevel)
		}
		if (lazy) return
		if (state.multiplayer && !remote) {
			let data = [x, y, z, blockID]; if (doNotLog) data.push(1)
			state.multiplayer.send(JSON.stringify({ type: "setBlock", data }))
		}
		if (xm && xm !== 15 && zm && zm !== 15) {
			chunk.updateBlock(xm-1,y,zm,this); chunk.updateBlock(xm,y-1,zm,this); chunk.updateBlock(xm+1,y,zm,this)
			chunk.updateBlock(xm,y+1,zm,this); chunk.updateBlock(xm,y,zm-1,this); chunk.updateBlock(xm,y,zm+1,this)
		} else {
			this.updateBlock(x-1,y,z); this.updateBlock(x+1,y,z); this.updateBlock(x,y-1,z)
			this.updateBlock(x,y+1,z); this.updateBlock(x,y,z-1); this.updateBlock(x,y,z+1)
		}
		chunk.updateBlock(xm, y, zm, this)
		if (xm | zm === 0) this.updateBlock(x-1,y,z-1)
		if (xm === 15 && zm === 0) this.updateBlock(x+1,y,z-1)
		if (xm === 0 && zm === 15) this.updateBlock(x-1,y,z+1)
		if (xm & zm === 15) this.updateBlock(x+1,y,z+1)
	}
	getLight(x, y, z, blockLight) {
		let X = (x >> 4) + this.offsetX; let Z = (z >> 4) + this.offsetZ
		if (blockLight === 1) return this.loaded[X * this.lwidth + Z].getBlockLight(x & 15, y, z & 15)
		else if (blockLight === 0) return this.loaded[X * this.lwidth + Z].getSkyLight(x & 15, y, z & 15)
		else return this.loaded[X * this.lwidth + Z].getLight(x & 15, y, z & 15)
	}
	setLight(x, y, z, level, blockLight) {
		let X = (x >> 4) + this.offsetX; let Z = (z >> 4) + this.offsetZ
		if (this.loaded[X * this.lwidth + Z]) {
			if (blockLight === 1) this.loaded[X * this.lwidth + Z].setBlockLight(x & 15, y, z & 15, level)
			else if (blockLight === 0) this.loaded[X * this.lwidth + Z].setSkyLight(x & 15, y, z & 15, level)
			else this.loaded[X * this.lwidth + Z].setLight(x & 15, y, z & 15, level)
		}
	}
	updateLight(x, y, z, place, blockLight = 0) {
		let chunk = this.getChunk(x, z); if (!chunk) return
		let cx = x & 15; let cz = z & 15
		let center = chunk.getSkyLight(cx, y, cz)
		let blight = chunk.getBlockLight(cx, y, cz)
		let up = this.getLight(x,y+1,z,0); let down = this.getLight(x,y-1,z,0)
		let north = this.getLight(x,y,z+1,0); let south = this.getLight(x,y,z-1,0)
		let east = this.getLight(x+1,y,z,0); let west = this.getLight(x-1,y,z,0)
		let spread = []
		if (!place) {
			if (up === 15) {
				for (let i = y; i > 0; i--) {
					if (blockData[chunk.getBlock(cx, i, cz)].transparent) { chunk.setSkyLight(cx, i, cz, 15); spread.push(x, i, z) }
					else break
				}
				chunk.spreadLight(spread, 14, true, 0)
			} else {
				center = max(up, down, north, south, east, west)
				if (center > 0) center -= 1
				this.setLight(x, y, z, center, 0)
				if (center > 1) { spread.push(x, y, z); chunk.spreadLight(spread, center-1, true, 0) }
			}
			if (!blockLight || blockLight < blight) {
				spread.length = 0
				up = this.getLight(x,y+1,z,1); down = this.getLight(x,y-1,z,1)
				north = this.getLight(x,y,z+1,1); south = this.getLight(x,y,z-1,1)
				east = this.getLight(x+1,y,z,1); west = this.getLight(x-1,y,z,1)
				blight = max(up, down, north, south, east, west)
				if (blight > 0) blight -= 1
				this.setLight(x, y, z, blight, 1)
				if (blight > 1) { spread.push(x, y, z); chunk.spreadLight(spread, blight-1, true, 1) }
			}
		} else if (place && (center !== 0 || blight !== 0)) {
			let respread = []; for (let i = 0; i <= 15; i++) respread[i] = []
			chunk.setLight(cx, y, cz, 0); spread.push(x, y, z)
			if (center === 15) {
				for (let i = y-1; i > 0; i--) {
					if (blockData[chunk.getBlock(cx, i, cz)].transparent) { chunk.setSkyLight(cx, i, cz, 0); spread.push(x, i, z) }
					else break
				}
			}
			chunk.unSpreadLight(spread, center-1, respread, 0)
			chunk.reSpreadLight(respread, 0)
			if (blight) {
				respread.length = 0; for (let i = 0; i <= 15; i++) respread[i] = []
				spread.length = 0; spread.push(x, y, z)
				chunk.unSpreadLight(spread, blight-1, respread, 1)
				chunk.reSpreadLight(respread, 1)
			}
		}
		if (place && blockLight) {
			chunk.setBlockLight(cx, y, cz, blockLight)
			spread.length = 0; spread.push(x, y, z)
			chunk.spreadLight(spread, blockLight-1, true, 1)
		} else if (!place && blockLight) {
			chunk.setBlockLight(cx, y, cz, 0); spread.push(x, y, z)
			let respread = []; for (let i = 0; i <= 15; i++) respread[i] = []
			chunk.unSpreadLight(spread, blockLight-1, respread, 1)
			chunk.reSpreadLight(respread, 1)
		}
	}
	async tick() {
		let pnow = performance.now()
		this.tickCount += state.multiplayer ? Math.round((pnow - this.lastTick) / 50) : 1
		this.lastTick = pnow
		if (this.tickCount & 1) { hud(); renderChatAlerts() }
		if (this.addedTime) { this.tickCount += 50; this.addedTime-- }
		let p = state.p
		let maxChunkX = (p.x >> 4) + state.settings.renderDistance
		let maxChunkZ = (p.z >> 4) + state.settings.renderDistance
		let chunk = maxChunkX + "," + maxChunkZ
		if (chunk !== this.lastChunk) { this.lastChunk = chunk; this.loadChunks(); this.chunkGenQueue.sort(sortChunks) }
		if (state.controlMap.breakBlock.pressed && (p.lastBreak < state.now - 250 || p.autoBreak) && state.screen === "play") {
			const { changeWorldBlock } = window.parent.exports["src/js/raytrace.js"]
			changeWorldBlock(0)
		}
		for (let i = 0; i < this.sortedChunks.length; i++) this.sortedChunks[i].tick()
		for (let i = this.entities.length - 1; i >= 0; i--) {
			const entity = this.entities[i]; entity.update()
			if (entity.canDespawn) this.entities.splice(i, 1)
		}
		if (this.ticking) return; this.ticking = true
		let doneWork = true
		while (doneWork && (state.screen === "play" || state.screen === "loading")) {
			doneWork = false; debug.start = performance.now()
			if (this.meshQueue.length) { do { this.meshQueue.pop().genMesh(state.indexBuffer, state.bigArray) } while(this.meshQueue.length); doneWork = true; debug("Meshes") }
			if (this.generateQueue.length && !doneWork) { this.generateQueue.pop().generate(); doneWork = true }
			if (this.populateQueue.length && !doneWork) {
				let ch = this.populateQueue[this.populateQueue.length - 1]
				if (!ch.caves) await ch.carveCaves()
				else { ch.populate(state.details); this.populateQueue.pop() }
				doneWork = true
			}
			if (!doneWork && this.loadQueue.length) { this.loadQueue.pop().load(); doneWork = true }
			if (!doneWork && this.lightingQueue.length) { this.lightingQueue.pop().fillLight(); doneWork = true }
			if (!doneWork && this.chunkGenQueue.length && !this.lightingQueue.length) {
				let ch = this.chunkGenQueue[0]
				if (!fillReqs(ch.x >> 4, ch.z >> 4, this)) {}
				else if (!ch.optimized) { ch.optimize(state.screen); debug("Optimize") }
				else if (!ch.buffer) { ch.genMesh(state.indexBuffer, state.bigArray); debug("Initial mesh") }
				else { this.chunkGenQueue.shift(); state.generatedChunks++ }
				doneWork = true
			}
			if (doneWork) await yieldThread()
		}
		this.ticking = false
	}
	render() {
		let p = state.p; let gl = state.gl
		if (state.controlMap.placeBlock.pressed && (p.lastPlace < state.now - 250 || p.autoBuild)) {
			const { lookingAt, newWorldBlock } = window.parent.exports["src/js/raytrace.js"]
			lookingAt(); newWorldBlock()
		}
		animateTextures(gl)
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
		let time = 0; let delta = performance.now() - this.lastTick
		if (!state.multiplayer && delta > 100) delta = 0
		time = this.tickCount * 50 + delta * (this.addedTime ? 51 : 1)
		state.p2.x = round(p.x); state.p2.y = round(p.y); state.p2.z = round(p.z)
		state.renderedChunks = 0
		let dist = Math.max(state.settings.renderDistance * 16 - 8, 16)
		if (this.chunkGenQueue.length) { let ch = this.chunkGenQueue[0]; dist = min(dist, chunkDist(ch)) }
		if (dist !== state.fogDist) {
			if (state.fogDist < dist - 0.1) state.fogDist += (dist - state.fogDist) / 30
			else if (state.fogDist > dist + 0.1) state.fogDist += (dist - state.fogDist) / 30
			else state.fogDist = dist
		}
		gl.useProgram(state.program3D)
		gl.uniform3f(state.glCache.uPos, p.x, p.y, p.z)
		gl.uniform1f(state.glCache.uDist, state.fogDist)
		gl.useProgram(state.program3DFogless)
		gl.uniform3f(state.glCache.uPosFogless, p.x, p.y, p.z)
		if (state.hitBox.pos) { p.transform(); drawHitbox(p) }
		initModelView(p)
		let c = this.sortedChunks; let glob = { renderedChunks: state.renderedChunks }; let fog = false
		for (let i = 0; i < c.length; i++) {
			if (!fog && state.fogDist < chunkDist(c[i]) + 24) { gl.useProgram(state.program3D); fog = true }
			c[i].render(p, glob)
		}
		state.skybox(time / 1000 + 150, state.matrix)
		use3d()
		gl.useProgram(state.program3DFogless); fog = false
		if (this.doubleRenderChunks.length) {
			gl.depthMask(false); gl.uniform1i(state.glCache.uTransFogless, 1)
			for (let ch of this.doubleRenderChunks) {
				if (!fog && state.fogDist < chunkDist(ch) + 24) {
					gl.uniform1i(state.glCache.uTransFogless, 0); gl.useProgram(state.program3D); gl.uniform1i(state.glCache.uTrans, 1); fog = true
				}
				ch.render(p, glob)
			}
			if (!fog) gl.uniform1i(state.glCache.uTransFogless, 0)
			else gl.uniform1i(state.glCache.uTrans, 0)
			gl.depthMask(true)
		}
		state.renderedChunks = glob.renderedChunks
		gl.disableVertexAttribArray(state.glCache.aSkylight); gl.disableVertexAttribArray(state.glCache.aBlocklight); gl.disableVertexAttribArray(state.glCache.aShadow)
		gl.useProgram(state.programEntity)
		for (let i = this.entities.length - 1; i >= 0; i--) this.entities[i].render()
		if (state.multiplayer) { for (let name in state.playerEntities) state.playerEntities[name].render() }
	}
	loadChunks(cx, cz, sort = true, renderDistance = state.settings.renderDistance + 4) {
		let p = state.p
		cx = cx !== undefined && cx !== null ? cx : p.x >> 4
		cz = cz !== undefined && cz !== null ? cz : p.z >> 4
		p.cx = cx; p.cz = cz
		let minChunkX = cx - renderDistance; let maxChunkX = cx + renderDistance
		let minChunkZ = cz - renderDistance; let maxChunkZ = cz + renderDistance
		this.offsetX = -minChunkX; this.offsetZ = -minChunkZ
		this.lwidth = renderDistance * 2 + 1
		this.chunkGenQueue.length = 0; this.lightingQueue.length = 0
		this.populateQueue.length = 0; this.generateQueue.length = 0
		let chunks = new Map()
		for (let i = this.loaded.length - 1; i >= 0; i--) {
			const chunk = this.loaded[i]; const chunkX = chunk.x >> 4; const chunkZ = chunk.z >> 4
			if (chunkX < minChunkX || chunkX > maxChunkX || chunkZ < minChunkZ || chunkZ > maxChunkZ) { chunk.unload(); delete chunk.blocks; this.loaded.splice(i, 1) }
			else chunks.set(`${chunkX},${chunkZ}`, chunk)
		}
		for (let x = minChunkX; x <= maxChunkX; x++) {
			for (let z = minChunkZ; z <= maxChunkZ; z++) {
				let chunk = chunks.get(`${x},${z}`)
				if (!chunk) { chunk = new Chunk(x * 16, z * 16, this, state.glExtensions, state.gl, state.glCache, state.superflat, state.caves, state.details); this.loaded.push(chunk) }
				const cdx = (chunk.x >> 4) - cx; const cdz = (chunk.z >> 4) - cz
				chunk.distSq = cdx * cdx + cdz * cdz
				if (!chunk.buffer && renderFilter(chunk)) this.chunkGenQueue.push(chunk)
			}
		}
		this.loaded.sort((a, b) => a.x - b.x || a.z - b.z)
		if (sort) {
			this.sortedChunks = this.loaded.filter(renderFilter)
			this.sortedChunks.sort(sortChunks)
			this.doubleRenderChunks = this.sortedChunks.filter(ch => ch.doubleRender)
		}
	}
	unloadChunks() {
		for (let chunk of this.loaded) {
			if (chunk.buffer) { state.gl.deleteBuffer(chunk.buffer); chunk.blocks = null; chunk.light = null }
		}
	}
	getSaveString() {
		let p = state.p
		let bab = new BitArrayBuilder()
		bab.add(this.name.length, 8)
		for (let c of this.name) bab.add(c.charCodeAt(0), 8)
		state.version.split(" ")[1].split(".").map(n => bab.add(+n, 8))
		bab.add(this.seed, 32).add(this.tickCount, 32)
		bab.add(round(p.x), 20).add(Math.min(round(p.y), 511), 9).add(round(p.z), 20)
		bab.add(p.rx * 100, 11).add(p.ry * 100, 11)
		bab.add(p.flying, 1).add(p.spectator, 1)
		bab.add(state.superflat, 1).add(state.caves, 1).add(state.details, 1).add(this.rivers, 1)
		for (let i = 0; i < inventory.playerStorage.size; i++) {
			const item = inventory.playerStorage.items[i]
			bab.add(item?.id || 0, 16).add(item?.stackSize - 1 || 0, 6)
		}
		bab.add(inventory.hotbar.index - inventory.hotbar.start, 4)
		for (let chunk of this.loaded) { let chunkData = chunk.getSave(); if (chunkData) bab.append(chunkData) }
		for (let coords in this.loadFrom) {
			const [x, z] = coords.split(",").map(n => n * 16)
			const chunk = new Chunk(x, z, this, state.glExtensions, state.gl, state.glCache, state.superflat, state.caves)
			if (this.version < "Alpha 0.8.1" || this.loadFrom[coords].edits) {
				chunk.blocks.fill(-1); chunk.originalBlocks = chunk.blocks.slice(); chunk.load()
			} else { chunk.originalBlocks = { length: 1 }; chunk.saveData = this.loadFrom[coords] }
			bab.append(chunk.getSave())
		}
		return bab.array
	}
	loadSave(data) {
		let p = state.p
		if (typeof data === "string") {
			if (data.includes("Alpha")) { try { return this.loadOldSave(data) } catch(e) { alert("Unable to load save string.") } }
			try {
				let bytes = atob(decompressString(data))
				let arr = new Uint8Array(bytes.length)
				for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
				data = arr
			} catch(e) { alert("Malformatted save string."); throw e }
		}
		const reader = new BitArrayReader(data)
		const nameLen = reader.read(8); this.name = ""
		for (let i = 0; i < nameLen; i++) this.name += String.fromCharCode(reader.read(8))
		reader.bit += 287; let version = reader.read(24); reader.bit -= 311
		let paletteLen = 0; let palette = []; let paletteBits = 0
		if (version === 0x800) {
			this.rivers = false; this.setSeed(reader.read(32)); this.tickCount = reader.read(32)
			p.x = reader.read(20, true); p.y = reader.read(8); p.z = reader.read(20, true)
			p.rx = reader.read(11, true) / 100; p.ry = reader.read(11, true) / 100
			for (let i = 0; i < 9; i++) { let id = reader.read(16); if (!blockData[id]) id = blockIds.pumpkin; inventory.playerStorage.setItem(id, i + inventory.hotbar.start) }
			inventory.hotbar.index = reader.read(4) + inventory.hotbar.start
			p.flying = reader.read(1); p.spectator = reader.read(1)
			state.superflat = reader.read(1); state.caves = reader.read(1); state.details = reader.read(1)
			reader.bit += 24; paletteLen = reader.read(16); paletteBits = BitArrayBuilder.bits(paletteLen)
			for (let i = 0; i < paletteLen; i++) {
				let id = reader.read(16)
				if (id & STAIR) { let rot = id & 0x1800; id ^= rot; if (!rot) id |= WEST; else if (rot === WEST) id |= SOUTH; else if (rot === SOUTH) id |= EAST }
				palette.push(id)
			}
			reader.bit += 32
		} else {
			version = reader.read(24); this.setSeed(reader.read(32)); this.tickCount = reader.read(32)
			p.x = reader.read(20, true); p.y = reader.read(9); p.z = reader.read(20, true)
			p.rx = reader.read(11, true) / 100; p.ry = reader.read(11, true) / 100
			p.flying = reader.read(1); p.spectator = reader.read(1)
			state.superflat = reader.read(1); state.caves = reader.read(1); state.details = reader.read(1); this.rivers = reader.read(1)
			for (let i = 0; i < 36; i++) {
				let id = reader.read(16); let stack = reader.read(6) + 1
				if (!blockData[id]) id = blockIds.pumpkin
				inventory.playerStorage.setItem(id ? new InventoryItem(id, blockData[id].name, stack, blockData[id].iconImg) : null, i)
			}
			inventory.hotbar.index = reader.read(4) + inventory.hotbar.start
		}
		this.version = "Alpha " + [version >> 16, version >> 8 & 0xff, version & 0xff].join(".")
		const getIndex = [
			(index, x, y, z) => (y + (index >> 6 & 7))*256 + (x + (index >> 3 & 7))*16 + z + (index >> 0 & 7),
			(index, x, y, z) => (y + (index >> 6 & 7))*256 + (x + (index >> 0 & 7))*16 + z + (index >> 3 & 7),
			(index, x, y, z) => (y + (index >> 3 & 7))*256 + (x + (index >> 6 & 7))*16 + z + (index >> 0 & 7),
			(index, x, y, z) => (y + (index >> 0 & 7))*256 + (x + (index >> 6 & 7))*16 + z + (index >> 3 & 7),
			(index, x, y, z) => (y + (index >> 0 & 7))*256 + (x + (index >> 3 & 7))*16 + z + (index >> 6 & 7),
			(index, x, y, z) => (y + (index >> 3 & 7))*256 + (x + (index >> 0 & 7))*16 + z + (index >> 6 & 7)
		]
		if (reader.bit >= reader.data.length * 8 - 37) return
		let chunks = {}; let previousChunk = null
		while (reader.bit < reader.data.length * 8 - 37) {
			let startPos = reader.bit
			let x = reader.read(16, true) * 8; let y = reader.read(5, false) * 8; let z = reader.read(16, true) * 8
			if (version > 0x800) {
				paletteLen = reader.read(9); paletteBits = BitArrayBuilder.bits(paletteLen); palette = []
				for (let i = 0; i < paletteLen; i++) palette.push(reader.read(16))
			}
			let orientation = reader.read(3)
			let cx = x >> 4; let cz = z >> 4
			x = x !== cx * 16 ? 8 : 0; z = z !== cz * 16 ? 8 : 0
			let ckey = `${cx},${cz}`; let chunk = chunks[ckey]
			if (!chunk) {
				if (previousChunk) previousChunk.endPos = startPos
				if (version >= 0x801) chunks[ckey] = chunk = { reader, startPos, blocks: [], endPos: 0 }
				else chunks[ckey] = chunk = { blocks: [] }
				previousChunk = chunk
			}
			let runs = reader.read(8); let singles = reader.read(9)
			for (let j = 0; j < runs; j++) {
				let index = reader.read(9); let types = reader.read(9); let lenSize = reader.read(4)
				for (let k = 0; k < types; k++) { let chain = reader.read(lenSize) + 1; let block = reader.read(paletteBits); for (let l = 0; l < chain; l++) { chunk.blocks[getIndex[orientation](index, x, y, z)] = palette[block]; index++ } }
			}
			for (let j = 0; j < singles; j++) { let index = reader.read(9); let block = reader.read(paletteBits); chunk.blocks[getIndex[orientation](index, x, y, z)] = palette[block] }
		}
		previousChunk.endPos = reader.bit
		this.loadFrom = chunks
	}
	loadOldSave(str) {
		let p = state.p
		this.rivers = false; let data = str.split(";")
		this.name = data.shift(); this.setSeed(parseInt(data.shift(), 36))
		let playerData = data.shift().split(",")
		p.x = parseInt(playerData[0], 36); p.y = parseInt(playerData[1], 36); p.z = parseInt(playerData[2], 36)
		p.rx = parseInt(playerData[3], 36) / 100; p.ry = parseInt(playerData[4], 36) / 100
		let options = parseInt(playerData[5], 36)
		p.flying = options & 1; p.spectator = options >> 2 & 1
		state.superflat = options >> 1 & 1; state.caves = options >> 3 & 1; state.details = options >> 4 & 1
		let version = data.shift(); this.version = version
		let palette = data.shift().split(",").map(n => parseInt(n, 36))
		let chunks = {}
		for (let i = 0; data.length; i++) {
			let blocks = data.shift().split(",")
			let cx = parseInt(blocks.shift(), 36); let cy = parseInt(blocks.shift(), 36); let cz = parseInt(blocks.shift(), 36)
			let s = `${cx},${cz}`; if (!chunks[s]) chunks[s] = { blocks: [] }
			let chunk = chunks[s].blocks
			for (let j = 0; j < blocks.length; j++) {
				let block = parseInt(blocks[j], 36)
				let x = block >> 8 & 15; let y = block >> 4 & 15; let z = block & 15
				let index = (cy * 16 + y) * 256 + x * 16 + z; let pid = block >> 12
				let id = palette[pid]
				if (id & STAIR) { let rot = id & 0x1800; id ^= rot; if (!rot) id |= WEST; else if (rot === WEST) id |= SOUTH; else if (rot === SOUTH) id |= EAST }
				chunk[index] = id
			}
		}
		this.loadFrom = chunks
	}
}

export { World, chunkDist, sortChunks }
