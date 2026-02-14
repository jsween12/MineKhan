// raytrace.js - Ray tracing, block targeting, and block interaction
import { state } from './state.js'
import { blockData } from './blockData.js'
import { shapes, FLIP, SOUTH, EAST, WEST } from './shapes.js'
import { roundBits } from './utils.js'

const { round } = Math

const rayTrace = (x, y, z, shape) => {
	let p = state.p
	let cf, cd = 1e9
	let m, ix, iy, iz
	let minX, minY, minZ, maxX, maxY, maxZ, min, max
	let dx = p.direction.x < 0
	let dy = p.direction.y < 0
	let dz = p.direction.z < 0
	let verts = shape.verts
	let faces = verts[0]

	if (dy) faces = verts[1]
	if (p.direction.y) {
		for (let face of faces) {
			min = face.min; minX = min[0]; minZ = min[2]
			max = face.max; maxX = max[0]; maxZ = max[2]
			m = (y + face[1] - p.y) / p.direction.y
			ix = m * p.direction.x + p.x
			iz = m * p.direction.z + p.z
			if (m > 0 && m < cd && ix >= x + minX && ix <= x + maxX && iz >= z + minZ && iz <= z + maxZ) {
				cd = m; cf = dy ? "top" : "bottom"
			}
		}
	}

	if (dx) faces = verts[4]
	else faces = verts[5]
	if (p.direction.x) {
		for (let face of faces) {
			min = face.min; minY = min[1]; minZ = min[2]
			max = face.max; maxY = max[1]; maxZ = max[2]
			m = (x + face[0] - p.x) / p.direction.x
			iy = m * p.direction.y + p.y
			iz = m * p.direction.z + p.z
			if (m > 0 && m < cd && iy >= y + minY && iy <= y + maxY && iz >= z + minZ && iz <= z + maxZ) {
				cd = m; cf = dx ? "east" : "west"
			}
		}
	}

	if (dz) faces = verts[2]
	else faces = verts[3]
	if (p.direction.z) {
		for (let face of faces) {
			min = face.min; minX = min[0]; minY = min[1]
			max = face.max; maxX = max[0]; maxY = max[1]
			m = (z + face[2] - p.z) / p.direction.z
			ix = m * p.direction.x + p.x
			iy = m * p.direction.y + p.y
			if (m > 0 && m < cd && ix >= x + minX && ix <= x + maxX && iy >= y + minY && iy <= y + maxY) {
				cd = m; cf = dz ? "north" : "south"
			}
		}
	}
	return [cd, cf]
}

const runRayTrace = (x, y, z) => {
	let block = state.world.getBlock(x, y, z)
	if (block) {
		let shape = blockData[block].shape
		if (shape.getShape) shape = shape.getShape(x, y, z, state.world, blockData)
		let rt = rayTrace(x, y, z, shape)
		if (rt[1] && rt[0] < state.hitBox.closest) {
			state.hitBox.closest = rt[0]
			state.hitBox.face = rt[1]
			state.hitBox.pos = [x, y, z]
			state.hitBox.shape = shape
		}
	}
}

const lookingAt = () => {
	state.hitBox.pos = null
	state.hitBox.closest = 1e9
	let p = state.p
	if (p.spectator) return
	let blockState = state.world.getBlock(state.p2.x, state.p2.y, state.p2.z)
	if (blockState) {
		state.hitBox.pos = [state.p2.x, state.p2.y, state.p2.z]
		state.hitBox.closest = 0
		state.hitBox.shape = blockData[blockState].shape
		return
	}
	let pd = p.direction
	let minX = state.p2.x, maxX = 0
	let minY = state.p2.y, maxY = 0
	let minZ = state.p2.z, maxZ = 0
	for (let i = 0; i < state.settings.reach + 1; i++) {
		if (i > state.settings.reach) i = state.settings.reach
		maxX = round(p.x + pd.x * i)
		maxY = round(p.y + pd.y * i)
		maxZ = round(p.z + pd.z * i)
		if (maxX === minX && maxY === minY && maxZ === minZ) continue
		if (minX !== maxX) {
			if (minY !== maxY) {
				if (minZ !== maxZ) runRayTrace(maxX, maxY, maxZ)
				runRayTrace(maxX, maxY, minZ)
			}
			if (minZ !== maxZ) runRayTrace(maxX, minY, maxZ)
			runRayTrace(maxX, minY, minZ)
		}
		if (minY !== maxY) {
			if (minZ !== maxZ) runRayTrace(minX, maxY, maxZ)
			runRayTrace(minX, maxY, minZ)
		}
		if (minZ !== maxZ) runRayTrace(minX, minY, maxZ)
		if (state.hitBox.pos) return
		minZ = maxZ; minY = maxY; minX = maxX
	}
}

const changeWorldBlock = (t, x, y, z) => {
	if (!state.hitBox.pos) return
	x = x !== undefined && x !== null ? x : state.hitBox.pos[0]
	y = y !== undefined && y !== null ? y : state.hitBox.pos[1]
	z = z !== undefined && z !== null ? z : state.hitBox.pos[2]
	if (y <= 0 || y >= state.maxHeight) return
	let p = state.p
	const data = blockData[t]
	if (t && data.rotate) {
		let pi = Math.PI / 4
		if (p.ry <= pi || p.ry >= 7 * pi) t |= WEST
		else if (p.ry < 3 * pi) t |= SOUTH
		else if (p.ry < 5 * pi) t |= EAST
	}
	if (t && data.flip && state.hitBox.face !== "top" && (state.hitBox.face === "bottom" || (p.direction.y * state.hitBox.closest + p.y) % 1 < 0.5)) {
		t |= FLIP
	}
	const newBlock = blockData[t]
	if (newBlock.solid) {
		const verts = newBlock.shape.verts
		let [ny, py, pz, nz, px, nx] = [0.5, -0.5, -0.5, 0.5, -0.5, 0.5]
		for (let face of verts[0]) ny = Math.min(ny, face[1])
		for (let face of verts[1]) py = Math.max(py, face[1])
		for (let face of verts[2]) pz = Math.max(pz, face[2])
		for (let face of verts[3]) nz = Math.min(nz, face[2])
		for (let face of verts[4]) px = Math.max(px, face[0])
		for (let face of verts[5]) nx = Math.min(nx, face[0])
		let pny = roundBits(p.y - p.bottomH - y)
		let ppy = roundBits(p.y + p.topH - y)
		let pnx = p.x - p.w - x
		let ppx = p.x + p.w - x
		let pnz = p.z - p.w - z
		let ppz = p.z + p.w - z
		if (ppx > nx && ppy > ny && ppz > nz && pnx < px && pny < py && pnz < pz) return
	}
	state.world.setBlock(x, y, z, t, 0)
	if (t) p.lastPlace = state.now
	else p.lastBreak = state.now
}

const newWorldBlock = () => {
	if (!state.hitBox.pos || !state.holding) return
	let [x, y, z] = state.hitBox.pos
	switch (state.hitBox.face) {
		case "top": y += 1; break
		case "bottom": y -= 1; break
		case "south": z -= 1; break
		case "north": z += 1; break
		case "west": x -= 1; break
		case "east": x += 1; break
	}
	let oldBlock = state.world.getBlock(x, y, z)
	if (y < state.maxHeight && y >= 0 && (!oldBlock || blockData[oldBlock].shape === shapes.flower) && oldBlock !== state.holding) {
		changeWorldBlock(state.holding, x, y, z)
	}
}

export { rayTrace, lookingAt, changeWorldBlock, newWorldBlock }
